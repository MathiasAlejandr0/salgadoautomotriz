<?php
declare(strict_types=1);

/*
 * Sincroniza la pestaña "SALGADO AUTOMOTRIZ" de la planilla + fotos de Drive
 * hacia MySQL. La planilla manda: lo que no está en la planilla se ARCHIVA
 * (status Vendido, published 0; no se borra ni pierde fotos). Solo toca
 * vehículos con source='sheet'; los creados en el admin no se tocan.
 * Fotos de Drive: se copian a /uploads/drive como WebP + miniatura (GD).
 * Fotos subidas a mano o con orden/portada fijada en el admin (photos_locked) no se tocan.
 *
 * cPanel → Cron Jobs (cada 10 min):
 *   /usr/local/bin/php /home/<usuario>/public_html/api/_cron/sync.php >/dev/null 2>&1
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

require dirname(__DIR__) . '/_lib/app.php';
require dirname(__DIR__) . '/_lib/specs.php';
require dirname(__DIR__) . '/_lib/media.php';

const PLACEHOLDER = '/placeholder-car.svg';

function http_get(string $url, int $tries = 3): string
{
    $last = null;
    for ($i = 1; $i <= $tries; $i++) {
        try {
            return http_get_once($url);
        } catch (RuntimeException $e) {
            $last = $e;
            if ($i < $tries) {
                usleep(400000 * $i);
            }
        }
    }
    throw $last ?? new RuntimeException("GET {$url} falló");
}

function http_get_once(string $url): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; SalgadoAutomotriz/1.1)',
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        $safe = preg_replace('/([?&]key=)[^&]+/', '$1***', $url);
        throw new RuntimeException("GET {$safe} respondió {$code}");
    }
    return (string) $body;
}

function google_id($v, string $fallback): string
{
    $id = trim((string) ($v ?: $fallback));
    return preg_match('/^[a-zA-Z0-9_-]{20,128}$/', $id) ? $id : $fallback;
}

function fold($v): string
{
    return strtoupper(trim(fold_accents((string) ($v ?? ''))));
}

function parse_csv_text(string $text): array
{
    $h = fopen('php://temp', 'r+');
    fwrite($h, $text);
    rewind($h);
    $rows = [];
    while (($row = fgetcsv($h, 0, ',', '"', '')) !== false) {
        $rows[] = $row;
    }
    fclose($h);
    return $rows;
}

function col(array $header, string ...$needles): int
{
    foreach ($header as $i => $cell) {
        $label = fold($cell);
        foreach ($needles as $n) {
            if ($label !== '' && str_contains($label, $n)) {
                return (int) $i;
            }
        }
    }
    return -1;
}

function clean_plate($raw): string
{
    $compact = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', (string) $raw) ?? '');
    $candidates = strlen($compact) === 7 ? [$compact, substr($compact, 0, 6)] : [$compact];
    foreach ($candidates as $p) {
        if (strlen($p) >= 5 && strlen($p) <= 6 && preg_match('/^[A-Z]{2,4}\d{2,4}$/', $p)) {
            return $p;
        }
    }
    return '';
}

const BRANDS = [
    'MERCEDES BENZ' => 'Mercedes-Benz', 'MERCEDES-BENZ' => 'Mercedes-Benz', 'MERCEDEZ' => 'Mercedes-Benz',
    'KIA MOTORS' => 'Kia', 'KIA' => 'Kia', 'VW' => 'Volkswagen', 'VOLSWAGEN' => 'Volkswagen', 'VOLKSWAGEN' => 'Volkswagen',
    'SSANYONG' => 'SsangYong', 'SSANGYONG' => 'SsangYong', 'GREAT WALL' => 'Great Wall', 'CHEVROLET' => 'Chevrolet',
    'HYUNDAI' => 'Hyundai', 'PEUGEOT' => 'Peugeot', 'TOYOTA' => 'Toyota', 'NISSAN' => 'Nissan', 'MITSUBISHI' => 'Mitsubishi',
    'RENAULT' => 'Renault', 'SUZUKI' => 'Suzuki', 'CHERY' => 'Chery', 'FORD' => 'Ford', 'MAXUS' => 'Maxus',
    'DONGFENG' => 'Dongfeng', 'DONGBENG' => 'Dongfeng', 'FOTON' => 'Foton', 'GEELY' => 'Geely', 'JETOUR' => 'Jetour',
    'VOLVO' => 'Volvo', 'OPEL' => 'Opel', 'JAC' => 'JAC', 'JMC' => 'JMC', 'MG' => 'MG', 'MINI' => 'MINI', 'BMW' => 'BMW',
];

function clean_brand($raw): string
{
    $key = preg_replace('/\s+/', ' ', fold($raw)) ?? '';
    if ($key === '') {
        return '';
    }
    if (isset(BRANDS[$key])) {
        return BRANDS[$key];
    }
    return implode(' ', array_map(
        fn ($w) => strlen($w) <= 3 ? strtoupper($w) : ucfirst($w),
        explode(' ', strtolower($key))
    ));
}

function parse_clp($raw): int
{
    $s = (string) ($raw ?? '');
    if (preg_match('/falta|reservado|vendido|entregado|sin\s+precio/i', $s)) {
        return 0;
    }
    $digits = preg_replace('/[^\d]/', '', $s) ?? '';
    if ($digits === '') {
        return 0;
    }
    $n = (int) $digits;
    return $n >= 1000000 ? $n : 0;
}

function parse_km($raw): ?int
{
    if ($raw === null || $raw === '') {
        return null;
    }
    $s = (string) $raw;
    if (preg_match('/falta|sin\s+km/i', $s)) {
        return null;
    }
    $digits = preg_replace('/[^\d]/', '', $s) ?? '';
    return $digits === '' ? null : (int) $digits;
}

function title_case(string $raw): string
{
    $words = preg_split('/\s+/', mb_strtolower(trim($raw), 'UTF-8')) ?: [];
    return implode(' ', array_map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)) . mb_substr($w, 1), array_filter($words, 'strlen')));
}

function guess_category(string $model): string
{
    $m = strtoupper($model);
    if (preg_match('/AMAROK|HILUX|NAVARA|RANGER|\bL200\b|WINGLE|\bT6\b|FRONTIER|SAVEIRO|COLORADO|RAPTOR|VIGUS/', $m)) {
        return 'Camioneta';
    }
    if (preg_match('/VAN|PARTNER|EXPERT|BOXER|\bC35\b|CARGO|FURG|SPRINTER|BERLINGO|DELIVERY/', $m)) {
        return 'Furgón';
    }
    if (preg_match('/\bDB\d|MOTO|SCOOT/', $m)) {
        return 'Moto';
    }
    if (preg_match('/TUCSON|SANTA FE|SPORTAGE|RAIZE|TRACKER|CRETA|X-TRAIL|XTRAIL|REXTON|MONTERO|TIGGO|COOLRAY|MOKKA|CAPTUR|FORESTER|\bX70\b|\bGLE\b|\b2008\b|\b3008\b|ECOSPORT|\bZS\b|\bZX\b/', $m)) {
        return 'SUV';
    }
    return 'Automóvil';
}

function cell(array $row, int $i)
{
    return $i < 0 ? '' : ($row[$i] ?? '');
}

function parse_salgado_rows(array $rows): array
{
    $driveFolder = null;
    foreach (array_slice($rows, 0, 8) as $row) {
        if (preg_match('#drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)#', implode(' ', $row), $m)) {
            $driveFolder = $m[1];
        }
    }
    $headerIndex = -1;
    foreach ($rows as $i => $row) {
        $labels = array_map('fold', $row);
        $hasPlate = (bool) array_filter($labels, fn ($l) => str_contains($l, 'PATENTE'));
        $hasBrand = (bool) array_filter($labels, fn ($l) => str_contains($l, 'MARCA'));
        if ($hasPlate && $hasBrand) {
            $headerIndex = $i;
            break;
        }
    }
    if ($headerIndex < 0) {
        return [[], $driveFolder, false];
    }
    $h = $rows[$headerIndex];
    $iOrigin = col($h, 'ORIGEN');
    $iId = col($h, 'ID');
    $iPlate = col($h, 'PATENTE');
    $iBrand = col($h, 'MARCA');
    $iModel = col($h, 'MODELO');
    $iColor = col($h, 'COLOR');
    $iYear = col($h, 'ANO');
    $iPrice = col($h, 'PRECIO');
    $iKm = col($h, 'KILOMET');
    $iLoc = col($h, 'UBICACION');
    $yearNow = (int) date('Y');
    $out = [];
    $seen = [];
    foreach (array_slice($rows, $headerIndex + 1) as $row) {
        if (!array_filter($row, fn ($c) => trim((string) $c) !== '')) {
            continue;
        }
        $plate = clean_plate(cell($row, $iPlate));
        $brand = clean_brand(cell($row, $iBrand));
        $model = trim((string) cell($row, $iModel));
        $year = (int) cell($row, $iYear);
        $price = parse_clp(cell($row, $iPrice));
        if ($plate === '' || $brand === '' || $model === '' || $year < 1990 || $year > $yearNow + 1 || $price <= 0) {
            continue;
        }
        if (isset($seen[$plate])) {
            continue;
        }
        $seen[$plate] = true;
        $spec = vehicle_specs($brand, $model, $year);
        $stock = preg_replace('/[^\d]/', '', (string) cell($row, $iId)) ?? '';
        $out[] = [
            'stockId' => $stock !== '' ? $stock : $plate,
            'plate' => $plate,
            'brand' => $brand,
            'model' => strtoupper($model),
            'color' => title_case((string) cell($row, $iColor)),
            'year' => $year,
            'price' => $price,
            'mileage' => parse_km(cell($row, $iKm)),
            'fuel' => $spec['fuel'],
            'transmission' => $spec['transmission'],
            'engine' => $spec['engine'],
            'doors' => $spec['doors'],
            'traction' => $spec['traction'],
            'power' => $spec['power'],
            'category' => guess_category($model),
            'location' => title_case((string) cell($row, $iLoc)) ?: 'Patio',
            'origin' => fold(cell($row, $iOrigin)) ?: 'STOCK',
        ];
    }
    return [$out, $driveFolder, true];
}

function location_rank(string $loc): int
{
    $v = strtoupper($loc);
    if (str_contains($v, 'PATIO')) {
        return 0;
    }
    if (str_contains($v, 'UNIDAD')) {
        return 1;
    }
    if (str_contains($v, 'CLIENTE')) {
        return 2;
    }
    return 3;
}

/** @var string[] */
$LOG = [];

function logln(string $msg): void
{
    global $LOG;
    $line = '[' . date('c') . "] {$msg}";
    $LOG[] = $line;
    fwrite(STDOUT, $line . "\n");
    $dir = (string) cfg('log_dir', dirname(__DIR__, 3) . '/salgado-logs');
    if (is_dir($dir) || @mkdir($dir, 0750, true)) {
        @file_put_contents($dir . '/sync-' . date('Y-m') . '.log', $line . "\n", FILE_APPEND | LOCK_EX);
    }
}

/** Listado vía Drive API v3 (si hay drive_api_key en la config). */
function drive_listing_api(string $folderId, string $key): array
{
    $entries = [];
    $page = '';
    do {
        $q = rawurlencode("'{$folderId}' in parents and trashed = false");
        $url = "https://www.googleapis.com/drive/v3/files?q={$q}&pageSize=1000&fields=nextPageToken,files(id,name,mimeType)&key=" . rawurlencode($key)
            . ($page !== '' ? '&pageToken=' . rawurlencode($page) : '');
        $data = json_decode(http_get($url), true);
        if (!is_array($data) || !isset($data['files']) || !is_array($data['files'])) {
            throw new RuntimeException('Drive API: respuesta inesperada');
        }
        foreach ($data['files'] as $f) {
            if (isset($f['id'], $f['name'])) {
                $entries[] = ['id' => (string) $f['id'], 'name' => (string) $f['name'], 'folder' => ($f['mimeType'] ?? '') === 'application/vnd.google-apps.folder'];
            }
        }
        $page = (string) ($data['nextPageToken'] ?? '');
    } while ($page !== '');
    return $entries;
}

/** Listado leyendo la vista embebida pública (sin API). */
function drive_listing_embed(string $folderId): array
{
    $html = http_get('https://drive.google.com/embeddedfolderview?id=' . rawurlencode($folderId));
    if (!str_contains($html, 'flip-entry') && !str_contains($html, 'flip-empty')) {
        throw new RuntimeException('embeddedfolderview cambió de formato o la carpeta no es pública');
    }
    $entries = [];
    foreach (array_slice(explode('class="flip-entry"', $html), 1) as $chunk) {
        if (!preg_match('/id="entry-([A-Za-z0-9_-]+)"/', $chunk, $id) || !preg_match('/class="flip-entry-title">([^<]+)/', $chunk, $name)) {
            continue;
        }
        $entries[] = ['id' => $id[1], 'name' => trim(html_entity_decode($name[1])), 'folder' => str_contains($chunk, 'aria-label="Folder"')];
    }
    return $entries;
}

/** API primero (si está configurada) y vista embebida como respaldo, o al revés. */
function drive_listing(string $folderId): array
{
    $key = (string) cfg('drive_api_key', '');
    $methods = $key !== '' ? ['api', 'embed'] : ['embed'];
    $errors = [];
    foreach ($methods as $m) {
        try {
            return $m === 'api' ? drive_listing_api($folderId, $key) : drive_listing_embed($folderId);
        } catch (Throwable $e) {
            $errors[] = "{$m}: " . $e->getMessage();
        }
    }
    throw new RuntimeException('Drive ' . $folderId . ' → ' . implode(' | ', $errors));
}

/** @return string[] ids de archivo de imagen de la carpeta, en orden natural por nombre */
function photo_ids(string $folderId, int $limit = 12): array
{
    // HEIC/HEIF no se pueden mostrar en navegadores ni procesar con GD: se omiten.
    $files = array_filter(drive_listing($folderId), fn ($e) => !$e['folder'] && preg_match('/\.(jpe?g|png|webp)$/i', $e['name']));
    usort($files, fn ($a, $b) => strnatcasecmp($a['name'], $b['name']));
    return array_map(fn ($e) => $e['id'], array_slice($files, 0, $limit));
}

/**
 * Copia local optimizada de una foto de Drive. Devuelve [ruta, miniatura] públicas,
 * o null si no se pudo (la foto se omite: nunca se publica una imagen rota).
 * $budget limita cuántas descargas nuevas hace cada corrida del cron.
 */
function mirror_drive_photo(string $fileId, int &$budget): ?array
{
    $dir = uploads_dir() . '/drive';
    $ext = function_exists('imagewebp') ? 'webp' : 'jpg';
    if (is_file("{$dir}/{$fileId}.{$ext}") && is_file("{$dir}/{$fileId}_t.{$ext}")) {
        return ["/uploads/drive/{$fileId}.{$ext}", "/uploads/drive/{$fileId}_t.{$ext}"];
    }
    if ($budget <= 0) {
        return ['https://lh3.googleusercontent.com/d/' . $fileId . '=w1600', null];
    }
    $budget--;
    foreach (["https://lh3.googleusercontent.com/d/{$fileId}=w1600", 'https://drive.google.com/uc?export=download&id=' . rawurlencode($fileId)] as $url) {
        try {
            $bytes = http_get($url, 2);
        } catch (Throwable $e) {
            continue;
        }
        $saved = save_optimized($bytes, $dir, $fileId);
        if ($saved) {
            return ["/uploads/drive/{$saved[0]}", "/uploads/drive/{$saved[1]}"];
        }
    }
    logln("Foto {$fileId}: no se pudo descargar o no es una imagen válida; se omite");
    return null;
}

$lock = fopen(sys_get_temp_dir() . '/salgado-sync.lock', 'c');
if ($lock && !flock($lock, LOCK_EX | LOCK_NB)) {
    fwrite(STDOUT, "Ya hay un sync corriendo\n");
    exit(0);
}

$pdo = db();
$pdo->prepare('INSERT INTO sync_runs (started_at) VALUES (?)')->execute([now_db()]);
$runId = (int) $pdo->lastInsertId();

try {
    $sheet = google_id(cfg('sheet_id'), '1BG2uR6APbXEMvVvRmdR-Nn0Vko6eobJ6Xam0XX41Ldc');
    $tab = (string) cfg('sheet_tab', 'SALGADO AUTOMOTRIZ');
    $csv = http_get("https://docs.google.com/spreadsheets/d/{$sheet}/gviz/tq?tqx=out:csv&sheet=" . rawurlencode($tab));
    $head = strtolower(substr($csv, 0, 120));
    if (str_contains($head, '<html') || str_contains($head, '<!doctype')) {
        throw new RuntimeException('La planilla no está compartida como lectura pública');
    }
    [$rows, $folderFromSheet, $hasHeader] = parse_salgado_rows(parse_csv_text($csv));
    if (!$hasHeader) {
        throw new RuntimeException("No está la pestaña {$tab}");
    }
    if (!$rows) {
        throw new RuntimeException('La pestaña no tiene unidades vendibles; no se toca el catálogo');
    }

    $existing = (int) $pdo->query("SELECT COUNT(*) FROM vehicles WHERE source = 'sheet' AND archived_at IS NULL")->fetchColumn();
    // Lectura a medias de la planilla: no archivar casi todo de golpe.
    if ($existing >= 6 && count($rows) < $existing * 0.5) {
        throw new RuntimeException('La planilla trajo ' . count($rows) . " de {$existing} unidades; sync abortado por seguridad");
    }

    $folderId = $folderFromSheet ?: google_id(cfg('drive_folder_id'), '1T_FkTaF9rFf97kM14MvdYzJHSYg-WLgo');
    $folders = [];
    $driveOk = true;
    try {
        foreach (drive_listing($folderId) as $e) {
            if ($e['folder'] && preg_match('/\bID\s*(\d+)\b/i', $e['name'], $m)) {
                $folders[$m[1]][] = $e['id'];
            }
        }
        logln('Drive índice: ' . count($folders) . ' carpetas con ID');
    } catch (Throwable $e) {
        $driveOk = false;
        logln('Drive índice no disponible, se conservan las fotos actuales: ' . $e->getMessage());
    }

    usort($rows, fn ($a, $b) => location_rank($a['location']) <=> location_rank($b['location']));

    // 1) Fotos de Drive por unidad (antes de elegir destacados).
    $budget = (int) cfg('sync_photo_budget', 150);
    foreach ($rows as &$r) {
        $r['photos'] = [];
        foreach ($folders[$r['stockId']] ?? [] as $candidate) {
            try {
                $ids = photo_ids($candidate);
                if (count($ids) > count($r['photos'])) {
                    $r['photos'] = $ids;
                }
                if (count($r['photos']) >= 4) {
                    break;
                }
            } catch (Throwable $e) {
                logln("Drive ID {$r['stockId']}: " . $e->getMessage());
            }
        }
    }
    unset($r);

    $find = $pdo->prepare('SELECT id, source, photos_locked FROM vehicles WHERE id = ? OR stock_id = ? OR plate = ? LIMIT 1');
    $realPhotos = $pdo->prepare("SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = ? AND storage_path NOT LIKE '%placeholder%'");
    $hasRealPhotos = function (array $r) use ($find, $realPhotos): bool {
        if ($r['photos']) {
            return true;
        }
        $find->execute(['sa-' . $r['stockId'], $r['stockId'], $r['plate']]);
        $f = $find->fetch();
        if (!$f) {
            return false;
        }
        $realPhotos->execute([$f['id']]);
        return (int) $realPhotos->fetchColumn() > 0;
    };

    // 2) Destacados: los 3 más caros del patio, solo entre los que tienen fotos reales.
    $withPhotos = array_values(array_filter($rows, $hasRealPhotos));
    $patio = array_filter($withPhotos, fn ($r) => stripos($r['location'], 'patio') !== false);
    $pool = count($patio) >= 3 ? $patio : ($withPhotos ?: $rows);
    usort($pool, fn ($a, $b) => $b['price'] <=> $a['price']);
    $featured = array_flip(array_map(fn ($r) => $r['stockId'], array_slice($pool, 0, 3)));

    $now = now_db();
    $keep = [];
    $insert = $pdo->prepare("INSERT INTO vehicles (id, source, sort_rank, stock_id, plate, slug, brand, model, year, version, category, fuel, transmission, mileage, color, doors, engine, traction, power, price, description, location, origin, status, published, featured, created_at, updated_at)
        VALUES (?, 'sheet', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Disponible', 1, ?, ?, ?)");
    $update = $pdo->prepare("UPDATE vehicles SET sort_rank = ?, stock_id = ?, plate = ?, slug = ?, brand = ?, model = ?, year = ?, version = ?, category = ?, fuel = ?, transmission = ?, mileage = ?, color = ?, doors = ?, engine = ?, traction = ?, power = ?, price = ?, description = ?, location = ?, origin = ?, status = 'Disponible', published = 1, archived_at = NULL, featured = ?, updated_at = ? WHERE id = ?");
    $delImg = $pdo->prepare('DELETE FROM vehicle_images WHERE vehicle_id = ?');
    $insImg = $pdo->prepare('INSERT INTO vehicle_images (id, vehicle_id, storage_path, thumb_path, source, drive_file_id, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?)');
    $hasUploads = $pdo->prepare("SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = ? AND (source = 'upload' OR storage_path LIKE '/uploads/vehicles/%')");
    $photoStats = ['mirrored' => 0, 'skipped' => 0];

    foreach ($rows as $rank => $r) {
        $id = 'sa-' . $r['stockId'];
        $slug = slugify("{$r['brand']} {$r['model']} {$r['year']} {$r['plate']}");
        $desc = "Patente {$r['plate']}. Ubicación: {$r['location']}. Origen: {$r['origin']}.";
        $feat = isset($featured[$r['stockId']]) ? 1 : 0;

        // Descargas fuera de la transacción.
        $images = [];
        foreach ($r['photos'] as $fileId) {
            $m = mirror_drive_photo($fileId, $budget);
            if ($m) {
                $images[] = [$m[0], $m[1], $fileId];
                $photoStats['mirrored']++;
            } else {
                $photoStats['skipped']++;
            }
        }

        $pdo->beginTransaction();
        $find->execute([$id, $r['stockId'], $r['plate']]);
        $found = $find->fetch();
        if ($found && $found['source'] !== 'sheet') {
            // Lo publicó el admin a mano: se respeta.
            $pdo->commit();
            $keep[] = $found['id'];
            continue;
        }
        $params = [$rank, $r['stockId'], $r['plate'], $slug, $r['brand'], $r['model'], $r['year'], $r['color'] ?: null, $r['category'],
            $r['fuel'], $r['transmission'], $r['mileage'], $r['color'] ?: null, $r['doors'], $r['engine'], $r['traction'], $r['power'],
            $r['price'], $desc, $r['location'], $r['origin']];
        if ($found) {
            $id = $found['id'];
            $update->execute(array_merge($params, [$feat, $now, $id]));
        } else {
            $insert->execute(array_merge([$id], $params, [$feat, $now, $now]));
        }
        // Fotos: Drive manda salvo fotos manuales u orden/portada fijados en el admin.
        // Si Drive no responde o no trae fotos válidas, se conservan las actuales.
        $hasUploads->execute([$id]);
        $locked = ($found && (int) $found['photos_locked'] === 1) || (int) $hasUploads->fetchColumn() > 0;
        if (!$locked && ($images || !$found)) {
            $delImg->execute([$id]);
            if ($images) {
                foreach ($images as $i => [$path, $thumb, $fileId]) {
                    $insImg->execute([uuid4(), $id, $path, $thumb, 'drive', $fileId, $i, $now]);
                }
            } else {
                $insImg->execute([uuid4(), $id, PLACEHOLDER, null, 'drive', null, 0, $now]);
            }
        }
        $pdo->commit();
        $keep[] = $id;
    }

    // Lo que ya no está en la planilla se archiva (no se borra): sale del sitio y queda en el admin.
    $marks = implode(',', array_fill(0, count($keep), '?'));
    $arch = $pdo->prepare("UPDATE vehicles SET status = 'Vendido', published = 0, featured = 0, archived_at = ?, updated_at = ? WHERE source = 'sheet' AND (archived_at IS NULL OR published = 1) AND id NOT IN ({$marks})");
    $arch->execute(array_merge([$now, $now], $keep));
    $archived = $arch->rowCount();

    $summary = 'ok · ' . count($rows) . " unidades, {$archived} archivadas, fotos {$photoStats['mirrored']} ok / {$photoStats['skipped']} omitidas" . ($driveOk ? '' : ' · Drive sin respuesta');
    logln($summary);
    $pdo->prepare('UPDATE sync_runs SET finished_at = ?, ok = 1, vehicles = ?, removed = ?, message = ?, log = ? WHERE id = ?')
        ->execute([now_db(), count($rows), $archived, mb_substr($summary, 0, 500), mb_substr(implode("\n", $LOG), 0, 60000), $runId]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    logln('ERROR: ' . $e->getMessage());
    $pdo->prepare('UPDATE sync_runs SET finished_at = ?, ok = 0, message = ?, log = ? WHERE id = ?')
        ->execute([now_db(), mb_substr($e->getMessage(), 0, 500), mb_substr(implode("\n", $LOG), 0, 60000), $runId]);
    exit(1);
}