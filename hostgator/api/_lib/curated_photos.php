<?php
declare(strict_types=1);

/**
 * Fotos curadas de unidades de Salgado, versionadas en el repo (sin Drive).
 * Cada unidad: stock_id => [carpeta opaca, cantidad]. Las imágenes están en
 * api/_lib/curated/<carpeta>/NN.webp (+ NN_t.webp). NN es el nombre estable del
 * archivo. Sin override, 01 es la portada. Si preferred_covers.json elige otro
 * NN de esta carpeta, el sync publica ese archivo primero y corre el resto
 * (01 queda en su lugar relativo). No renombra ni borra archivos.
 * El sync las copia a uploads/curated/<carpeta>/ y las deja bloqueadas (source=upload).
 * La portada preferida se reaplica en cada sync aunque photos_locked esté activo.
 * Si la carpeta de una unidad cambia, el sync reemplaza ese set una vez y conserva
 * las fotos que el admin haya subido a mano. No se usan patentes en rutas ni URLs.
 */

/** @return array<string, array{dir: string, count: int}> */
function curated_photos(): array
{
    return [
        'DDLJ95' => ['dir' => '3f53be225f6a', 'count' => 10],
        'HVHS94' => ['dir' => '5cf70ae2f9d5', 'count' => 9],
        'LFST41' => ['dir' => '176bc28be185', 'count' => 9],
        'LRJY32' => ['dir' => 'e95778f9f517', 'count' => 11],
        'PRKK70' => ['dir' => '6534c239bfc2', 'count' => 10],
        'PSJJ97' => ['dir' => '4a991380ba9a', 'count' => 10],
        'PSKJ78' => ['dir' => '29aee90b1724', 'count' => 10],
        'RGBP20' => ['dir' => 'da4fe0f31548', 'count' => 5],
        'RGBP23' => ['dir' => 'b85c57b542cc', 'count' => 9],
        'RGGZ96' => ['dir' => '498762800952', 'count' => 10],
        'RHCL44' => ['dir' => '2b6d111bb4e1', 'count' => 9],
        'RKRG58' => ['dir' => '5920717b3370', 'count' => 6],
        'RPSH27' => ['dir' => '79c2439fb27e', 'count' => 9],
        'RPSH28' => ['dir' => '962e6a596257', 'count' => 9],
        'RRKB78' => ['dir' => '1dc13f690a3b', 'count' => 10],
        'RRYJ47' => ['dir' => '5dc1de8e9d7b', 'count' => 9],
        'RXFK24' => ['dir' => 'b9e69bb8475d', 'count' => 4],
        'RZTG13' => ['dir' => '5165c74a97e6', 'count' => 8],
        'RZVK91' => ['dir' => 'b2ce021d3239', 'count' => 11],
        'RZWV49' => ['dir' => 'd7b2a4b6083f', 'count' => 6],
        'SBJR89' => ['dir' => '749997b749fa', 'count' => 8],
        'SBZG55' => ['dir' => '316e8edc8bde', 'count' => 8],
        'SCDW37' => ['dir' => '3375f830a692', 'count' => 12],
        'SDJT43' => ['dir' => 'a5dad43599ad', 'count' => 11],
        'SFBL43' => ['dir' => '185970141ab1', 'count' => 9],
        'SFYB29' => ['dir' => '575ff33a4478', 'count' => 8],
        'SHYL53' => ['dir' => 'bcf48f84e1b3', 'count' => 9],
        'SKLF13' => ['dir' => '5805393b91d0', 'count' => 11],
        'SLGD85' => ['dir' => '4a0f1245edab', 'count' => 10],
        'SSDD57' => ['dir' => '736da773bfc9', 'count' => 8],
        'STPZ87' => ['dir' => '7f56c57c8dd6', 'count' => 12],
        'SVFB26' => ['dir' => '3436377c80df', 'count' => 10],
        'SVFD42' => ['dir' => '0123050d41b6', 'count' => 10],
        'SWDV33' => ['dir' => '659f1299f49c', 'count' => 8],
        'SXKK11' => ['dir' => '5bd7bc27319d', 'count' => 9],
        'THLV62' => ['dir' => '292bec044fda', 'count' => 11],
        'THSR65' => ['dir' => 'd183ec270531', 'count' => 12],
        'TSGL82' => ['dir' => 'b9b9a3ec681f', 'count' => 9],
        'VFRF57' => ['dir' => '421e3b1cc5ec', 'count' => 12],
    ];
}

/** Unidades que se ocultan del sitio mientras no tengan fotos reales (se publican solas al llegar fotos). */
function hidden_until_photos(): array
{
    return ['RPSH75', 'RPSV20', 'RPSH34', 'SRCP22', 'RYYS68'];
}
