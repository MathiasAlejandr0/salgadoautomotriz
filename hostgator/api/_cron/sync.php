<?php
declare(strict_types=1);

/*
 * Sincroniza la pestaña "SALGADO AUTOMOTRIZ" de la planilla + fotos de Drive
 * hacia MySQL. La pestaña tiene varios bloques: la lista principal y, más
 * abajo, UNI CHILE / CARDONAL / SALGADO (columnas corridas, sin ORIGEN ni ID).
 * Cada encabezado arma su mapa. El N° de esas listas no es un ID. La planilla
 * manda: lo que no está se ARCHIVA (status Vendido, published 0; no se borra
 * ni pierde fotos). Solo toca vehículos con source='sheet'; los del admin no.

 * Fotos de Drive: se copian a /uploads/drive como WebP + miniatura (GD).
 * Fotos subidas a mano o con orden/portada fijada en el admin (photos_locked) no se tocan.
 * Fotos curadas del repo: se publican una vez (source=upload, photos_locked=1).
 * Si la carpeta del mapa cambió, se reemplaza solo ese set; las subidas a mano quedan.
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
require_once dirname(__DIR__) . '/_lib/photo_exclusions.php';
require_once dirname(__DIR__) . '/_lib/curated_photos.php';

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

/** El visor público trae `name: "PESTAÑA" ... gid: "123"`. gviz no sirve: tipa columnas y borra texto. */
function sheet_gid_from_html(string $html, string $tab): ?string
{
    $want = fold($tab);
    if (!preg_match_all('/name:\s*"([^"]+)"[^}]*?gid:\s*"(\d+)"/', $html, $matches, PREG_SET_ORDER)) {
        return null;
    }
    foreach ($matches as $m) {
        $name = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
        if (fold($name) === $want) {
            return $m[2];
        }
    }
    return null;
}

function sheet_csv(string $sheetId, string $tab): string
{
    // gviz marca la columna del ID como número y deja vacías las patentes
    // de los bloques de abajo. El export CSV conserva ese texto.
    $html = http_get('https://docs.google.com/spreadsheets/d/' . rawurlencode($sheetId) . '/htmlview');
    $gid = sheet_gid_from_html($html, $tab);
    if ($gid === null) {
        throw new RuntimeException("No se encontró la pestaña {$tab} para exportar el CSV");
    }
    logln("Planilla {$tab} gid {$gid}");
    $csv = http_get('https://docs.google.com/spreadsheets/d/' . rawurlencode($sheetId) . '/export?format=csv&gid=' . rawurlencode($gid));
    $head = strtolower(substr($csv, 0, 120));
    if (str_contains($head, '<html') || str_contains($head, '<!doctype')) {
        throw new RuntimeException('La planilla no está compartida como lectura pública');
    }
    return $csv;
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
    $text = preg_replace('/^\xEF\xBB\xBF/', '', $text) ?? $text;
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

/** Todas las columnas cuyo rótulo contiene alguna aguja, de izquierda a derecha. */
function col_all(array $header, string ...$needles): array
{
    $hits = [];
    foreach ($header as $i => $cell) {
        $label = fold($cell);
        if ($label === '') {
            continue;
        }
        foreach ($needles as $n) {
            if (str_contains($label, $n)) {
                $hits[] = (int) $i;
                break;
            }
        }
    }
    return $hits;
}

/** N°, Nº, NRO: índice de lista. Se repite entre bloques y no es el ID de las fotos. */
function is_index_label(string $label): bool
{
    $compact = preg_replace('/[^A-Z0-9]/', '', $label) ?? '';
    return in_array($compact, ['N', 'NO', 'NRO', 'NUM', 'NUMERO'], true);
}

function col_id(array $header): int
{
    foreach ($header as $i => $cell) {
        $label = fold($cell);
        if ($label === '' || is_index_label($label)) {
            continue;
        }
        if (preg_match('/\bID\b/', $label)) {
            return (int) $i;
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
    if (preg_match('/^\s*(\d+(?:\.\d+)?)[eE]\+?(\d+)\s*$/', $s, $sci)) {
        $n = (int) round((float) $sci[1] * (10 ** (int) $sci[2]));
        return $n >= 1000000 ? $n : 0;
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

function guess_category(string $model, string $brand = ''): string
{
    // La marca entra porque hay fichas como RAM 700, donde el modelo es solo "700".
    $m = strtoupper(trim($brand . ' ' . $model));
    if (preg_match('/AMAROK|HILUX|NAVARA|RANGER|\bL200\b|WINGLE|\bT6\b|\bT60\b|FRONTIER|SAVEIRO|COLORADO|RAPTOR|VIGUS|D\s*-?\s*MAX|BT\s*-?\s*50|\bNP300\b|TRITON|TACOMA|ALASKAN|STRADA|OROCH|SILVERADO|MAVERICK|\bF\s*-?\s*150\b|\bPOER\b|\bRAM\s*700\b/', $m)) {
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

function is_header_row(array $row): bool
{
    $hasPlate = false;
    $hasBrand = false;
    foreach ($row as $cell) {
        $label = fold($cell);
        if (str_contains($label, 'PATENTE')) {
            $hasPlate = true;
        }
        if (str_contains($label, 'MARCA')) {
            $hasBrand = true;
        }
    }
    return $hasPlate && $hasBrand;
}

/** Título de sección (UNI CHILE, CARDONAL, SALGADO): una sola celda, sin datos de auto. */
function section_title(array $row): string
{
    $cells = [];
    foreach ($row as $c) {
        $t = trim((string) $c);
        if ($t !== '') {
            $cells[] = $t;
        }
    }
    if (count($cells) !== 1) {
        return '';
    }
    $text = $cells[0];
    $f = fold($text);
    if ($f === '' || strlen($f) < 3 || strlen($f) > 40 || preg_match('/\d/', $f)) {
        return '';
    }
    if (!preg_match('/^[A-Z ]+$/', $f)) {
        return '';
    }
    if (str_contains($f, 'PATENTE') || str_contains($f, 'MARCA') || str_contains($f, 'PRECIO') || str_contains($f, 'ORIGEN')) {
        return '';
    }
    $brandKey = preg_replace('/\s+/', ' ', $f) ?? '';
    if (isset(BRANDS[$brandKey]) || clean_plate($text) !== '') {
        return '';
    }
    return title_case($text);
}

function row_is_blank(array $row): bool
{
    foreach ($row as $c) {
        if (trim((string) $c) !== '') {
            return false;
        }
    }
    return true;
}

function row_is_unavailable(array $row): bool
{
    return (bool) preg_match('/\b(VENDIDO|RESERVADO|ENTREGADO)\b/', fold(implode(' ', $row)));
}

function looks_like_date(string $s): bool
{
    $f = fold($s);
    if ($f === '') {
        return false;
    }
    if (preg_match('/\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/', $f)) {
        return true;
    }
    return (bool) preg_match('/^\d{4,6}(\.0+)?$/', $f);
}

/** @return array{origin: int, id: int, plate: int, brand: int, model: int, color: int, year: int, price: int, offer: int, km: int, location: int, location_alt: int, shifted: bool} */
function header_map(array $h): array
{
    $prices = col_all($h, 'PRECIO');
    return [
        'origin' => col($h, 'ORIGEN'),
        'id' => col_id($h),
        'plate' => col($h, 'PATENTE'),
        'brand' => col($h, 'MARCA'),
        'model' => col($h, 'MODELO'),
        'color' => col($h, 'COLOR'),
        'year' => col($h, 'ANO'),
        'price' => $prices[0] ?? -1,
        'offer' => $prices[1] ?? -1,
        'km' => col($h, 'KILOMET'),
        'location' => col($h, 'UBICACION'),
        'location_alt' => -1,
        'shifted' => false,
    ];
}

/**
 * Bloque sin encabezado propio: N° en la columna de ORIGEN, patente donde iba el ID,
 * marca donde iba la patente. El precio de lista cae en la columna del año y el de
 * oferta queda en la columna de precio. La ubicación pasa una columna a la derecha.
 */
function shift_map(array $map, int $by = 1): array
{
    $shifted = $map;
    $shifted['origin'] = -1;
    $shifted['id'] = -1;
    foreach (['plate', 'brand', 'model', 'color', 'year'] as $key) {
        if ($map[$key] >= $by) {
            $shifted[$key] = $map[$key] - $by;
        }
    }
    // Lista, oferta y km siguen al año, sin importar cuánto se corrió el bloque.
    $shifted['price'] = $shifted['year'] + 1;
    $shifted['offer'] = $shifted['year'] + 2;
    $shifted['km'] = $shifted['year'] + 3;
    if ($map['location'] >= 0) {
        $shifted['location'] = $map['location'] + 1;
        $shifted['location_alt'] = $map['location'];
    }
    $shifted['shifted'] = true;
    return $shifted;
}

/** Cuántas columnas a la izquierda quedó la patente respecto del encabezado (0 = no está corrida). */
function row_shift_by(array $row, array $map): int
{
    if ($map['shifted'] || $map['plate'] <= 0 || $map['year'] <= 0) {
        return 0;
    }
    $yearNow = (int) date('Y');
    $yearOk = static fn (int $y): bool => $y >= 1990 && $y <= $yearNow + 1;
    if (clean_plate(cell($row, $map['plate'])) !== '') {
        return 0;
    }
    foreach ([1, 2] as $by) {
        if ($map['plate'] - $by >= 0 && $map['year'] - $by >= 0
            && clean_plate(cell($row, $map['plate'] - $by)) !== ''
            && !$yearOk((int) cell($row, $map['year']))
            && $yearOk((int) cell($row, $map['year'] - $by))) {
            return $by;
        }
    }
    return 0;
}

function sheet_stock_id($raw): string
{
    $s = trim((string) $raw);
    if ($s === '' || clean_plate($s) !== '') {
        return '';
    }
    if (preg_match('/^\d+(?:\.0+)?$/', $s)) {
        return (string) (int) $s;
    }
    if (preg_match('/\b(\d+)\b/', $s, $m)) {
        return $m[1];
    }
    return '';
}

function pick_price(array $row, int $listIndex, int $offerIndex): int
{
    if ($offerIndex >= 0) {
        $offer = parse_clp(cell($row, $offerIndex));
        if ($offer > 0) {
            return $offer;
        }
    }
    return parse_clp(cell($row, $listIndex));
}

function location_of(array $row, array $map, string $section): string
{
    $candidates = [];
    if ($map['location'] >= 0) {
        $candidates[] = (string) cell($row, $map['location']);
    }
    if ($map['location_alt'] >= 0) {
        $candidates[] = (string) cell($row, $map['location_alt']);
    }
    if ($section !== '') {
        $candidates[] = $section;
    }
    foreach ($candidates as $raw) {
        $loc = title_case($raw);
        if ($loc !== '' && !looks_like_date($loc)) {
            return $loc;
        }
    }
    return 'Patio';
}

function parse_vehicle_row(array $row, array $map, string $section): ?array
{
    if (row_is_unavailable($row)) {
        return null;
    }
    $plate = clean_plate(cell($row, $map['plate']));
    $brand = clean_brand(cell($row, $map['brand']));
    $model = trim((string) cell($row, $map['model']));
    $year = (int) cell($row, $map['year']);
    $price = pick_price($row, $map['price'], $map['offer']);
    $yearNow = (int) date('Y');
    if ($plate === '' || $brand === '' || $model === '' || $year < 1990 || $year > $yearNow + 1 || $price <= 0) {
        return null;
    }
    // Sin columna ID el stock es la patente. El N° nunca se usa, aunque sea numérico.
    $stock = $map['id'] >= 0 ? sheet_stock_id(cell($row, $map['id'])) : '';
    $spec = vehicle_specs($brand, $model, $year);
    return [
        'stockId' => $stock !== '' ? $stock : $plate,
        'hasSheetId' => $stock !== '',
        'plate' => $plate,
        'brand' => $brand,
        'model' => strtoupper($model),
        'color' => title_case((string) cell($row, $map['color'])),
        'year' => $year,
        'price' => $price,
        'mileage' => parse_km(cell($row, $map['km'])),
        'fuel' => $spec['fuel'],
        'transmission' => $spec['transmission'],
        'engine' => $spec['engine'],
        'doors' => $spec['doors'],
        'traction' => $spec['traction'],
        'power' => $spec['power'],
        'category' => guess_category($model, $brand),
        'location' => location_of($row, $map, $section),
        'origin' => fold(cell($row, $map['origin'])) ?: 'STOCK',
    ];
}

function parse_salgado_rows(array $rows): array
{
    $driveFolder = null;
    foreach (array_slice($rows, 0, 8) as $row) {
        if (preg_match('#drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)#', implode(' ', $row), $m)) {
            $driveFolder = $m[1];
        }
    }
    $map = null;
    $section = '';
    $out = [];
    $seen = [];
    foreach ($rows as $row) {
        if (row_is_blank($row)) {
            continue;
        }
        if (is_header_row($row)) {
            $map = header_map($row);
            continue;
        }
        // El banner "STOCK SALGADO..." está antes del primer encabezado: no es una sección.
        if ($map !== null) {
            $title = section_title($row);
            if ($title !== '') {
                $section = $title;
                continue;
            }
        }
        if ($map === null) {
            continue;
        }
        $by = row_shift_by($row, $map);
        if ($by > 0) {
            $map = shift_map($map, $by);
        }
        $vehicle = parse_vehicle_row($row, $map, $section);
        if ($vehicle === null || isset($seen[$vehicle['plate']])) {
            continue;
        }
        $seen[$vehicle['plate']] = true;
        $out[] = $vehicle;
    }
    return [$out, $driveFolder, $map !== null];
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

/** Imagick con HEIC: solo hace falta si Drive no entrega la versión JPEG renderizada. */
function heic_supported(): bool
{
    static $ok = null;
    if ($ok === null) {
        try {
            $ok = class_exists('Imagick') && \Imagick::queryFormats('HEIC') !== [];
        } catch (Throwable $e) {
            $ok = false;
        }
    }
    return $ok;
}

/** @return array<int, array{id: string, name: string}> imágenes de la carpeta, en orden natural por nombre */
function photo_files(string $folderId): array
{
    // HEIC/HEIF/DNG: Drive las entrega ya renderizadas a JPEG (lh3); si no, se convierten o se omiten.
    // "._*" son metadatos de macOS (AppleDouble), no fotos: se omiten.
    $files = array_values(array_filter(
        drive_listing($folderId),
        fn ($e) => !$e['folder'] && !str_starts_with($e['name'], '._') && preg_match('/\.(jpe?g|png|webp|heic|heif|dng)$/i', $e['name'])
    ));
    usort($files, fn ($a, $b) => strnatcasecmp($a['name'], $b['name']));
    return array_map(fn ($e) => ['id' => $e['id'], 'name' => $e['name']], $files);
}

/**
 * Une las fotos de todas las carpetas de un mismo ID: primero las carpetas "nuevas",
 * sin repetir archivos con el mismo nombre (carpetas duplicadas), hasta $limit.
 *
 * @param array<int, array{id: string, name: string}> $candidates
 * @return string[]
 */
function merged_photo_ids(array $candidates, string $stockId, int $limit = 12): array
{
    usort($candidates, fn ($a, $b) => (int) !preg_match('/nueva/i', $a['name']) <=> (int) !preg_match('/nueva/i', $b['name']));
    $ids = [];
    $seen = [];
    foreach ($candidates as $folder) {
        try {
            collect_public_photo_ids(photo_files($folder['id']), $seen, $ids, $limit);
            if (count($ids) >= $limit) {
                return $ids;
            }
        } catch (Throwable $e) {
            logln("Drive ID {$stockId} ({$folder['name']}): " . $e->getMessage());
        }
    }
    return $ids;
}

/**
 * Quita de la base y de /uploads/drive las fotos con patente descubierta.
 * Idempotente: si la fila o el archivo ya no están, sigue. No toca Drive.
 */
function purge_excluded_vehicle_photos(PDO $pdo): int
{
    $rows = $pdo->query('SELECT id, vehicle_id, storage_path, thumb_path, drive_file_id FROM vehicle_images')->fetchAll();
    $drop = $pdo->prepare('DELETE FROM vehicle_images WHERE id = ?');
    $touched = [];
    $removed = 0;
    foreach ($rows as $img) {
        if (!image_record_is_excluded($img)) {
            continue;
        }
        $drop->execute([$img['id']]);
        $removed++;
        $touched[(string) $img['vehicle_id']] = true;
    }
    $dir = uploads_dir() . '/drive';
    foreach (excluded_photo_ids() as $fileId) {
        remove_excluded_drive_files($dir, $fileId);
    }
    if ($touched) {
        $list = $pdo->prepare('SELECT id FROM vehicle_images WHERE vehicle_id = ? ORDER BY sort_order ASC, created_at ASC, id ASC');
        $set = $pdo->prepare('UPDATE vehicle_images SET sort_order = ? WHERE id = ? AND vehicle_id = ?');
        foreach (array_keys($touched) as $vehicleId) {
            $list->execute([$vehicleId]);
            $order = 0;
            foreach ($list->fetchAll() as $row) {
                $set->execute([$order, $row['id'], $vehicleId]);
                $order++;
            }
        }
    }
    return $removed;
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
        return ['deferred', null]; // se descarga en la próxima corrida; nunca se publica la URL de Drive
    }
    $budget--;
    foreach (["https://lh3.googleusercontent.com/d/{$fileId}=w1600", 'https://drive.google.com/uc?export=download&id=' . rawurlencode($fileId)] as $url) {
        try {
            $bytes = http_get($url, 2);
        } catch (Throwable $e) {
            continue;
        }
        if (preg_match('/^.{4}ftyp(heic|heix|hevc|mif1|msf1)/s', $bytes)) {
            $bytes = heic_to_jpeg($bytes);
            if ($bytes === null) {
                continue;
            }
        }
        $saved = save_optimized($bytes, $dir, $fileId);
        if ($saved) {
            return ["/uploads/drive/{$saved[0]}", "/uploads/drive/{$saved[1]}"];
        }
    }
    logln("Foto {$fileId}: no se pudo descargar o no es una imagen válida; se omite");
    return null;
}

/**
 * Qué hacer con el set curado, sin volver a pisarlo en cada sync.
 *
 * fresh: no hay fotos source=upload (siguen las de Drive, o no hay) → se reemplaza la galería.
 * refresh: las fotos upload son solo una carpeta curada distinta a la del mapa → se reemplaza entera.
 * refresh-keep: cambió esa carpeta y además hay fotos subidas a mano → se cambia el set y esas quedan.
 * keep: la carpeta guardada ya es la del mapa, o no hay un set curado único que rotar.
 *
 * @param list<array{source?: string, storage_path?: string}> $images
 * @return array{action: string, saved_dir: ?string}
 */
function curated_publish_plan(array $images, string $dir): array
{
    $dirs = [];
    $uploads = 0;
    $manual = 0;
    foreach ($images as $img) {
        $source = (string) ($img['source'] ?? '');
        $path = (string) ($img['storage_path'] ?? '');
        $curatedDir = null;
        if (preg_match('#^/uploads/curated/([a-f0-9]{12})/#', $path, $m)) {
            $curatedDir = $m[1];
        }
        // /uploads/vehicles/ es una subida del admin aunque el source no haya quedado en 'upload'.
        $manualPath = preg_match('#^/uploads/vehicles/#', $path) === 1;
        if ($source !== 'upload' && !$manualPath) {
            continue;
        }
        $uploads++;
        if ($curatedDir !== null && $source === 'upload' && !$manualPath) {
            $dirs[$curatedDir] = true;
        } else {
            $manual++;
        }
    }
    if ($uploads === 0) {
        return ['action' => 'fresh', 'saved_dir' => null];
    }
    if (count($dirs) === 1 && !isset($dirs[$dir])) {
        $saved = array_key_first($dirs);
        return [
            'action' => $manual === 0 ? 'refresh' : 'refresh-keep',
            'saved_dir' => is_string($saved) ? $saved : null,
        ];
    }
    return ['action' => 'keep', 'saved_dir' => null];
}

/**
 * @param array<int, array{0: string, 1: string}> $pairs
 */
function insert_curated_set(PDOStatement $ins, string $vehicleId, array $pairs, string $now): void
{
    foreach ($pairs as $i => [$path, $thumb]) {
        $ins->execute([uuid4(), $vehicleId, $path, $thumb, 'upload', null, $i, $now]);
    }
}

/** Borra la copia publicada de una carpeta curada que ya no está en el mapa. */
function remove_published_curated_dir(string $dir): void
{
    if (!preg_match('/^[a-f0-9]{12}$/', $dir)) {
        return;
    }
    foreach (curated_photos() as $cur) {
        if (($cur['dir'] ?? '') === $dir) {
            return;
        }
    }
    $path = uploads_dir() . '/curated/' . $dir;
    if (!is_dir($path)) {
        return;
    }
    foreach (scandir($path) ?: [] as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $file = $path . '/' . $name;
        if (is_file($file) && !@unlink($file)) {
            logln("Fotos curadas {$dir}: no se pudo borrar {$name} en uploads");
        }
    }
    if (!@rmdir($path)) {
        logln("Fotos curadas {$dir}: la carpeta vieja de uploads quedó con archivos");
    }
}

/**
 * Fotos curadas del repo (api/_lib/curated/<dir>/NN.webp): las copia a uploads/curated/<dir>/
 * (solo si faltan o cambió el tamaño) y devuelve [[ruta, miniatura], ...] en orden, portada primero.
 * Devuelve null si falta algún archivo fuente o no se pudo copiar (no se publica a medias).
 *
 * @return array<int, array{0: string, 1: string}>|null
 */
function publish_curated_photos(string $stockId): ?array
{
    $cur = curated_photos()[$stockId] ?? null;
    if (!$cur || !preg_match('/^[a-f0-9]{12}$/', $cur['dir'])) {
        return null;
    }
    $src = dirname(__DIR__) . '/_lib/curated/' . $cur['dir'];
    $dst = uploads_dir() . '/curated/' . $cur['dir'];
    if (!is_dir($dst) && !@mkdir($dst, 0755, true)) {
        logln("Fotos curadas {$cur['dir']}: no se pudo crear la carpeta");
        return null;
    }
    $out = [];
    for ($i = 1; $i <= $cur['count']; $i++) {
        $pair = [];
        foreach ([sprintf('%02d.webp', $i), sprintf('%02d_t.webp', $i)] as $name) {
            if (!is_file("{$src}/{$name}")) {
                logln("Fotos curadas {$cur['dir']}: falta {$name} en el repo");
                return null;
            }
            if (!is_file("{$dst}/{$name}") || filesize("{$dst}/{$name}") !== filesize("{$src}/{$name}")) {
                if (!@copy("{$src}/{$name}", "{$dst}/{$name}.tmp") || !@rename("{$dst}/{$name}.tmp", "{$dst}/{$name}")) {
                    logln("Fotos curadas {$cur['dir']}: no se pudo copiar {$name}");
                    return null;
                }
            }
            $pair[] = "/uploads/curated/{$cur['dir']}/{$name}";
        }
        $out[] = $pair;
    }
    return $out;
}

function heic_to_jpeg(string $bytes): ?string
{
    if (!heic_supported()) {
        return null;
    }
    try {
        $im = new \Imagick();
        $im->readImageBlob($bytes);
        $im->setImageFormat('jpeg');
        return $im->getImageBlob();
    } catch (Throwable $e) {
        return null;
    }
}

/** Patentes en el nombre de una carpeta. "ID 341" no es una patente. */
function plates_in_folder_name(string $name): array
{
    $clean = preg_replace('/\bID\s*\d+\b/i', ' ', $name) ?? $name;
    $found = [];
    $whole = clean_plate($clean);
    if ($whole !== '') {
        $found[$whole] = true;
    }
    if (preg_match_all('/[A-Za-z]{2,4}[\s.\-]*\d{2,4}/', $clean, $m)) {
        foreach ($m[0] as $tok) {
            $plate = clean_plate($tok);
            if ($plate !== '') {
                $found[$plate] = true;
            }
        }
    }
    return array_keys($found);
}

/**
 * Carpetas "ID 123" por id, y el resto por patente.
 * El N° de las listas de abajo no entra: se repite y chocaría con "ID 8", "ID 10", etc.
 *
 * @param array<int, array{id?: string, name?: string, folder?: bool}> $entries
 * @return array{id: array<string, array<int, array{id: string, name: string}>>, plate: array<string, array<int, array{id: string, name: string}>>}
 */
function index_drive_folders(array $entries): array
{
    $byId = [];
    $byPlate = [];
    foreach ($entries as $e) {
        if (empty($e['folder'])) {
            continue;
        }
        $name = (string) ($e['name'] ?? '');
        $item = ['id' => (string) ($e['id'] ?? ''), 'name' => $name];
        if (preg_match('/\bID\s*(\d+)\b/i', $name, $m)) {
            $byId[$m[1]][] = $item;
        }
        foreach (plates_in_folder_name($name) as $plate) {
            $byPlate[$plate][] = $item;
        }
    }
    return ['id' => $byId, 'plate' => $byPlate];
}

function drive_folders_for_row(array $index, array $row): array
{
    if (!empty($row['hasSheetId'])) {
        return $index['id'][$row['stockId']] ?? [];
    }
    return $index['plate'][$row['plate']] ?? [];
}

function salgado_sync_is_entry(): bool
{
    $self = realpath(__FILE__);
    if ($self === false) {
        return false;
    }
    $script = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
    if ($script !== false && $script === $self) {
        return true;
    }
    $arg = realpath((string) ($_SERVER['argv'][0] ?? ''));
    return $arg !== false && $arg === $self;
}

if (!salgado_sync_is_entry()) {
    return;
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
    $purged = purge_excluded_vehicle_photos($pdo);
    if ($purged > 0) {
        logln('Fotos con patente descubierta retiradas: ' . $purged);
    }

    $sheet = google_id(cfg('sheet_id'), '1BG2uR6APbXEMvVvRmdR-Nn0Vko6eobJ6Xam0XX41Ldc');
    $tab = (string) cfg('sheet_tab', 'SALGADO AUTOMOTRIZ');
    $csv = sheet_csv($sheet, $tab);
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
    $driveIndex = ['id' => [], 'plate' => []];
    $driveOk = true;
    try {
        $driveIndex = index_drive_folders(drive_listing($folderId));
        logln('Drive índice: ' . count($driveIndex['id']) . ' carpetas con ID, ' . count($driveIndex['plate']) . ' con patente');
    } catch (Throwable $e) {
        $driveOk = false;
        logln('Drive índice no disponible, se conservan las fotos actuales: ' . $e->getMessage());
    }

    usort($rows, fn ($a, $b) => location_rank($a['location']) <=> location_rank($b['location']));

    // 1) Fotos de Drive por unidad (antes de elegir destacados).
    // Con ID se usa la carpeta "ID n". Sin ID (listas de abajo) se busca por patente.
    // No se borra nada en Drive: solo se copian fotos nuevas al hosting.
    $budget = (int) cfg('sync_photo_budget', 150);
    foreach ($rows as &$r) {
        $label = !empty($r['hasSheetId']) ? $r['stockId'] : $r['plate'];
        // Unidades con fotos curadas en el repo: no se usa Drive para ellas.
        $r['photos'] = isset(curated_photos()[$r['stockId']]) ? [] : merged_photo_ids(drive_folders_for_row($driveIndex, $r), $label);
    }
    unset($r);

    $find = $pdo->prepare('SELECT id, source, photos_locked FROM vehicles WHERE id = ? OR stock_id = ? OR plate = ? LIMIT 1');
    $realPhotos = $pdo->prepare("SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = ? AND storage_path NOT LIKE '%placeholder%'");
    $hasRealPhotos = function (array $r) use ($find, $realPhotos): bool {
        if ($r['photos'] || isset(curated_photos()[$r['stockId']])) {
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
    $listImgs = $pdo->prepare('SELECT source, storage_path FROM vehicle_images WHERE vehicle_id = ?');
    $delDriveLeftovers = $pdo->prepare("DELETE FROM vehicle_images WHERE vehicle_id = ? AND source <> 'upload' AND storage_path NOT LIKE '/uploads/vehicles/%'");
    $delCuratedDir = $pdo->prepare('DELETE FROM vehicle_images WHERE vehicle_id = ? AND storage_path LIKE ?');
    $restImgs = $pdo->prepare('SELECT id FROM vehicle_images WHERE vehicle_id = ? AND storage_path NOT LIKE ? ORDER BY sort_order ASC, created_at ASC, id ASC');
    $setImgOrder = $pdo->prepare('UPDATE vehicle_images SET sort_order = ? WHERE id = ? AND vehicle_id = ?');
    $lockPhotos = $pdo->prepare('UPDATE vehicles SET photos_locked = 1 WHERE id = ?');
    $photoStats = ['mirrored' => 0, 'skipped' => 0];

    foreach ($rows as $rank => $r) {
        $retireCuratedDir = null;
        $id = 'sa-' . $r['stockId'];
        $slug = slugify("{$r['brand']} {$r['model']} {$r['year']} {$r['plate']}");
        $desc = "Patente {$r['plate']}. Ubicación: {$r['location']}. Origen: {$r['origin']}.";
        $feat = isset($featured[$r['stockId']]) ? 1 : 0;

        // Descargas fuera de la transacción.
        $images = [];
        $deferred = false;
        foreach ($r['photos'] as $fileId) {
            $m = mirror_drive_photo($fileId, $budget);
            if ($m && $m[0] === 'deferred') {
                $deferred = true;
            } elseif ($m) {
                $images[] = [$m[0], $m[1], $fileId];
                $photoStats['mirrored']++;
            } else {
                $photoStats['skipped']++;
            }
        }

        // Fotos curadas del repo: copia de archivos fuera de la transacción.
        $curated = publish_curated_photos($r['stockId']);

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
        // Si quedaron fotos pendientes por el tope de descargas, no se reemplaza a medias.
        if ($deferred && $found) {
            $locked = true;
        }
        if ($curated) {
            // La primera vez reemplazan a Drive. Si la carpeta del mapa cambió respecto a la
            // guardada en /uploads/curated/<carpeta>/, se reemplaza ese set una sola vez.
            // Las fotos que el admin subió a mano (otra ruta, source=upload) no se borran.
            // Con la carpeta ya al día no se vuelve a pisar: quedan source=upload y photos_locked.
            $curDir = (string) (curated_photos()[$r['stockId']]['dir'] ?? '');
            $listImgs->execute([$id]);
            $plan = curated_publish_plan($listImgs->fetchAll(), $curDir);
            $savedDir = $plan['saved_dir'];
            $rotating = ($plan['action'] === 'refresh' || $plan['action'] === 'refresh-keep')
                && is_string($savedDir)
                && preg_match('/^[a-f0-9]{12}$/', $savedDir) === 1
                && $savedDir !== $curDir;
            if ($plan['action'] === 'fresh' || ($plan['action'] === 'refresh' && $rotating)) {
                $delImg->execute([$id]);
                insert_curated_set($insImg, $id, $curated, $now);
                $lockPhotos->execute([$id]);
                if ($rotating) {
                    logln("Fotos curadas {$curDir}: reemplaza la carpeta {$savedDir}");
                    $retireCuratedDir = $savedDir;
                }
            } elseif ($plan['action'] === 'refresh-keep' && $rotating) {
                $delCuratedDir->execute([$id, '/uploads/curated/' . $savedDir . '/%']);
                $delDriveLeftovers->execute([$id]);
                insert_curated_set($insImg, $id, $curated, $now);
                $restImgs->execute([$id, '/uploads/curated/' . $curDir . '/%']);
                $n = count($curated);
                foreach ($restImgs->fetchAll() as $row) {
                    $setImgOrder->execute([$n++, $row['id'], $id]);
                }
                $lockPhotos->execute([$id]);
                logln("Fotos curadas {$curDir}: reemplaza la carpeta {$savedDir} y conserva las subidas a mano");
                $retireCuratedDir = $savedDir;
            }
            $locked = true;
        }
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
        // Ocultas hasta tener fotos reales: se publican solas cuando llegan fotos (Drive o admin).
        if (in_array($r['stockId'], hidden_until_photos(), true)) {
            $realPhotos->execute([$id]);
            if ((int) $realPhotos->fetchColumn() === 0) {
                $pdo->prepare('UPDATE vehicles SET published = 0, featured = 0 WHERE id = ?')->execute([$id]);
            }
        }
        $pdo->commit();
        if (is_string($retireCuratedDir)) {
            remove_published_curated_dir($retireCuratedDir);
        }
        $keep[] = $id;
    }

    // Limpieza: URLs remotas de Drive que quedaron de versiones anteriores del sync.
    // Se intenta copiarlas; si no se puede, se quitan (y si el auto queda sin fotos, placeholder).
    $remote = $pdo->query("SELECT i.id, i.vehicle_id, i.storage_path FROM vehicle_images i JOIN vehicles v ON v.id = i.vehicle_id WHERE i.storage_path LIKE 'http%'")->fetchAll();
    $fix = $pdo->prepare('UPDATE vehicle_images SET storage_path = ?, thumb_path = ?, drive_file_id = ? WHERE id = ?');
    $drop = $pdo->prepare('DELETE FROM vehicle_images WHERE id = ?');
    $touched = [];
    foreach ($remote as $img) {
        $fileId = preg_match('#googleusercontent\.com/d/([A-Za-z0-9_-]+)#', $img['storage_path'], $mm) ? $mm[1] : null;
        $m = $fileId ? mirror_drive_photo($fileId, $budget) : null;
        if ($m && $m[0] === 'deferred') {
            continue;
        }
        if ($m) {
            $fix->execute([$m[0], $m[1], $fileId, $img['id']]);
        } else {
            $drop->execute([$img['id']]);
            $photoStats['skipped']++;
        }
        $touched[$img['vehicle_id']] = true;
    }
    $empty = $pdo->prepare('SELECT COUNT(*) FROM vehicle_images WHERE vehicle_id = ?');
    foreach (array_keys($touched) as $vid) {
        $empty->execute([$vid]);
        if ((int) $empty->fetchColumn() === 0) {
            $insImg->execute([uuid4(), $vid, PLACEHOLDER, null, 'drive', null, 0, $now]);
        }
    }
    if ($remote) {
        logln('Limpieza de URLs de Drive: ' . count($remote) . ' revisadas');
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