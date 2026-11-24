<?php
declare(strict_types=1);

/**
 * Lista las fotos de Drive que el sync asignaría a cada unidad de la planilla.
 * No escribe MySQL. Salida JSON a stdout (o --out archivo).
 *
 *   php hostgator/tools/dump-drive-photos.php --out /tmp/salgado-drive-photos.json
 */

require dirname(__DIR__) . '/api/_cron/sync.php';

$out = null;
$args = array_map('strval', $_SERVER['argv'] ?? []);
foreach ($args as $i => $arg) {
    if ($arg === '--out' && isset($args[$i + 1])) {
        $out = $args[$i + 1];
    }
}

$sheet = google_id(cfg('sheet_id'), '1BG2uR6APbXEMvVvRmdR-Nn0Vko6eobJ6Xam0XX41Ldc');
$tab = (string) cfg('sheet_tab', 'SALGADO AUTOMOTRIZ');
$csv = sheet_csv($sheet, $tab);
[$rows, $folderFromSheet] = parse_salgado_rows(parse_csv_text($csv));
$sold = sold_plates_from_tabs($sheet);
if ($sold) {
    $rows = array_values(array_filter($rows, static fn ($r) => !isset($sold[$r['plate']])));
}
$folderId = $folderFromSheet ?: google_id(cfg('drive_folder_id'), '1T_FkTaF9rFf97kM14MvdYzJHSYg-WLgo');
fwrite(STDERR, 'Planilla: ' . count($rows) . " unidades. Carpeta {$folderId}\n");
$nodes = drive_index_collect($folderId, 'drive_listing', [
    'max_depth' => 3,
    'prefer' => drive_sheet_prefer($rows),
]);
fwrite(STDERR, 'Índice: ' . count($nodes) . " entradas\n");
$match = match_sheet_photos($rows, $nodes);

$payload = [
    'generated_at' => gmdate('c'),
    'folder_id' => $folderId,
    'vehicles' => [],
];
foreach ($rows as $r) {
    $id = (string) $r['stockId'];
    $hit = $match['by_stock'][$id] ?? ['file_ids' => [], 'via' => 'none', 'files' => []];
    $files = [];
    foreach ($hit['files'] ?? [] as $f) {
        $files[] = [
            'id' => (string) ($f['id'] ?? ''),
            'name' => (string) ($f['name'] ?? ''),
            'parent' => (string) ($f['parent'] ?? ''),
        ];
    }
    $payload['vehicles'][] = [
        'stock_id' => $id,
        'plate' => (string) $r['plate'],
        'brand' => (string) $r['brand'],
        'model' => (string) $r['model'],
        'year' => (int) $r['year'],
        'via' => (string) ($hit['via'] ?? 'none'),
        'files' => $files,
    ];
}
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
if ($out) {
    file_put_contents($out, $json);
    fwrite(STDERR, "Escrito {$out}: " . count($payload['vehicles']) . " unidades\n");
} else {
    fwrite(STDOUT, $json);
}
