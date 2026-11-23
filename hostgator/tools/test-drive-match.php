<?php
declare(strict_types=1);

/**
 * Match de fotos, regla de publicación y estado de la ficha.
 * No abre MySQL ni la red.
 *
 *   php hostgator/tools/test-drive-match.php
 */

require dirname(__DIR__) . '/api/_cron/sync.php';
require dirname(__DIR__) . '/api/_lib/handlers.php';

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

function veh(string $stock, string $plate, string $brand, string $model, int $year, bool $hasId = false, string $vin = ''): array
{
    return [
        'stockId' => $stock,
        'plate' => $plate,
        'brand' => $brand,
        'model' => $model,
        'year' => $year,
        'hasSheetId' => $hasId,
        'vin' => $vin,
    ];
}

function node(string $id, string $name, ?string $parent, bool $folder, ?string $md5 = null, ?string $shortcut = null): array
{
    return [
        'id' => $id,
        'name' => $name,
        'parent' => $parent,
        'folder' => $folder,
        'mime' => '',
        'md5' => $md5,
        'modified' => null,
        'image_time' => null,
        'shortcut_target' => $shortcut,
    ];
}

function ids_of(array $match, string $stock): array
{
    return $match['by_stock'][$stock]['file_ids'] ?? [];
}

$vehicles = [
    veh('341', 'SKTJ95', 'Hyundai', 'Accent', 2023, true),
    veh('RPSH27', 'RPSH27', 'Hyundai', 'Porter', 2022),
    veh('RPSH63', 'RPSH63', 'Hyundai', 'Porter', 2022),
    veh('RPSH66', 'RPSH66', 'Hyundai', 'Porter', 2022),
    veh('SBFG83', 'SBFG83', 'Mitsubishi', 'Katana', 2022),
    veh('SBFG80', 'SBFG80', 'Mitsubishi', 'L200', 2021),
    veh('ABC010', 'ABC010', 'Kia', 'Rio', 2020),
    veh('ABCO10', 'ABCO10', 'Kia', 'Soluto', 2020),
    veh('SRVL14', 'SRVL14', 'Citroen', 'C5 Aircross', 2023),
    veh('VIN01', 'JYFW75', 'Chevrolet', 'Tahoe', 2017, false, '1HGBH41JXMN109186'),
    veh('VIN02', 'TTBF40', 'Mitsubishi', 'L200', 2025, false, '1HGBH41JXMN109186'),
];

$nodes = [
    node('f341', 'ID 341', 'root', true),
    node('f341b', 'ID 341 nuevas', 'root', true),
    node('a', '02.jpg', 'f341', false, 'md5-a'),
    node('b', 'RPSH27.jpg', 'f341', false),
    node('c', '01.jpg', 'f341b', false),
    node('f27', 'Hyundai RPSH27', 'root', true),
    node('d', '01.jpg', 'f27', false),
    node('e', '02.HEIC', 'f27', false),
    node('fkh', 'KHFG83', 'root', true),
    node('k1', '01.jpg', 'fkh', false),
    node('f83', 'SBFG 83', 'root', true),
    node('s1', 'foto.jpg', 'f83', false),
    node('f80', 'SBFG8O', 'root', true),
    node('o1', '01.jpg', 'f80', false),
    node('both', 'RPSH63 RPSH66', 'root', true),
    node('both1', '01.jpg', 'both', false),
    node('varios', 'Varios', 'root', true),
    node('solo', 'SBFG83-extra.jpeg', 'varios', false),
    node('otro', 'IMG_9999.jpg', 'varios', false),
    node('exact010', 'ABC010', 'root', true),
    node('p010', '01.jpg', 'exact010', false),
    node('fuzzy', 'ABCO1O', 'root', true),
    node('pf', '01.jpg', 'fuzzy', false),
    node('cit', 'Citroen C5 Aircross 2023', 'root', true),
    node('c1', '01.png', 'cit', false),
    node('c2', '02.png', 'cit', false, 'md5-c'),
    node('c3', '03.png', 'cit', false, 'md5-c'),
    node('porter', 'Hyundai Porter 2022', 'root', true),
    node('pp', '01.jpg', 'porter', false),
    node('vinbox', 'Documentos', 'root', true),
    node('vinf', '1HGBH41JXMN109186.jpg', 'vinbox', false),
    node('skip', 'notas.txt', 'f27', false),
    node('apple', '._01.jpg', 'f27', false),
];

$match = match_sheet_photos($vehicles, $nodes);
check($match['conflicts'] === [], 'el fixture no asigna una foto al auto equivocado');
check(ids_of($match, '341') === ['c', 'b', 'a'] || ids_of($match, '341') === ['c', 'a', 'b'], 'ID 341 se queda con sus archivos, nuevas primero');
check(in_array('c', ids_of($match, '341'), true) && !in_array('c', ids_of($match, 'RPSH27'), true), 'la carpeta nuevas no se va a otro auto');
check(!in_array('b', ids_of($match, 'RPSH27'), true), 'un archivo llamado RPSH27 dentro de ID 341 no cambia de auto');
check(ids_of($match, 'RPSH27') === ['d', 'e'], 'RPSH27 toma jpg y HEIC, no el txt ni el AppleDouble');
check(ids_of($match, 'RPSH63') === [] && ids_of($match, 'RPSH66') === [], 'RPSH63 y RPSH66 no heredan la carpeta RPSH27');
check(ids_of($match, 'SBFG83') === ['s1', 'solo'] || ids_of($match, 'SBFG83') === ['solo', 's1'], 'SBFG83 calza con espacio y con el archivo suelto');
check(!in_array('k1', ids_of($match, 'SBFG83'), true), 'KHFG83 no se entrega a SBFG83');
check(ids_of($match, 'SBFG80') === ['o1'], 'SBFG8O calza con SBFG80 por O/0');
check(ids_of($match, 'ABC010') === ['p010'], 'la patente exacta gana aunque su O/0 sea ambigua');
check(ids_of($match, 'ABCO10') === [], 'ABCO1O no se asigna: O/0 colapsa dos patentes');
check($match['by_stock']['ABCO10']['via'] === 'ambiguous', 'el choque O/0 queda ambiguo');
check(ids_of($match, 'SRVL14') === ['c1', 'c2'] || ids_of($match, 'SRVL14') === ['c1', 'c3'], 'marca+modelo+año único y dedup por md5');
check(count(ids_of($match, 'SRVL14')) === 2, 'el md5 repetido cuenta una sola vez');
check(ids_of($match, 'RPSH63') === [] && $match['by_stock']['RPSH63']['via'] === 'ambiguous', 'dos Porter 2022 no se reparten la carpeta');
check(ids_of($match, 'VIN01') === [] && ids_of($match, 'VIN02') === [], 'el mismo VIN en dos autos no asigna');
check(in_array('otro', ids_of($match, 'SBFG83'), true) === false, 'el archivo vecino sin patente no se lleva');

$flyerVehicles = [
    veh('340', 'BLZX59', 'Jeep', 'Compass', 2008, true),
    veh('341', 'SKTJ95', 'Hyundai', 'Accent', 2023, true),
];
$flyerNodes = [
    node('fly', 'Flyers', 'root', true),
    node('fa', 'FLYER_BLZX59.jpg', 'fly', false),
    node('fb', 'FLYER_SKTJ95.jpg', 'fly', false),
    node('id340', 'ID 340', 'root', true),
    node('real', '01.jpg', 'id340', false),
];
$flyerMatch = match_sheet_photos($flyerVehicles, $flyerNodes);
check(ids_of($flyerMatch, '340') === ['real'], 'el afiche no entra a la galería ni tapa las fotos del ID');
check(ids_of($flyerMatch, '341') === [], 'un afiche suelto no publica el auto');
check($flyerMatch['conflicts'] === [], 'los afiches no generan una asignación cruzada');

$pub0 = sheet_publication(0);
$pub1 = sheet_publication(2);
check($pub0 === ['published' => 0, 'placeholder' => false], 'sin foto real no se publica ni se inventa placeholder');
check($pub1['published'] === 1 && $pub1['placeholder'] === false, 'con foto real se publica');

$many = [veh('X', 'SBFG83', 'Mitsubishi', 'Katana', 2022)];
$files = [node('box', 'SBFG83', 'root', true)];
for ($i = 1; $i <= 21; $i++) {
    $files[] = node('p' . $i, sprintf('%02d.jpg', $i), 'box', false);
}
$limited = match_sheet_photos($many, $files);
check(count(ids_of($limited, 'X')) === 20, 'a lo más 20 fotos');
check(ids_of($limited, 'X')[0] === 'p1', 'el orden es el nombre natural');

$bad = [
    'by_stock' => [
        'RPSH63' => ['files' => [['id' => 'd', 'name' => '01.jpg', 'parent' => 'f27', 'via' => 'plate']], 'file_ids' => ['d'], 'via' => 'plate'],
    ],
];
$violations = drive_assignment_violations($vehicles, $nodes, $bad);
check($violations !== [], 'detecta una foto de RPSH27 entregada a RPSH63');

$removed = drive_apply_changes(
    [node('keep', 'a.jpg', 'root', false), node('gone', 'b.jpg', 'box', false), node('box', 'Carpeta', 'root', true)],
    [
        ['fileId' => 'gone', 'removed' => true],
        ['fileId' => 'new', 'file' => ['id' => 'new', 'name' => 'c.jpg', 'mimeType' => 'image/jpeg', 'parents' => ['root'], 'md5Checksum' => 'abc']],
    ]
);
$removedIds = array_column($removed, 'id');
check(!in_array('gone', $removedIds, true) && in_array('new', $removedIds, true) && in_array('keep', $removedIds, true), 'changes.list quita lo borrado y agrega lo nuevo');
check(drive_changes_response_invalid(410, ''), '410 invalida el pageToken');
check(drive_changes_response_invalid(400, 'Invalid startPageToken'), '400 de pageToken invalida el token');
check(!drive_changes_response_invalid(400, 'quota'), 'otro 400 no borra el token');

$calls = [];
$lister = static function (string $id) use (&$calls): array {
    $calls[] = $id;
    if ($id === 'root') {
        return [
            ['id' => 'sc', 'name' => 'SBFG83', 'folder' => true, 'mime' => 'application/vnd.google-apps.shortcut', 'shortcut_target' => 'real'],
            ['id' => 'real', 'name' => 'destino', 'folder' => true],
        ];
    }
    if ($id === 'real') {
        return [['id' => 'img', 'name' => '01.jpg', 'folder' => false]];
    }
    return [];
};
$collected = drive_index_collect('root', $lister, ['max_depth' => 3, 'max_listings' => 20]);
check(array_count_values($calls)['root'] === 1 && array_count_values($calls)['real'] === 1, 'cada carpeta se lista una sola vez');
$byParent = [];
foreach ($collected as $n) {
    $byParent[$n['id']] = $n['parent'];
}
check(($byParent['img'] ?? '') === 'sc', 'el atajo deja las fotos bajo el nombre de la patente');
$shortcutMatch = match_sheet_photos([veh('SBFG83', 'SBFG83', 'Mitsubishi', 'Katana', 2022)], $collected);
check(ids_of($shortcutMatch, 'SBFG83') === ['img'], 'la patente del atajo recibe la foto del destino');

check(drive_index_listing_cap([]) >= 800, 'el tope por defecto abre toda la carpeta de patentes');
check(drive_prefer_rank('TTBF40', ['TTBF40']) === 0, 'una carpeta con la patente de la planilla va primero');
check(drive_prefer_rank('Flyers', ['TTBF40']) === 1, 'Flyers no se adelanta');
check(drive_prefer_rank('RRYJ47', ['RRYJ22']) === 1, 'RRYJ47 no se confunde con RRYJ22');
$seenOrder = [];
$preferLister = static function (string $id) use (&$seenOrder): array {
    $seenOrder[] = $id;
    if ($id === 'root') {
        return [
            ['id' => 'late', 'name' => 'ZZZZ99', 'folder' => true],
            ['id' => 'soon', 'name' => 'SBFG83', 'folder' => true],
        ];
    }
    return [['id' => $id . 'f', 'name' => '01.jpg', 'folder' => false]];
};
drive_index_collect('root', $preferLister, ['max_listings' => 10, 'prefer' => ['SBFG83']]);
check(($seenOrder[1] ?? '') === 'soon', 'primero se abre la carpeta de la patente, no la que está antes en el listado');

$stmts = drive_sql_statements((string) file_get_contents(dirname(__DIR__) . '/sql/migr3_drive_index.sql'));
$joined = implode("\n", $stmts);
check(count($stmts) === 2, 'la migración son dos CREATE TABLE');
check(str_contains($joined, 'CREATE TABLE IF NOT EXISTS drive_index'), 'crea drive_index si no existe');
check(str_contains($joined, 'CREATE TABLE IF NOT EXISTS drive_sync_state'), 'crea drive_sync_state si no existe');
check(str_contains($joined, 'nombre') && str_contains($joined, 'parent_id') && str_contains($joined, 'md5'), 'guarda nombre, carpeta padre y md5');

check(!function_exists('hidden_until_photos'), 'la lista manual de ocultos ya no existe');
$sync = (string) file_get_contents(dirname(__DIR__) . '/api/_cron/sync.php');
check(!str_contains($sync, 'hidden_until_photos'), 'el sync no llama a la lista manual');
check(!str_contains($sync, "PLACEHOLDER, null, 'drive'"), 'el sync ya no inserta el placeholder');
check(str_contains($sync, '--dry-run'), 'hay simulación sin escribir');
check(str_contains($sync, 'sheet_publication'), 'la publicación depende de las fotos reales');

check(detail_status_for_vehicle(true, true, null, 'Disponible') === 200, 'publicado con foto responde 200');
check(detail_status_for_vehicle(true, false, null, 'Disponible') === 404, 'publicado solo con placeholder responde 404');
check(detail_status_for_vehicle(false, false, null, 'Disponible') === 404, 'oculto por falta de foto no se anuncia como vendido');
check(detail_status_for_vehicle(false, true, '2026-11-19 00:00:00.000', 'Vendido') === 410, 'archivado responde 410');
check(vehicle_has_real_photo(['vehicle_images' => [['storage_path' => '/placeholder-car.svg']]]) === false, 'el placeholder no es foto real');
check(vehicle_has_real_photo(['vehicle_images' => [['storage_path' => '/uploads/drive/abc.webp']]]) === true, 'una foto en uploads sí cuenta');

if ($failed > 0) {
    fwrite(STDERR, "{$failed} pruebas fallaron\n");
    exit(1);
}
fwrite(STDOUT, "todas las pruebas pasaron\n");
