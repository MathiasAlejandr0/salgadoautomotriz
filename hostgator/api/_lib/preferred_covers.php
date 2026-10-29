<?php
declare(strict_types=1);

/**
 * Portada preferida por stock_id.
 *
 * Regla de Mathias: el frente del vehículo completo. Primero un 3/4 frontal
 * mirando a la derecha; si no hay, un 3/4 frontal a la izquierda; si no, el
 * frontal directo. Nunca interior, tablero, maletero ni trasera.
 *
 * La identidad es estable: id de Drive o carpeta/archivo curado (NN.webp).
 * No es la posición. La foto elegida pasa a sort_order 0 y el resto se corre
 * sin cambiar su orden relativo. No se borra ni se renombra ninguna foto.
 *
 * El mapa vive en preferred_covers.json (lo leen también el build de Next).
 */

function preferred_cover_tokens(): array
{
    static $map = null;
    if ($map !== null) {
        return $map;
    }
    $raw = file_get_contents(__DIR__ . '/preferred_covers.json');
    if ($raw === false) {
        throw new RuntimeException('No se pudo leer preferred_covers.json');
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('preferred_covers.json no es un objeto');
    }
    $map = [];
    foreach ($decoded as $stockId => $token) {
        $map[(string) $stockId] = $token;
    }
    return $map;
}

function preferred_cover_token(string $stockId): ?string
{
    $token = preferred_cover_tokens()[$stockId] ?? null;
    if (!is_string($token)) {
        return null;
    }
    if (!preg_match('/^(?:drive:[A-Za-z0-9_-]{16,128}|curated:[a-f0-9]{12}\/\d{2})$/', $token)) {
        return null;
    }
    return $token;
}

function image_matches_cover_token(array $img, string $token): bool
{
    if (str_starts_with($token, 'drive:')) {
        $id = substr($token, 6);
        $driveId = trim((string) ($img['drive_file_id'] ?? ''));
        if ($driveId !== '' && $driveId === $id) {
            return true;
        }
        foreach (['storage_path', 'thumb_path'] as $field) {
            if (path_has_drive_id((string) ($img[$field] ?? ''), $id)) {
                return true;
            }
        }
        return false;
    }
    if (str_starts_with($token, 'curated:')) {
        $rel = substr($token, 8);
        foreach (['storage_path', 'thumb_path'] as $field) {
            if (path_has_curated_file((string) ($img[$field] ?? ''), $rel)) {
                return true;
            }
        }
    }
    return false;
}

function path_has_drive_id(string $path, string $id): bool
{
    if ($path === '' || $id === '') {
        return false;
    }
    $q = preg_quote($id, '~');
    if (preg_match('~/uploads/drive/' . $q . '(?:_t)?\.(?:webp|jpe?g|png)(?:$|[?#])~i', $path)) {
        return true;
    }
    if (preg_match('~googleusercontent\.com/d/' . $q . '(?:[=/?#]|$)~', $path)) {
        return true;
    }
    return (bool) preg_match('~[?&]id=' . $q . '(?:&|$)~', $path);
}

function path_has_curated_file(string $path, string $rel): bool
{
    if ($path === '' || $rel === '') {
        return false;
    }
    $q = preg_quote($rel, '~');
    return (bool) preg_match('~/uploads/curated/' . $q . '(?:_t)?\.webp(?:$|[?#])~i', $path);
}

/**
 * Orden de galería. Si hay portada preferida y la foto está en el set, queda
 * primera. Si no está, el orden de entrada (por sort_order) se conserva.
 *
 * @param array<int, array> $images
 * @return array<int, array>
 */
function with_preferred_cover(array $images, string $stockId): array
{
    $sorted = cover_images_in_order($images);
    $token = preferred_cover_token($stockId);
    if ($token === null) {
        return $sorted;
    }
    $idx = null;
    foreach ($sorted as $i => $img) {
        if (image_matches_cover_token($img, $token)) {
            $idx = $i;
            break;
        }
    }
    if ($idx === null) {
        return $sorted;
    }
    if ($idx !== 0) {
        $chosen = $sorted[$idx];
        array_splice($sorted, $idx, 1);
        array_unshift($sorted, $chosen);
    }
    foreach ($sorted as $i => &$img) {
        $img['sort_order'] = $i;
    }
    unset($img);
    return $sorted;
}

/**
 * @param array<int, mixed> $images
 * @return array<int, array>
 */
function cover_images_in_order(array $images): array
{
    $indexed = [];
    foreach (array_values($images) as $i => $img) {
        if (!is_array($img)) {
            continue;
        }
        $indexed[] = ['img' => $img, 'seq' => $i];
    }
    usort($indexed, static function (array $a, array $b): int {
        $sa = (int) ($a['img']['sort_order'] ?? 0);
        $sb = (int) ($b['img']['sort_order'] ?? 0);
        if ($sa !== $sb) {
            return $sa <=> $sb;
        }
        return $a['seq'] <=> $b['seq'];
    });
    return array_map(static fn (array $row): array => $row['img'], $indexed);
}

/**
 * Filas del sync de Drive: [ruta, miniatura, id]. La elegida queda primera.
 *
 * @param array<int, array{0: string, 1: ?string, 2?: ?string}> $rows
 * @return array<int, array{0: string, 1: mixed, 2: mixed}>
 */
function order_drive_image_rows(array $rows, string $stockId): array
{
    $images = [];
    foreach (array_values($rows) as $i => $row) {
        $fileId = $row[2] ?? null;
        $images[] = [
            'storage_path' => (string) ($row[0] ?? ''),
            'thumb_path' => $row[1] ?? null,
            'drive_file_id' => $fileId === null || $fileId === '' ? null : (string) $fileId,
            'sort_order' => $i,
        ];
    }
    $out = [];
    foreach (with_preferred_cover($images, $stockId) as $img) {
        $out[] = [$img['storage_path'], $img['thumb_path'], $img['drive_file_id']];
    }
    return $out;
}

/**
 * Pares curados [ruta, miniatura] en el orden publicado. Si la portada
 * preferida es otro NN.webp de esta carpeta, ese archivo abre el mapa y el
 * resto conserva el orden numérico. Si esa foto no está en el set, el mapa
 * sigue 01, 02, 03… Los nombres no cambian.
 *
 * @param array<int, array{0: string, 1: string}> $pairs
 * @return array<int, array{0: string, 1: mixed}>
 */
function order_curated_pairs(array $pairs, string $stockId): array
{
    $images = [];
    foreach (array_values($pairs) as $i => $pair) {
        $images[] = [
            'storage_path' => (string) ($pair[0] ?? ''),
            'thumb_path' => $pair[1] ?? null,
            'sort_order' => $i,
        ];
    }
    $out = [];
    foreach (with_preferred_cover($images, $stockId) as $img) {
        $out[] = [$img['storage_path'], $img['thumb_path']];
    }
    return $out;
}

/**
 * Deja la portada preferida en la base. Idempotente. No borra filas.
 * Corre aunque el auto tenga photos_locked: el sync siguiente no la pisa.
 */
function persist_preferred_cover(PDO $pdo, string $vehicleId, string $stockId): bool
{
    if ($vehicleId === '' || preferred_cover_token($stockId) === null) {
        return false;
    }
    $list = $pdo->prepare(
        'SELECT id, storage_path, thumb_path, drive_file_id, sort_order
         FROM vehicle_images WHERE vehicle_id = ? ORDER BY sort_order ASC, created_at ASC, id ASC'
    );
    $list->execute([$vehicleId]);
    $rows = $list->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) < 2) {
        return false;
    }
    $next = with_preferred_cover($rows, $stockId);
    $changed = false;
    foreach ($rows as $i => $row) {
        if ((string) $row['id'] !== (string) $next[$i]['id'] || (int) $row['sort_order'] !== (int) $next[$i]['sort_order']) {
            $changed = true;
            break;
        }
    }
    if (!$changed) {
        return false;
    }
    $set = $pdo->prepare('UPDATE vehicle_images SET sort_order = ? WHERE id = ? AND vehicle_id = ?');
    $ownTx = !$pdo->inTransaction();
    if ($ownTx) {
        $pdo->beginTransaction();
    }
    try {
        foreach ($next as $img) {
            $set->execute([(int) $img['sort_order'], $img['id'], $vehicleId]);
        }
        if ($ownTx) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($ownTx && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    return true;
}

/** Reaplica la portada de cada stock del mapa que exista en vehicles. */
function apply_preferred_covers(PDO $pdo): int
{
    $find = $pdo->prepare('SELECT id FROM vehicles WHERE stock_id = ? LIMIT 1');
    $changed = 0;
    foreach (preferred_cover_tokens() as $stockId => $_token) {
        $stockId = (string) $stockId;
        if (preferred_cover_token($stockId) === null) {
            continue;
        }
        $find->execute([$stockId]);
        $vehicleId = $find->fetchColumn();
        if ($vehicleId === false) {
            continue;
        }
        if (persist_preferred_cover($pdo, (string) $vehicleId, $stockId)) {
            $changed++;
        }
    }
    return $changed;
}
