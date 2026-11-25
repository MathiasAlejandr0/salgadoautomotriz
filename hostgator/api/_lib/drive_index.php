<?php
declare(strict_types=1);

require_once __DIR__ . '/drive_match.php';

/**
 * Índice de Drive: un listado por carpeta y, si hay OAuth, changes.list.
 * La tabla se crea en la primera corrida del sync. El deploy no ejecuta SQL.
 */

class DrivePageTokenException extends RuntimeException
{
}

function drive_index_sql_path(): string
{
    // En el servidor el archivo viaja dentro de api/ (el deploy no sube hostgator/sql).
    $beside = __DIR__ . '/migr3_drive_index.sql';
    if (is_file($beside)) {
        return $beside;
    }
    return dirname(__DIR__, 2) . '/sql/migr3_drive_index.sql';
}

/** @return string[] */
function drive_sql_statements(string $sql): array
{
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    $out = [];
    foreach (explode(';', $sql) as $part) {
        $stmt = trim($part);
        if ($stmt !== '') {
            $out[] = $stmt;
        }
    }
    return $out;
}

function drive_index_ensure(PDO $pdo): void
{
    $path = drive_index_sql_path();
    if (!is_file($path)) {
        throw new RuntimeException('Falta ' . $path);
    }
    foreach (drive_sql_statements((string) file_get_contents($path)) as $stmt) {
        $pdo->exec($stmt);
    }
}

function drive_oauth_configured(): bool
{
    if (!function_exists('cfg')) {
        return false;
    }
    foreach (['drive_oauth_client_id', 'drive_oauth_client_secret', 'drive_oauth_refresh_token'] as $key) {
        if (trim((string) cfg($key, '')) === '') {
            return false;
        }
    }
    return true;
}

/** @return array{code: int, body: string} */
function drive_http_post_form(string $url, array $fields): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_TIMEOUT => 25,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException('POST de Drive falló');
    }
    return ['code' => $code, 'body' => (string) $body];
}

/** @return array{code: int, body: string} */
function drive_http_get_auth(string $url, string $token): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        CURLOPT_TIMEOUT => 30,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false) {
        throw new RuntimeException('GET de Drive falló');
    }
    return ['code' => $code, 'body' => (string) $body];
}

function drive_oauth_access_token(): string
{
    static $token = null;
    if (is_string($token) && $token !== '') {
        return $token;
    }
    $res = drive_http_post_form('https://oauth2.googleapis.com/token', [
        'client_id' => (string) cfg('drive_oauth_client_id', ''),
        'client_secret' => (string) cfg('drive_oauth_client_secret', ''),
        'refresh_token' => (string) cfg('drive_oauth_refresh_token', ''),
        'grant_type' => 'refresh_token',
    ]);
    $data = json_decode($res['body'], true);
    if ($res['code'] < 200 || $res['code'] >= 300 || !is_array($data) || empty($data['access_token'])) {
        throw new RuntimeException('OAuth de Drive respondió ' . $res['code']);
    }
    $token = (string) $data['access_token'];
    return $token;
}

/** @return array{changes: array<int, array<string, mixed>>, page_token: string} */
function drive_changes_pull(string $pageToken): array
{
    $token = drive_oauth_access_token();
    $changes = [];
    $page = $pageToken;
    $nextStart = '';
    do {
        $url = 'https://www.googleapis.com/drive/v3/changes?pageSize=1000&includeRemoved=true'
            . '&fields=' . rawurlencode('nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,parents,trashed,md5Checksum,modifiedTime,imageMediaMetadata,shortcutDetails))')
            . '&pageToken=' . rawurlencode($page);
        $res = drive_http_get_auth($url, $token);
        if (drive_changes_response_invalid($res['code'], $res['body'])) {
            throw new DrivePageTokenException('pageToken de Drive inválido');
        }
        if ($res['code'] < 200 || $res['code'] >= 300) {
            throw new RuntimeException('changes.list respondió ' . $res['code']);
        }
        $data = json_decode($res['body'], true);
        if (!is_array($data)) {
            throw new RuntimeException('changes.list: respuesta inesperada');
        }
        foreach ($data['changes'] ?? [] as $ch) {
            if (is_array($ch)) {
                $changes[] = $ch;
            }
        }
        $page = (string) ($data['nextPageToken'] ?? '');
        if (!empty($data['newStartPageToken'])) {
            $nextStart = (string) $data['newStartPageToken'];
        }
    } while ($page !== '');
    if ($nextStart === '') {
        throw new RuntimeException('changes.list no devolvió newStartPageToken');
    }
    return ['changes' => $changes, 'page_token' => $nextStart];
}

function drive_start_page_token(): string
{
    $token = drive_oauth_access_token();
    $res = drive_http_get_auth('https://www.googleapis.com/drive/v3/changes/startPageToken', $token);
    $data = json_decode($res['body'], true);
    if ($res['code'] < 200 || $res['code'] >= 300 || !is_array($data) || empty($data['startPageToken'])) {
        throw new RuntimeException('startPageToken respondió ' . $res['code']);
    }
    return (string) $data['startPageToken'];
}

/** @return array<int, array<string, mixed>> */
function drive_index_load(PDO $pdo): array
{
    $rows = $pdo->query('SELECT id, nombre, ruta, parent_id, md5, modified, image_time, mime, is_folder, shortcut_target FROM drive_index')->fetchAll();
    $out = [];
    foreach ($rows as $r) {
        $out[] = [
            'id' => (string) $r['id'],
            'name' => (string) $r['nombre'],
            'path' => $r['ruta'],
            'parent' => $r['parent_id'] !== null ? (string) $r['parent_id'] : null,
            'folder' => (int) $r['is_folder'] === 1,
            'mime' => (string) ($r['mime'] ?? ''),
            'md5' => $r['md5'] !== null ? (string) $r['md5'] : null,
            'modified' => $r['modified'] !== null ? (string) $r['modified'] : null,
            'image_time' => $r['image_time'] !== null ? (string) $r['image_time'] : null,
            'shortcut_target' => $r['shortcut_target'] !== null ? (string) $r['shortcut_target'] : null,
        ];
    }
    return $out;
}

/** @param array<int, array<string, mixed>> $nodes */
function drive_index_save(PDO $pdo, array $nodes, string $rootId): void
{
    $nodes = drive_nodes_with_paths($nodes);
    $now = function_exists('now_db') ? now_db() : gmdate('Y-m-d H:i:s.v');
    $pdo->beginTransaction();
    try {
        $pdo->exec('DELETE FROM drive_index');
        $ins = $pdo->prepare('INSERT INTO drive_index (id, nombre, ruta, parent_id, md5, modified, image_time, mime, is_folder, shortcut_target, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        foreach ($nodes as $n) {
            if (($n['id'] ?? '') === '' || $n['id'] === $rootId) {
                continue;
            }
            $ins->execute([
                $n['id'],
                mb_substr((string) $n['name'], 0, 1024),
                mb_substr((string) ($n['path'] ?? ''), 0, 2048),
                $n['parent'] !== null && $n['parent'] !== '' ? $n['parent'] : null,
                $n['md5'] ?? null,
                $n['modified'] ?? null,
                $n['image_time'] ?? null,
                $n['mime'] !== '' ? mb_substr((string) $n['mime'], 0, 160) : null,
                !empty($n['folder']) ? 1 : 0,
                $n['shortcut_target'] ?? null,
                $now,
            ]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** @return array{page_token: ?string, root_id: ?string, mode: string, indexed_at: ?string} */
function drive_state_read(PDO $pdo): array
{
    $row = $pdo->query('SELECT page_token, root_id, mode, indexed_at FROM drive_sync_state WHERE id = 1')->fetch();
    if (!$row) {
        return ['page_token' => null, 'root_id' => null, 'mode' => '', 'indexed_at' => null];
    }
    return [
        'page_token' => $row['page_token'] !== null ? (string) $row['page_token'] : null,
        'root_id' => $row['root_id'] !== null ? (string) $row['root_id'] : null,
        'mode' => (string) ($row['mode'] ?? ''),
        'indexed_at' => $row['indexed_at'] !== null ? (string) $row['indexed_at'] : null,
    ];
}

function drive_state_save(PDO $pdo, ?string $pageToken, string $mode, string $rootId): void
{
    $now = function_exists('now_db') ? now_db() : gmdate('Y-m-d H:i:s.v');
    $pdo->prepare('INSERT INTO drive_sync_state (id, page_token, root_id, mode, indexed_at) VALUES (1, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE page_token = VALUES(page_token), root_id = VALUES(root_id), mode = VALUES(mode), indexed_at = VALUES(indexed_at)')
        ->execute([$pageToken, $rootId, $mode, $now]);
}

/** Cuántas carpetas abre una corrida. 200 no alcanza: la raíz ya pasa de 300 patentes. */
function drive_index_listing_cap(array $options = []): int
{
    if (isset($options['max_listings'])) {
        return max(1, (int) $options['max_listings']);
    }
    $fallback = 800;
    if (function_exists('cfg')) {
        return max(1, (int) cfg('drive_index_max_listings', $fallback));
    }
    return $fallback;
}

/** 0 si el nombre trae una patente o un ID de la planilla. Esas carpetas se leen primero. */
function drive_prefer_rank(string $name, array $prefer): int
{
    $compact = drive_compact($name);
    if ($compact === '') {
        return 1;
    }
    foreach ($prefer as $needle) {
        $needle = drive_compact((string) $needle);
        if ($needle !== '' && str_contains($compact, $needle)) {
            return 0;
        }
    }
    return 1;
}

/** @param array<int, array<string, mixed>> $rows */
function drive_sheet_prefer(array $rows): array
{
    $out = [];
    foreach ($rows as $r) {
        if (!is_array($r)) {
            continue;
        }
        $plate = drive_compact((string) ($r['plate'] ?? ''));
        if ($plate !== '') {
            $out[] = $plate;
        }
        if (!empty($r['hasSheetId'])) {
            $out[] = 'ID' . drive_compact((string) ($r['stockId'] ?? ''));
        }
    }
    return array_values(array_unique($out));
}

/**
 * @param callable(string): array $listFolder
 * @param array{max_listings?: int, max_depth?: int, prefer?: string[]} $options
 * @return array<int, array<string, mixed>>
 */
function drive_index_collect(string $rootId, callable $listFolder, array $options = []): array
{
    $maxListings = drive_index_listing_cap($options);
    $maxDepth = (int) ($options['max_depth'] ?? 3);
    $prefer = array_values($options['prefer'] ?? []);
    $nodes = [];
    $seenList = [];
    $listings = 0;
    $queue = [[$rootId, 0, $rootId]];
    $rootSorted = false;
    while ($queue) {
        if (!$rootSorted && $listings >= 1) {
            usort($queue, static function (array $a, array $b) use ($nodes, $prefer): int {
                $na = (string) ($nodes[$a[0]]['name'] ?? '');
                $nb = (string) ($nodes[$b[0]]['name'] ?? '');
                return drive_prefer_rank($na, $prefer) <=> drive_prefer_rank($nb, $prefer);
            });
            $rootSorted = true;
        }
        [$folderId, $depth, $parentId] = array_shift($queue);
        if (isset($seenList[$folderId])) {
            continue;
        }
        $seenList[$folderId] = true;
        if ($listings >= $maxListings) {
            if (function_exists('logln')) {
                logln("Índice de Drive: tope de {$maxListings} listados; el resto queda para la próxima corrida");
            }
            break;
        }
        $listings++;
        try {
            $entries = $listFolder($folderId);
        } catch (Throwable $e) {
            if (function_exists('logln')) {
                logln("Índice de Drive {$folderId}: " . $e->getMessage());
            }
            continue;
        }
        if (!is_array($entries)) {
            continue;
        }
        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $node = drive_normalize_entry($entry, $parentId);
            if ($node['id'] === '' || isset($nodes[$node['id']])) {
                continue;
            }
            $nodes[$node['id']] = $node;
            if ($depth >= $maxDepth) {
                continue;
            }
            if (!empty($node['shortcut_target']) && !empty($node['folder'])) {
                $queue[] = [$node['shortcut_target'], $depth + 1, $node['id']];
                continue;
            }
            if (!empty($node['folder'])) {
                $queue[] = [$node['id'], $depth + 1, $node['id']];
            }
        }
    }
    return array_values($nodes);
}

/**
 * @return array{nodes: array<int, array<string, mixed>>, mode: string}
 */
function drive_index_for_sync(PDO $pdo, string $rootId, array $options = []): array
{
    $dbOk = true;
    try {
        drive_index_ensure($pdo);
    } catch (Throwable $e) {
        $dbOk = false;
        if (function_exists('logln')) {
            logln('No se pudo crear drive_index (' . $e->getMessage() . '). El match sigue en memoria. Importar hostgator/sql/migr3_drive_index.sql en phpMyAdmin si el usuario MySQL no puede crear tablas.');
        }
    }

    $full = static function () use ($pdo, $rootId, $dbOk, $options): array {
        $nodes = drive_index_collect($rootId, 'drive_listing', [
            'max_listings' => drive_index_listing_cap($options),
            'max_depth' => (int) ($options['max_depth'] ?? 3),
            'prefer' => $options['prefer'] ?? [],
        ]);
        if ($dbOk) {
            try {
                drive_index_save($pdo, $nodes, $rootId);
                $page = null;
                if (drive_oauth_configured()) {
                    try {
                        $page = drive_start_page_token();
                    } catch (Throwable $e) {
                        if (function_exists('logln')) {
                            logln('No se pudo guardar el pageToken: ' . $e->getMessage());
                        }
                    }
                }
                drive_state_save($pdo, $page, 'full', $rootId);
            } catch (Throwable $e) {
                if (function_exists('logln')) {
                    logln('No se pudo guardar drive_index: ' . $e->getMessage());
                }
            }
        }
        return ['nodes' => $nodes, 'mode' => 'full'];
    };

    if (!drive_oauth_configured()) {
        if ($dbOk && getenv('SALGADO_DRIVE_FORCE_INDEX') !== '1') {
            try {
                $st = drive_state_read($pdo);
                $ts = !empty($st['indexed_at']) ? strtotime((string) $st['indexed_at'] . ' UTC') : false;
                if (($st['root_id'] ?? null) === $rootId && $ts !== false && (time() - $ts) >= 0 && (time() - $ts) <= 900) {
                    $cached = drive_index_load($pdo);
                    if (count($cached) >= 50) {
                        if (function_exists('logln')) {
                            logln('Índice de Drive reutilizado (< 15 min): ' . count($cached) . ' entradas');
                        }
                        return ['nodes' => $cached, 'mode' => 'cached'];
                    }
                }
            } catch (Throwable $e) {
            }
        }
        if (function_exists('logln')) {
            logln('changes.list inactivo: faltan drive_oauth_client_id, drive_oauth_client_secret y drive_oauth_refresh_token. Reindexado completo.');
        }
        return $full();
    }

    $state = ['page_token' => null];
    if ($dbOk) {
        try {
            $state = drive_state_read($pdo);
        } catch (Throwable $e) {
            $state = ['page_token' => null];
        }
    }
    if ($dbOk && !empty($state['page_token']) && ($state['root_id'] ?? null) === $rootId) {
        try {
            $existing = drive_index_load($pdo);
            if (!$existing) {
                throw new DrivePageTokenException('índice vacío');
            }
            $pulled = drive_changes_pull((string) $state['page_token']);
            $nodes = drive_apply_changes($existing, $pulled['changes']);
            drive_index_save($pdo, $nodes, $rootId);
            drive_state_save($pdo, $pulled['page_token'], 'changes', $rootId);
            return ['nodes' => $nodes, 'mode' => 'changes'];
        } catch (DrivePageTokenException $e) {
            if (function_exists('logln')) {
                logln('pageToken de Drive inválido; reindexado completo');
            }
        } catch (Throwable $e) {
            if (function_exists('logln')) {
                logln('changes.list falló; reindexado completo: ' . $e->getMessage());
            }
        }
    }
    return $full();
}

/**
 * Lee planilla, Drive y la API pública. No abre MySQL ni escribe en Drive.
 */
function salgado_sync_dry_run(): int
{
    $sheet = google_id(cfg('sheet_id'), '1BG2uR6APbXEMvVvRmdR-Nn0Vko6eobJ6Xam0XX41Ldc');
    $tab = (string) cfg('sheet_tab', 'SALGADO AUTOMOTRIZ');
    $csv = sheet_csv($sheet, $tab);
    [$rows, $folderFromSheet] = parse_salgado_rows(parse_csv_text($csv));
    $sold = sold_plates_from_tabs($sheet);
    if ($sold) {
        $rows = array_values(array_filter($rows, static fn ($r) => !isset($sold[$r['plate']])));
    }
    $folderId = $folderFromSheet ?: google_id(cfg('drive_folder_id'), '1T_FkTaF9rFf97kM14MvdYzJHSYg-WLgo');
    fwrite(STDOUT, "Planilla: " . count($rows) . " unidades vendibles. Carpeta Drive {$folderId}\n");
    if ($sold) {
        fwrite(STDOUT, 'Vendidos en otras pestañas: ' . count($sold) . "\n");
    }
    $nodes = drive_index_collect($folderId, 'drive_listing', [
        'max_depth' => 3,
        'prefer' => drive_sheet_prefer($rows),
    ]);
    fwrite(STDOUT, 'Índice: ' . count($nodes) . " entradas (un listado por carpeta, sin changes.list)\n");
    $match = match_sheet_photos($rows, $nodes);
    $api = [];
    $apiNote = 'API pública leída';
    try {
        $data = json_decode(http_get('https://salgadoautomotriz.cl/api/vehicles'), true);
        foreach ($data['vehicles'] ?? [] as $v) {
            if (is_array($v)) {
                $api[(string) ($v['stock_id'] ?? '')] = $v;
            }
        }
    } catch (Throwable $e) {
        $apiNote = 'API pública no disponible: ' . $e->getMessage();
    }
    fwrite(STDOUT, $apiNote . ' (' . count($api) . " publicados ahora)\n");

    $byPlate = [];
    $published = [];
    $hidden = [];
    foreach ($rows as $r) {
        $id = (string) $r['stockId'];
        $hit = $match['by_stock'][$id] ?? ['file_ids' => [], 'via' => 'none', 'files' => []];
        $driveN = count($hit['file_ids'] ?? []);
        $wasCurated = isset(curated_photos()[$id]);
        $apiV = $api[$id] ?? null;
        $apiReal = false;
        $apiCurated = false;
        if (is_array($apiV)) {
            foreach ($apiV['vehicle_images'] ?? [] as $img) {
                $p = (string) ($img['storage_path'] ?? '');
                if (str_contains($p, '/uploads/curated/')) {
                    $apiCurated = true;
                }
                if ($p !== '' && !str_contains($p, 'placeholder')) {
                    $apiReal = true;
                }
            }
        }
        $locked = is_array($apiV) && !empty($apiV['photos_locked']);
        // En el próximo sync todas las de la planilla se publican. Sin foto: placeholder.
        $will = true;
        if ($driveN > 0) {
            $reason = (string) $hit['via'];
        } elseif ($wasCurated || $apiCurated) {
            $reason = 'pasaría de curada a Drive/placeholder';
        } elseif ($apiReal) {
            $reason = 'foto ya en el sitio';
        } else {
            $reason = 'placeholder';
        }
        $row = [
            'plate' => (string) $r['plate'],
            'stock' => $id,
            'brand' => (string) $r['brand'],
            'model' => (string) $r['model'],
            'year' => (int) $r['year'],
            'drive' => $driveN,
            'via' => (string) ($hit['via'] ?? 'none'),
            'curated' => $wasCurated,
            'api_real' => $apiReal,
            'locked' => $locked,
            'publish' => $will,
            'reason' => $reason,
            'folder' => drive_match_folder_label($hit['files'] ?? [], $nodes),
        ];
        $byPlate[$row['plate']] = $row;
        if ($will) {
            $published[] = $row['plate'];
        } else {
            $hidden[] = $row['plate'];
        }
    }

    $focus = ['SBFG83', 'SBGT61', 'SBGW67', 'RDPG53', 'SXDW77', 'RLCT88', 'LYZP47', 'SLKF16', 'RRYJ22', 'RPSH63', 'RPSH36', 'RPSH66', 'JYFW75', 'SKLJ24', 'TLZG29', 'PLHY77', 'SPKG43', 'RVWG57', 'TTBF40', 'SHJK15', 'SSVV97', 'SRVL14'];
    fwrite(STDOUT, "\nPatente\tResultado\tVia\tFotosDrive\tCarpeta\n");
    foreach ($focus as $plate) {
        $row = $byPlate[$plate] ?? null;
        if (!$row) {
            fwrite(STDOUT, "{$plate}\tno está en la planilla vendible\t-\t0\t-\n");
            continue;
        }
        if ($row['drive'] > 0) {
            $label = 'con fotos Drive';
        } elseif ($row['reason'] === 'placeholder') {
            $label = 'se publica con placeholder';
        } elseif (str_contains((string) $row['reason'], 'curada')) {
            $label = 'deja curada; usará Drive o placeholder';
        } else {
            $label = (string) $row['reason'];
        }
        fwrite(STDOUT, "{$plate}\t{$label}\t{$row['via']}\t{$row['drive']}\t{$row['folder']}\n");
    }
    fwrite(STDOUT, "\nQuedarían publicados: " . count($published) . ' de ' . count($rows) . "\n");
    $withDrive = count(array_filter($byPlate, static fn ($r) => $r['drive'] > 0));
    $withPlaceholder = count($rows) - $withDrive;
    fwrite(STDOUT, "Con fotos de Drive: {$withDrive}\n");
    fwrite(STDOUT, "Se publicarían con placeholder: {$withPlaceholder}\n");
    if ($withPlaceholder) {
        $ph = [];
        foreach ($byPlate as $row) {
            if ($row['drive'] < 1) {
                $ph[] = $row['plate'];
            }
        }
        fwrite(STDOUT, 'Placeholder: ' . implode(', ', $ph) . "\n");
    }
    $sheetIds = array_fill_keys(array_map(static fn ($r) => (string) $r['stockId'], $rows), true);
    $archive = [];
    foreach ($api as $sid => $v) {
        if ($sid !== '' && !isset($sheetIds[$sid])) {
            $archive[] = $sid;
        }
    }
    fwrite(STDOUT, 'Se archivarían (en API y ya no en la pestaña): ' . count($archive) . "\n");
    if ($archive) {
        fwrite(STDOUT, 'Archivar: ' . implode(', ', $archive) . "\n");
    }

    $violations = $match['conflicts'];
    fwrite(STDOUT, 'Asignaciones cruzadas: ' . count($violations) . "\n");
    foreach (array_slice($violations, 0, 20) as $line) {
        fwrite(STDERR, "CONFLICTO {$line}\n");
    }
    fwrite(STDOUT, "\nMuestra de carpetas asignadas:\n");
    foreach ($byPlate as $row) {
        if ($row['drive'] < 1) {
            continue;
        }
        fwrite(STDOUT, "{$row['plate']}\t{$row['stock']}\t{$row['via']}\t{$row['drive']}\t{$row['folder']}\n");
    }
    return $violations ? 1 : 0;
}

function drive_match_folder_label(array $files, array $nodes): string
{
    $by = [];
    foreach ($nodes as $n) {
        if (($n['id'] ?? '') !== '') {
            $by[$n['id']] = (string) $n['name'];
        }
    }
    $names = [];
    foreach ($files as $file) {
        $name = $by[(string) ($file['parent'] ?? '')] ?? '';
        if ($name !== '') {
            $names[$name] = true;
        }
    }
    $list = array_keys($names);
    return $list ? implode(' | ', array_slice($list, 0, 3)) : '-';
}
