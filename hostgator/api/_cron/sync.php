<?php
declare(strict_types=1);

/*
 * Sincroniza la pestaña "SALGADO AUTOMOTRIZ" de la planilla + fotos de Drive
 * hacia MySQL. La planilla manda: lo que no está en la planilla se despublica
 * y se borra (solo vehículos con source='sheet'; los creados en el admin no se tocan).
 *
 * cPanel → Cron Jobs (cada 10 min):
 *   /usr/local/bin/php /home/<usuario>/public_html/api/_cron/sync.php >/dev/null 2>&1
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

require dirname(__DIR__) . '/_lib/app.php';

const PLACEHOLDER = '/placeholder-car.svg';

function http_get(string $url): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_USERAGENT => 'SalgadoAutomotriz/1.0',
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException("GET {$url} respondió {$code}");
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

function infer_powertrain(string $model): array
{
    $m = strtoupper($model);
    $fuel = null;
    if (preg_match('/DIESEL|\bHDI\b|\bCRDI\b|\bDCI\b|\bTDI\b|\bTD\b/', $m)) {
        $fuel = 'Diésel';
    } elseif (preg_match('/BENCINA|GASOLINA|PURETECH|\bMPI\b/', $m)) {
        $fuel = 'Bencina';
    }
    $tr = null;
    if (preg_match('/\b(CVT|DCT|AUT|AT)\b|AUTOM/', $m)) {
        $tr = 'Automática';
    } elseif (preg_match('/\bMT\b|MECAN/', $m)) {
        $tr = 'Manual';
    }
    return [$fuel, $tr];
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
        [$fuel, $tr] = infer_powertrain($model);
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
            'fuel' => $fuel,
            'transmission' => $tr,
            'category' => guess_category($model),
            'location' => title_case((string) cell($row, $iLoc)) ?: 'Patio',
            'origin' => fold(cell($row, $iOrigin)) ?: 'STOCK',
        ];
    }
    return [$out, $driveFolder, true];
}

function drive_listing(string $folderId): array
{
    $html = http_get('https://drive.google.com/embeddedfolderview?id=' . rawurlencode($folderId));
    $entries = [];
    foreach (array_slice(explode('class="flip-entry"', $html), 1) as $chunk) {
        if (!preg_match('/id="entry-([A-Za-z0-9_-]+)"/', $chunk, $id) || !preg_match('/class="flip-entry-title">([^<]+)/', $chunk, $name)) {
            continue;
        }
        $entries[] = ['id' => $id[1], 'name' => trim(html_entity_decode($name[1])), 'folder' => str_contains($chunk, 'aria-label="Folder"')];
    }
    return $entries;
}

function photo_urls(string $folderId, int $limit = 10): array
{
    $files = array_filter(drive_listing($folderId), fn ($e) => !$e['folder'] && preg_match('/\.(jpe?g|png|webp|heic|heif|gif)$/i', $e['name']));
    usort($files, fn ($a, $b) => strnatcasecmp($a['name'], $b['name']));
    return array_map(fn ($e) => 'https://lh3.googleusercontent.com/d/' . $e['id'] . '=w1600', array_slice($files, 0, $limit));
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

function logln(string $msg): void
{
    fwrite(STDOUT, '[' . date('c') . "] {$msg}\n");
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

    $existing = (int) $pdo->query("SELECT COUNT(*) FROM vehicles WHERE source = 'sheet'")->fetchColumn();
    // Lectura a medias de la planilla: no archivar casi todo de golpe.
    if ($existing >= 6 && count($rows) < $existing * 0.5) {
        throw new RuntimeException('La planilla trajo ' . count($rows) . " de {$existing} unidades; sync abortado por seguridad");
    }

    $folderId = $folderFromSheet ?: google_id(cfg('drive_folder_id'), '1T_FkTaF9rFf97kM14MvdYzJHSYg-WLgo');
    $folders = [];
    try {
        foreach (drive_listing($folderId) as $e) {
            if ($e['folder'] && preg_match('/\bID\s*(\d+)\b/i', $e['name'], $m)) {
                $folders[$m[1]][] = $e['id'];
            }
        }
    } catch (Throwable $e) {
        logln('Drive índice: ' . $e->getMessage());
    }

    usort($rows, fn ($a, $b) => location_rank($a['location']) <=> location_rank($b['location']));
    $patio = array_filter($rows, fn ($r) => stripos($r['location'], 'patio') !== false);
    $pool = count($patio) >= 3 ? $patio : $rows;
    usort($pool, fn ($a, $b) => $b['price'] <=> $a['price']);
    $featured = array_flip(array_map(fn ($r) => $r['stockId'], array_slice($pool, 0, 3)));

    $now = now_db();
    $keep = [];
    $find = $pdo->prepare('SELECT id, source FROM vehicles WHERE id = ? OR stock_id = ? OR plate = ? LIMIT 1');
    $insert = $pdo->prepare("INSERT INTO vehicles (id, source, sort_rank, stock_id, plate, slug, brand, model, year, version, category, fuel, transmission, mileage, color, price, description, location, origin, status, published, featured, created_at, updated_at)
        VALUES (?, 'sheet', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Disponible', 1, ?, ?, ?)");
    $update = $pdo->prepare("UPDATE vehicles SET sort_rank = ?, stock_id = ?, plate = ?, slug = ?, brand = ?, model = ?, year = ?, version = ?, category = ?, fuel = ?, transmission = ?, mileage = ?, color = ?, price = ?, description = ?, location = ?, origin = ?, status = 'Disponible', published = 1, featured = ?, updated_at = ? WHERE id = ?");
    $delImg = $pdo->prepare('DELETE FROM vehicle_images WHERE vehicle_id = ?');
    $insImg = $pdo->prepare('INSERT INTO vehicle_images (id, vehicle_id, storage_path, sort_order, created_at) VALUES (?,?,?,?,?)');

    foreach ($rows as $rank => $r) {
        $id = 'sa-' . $r['stockId'];
        $slug = slugify("{$r['brand']} {$r['model']} {$r['year']} {$r['plate']}");
        $desc = "Patente {$r['plate']}. Ubicación: {$r['location']}. Origen: {$r['origin']}.";
        $feat = isset($featured[$r['stockId']]) ? 1 : 0;

        $photos = [];
        foreach ($folders[$r['stockId']] ?? [] as $candidate) {
            try {
                $urls = photo_urls($candidate);
                if (count($urls) > count($photos)) {
                    $photos = $urls;
                }
                if (count($photos) >= 4) {
                    break;
                }
            } catch (Throwable $e) {
                logln("Drive ID {$r['stockId']}: " . $e->getMessage());
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
            $r['fuel'], $r['transmission'], $r['mileage'], $r['color'] ?: null, $r['price'], $desc, $r['location'], $r['origin']];
        if ($found) {
            $id = $found['id'];
            $update->execute(array_merge($params, [$feat, $now, $id]));
        } else {
            $insert->execute(array_merge([$id], $params, [$feat, $now, $now]));
        }
        // Fotos: Drive manda; si Drive no responde se conservan las actuales.
        $hasUploads = $pdo->prepare("SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = ? AND storage_path LIKE '/uploads/%'");
        $hasUploads->execute([$id]);
        if ($photos || !$found) {
            if ((int) $hasUploads->fetchColumn() === 0) {
                $delImg->execute([$id]);
                foreach (($photos ?: [PLACEHOLDER]) as $i => $p) {
                    $insImg->execute([uuid4(), $id, $p, $i, $now]);
                }
            }
        }
        $pdo->commit();
        $keep[] = $id;
    }

    $marks = implode(',', array_fill(0, count($keep), '?'));
    $del = $pdo->prepare("DELETE FROM vehicles WHERE source = 'sheet' AND id NOT IN ({$marks})");
    $del->execute($keep);
    $removed = $del->rowCount();

    $pdo->prepare('UPDATE sync_runs SET finished_at = ?, ok = 1, vehicles = ?, removed = ?, message = ? WHERE id = ?')
        ->execute([now_db(), count($rows), $removed, 'ok', $runId]);
    logln('OK: ' . count($rows) . " unidades, {$removed} retiradas");
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $pdo->prepare('UPDATE sync_runs SET finished_at = ?, ok = 0, message = ? WHERE id = ?')
        ->execute([now_db(), mb_substr($e->getMessage(), 0, 500), $runId]);
    logln('ERROR: ' . $e->getMessage());
    exit(1);
}