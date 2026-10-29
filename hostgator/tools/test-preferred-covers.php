<?php
declare(strict_types=1);

/**
 * Portada preferida: la foto se identifica por id de Drive o por archivo
 * curado, no por su posición. Pasa a sort_order 0 y el resto conserva el orden.
 * No se borra ninguna.
 *
 *   php hostgator/tools/test-preferred-covers.php
 */

require dirname(__DIR__) . '/api/_lib/preferred_covers.php';
require dirname(__DIR__) . '/api/_lib/curated_photos.php';
require dirname(__DIR__) . '/api/_lib/photo_exclusions.php';

$failed = 0;

function check(bool $ok, string $msg): void
{
    global $failed;
    if ($ok) {
        fwrite(STDOUT, "ok  {$msg}\n");
        return;
    }
    $failed++;
    fwrite(STDERR, "FAIL {$msg}\n");
}

/** @param array<int, array> $images */
function paths(array $images): array
{
    return array_map(static fn (array $img): string => (string) ($img['storage_path'] ?? $img[0] ?? ''), $images);
}

$expected = [
    'RGBP20' => 'curated:da4fe0f31548/02',
    '299' => 'drive:1OAy6SP3izB48ViiSGzV3OCE_xnaDefJb',
    '315' => 'drive:1HvVTOv6tBcsrxjoJNrob41mG3GjCoHV_',
    '333' => 'drive:1O7dGfqgqJRdR5Z1FKNqVSTF_wC7Tf2DF',
    '316' => 'drive:1khZHcSQi6gSqatotPLre9qhsKHJM5AsB',
    '302' => 'drive:1i6hs6bA5ELFb3OjyiD2AAKWcuEEDEJ5-',
    '278' => 'drive:1Fqg6mopA01_hPHtGX1BU2h1bVIlirV6u',
    '217' => 'drive:13SDbPFg8skfDwX3dzJ0no_LRXvxnqwfn',
    '209' => 'drive:15FXbCLB6EzCOrrnzqZfS4boRmBLfg_OQ',
    '166' => 'drive:1900bey9XnkzwJiSdcaXvRHosVeUMC7Ar',
    '139' => 'drive:1UxiULhaXODzFUdRd7fJizASTY6b99QNi',
    '131' => 'drive:1foZhWBaDCWbXaVUczaXtq-b4nq-p2fLt',
    '129' => 'drive:10zlLlC9yw61NSyElYTzd8f81XeXqYTDq',
    '118' => 'drive:1WcVJejrVuiVGwOXouwSk6zTjk1XAuwok',
    '112' => 'drive:1o-UmRRIFBZpOJQblQdOvJ7i8ZctJHZAv',
    '108' => 'drive:1FzM0mg4oDey_BlYfsUM4K79ee3WbAj_T',
    '100' => 'drive:1az3sRBa6baC2xw4DNM8wSQG857IbKFRu',
    '87' => 'drive:1BCQamxHHH_3mMF06rFKyuNHNRuasFmS6',
    '66' => 'drive:1TarFG20HU8_VJHtXJ_-aLZ4FT0qHOSFi',
    '37' => 'drive:1XNF_HH2Ln6xt1Al6VGN-r9vYIxo2wmPo',
    '262' => 'drive:1Vc_WiIego_ZtzofimIAE2V-5yVxRbiiZ',
    '231' => 'drive:12d3O-vE1wajuAL1QcMDnISoJhZdMRzS0',
    '107' => 'drive:1EU6PGWn-ncXntKHrV7t8k4WlTOmFGcSA',
    '323' => 'drive:1l2xfTisqo5-B-bnvlBIM4QlX7ByaYW5L',
    'HVHS94' => 'curated:5cf70ae2f9d5/02',
];

$tokens = preferred_cover_tokens();
check($tokens === $expected, 'el mapa tiene las 25 portadas, con la identidad de la propuesta');
check(count($tokens) === 25, 'son 25 stocks');
check(preferred_cover_token('999') === null, 'un stock fuera del mapa no tiene portada preferida');
check(preferred_cover_token('') === null, 'stock vacío no coincide');

$excluded = array_fill_keys(excluded_photo_ids(), true);
foreach ($tokens as $stockId => $token) {
    if (!str_starts_with($token, 'drive:')) {
        continue;
    }
    $id = substr($token, 6);
    check(!isset($excluded[$id]), "{$stockId} no usa una foto con patente descubierta");
}

foreach (['RGBP20' => 'da4fe0f31548', 'HVHS94' => '5cf70ae2f9d5'] as $stockId => $dir) {
    $token = preferred_cover_token($stockId);
    check($token === 'curated:' . $dir . '/02', "{$stockId} apunta a 02.webp de su carpeta");
    $cur = curated_photos()[$stockId] ?? null;
    check(is_array($cur) && ($cur['dir'] ?? '') === $dir, "{$stockId} sigue en el mapa curado");
    $base = dirname(__DIR__) . "/api/_lib/curated/{$dir}/02.webp";
    $thumb = dirname(__DIR__) . "/api/_lib/curated/{$dir}/02_t.webp";
    check(is_file($base) && is_file($thumb), "{$stockId} tiene 02.webp y su miniatura en el repo");
    check((int) ($cur['count'] ?? 0) >= 2, "{$stockId} tiene más de una foto para reordenar");
}

$front = '1khZHcSQi6gSqatotPLre9qhsKHJM5AsB';
$dash = '1vTZYw462LztK3Cq-72XjbyYEP-QQXDD9';
$rexton = [
    [
        'id' => 'dash',
        'storage_path' => "/uploads/drive/{$dash}.webp",
        'thumb_path' => "/uploads/drive/{$dash}_t.webp",
        'sort_order' => 0,
    ],
    [
        'id' => 'front',
        'storage_path' => "/uploads/drive/{$front}.webp",
        'thumb_path' => "/uploads/drive/{$front}_t.webp",
        'sort_order' => 1,
    ],
    [
        'id' => 'rear',
        'storage_path' => '/uploads/drive/1rearRearRearRearRearRR.webp',
        'thumb_path' => '/uploads/drive/1rearRearRearRearRearRR_t.webp',
        'sort_order' => 2,
    ],
];
$ordered = with_preferred_cover($rexton, '316');
check(count($ordered) === 3, 'Rexton 316 no pierde fotos');
check($ordered[0]['id'] === 'front' && $ordered[0]['sort_order'] === 0, 'Rexton 316: el 3/4 derecho queda en sort 0');
check(str_contains((string) $ordered[0]['thumb_path'], $front . '_t.webp'), 'Rexton 316: la miniatura de la portada es la de esa foto');
check($ordered[1]['id'] === 'dash' && $ordered[2]['id'] === 'rear', 'Rexton 316: tablero y trasera conservan el orden');
$again = with_preferred_cover($ordered, '316');
check(paths($again) === paths($ordered), 'aplicar dos veces no vuelve a mover');

$decoy = [
    ['id' => 'a', 'storage_path' => '/uploads/drive/1aaaaaaaaaaaaaaaaaaaaaa.webp', 'sort_order' => 0],
    ['id' => 'decoy', 'storage_path' => '/uploads/drive/1bbbbbbbbbbbbbbbbbbbbbb.webp', 'sort_order' => 1],
    ['id' => 'c', 'storage_path' => '/uploads/drive/1cccccccccccccccccccccc.webp', 'sort_order' => 2],
    ['id' => 'front', 'storage_path' => "/uploads/drive/{$front}.webp", 'drive_file_id' => $front, 'sort_order' => 4],
];
$byId = with_preferred_cover($decoy, '316');
check($byId[0]['id'] === 'front', 'no elige la foto que está en el sort de la candidata: elige el id');
check(array_column($byId, 'id') === ['front', 'a', 'decoy', 'c'], 'el resto se corre y mantiene el orden relativo');
check(array_column($byId, 'sort_order') === [0, 1, 2, 3], 'los sort_order quedan 0..n-1');

$remote = [
    ['id' => 'dash', 'storage_path' => "https://lh3.googleusercontent.com/d/{$dash}=w1600", 'sort_order' => 0],
    ['id' => 'front', 'storage_path' => "https://lh3.googleusercontent.com/d/{$front}=w1600", 'sort_order' => 5],
];
check(with_preferred_cover($remote, '316')[0]['id'] === 'front', 'también reconoce la URL de Drive del build');

$untouched = with_preferred_cover($rexton, 'no-esta');
check(array_column($untouched, 'id') === ['dash', 'front', 'rear'], 'sin override no se reordena');

$missing = with_preferred_cover([
    ['id' => 'only', 'storage_path' => '/uploads/drive/1zzzzzzzzzzzzzzzzzzzzz.webp', 'sort_order' => 0],
    ['id' => 'other', 'storage_path' => '/uploads/drive/1yyyyyyyyyyyyyyyyyyyyyy.webp', 'sort_order' => 1],
], '316');
check(array_column($missing, 'id') === ['only', 'other'], 'si la foto preferida no está, la galería queda igual');

$pairs = [];
for ($i = 1; $i <= 5; $i++) {
    $n = sprintf('%02d', $i);
    $pairs[] = ["/uploads/curated/da4fe0f31548/{$n}.webp", "/uploads/curated/da4fe0f31548/{$n}_t.webp"];
}
$curated = order_curated_pairs($pairs, 'RGBP20');
check(count($curated) === 5, 'RAM 700 curado no pierde fotos');
check($curated[0][0] === '/uploads/curated/da4fe0f31548/02.webp', 'RGBP20: 02.webp abre el mapa');
check($curated[0][1] === '/uploads/curated/da4fe0f31548/02_t.webp', 'RGBP20: la miniatura sigue a su archivo');
check($curated[1][0] === '/uploads/curated/da4fe0f31548/01.webp', 'RGBP20: 01.webp pasa al segundo lugar, no se renombra');
check($curated[2][0] === '/uploads/curated/da4fe0f31548/03.webp', 'RGBP20: 03.webp sigue a la 01');
check($curated[4][0] === '/uploads/curated/da4fe0f31548/05.webp', 'RGBP20: el final del mapa se conserva');

$otherDir = [
    ['/uploads/curated/aaaaaaaaaaaa/01.webp', '/uploads/curated/aaaaaaaaaaaa/01_t.webp'],
    ['/uploads/curated/aaaaaaaaaaaa/02.webp', '/uploads/curated/aaaaaaaaaaaa/02_t.webp'],
];
$kept = order_curated_pairs($otherDir, 'RGBP20');
check($kept[0][0] === $otherDir[0][0] && $kept[1][0] === $otherDir[1][0], 'si la candidata no está en esta carpeta, el mapa curado no se toca');

$l200 = [];
for ($i = 1; $i <= 9; $i++) {
    $n = sprintf('%02d', $i);
    $l200[] = ["/uploads/curated/5cf70ae2f9d5/{$n}.webp", "/uploads/curated/5cf70ae2f9d5/{$n}_t.webp"];
}
$l200order = order_curated_pairs($l200, 'HVHS94');
check($l200order[0][0] === '/uploads/curated/5cf70ae2f9d5/02.webp', 'HVHS94: 02.webp abre el mapa');
check($l200order[1][0] === '/uploads/curated/5cf70ae2f9d5/01.webp', 'HVHS94: 01.webp queda segunda');
check(count($l200order) === 9, 'HVHS94 no pierde fotos');

$driveRows = [
    ["/uploads/drive/{$dash}.webp", "/uploads/drive/{$dash}_t.webp", $dash],
    ["/uploads/drive/{$front}.webp", "/uploads/drive/{$front}_t.webp", $front],
    ['/uploads/drive/1rearRearRearRearRearRR.webp', null, '1rearRearRearRearRearRR'],
];
$driveOrder = order_drive_image_rows($driveRows, '316');
check($driveOrder[0][2] === $front && $driveOrder[1][2] === $dash && $driveOrder[2][2] === '1rearRearRearRearRearRR', 'el insert de Drive publica el 3/4 primero');
check(count($driveOrder) === 3, 'el insert de Drive no borra filas');

foreach ($tokens as $stockId => $token) {
    $gallery = [
        ['id' => 'p0', 'storage_path' => '/uploads/drive/1placeholderplaceholderX.webp', 'sort_order' => 0],
        ['id' => 'p1', 'storage_path' => '/uploads/drive/1placeholderplaceholderY.webp', 'sort_order' => 1],
        ['id' => 'p2', 'storage_path' => '/uploads/drive/1placeholderplaceholderZ.webp', 'sort_order' => 2],
    ];
    if (str_starts_with($token, 'drive:')) {
        $id = substr($token, 6);
        $gallery[] = [
            'id' => 'cover',
            'storage_path' => "/uploads/drive/{$id}.webp",
            'thumb_path' => "/uploads/drive/{$id}_t.webp",
            'sort_order' => 7,
        ];
    } else {
        $rel = substr($token, 8);
        $gallery[] = [
            'id' => 'cover',
            'storage_path' => "/uploads/curated/{$rel}.webp",
            'thumb_path' => "/uploads/curated/{$rel}_t.webp",
            'sort_order' => 7,
        ];
    }
    $next = with_preferred_cover($gallery, (string) $stockId);
    check(count($next) === 4 && $next[0]['id'] === 'cover', "{$stockId}: la foto elegida sale del sort 7 al 0");
    check(array_column($next, 'id') === ['cover', 'p0', 'p1', 'p2'], "{$stockId}: el orden relativo del resto se mantiene");
    $ids = array_column($gallery, 'id');
    sort($ids);
    $ids2 = array_column($next, 'id');
    sort($ids2);
    check($ids === $ids2, "{$stockId}: no se borra ninguna foto");
}

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$pdo->exec('CREATE TABLE vehicles (id TEXT PRIMARY KEY, stock_id TEXT UNIQUE, photos_locked INTEGER NOT NULL DEFAULT 0)');
$pdo->exec('CREATE TABLE vehicle_images (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumb_path TEXT,
    drive_file_id TEXT,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL
)');
$insV = $pdo->prepare('INSERT INTO vehicles (id, stock_id, photos_locked) VALUES (?, ?, 1)');
$insV->execute(['sa-316', '316']);
$insV->execute(['sa-RGBP20', 'RGBP20']);
$insI = $pdo->prepare('INSERT INTO vehicle_images (id, vehicle_id, storage_path, thumb_path, drive_file_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
$insI->execute(['i0', 'sa-316', "/uploads/drive/{$dash}.webp", "/uploads/drive/{$dash}_t.webp", $dash, 0, '2026-01-01 00:00:00']);
$insI->execute(['i1', 'sa-316', "/uploads/drive/{$front}.webp", "/uploads/drive/{$front}_t.webp", $front, 1, '2026-01-01 00:00:01']);
$insI->execute(['i2', 'sa-316', '/uploads/drive/1rearRearRearRearRearRR.webp', null, '1rearRearRearRearRearRR', 2, '2026-01-01 00:00:02']);
for ($i = 1; $i <= 5; $i++) {
    $n = sprintf('%02d', $i);
    $insI->execute([
        'c' . $i,
        'sa-RGBP20',
        "/uploads/curated/da4fe0f31548/{$n}.webp",
        "/uploads/curated/da4fe0f31548/{$n}_t.webp",
        null,
        $i - 1,
        sprintf('2026-01-02 00:00:%02d', $i),
    ]);
}

$changed = apply_preferred_covers($pdo);
check($changed === 2, 'el sync persiste la portada aunque photos_locked esté en 1');
$got = $pdo->query('SELECT id FROM vehicle_images WHERE vehicle_id = \'sa-316\' ORDER BY sort_order ASC')->fetchAll(PDO::FETCH_COLUMN);
check($got === ['i1', 'i0', 'i2'], 'MySQL del Rexton queda frente, tablero, trasera');
$ram = $pdo->query('SELECT storage_path FROM vehicle_images WHERE vehicle_id = \'sa-RGBP20\' ORDER BY sort_order ASC')->fetchAll(PDO::FETCH_COLUMN);
check($ram[0] === '/uploads/curated/da4fe0f31548/02.webp' && $ram[1] === '/uploads/curated/da4fe0f31548/01.webp', 'el curado bloqueado también queda con 02 primero');
check(count($ram) === 5, 'el curado bloqueado no borra fotos');
check(apply_preferred_covers($pdo) === 0, 'un segundo sync no vuelve a escribir el mismo orden');

$sync = (string) file_get_contents(dirname(__DIR__) . '/api/_cron/sync.php');
$handlers = (string) file_get_contents(dirname(__DIR__) . '/api/_lib/handlers.php');
check(substr_count($sync, 'apply_preferred_covers(') >= 2, 'el sync reaplica la portada al empezar y al terminar');
check(str_contains($sync, 'order_drive_image_rows('), 'el alta de fotos de Drive usa el orden preferido');
check(str_contains($sync, 'order_curated_pairs('), 'publicar curados reordena el mapa');
check(str_contains($handlers, 'with_preferred_cover('), 'la API pública devuelve la portada preferida');

if ($failed > 0) {
    fwrite(STDERR, "{$failed} pruebas fallaron\n");
    exit(1);
}
fwrite(STDOUT, "portadas preferidas ok\n");
