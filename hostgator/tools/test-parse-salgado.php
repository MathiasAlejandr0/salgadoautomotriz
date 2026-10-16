<?php
declare(strict_types=1);

/**
 * Prueba de parse_salgado_rows con los dos formatos de la pestaña
 * SALGADO AUTOMOTRIZ: lista con ORIGEN/ID y listas de abajo (N° corrido,
 * sin ID, dos precios). No toca MySQL ni Drive.
 *
 *   php hostgator/tools/test-parse-salgado.php
 */

require dirname(__DIR__) . '/api/_cron/sync.php';

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

function by_plate(array $vehicles): array
{
    $out = [];
    foreach ($vehicles as $v) {
        $out[$v['plate']] = $v;
    }
    return $out;
}

// Formato A: encabezados distintos + títulos de sección.
$withHeaders = <<<'CSV'
LINK,https://drive.google.com/drive/folders/1T_FkTaF9rFf97kM14MvdYzJHSYg-WLgo
ORIGEN,ID,PATENTE,MARCA,MODELO,COLOR,AÑO,PRECIO,KILOMETRAJE,UBICACION
PROPIO,341,SKTJ95,HYUNDAI,ACCENT HCI 1.4,BLANCO,2023,10.990.000,73931,CARDONAL
CONSIG,10,VEND01,KIA,MORNING,BLANCO,2020,VENDIDO,10000,CARDONAL
CONSIG,11,NOPR01,KIA,RIO,BLANCO,2020,,10000,CARDONAL
CONSIG,12,RESE01,KIA,SOLUTO,BLANCO,2021,RESERVADO,10000,CARDONAL
UNI CHILE
N°,PATENTE,MARCA,MODELO,COLOR,AÑO,PRECIO,PRECIO OFERTA,KILOMETRAJE,UBICACION
8,LPCG80,MITSUBISHI,L200 KATANA CRT 4X4,ROJO,2019,"12.990.000 (iva incluido)","11.990.000 (iva incluido)",227964,
10,SJTD29,NISSAN,NAVARA 4X2,GRIS,2023,$17.990.000,$15.990.000,80000,UNI CHILE
18,CLNT01,SUZUKI,JIMNY MT 4X4 1.5,GRIS,2023,$13.490.000,$12.490.000,174501,CLIENTE
11,SHYL53,FORD,RANGER 4X4,ROJO,2023,$16.990.000,$15.990.000,104628,
7,SKTJ 95,HYUNDAI,ACCENT HCI 1.4,BLANCO,2023,$11.990.000,$10.990.000,74000,SALGADO
CARDONAL
8,THSR65,TOYOTA,HILUX SR 4X4,ROJA,2024,"$24.990,000",$23.990.000,90386,
4,SFBL43,CHEVROLET,COLORADO 4X4 AUT.,BLANCO,2022,$16.990.000,$15.990.000,149586,SALGADO
5,RPFS85,CHEVROLET,D-MAX 4X4,ROJO,2022,$13.990.000,$12.990.000,125438,SALGADO
10,SGYL33,MAXUS,T60 4X4,BLANCO,2023,9.990.000,8.990.000,185666,SALGADO
8,RFJR21,RAM,700,BLANCO,2022,$8.990.000,$7.990.000,119996,SALGADO
CSV;

[$vehicles, $folder, $hasHeader] = parse_salgado_rows(parse_csv_text($withHeaders));
$by = by_plate($vehicles);

check($hasHeader, 'detecta encabezado');
check($folder === '1T_FkTaF9rFf97kM14MvdYzJHSYg-WLgo', 'lee la carpeta de Drive del encabezado');
check(count($vehicles) === count($by), 'no repite patente');
check(!isset($by['VEND01']) && !isset($by['NOPR01']) && !isset($by['RESE01']), 'deja fuera vendido, sin precio y reservado');
check(isset($by['SKTJ95']) && $by['SKTJ95']['stockId'] === '341' && $by['SKTJ95']['hasSheetId'] === true, 'SKTJ95 queda una vez, con el ID de la lista principal');
check(!isset($by['SKTJ95']) || $by['SKTJ95']['price'] === 10990000, 'el duplicado de abajo no pisa el precio de la lista principal');
check(isset($by['LPCG80']) && $by['LPCG80']['price'] === 11990000 && $by['LPCG80']['category'] === 'Camioneta', 'LPCG80 usa el precio de oferta y es camioneta');
check(isset($by['LPCG80']) && $by['LPCG80']['hasSheetId'] === false && $by['LPCG80']['stockId'] === 'LPCG80', 'sin ID el stock es la patente, no el N° 8');
check(isset($by['LPCG80']) && $by['LPCG80']['location'] === 'Uni Chile', 'título UNI CHILE rellena la ubicación vacía');
check(isset($by['SJTD29']) && $by['SJTD29']['location'] === 'Uni Chile' && $by['SJTD29']['price'] === 15990000, 'SJTD29 respeta la ubicación de su fila');
check(isset($by['CLNT01']) && $by['CLNT01']['location'] === 'Cliente', 'la ubicación de la fila gana al título de sección');
check(isset($by['SHYL53']) && $by['SHYL53']['location'] === 'Uni Chile' && $by['SHYL53']['category'] === 'Camioneta', 'SHYL53 hereda UNI CHILE');
check(isset($by['THSR65']) && $by['THSR65']['location'] === 'Cardonal' && $by['THSR65']['price'] === 23990000 && $by['THSR65']['category'] === 'Camioneta', 'CARDONAL cambia la sección y el precio es la oferta');
check(isset($by['SFBL43']) && $by['SFBL43']['category'] === 'Camioneta' && $by['SFBL43']['location'] === 'Salgado', 'COLORADO es camioneta');
check(isset($by['RPFS85']) && $by['RPFS85']['category'] === 'Camioneta', 'D-MAX es camioneta');
check(isset($by['SGYL33']) && $by['SGYL33']['category'] === 'Camioneta' && $by['SGYL33']['price'] === 8990000, 'T60 es camioneta y usa la oferta');
check(isset($by['RFJR21']) && $by['RFJR21']['category'] === 'Camioneta' && $by['RFJR21']['stockId'] === 'RFJR21', 'RAM 700 es camioneta y no usa el N°');
check(isset($by['RFJR21'], $by['LPCG80']) && $by['RFJR21']['stockId'] !== $by['LPCG80']['stockId'], 'el N° 8 repetido no fusiona dos autos');

// Formato B: el de la planilla real. Un solo encabezado y, más abajo, columnas corridas sin otro encabezado.
$shifted = <<<'CSV'
".",ORIGEN,ID,PATENTE,MARCA,MODELO,COLOR,AÑO,PRECIO,KILOMETRAJE,REV. TECNICA,PERMISO CIRCULACION,UBICACION
"",PROPIO,341,SKTJ95,HYUNDAI,ACCENT HCI 1.4,BLANCO,2023,"10.990.000",73931,"","",CARDONAL
"",CONSIG,12,RESE01,KIA,SOLUTO,BLANCO,2021,RESERVADO,1000,"","",CARDONAL
"","","","","","","","","","","","",""
"",8,LPCG80,MITSUBISHI,L200 KATANA CRT 4X4,ROJO,2019,"12.990.000 (iva incluido)","11.990.000 (iva incluido)","227.964  KM",RQ,"febrero 2027","marzo 2027",UNI CHILE
"",7,"SKTJ 95",HYUNDAI,ACCENT HCI 1.4,BLANCO,2023,"$11.990.000","$10.990.000","74.000 KM",RELSA,SEPTIEMBRE,"marzo 2027",SALGADO
"",8,"RFJR 21",RAM,700,BLANCO,2022,"$8.990.000","$7.990.000","119.996 KM",ARVAL,"abril 2027","marzo 2027",SALGADO
"",5,"RPFS 85",CHEVROLET,DMAX 4X4,ROJO,2022,"$13.990.000","$12.990.000","125,438 KM",RQ,"agosto 2027","marzo 2027",SALGADO
"",1,"TCGB 98",NISSAN,NAVARA XE 4X2,ROJA,2024,"$15.490.000","$14,490,000","125.518 KM",ECONO,"noviembre 2027","marzo 2027",SALGADO
CSV;

[$shiftedRows, $shiftedFolder, $shiftedHeader] = parse_salgado_rows(parse_csv_text($shifted));
$shift = by_plate($shiftedRows);
check($shiftedHeader && $shiftedFolder === null, 'el bloque corrido no exige un segundo encabezado');
check(isset($shift['SKTJ95']) && $shift['SKTJ95']['stockId'] === '341' && !isset($shift['RESE01']), 'la lista principal sigue igual y el reservado no entra');
check(count($shiftedRows) === 5, 'entran 4 del bloque corrido y no se duplica SKTJ95');
check(isset($shift['LPCG80']) && $shift['LPCG80']['year'] === 2019 && $shift['LPCG80']['price'] === 11990000 && $shift['LPCG80']['mileage'] === 227964, 'LPCG80 lee año, oferta y kilometraje en el bloque corrido');
check(isset($shift['LPCG80']) && $shift['LPCG80']['location'] === 'Uni Chile' && $shift['LPCG80']['stockId'] === 'LPCG80', 'la ubicación del bloque corrido es la columna de la derecha y el stock es la patente');
check(isset($shift['RFJR21']) && $shift['RFJR21']['stockId'] === 'RFJR21' && $shift['RFJR21']['category'] === 'Camioneta', 'RFJR21 no hereda el N° 8 ni la carpeta ID 8');
check(isset($shift['RPFS85']) && $shift['RPFS85']['category'] === 'Camioneta' && $shift['RPFS85']['price'] === 12990000, 'DMAX sin guion es camioneta');
check(isset($shift['TCGB98']) && $shift['TCGB98']['price'] === 14490000 && $shift['TCGB98']['category'] === 'Camioneta', 'la oferta con coma de miles se lee como 14.490.000');

check(guess_category('HILUX SR 4X4', 'Toyota') === 'Camioneta', 'HILUX');
check(guess_category('NAVARA 4X2', 'Nissan') === 'Camioneta', 'NAVARA');
check(guess_category('RANGER 4X4', 'Ford') === 'Camioneta', 'RANGER');
check(guess_category('L200 KATANA', 'Mitsubishi') === 'Camioneta', 'L200');
check(guess_category('COLORADO 4X4', 'Chevrolet') === 'Camioneta', 'COLORADO');
check(guess_category('BT-50', 'Mazda') === 'Camioneta', 'BT-50 similar');
check(guess_category('ACCENT HCI 1.4', 'Hyundai') === 'Automóvil', 'un auto no pasa a camioneta');
check(guess_category('PARTNER', 'Peugeot') === 'Furgón', 'Partner sigue siendo furgón');
check(parse_clp('1.449E7') === 14490000, 'notación científica de la planilla');

$index = index_drive_folders([
    ['id' => 'folder-341', 'name' => 'ID 341', 'folder' => true],
    ['id' => 'folder-341b', 'name' => 'ID 341 nuevas', 'folder' => true],
    ['id' => 'folder-8', 'name' => 'ID 8', 'folder' => true],
    ['id' => 'folder-lpcg', 'name' => 'LPCG80', 'folder' => true],
    ['id' => 'folder-sjtd', 'name' => 'SJTD 29 fotos', 'folder' => true],
    ['id' => 'file', 'name' => 'LPCG80.jpg', 'folder' => false],
]);
$main = drive_folders_for_row($index, ['hasSheetId' => true, 'stockId' => '341', 'plate' => 'SKTJ95']);
$noId = drive_folders_for_row($index, ['hasSheetId' => false, 'stockId' => 'LPCG80', 'plate' => 'LPCG80']);
$spaced = drive_folders_for_row($index, ['hasSheetId' => false, 'stockId' => 'SJTD29', 'plate' => 'SJTD29']);
check(array_column($main, 'id') === ['folder-341', 'folder-341b'], 'con ID se usan las carpetas ID, no la patente');
check(array_column($noId, 'id') === ['folder-lpcg'], 'sin ID se busca por patente y no por la carpeta ID 8');
check(array_column($spaced, 'id') === ['folder-sjtd'], 'la carpeta con patente separada también calza');
check(sheet_gid_from_html('items.push({name: "SALGADO AUTOMOTRIZ", pageUrl: "https://docs.google.com/x?gid=1", gid: "423788046"});', 'SALGADO AUTOMOTRIZ') === '423788046', 'el gid sale del visor, no de gviz');
check(sheet_gid_from_html('items.push({name: "OTRA", gid: "1"});', 'SALGADO AUTOMOTRIZ') === null, 'una pestaña que no está no devuelve gid');

if ($failed > 0) {
    fwrite(STDERR, "{$failed} pruebas fallaron\n");
    exit(1);
}
fwrite(STDOUT, "todas las pruebas pasaron\n");
