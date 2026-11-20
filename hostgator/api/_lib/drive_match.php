<?php
declare(strict_types=1);

/**
 * Empareja fotos de un índice de Drive (ya en memoria) con las filas de la planilla.
 * No llama a la API ni a MySQL. Si hay más de un auto posible, no asigna.
 *
 * Niveles:
 *  1) Patente o stock normalizado en el nombre de una carpeta ancestro, o en el
 *     archivo si ninguna carpeta lo reclama. O y 0 se tratan igual solo cuando
 *     una sola patente del inventario colapsa a esa clave.
 *  2) VIN, si la ficha lo trae y un solo auto lo tiene.
 *  3) Marca + modelo + año, solo con un candidato.
 */

const DRIVE_IMAGE_EXT = '/\.(jpe?g|png|webp|gif|heic|heif|dng|tiff?)$/i';

function drive_compact(string $value): string
{
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $value) ?? '');
}

function drive_o0_key(string $value): string
{
    return strtr(drive_compact($value), ['0' => 'O']);
}

function drive_clean_plate(string $raw): string
{
    if (function_exists('clean_plate')) {
        return clean_plate($raw);
    }
    $compact = drive_compact($raw);
    $candidates = strlen($compact) === 7 ? [$compact, substr($compact, 0, 6)] : [$compact];
    foreach ($candidates as $p) {
        if (strlen($p) >= 5 && strlen($p) <= 6 && preg_match('/^[A-Z]{2,4}\d{2,4}$/', $p)) {
            return $p;
        }
    }
    return '';
}

/** @return string[] patentes exactas (sin confundir O/0) */
function drive_exact_plates(string $name): array
{
    $clean = preg_replace('/\bID\s*\d+\b/i', ' ', $name) ?? $name;
    $found = [];
    $whole = drive_clean_plate($clean);
    if ($whole !== '') {
        $found[$whole] = true;
    }
    if (preg_match_all('/(?<![A-Za-z0-9])[A-Za-z]{2,4}[\s.\-]*\d{2,4}(?![A-Za-z0-9])/', $clean, $m)) {
        foreach ($m[0] as $tok) {
            $plate = drive_clean_plate($tok);
            if ($plate !== '') {
                $found[$plate] = true;
            }
        }
    }
    return array_keys($found);
}

function drive_plate_shape(string $token): bool
{
    $n = drive_compact($token);
    $len = strlen($n);
    if ($len < 5 || $len > 6) {
        return false;
    }
    $letter = static fn (string $c): bool => ctype_alpha($c) || $c === '0';
    $digit = static fn (string $c): bool => ctype_digit($c) || $c === 'O';
    $match = static function (string $n, int $letters) use ($letter, $digit): bool {
        $len = strlen($n);
        if ($letters < 2 || $letters >= $len) {
            return false;
        }
        for ($i = 0; $i < $letters; $i++) {
            if (!$letter($n[$i])) {
                return false;
            }
        }
        for ($i = $letters; $i < $len; $i++) {
            if (!$digit($n[$i])) {
                return false;
            }
        }
        return true;
    };
    if ($len === 6) {
        return $match($n, 4) || $match($n, 2);
    }
    return $match($n, 3) || $match($n, 2);
}

/** @return string[] tokens con forma de patente, límites de palabra, O/0 incluidos */
function drive_loose_plate_tokens(string $name): array
{
    $clean = preg_replace('/\bID\s*\d+\b/i', ' ', $name) ?? $name;
    $found = [];
    if (preg_match_all('/(?<![A-Za-z0-9])[A-Za-z0-9]{2,4}[\s.\-]*[A-Za-z0-9]{2,4}(?![A-Za-z0-9])/', $clean, $m)) {
        foreach ($m[0] as $tok) {
            $n = drive_compact($tok);
            if (drive_plate_shape($n)) {
                $found[$n] = true;
            }
        }
    }
    return array_keys($found);
}

function drive_is_image_name(string $name): bool
{
    return $name !== '' && !str_starts_with($name, '._') && preg_match(DRIVE_IMAGE_EXT, $name) === 1;
}

/** Un afiche (FLYER_PATENTE) no es una foto del auto. */
function drive_is_vehicle_photo(string $name): bool
{
    if (!drive_is_image_name($name)) {
        return false;
    }
    $base = drive_compact((string) pathinfo($name, PATHINFO_FILENAME));
    return !str_starts_with($base, 'FLYER');
}

function drive_brand_key(string $brand): string
{
    $key = preg_replace('/\s+/', ' ', strtoupper(trim(function_exists('fold_accents') ? fold_accents($brand) : $brand))) ?? '';
    $aliases = [
        'MITSIBUSHI' => 'MITSUBISHI',
        'MITSUSBISHI' => 'MITSUBISHI',
        'MITSUBISI' => 'MITSUBISHI',
        'MERCEDEZ' => 'MERCEDESBENZ',
        'MERCEDES BENZ' => 'MERCEDESBENZ',
        'MERCEDES-BENZ' => 'MERCEDESBENZ',
        'CITROËN' => 'CITROEN',
    ];
    if (isset($aliases[$key])) {
        return $aliases[$key];
    }
    if (function_exists('clean_brand')) {
        return drive_compact(clean_brand($brand));
    }
    return drive_compact($key);
}

function drive_model_key(string $model): string
{
    $m = strtoupper(trim(function_exists('fold_accents') ? fold_accents($model) : $model));
    $m = preg_replace('/\b(4X4|4X2|AT|MT|AUT|AUTOMATICO|AUTOMATICA)\b/', ' ', $m) ?? $m;
    return drive_compact($m);
}

function sheet_publication(int $realPhotos): array
{
    return ['published' => $realPhotos > 0 ? 1 : 0, 'placeholder' => false];
}

/**
 * @param array<int, array<string, mixed>> $vehicles
 * @return array<string, mixed>
 */
function drive_match_catalog(array $vehicles): array
{
    $exact = [];
    $o0 = [];
    $stock = [];
    $vin = [];
    $brand = [];
    $byId = [];
    foreach ($vehicles as $v) {
        $id = (string) ($v['stockId'] ?? '');
        if ($id === '') {
            continue;
        }
        $byId[$id] = $v;
        $plate = drive_clean_plate((string) ($v['plate'] ?? ''));
        if ($plate !== '') {
            $exact[$plate][] = $id;
            $o0[drive_o0_key($plate)][] = $id;
        }
        $sid = (string) ($v['stockId'] ?? '');
        $hasSheetId = !empty($v['hasSheetId']) || (ctype_digit($sid) && $sid !== (string) ($v['plate'] ?? ''));
        if ($hasSheetId && ctype_digit($sid)) {
            $stock[$sid][] = $id;
        }
        $vinKey = drive_compact((string) ($v['vin'] ?? ''));
        if (strlen($vinKey) >= 11) {
            $vin[$vinKey][] = $id;
        }
        $sig = drive_brand_key((string) ($v['brand'] ?? '')) . '|' . drive_model_key((string) ($v['model'] ?? '')) . '|' . (int) ($v['year'] ?? 0);
        $brand[$sig][] = $id;
    }
    $ambiguousO0 = [];
    foreach ($o0 as $key => $ids) {
        $ids = array_values(array_unique($ids));
        $o0[$key] = $ids;
        if (count($ids) > 1) {
            $ambiguousO0[$key] = $ids;
        }
    }
    $ambiguousVin = [];
    foreach ($vin as $key => $ids) {
        $ids = array_values(array_unique($ids));
        $vin[$key] = $ids;
        if (count($ids) > 1) {
            $ambiguousVin[$key] = $ids;
        }
    }
    $ambiguousBrand = [];
    foreach ($brand as $ids) {
        if (count(array_unique($ids)) > 1) {
            foreach ($ids as $id) {
                $ambiguousBrand[$id] = true;
            }
        }
    }
    return [
        'exact' => $exact,
        'o0' => $o0,
        'ambiguous_o0' => $ambiguousO0,
        'stock' => $stock,
        'vin' => $vin,
        'ambiguous_vin' => $ambiguousVin,
        'brand' => $brand,
        'ambiguous_brand' => $ambiguousBrand,
        'by_id' => $byId,
    ];
}

/**
 * @param array<string, mixed> $catalog
 * @return array{ids: string[], ambiguous: bool, via: array<string, string>}
 */
function drive_name_claims(string $name, array $catalog): array
{
    $ids = [];
    $via = [];
    $ambiguous = false;
    foreach (drive_exact_plates($name) as $plate) {
        foreach ($catalog['exact'][$plate] ?? [] as $id) {
            $ids[$id] = true;
            $via[$id] = 'plate';
        }
    }
    if (preg_match_all('/\bID\s*(\d+)\b/i', $name, $mm)) {
        foreach ($mm[1] as $num) {
            foreach ($catalog['stock'][$num] ?? [] as $id) {
                $ids[$id] = true;
                $via[$id] = $via[$id] ?? 'stock';
            }
        }
    }
    $compact = drive_compact($name);
    if ($compact !== '' && ctype_digit($compact) && isset($catalog['stock'][$compact])) {
        foreach ($catalog['stock'][$compact] as $id) {
            $ids[$id] = true;
            $via[$id] = $via[$id] ?? 'stock';
        }
    }
    foreach (drive_loose_plate_tokens($name) as $tok) {
        $exact = drive_clean_plate($tok);
        if ($exact !== '' && isset($catalog['exact'][$exact])) {
            continue;
        }
        $key = drive_o0_key($tok);
        if (isset($catalog['ambiguous_o0'][$key])) {
            $ambiguous = true;
            foreach ($catalog['ambiguous_o0'][$key] as $id) {
                $ids[$id] = true;
                $via[$id] = $via[$id] ?? 'o0';
            }
            continue;
        }
        $hit = $catalog['o0'][$key] ?? [];
        if (count($hit) === 1) {
            $ids[$hit[0]] = true;
            $via[$hit[0]] = $via[$hit[0]] ?? 'o0';
        }
    }
    $list = array_map('strval', array_keys($ids));
    if (count($list) > 1) {
        $ambiguous = true;
    }
    return ['ids' => $list, 'ambiguous' => $ambiguous, 'via' => $via];
}

function drive_normalize_entry(array $entry, ?string $parent): array
{
    $mime = (string) ($entry['mime'] ?? $entry['mimeType'] ?? '');
    $details = is_array($entry['shortcutDetails'] ?? null) ? $entry['shortcutDetails'] : [];
    $shortcut = (string) ($entry['shortcut_target'] ?? ($details['targetId'] ?? ''));
    $targetMime = (string) ($entry['target_mime'] ?? ($details['targetMimeType'] ?? ''));
    $folder = !empty($entry['folder'])
        || $mime === 'application/vnd.google-apps.folder'
        || $targetMime === 'application/vnd.google-apps.folder';
    if ($mime === 'application/vnd.google-apps.shortcut' && $targetMime !== '') {
        $folder = $targetMime === 'application/vnd.google-apps.folder';
    }
    $meta = is_array($entry['imageMediaMetadata'] ?? null) ? $entry['imageMediaMetadata'] : [];
    $imageTime = $entry['image_time'] ?? ($meta['time'] ?? null);
    $md5 = $entry['md5'] ?? ($entry['md5Checksum'] ?? null);
    $modified = $entry['modified'] ?? ($entry['modifiedTime'] ?? null);
    return [
        'id' => (string) ($entry['id'] ?? ''),
        'name' => (string) ($entry['name'] ?? ''),
        'parent' => $parent,
        'folder' => $folder,
        'mime' => $mime,
        'md5' => is_string($md5) && $md5 !== '' ? $md5 : null,
        'modified' => is_string($modified) && $modified !== '' ? $modified : null,
        'image_time' => is_string($imageTime) && $imageTime !== '' ? $imageTime : null,
        'shortcut_target' => $shortcut !== '' ? $shortcut : null,
    ];
}

function drive_node_path(array $node, array $byId): string
{
    $parts = [];
    $cur = $node;
    $guard = 0;
    $seen = [];
    while ($cur && $guard++ < 16) {
        $id = (string) ($cur['id'] ?? '');
        if ($id !== '' && isset($seen[$id])) {
            break;
        }
        $seen[$id] = true;
        array_unshift($parts, (string) ($cur['name'] ?? ''));
        $pid = (string) ($cur['parent'] ?? '');
        $cur = ($pid !== '' && isset($byId[$pid])) ? $byId[$pid] : null;
    }
    return implode('/', $parts);
}

/**
 * @param array<int, array<string, mixed>> $nodes
 * @return array<int, array<string, mixed>>
 */
function drive_nodes_with_paths(array $nodes): array
{
    $by = [];
    foreach ($nodes as $n) {
        if (($n['id'] ?? '') !== '') {
            $by[$n['id']] = $n;
        }
    }
    $out = [];
    foreach ($nodes as $n) {
        $n['path'] = drive_node_path($n, $by);
        $out[] = $n;
    }
    return $out;
}

/**
 * @param array<string, mixed> $claim
 * @param array<string, mixed> $byId
 * @return array{ids: string[], ambiguous: bool, via: array<string, string>}
 */
function drive_claim_from(array $start, array $byId, array $claimsByNode): array
{
    $cur = $start;
    $guard = 0;
    $seen = [];
    while ($guard++ < 16) {
        $id = (string) ($cur['id'] ?? '');
        if ($id === '' || isset($seen[$id])) {
            break;
        }
        $seen[$id] = true;
        $claim = $claimsByNode[$id] ?? null;
        if (is_array($claim) && ($claim['ambiguous'] || !empty($claim['ids']))) {
            return $claim;
        }
        $pid = (string) ($cur['parent'] ?? '');
        if ($pid === '' || !isset($byId[$pid])) {
            break;
        }
        $cur = $byId[$pid];
    }
    return ['ids' => [], 'ambiguous' => false, 'via' => []];
}

function drive_changes_response_invalid(int $code, string $body): bool
{
    if ($code === 404 || $code === 410) {
        return true;
    }
    return $code === 400 && preg_match('/page token|startPageToken|invalid/i', $body) === 1;
}

/**
 * Aplica cambios de changes.list sobre un índice ya cargado.
 *
 * @param array<int, array<string, mixed>> $nodes
 * @param array<int, array<string, mixed>> $changes
 * @return array<int, array<string, mixed>>
 */
function drive_apply_changes(array $nodes, array $changes): array
{
    $by = [];
    foreach ($nodes as $n) {
        if (($n['id'] ?? '') !== '') {
            $by[$n['id']] = $n;
        }
    }
    $drop = static function (string $id) use (&$by, &$drop): void {
        unset($by[$id]);
        $kids = [];
        foreach ($by as $cid => $node) {
            if ((string) ($node['parent'] ?? '') === $id) {
                $kids[] = (string) $cid;
            }
        }
        foreach ($kids as $cid) {
            $drop($cid);
        }
    };
    foreach ($changes as $ch) {
        if (!is_array($ch)) {
            continue;
        }
        $file = is_array($ch['file'] ?? null) ? $ch['file'] : [];
        $id = (string) ($ch['fileId'] ?? ($file['id'] ?? ''));
        if ($id === '') {
            continue;
        }
        if (!empty($ch['removed']) || !empty($file['trashed'])) {
            $drop($id);
            continue;
        }
        if (!$file) {
            continue;
        }
        $parents = $file['parents'] ?? null;
        $parent = is_array($parents) && isset($parents[0]) ? (string) $parents[0] : ($by[$id]['parent'] ?? null);
        $by[$id] = drive_normalize_entry($file, is_string($parent) ? $parent : null);
    }
    return array_values($by);
}

/**
 * @param array<int, array<string, mixed>> $vehicles
 * @param array<int, array<string, mixed>> $nodes
 * @param array{limit?: int, skip?: string[]} $options
 * @return array{by_stock: array<string, array<string, mixed>>, log: string[], conflicts: string[]}
 */
function match_sheet_photos(array $vehicles, array $nodes, array $options = []): array
{
    $limit = (int) ($options['limit'] ?? 12);
    $skip = array_fill_keys(array_map('strval', $options['skip'] ?? []), true);
    $catalog = drive_match_catalog($vehicles);
    $byId = [];
    foreach ($nodes as $n) {
        if (!is_array($n) || ($n['id'] ?? '') === '') {
            continue;
        }
        $byId[$n['id']] = $n;
    }
    $claims = [];
    foreach ($byId as $id => $n) {
        $claims[$id] = drive_name_claims((string) $n['name'], $catalog);
    }

    $buckets = [];
    $notes = [];
    $usedIds = [];
    $emptyClaim = ['ids' => [], 'ambiguous' => false, 'via' => []];

    $push = static function ($stock, array $file, string $via) use (&$buckets, &$usedIds): void {
        $stock = (string) $stock;
        $download = (string) (($file['shortcut_target'] ?? '') !== '' && empty($file['folder'])
            ? $file['shortcut_target']
            : $file['id']);
        if ($download === '' || isset($usedIds[$download])) {
            return;
        }
        $usedIds[$download] = $stock;
        $buckets[$stock][] = [
            'id' => $download,
            'name' => (string) ($file['name'] ?? ''),
            'parent' => (string) ($file['parent'] ?? ''),
            'md5' => $file['md5'] ?? null,
            'image_time' => $file['image_time'] ?? null,
            'via' => $via,
        ];
    };

    $mixedParents = [];
    foreach ($byId as $folder) {
        if (empty($folder['folder'])) {
            continue;
        }
        $folderClaim = $claims[(string) $folder['id']] ?? $emptyClaim;
        if ($folderClaim['ambiguous'] || $folderClaim['ids']) {
            continue;
        }
        $owners = [];
        foreach ($byId as $child) {
            if ((string) ($child['parent'] ?? '') !== (string) $folder['id'] || !empty($child['folder'])) {
                continue;
            }
            if (!drive_is_vehicle_photo((string) $child['name'])) {
                continue;
            }
            $self = $claims[(string) $child['id']] ?? $emptyClaim;
            if ($self['ambiguous'] || count($self['ids']) > 1) {
                $mixedParents[(string) $folder['id']] = true;
                break;
            }
            if (count($self['ids']) === 1) {
                $owners[(string) $self['ids'][0]] = true;
            }
        }
        if (count($owners) > 1) {
            $mixedParents[(string) $folder['id']] = true;
        }
    }

    foreach ($byId as $n) {
        if (!empty($n['folder']) || !drive_is_vehicle_photo((string) $n['name'])) {
            continue;
        }
        $parent = $byId[(string) ($n['parent'] ?? '')] ?? null;
        $folderClaim = $parent ? drive_claim_from($parent, $byId, $claims) : $emptyClaim;
        if ($folderClaim['ambiguous']) {
            foreach ($folderClaim['ids'] as $id) {
                $notes[$id] = 'ambiguous';
            }
            continue;
        }
        if (count($folderClaim['ids']) === 1) {
            $id = $folderClaim['ids'][0];
            $push($id, $n, (string) ($folderClaim['via'][$id] ?? 'plate'));
            continue;
        }
        $self = $claims[(string) $n['id']] ?? $emptyClaim;
        if ($self['ambiguous']) {
            foreach ($self['ids'] as $id) {
                $notes[$id] = 'ambiguous';
            }
            continue;
        }
        if (isset($mixedParents[(string) ($n['parent'] ?? '')])) {
            continue;
        }
        if (count($self['ids']) === 1) {
            $id = $self['ids'][0];
            $push($id, $n, 'file');
        }
    }

    $hasFiles = static fn ($id): bool => !empty($buckets[(string) $id]);

    foreach ($byId as $n) {
        if (!empty($n['folder'])) {
            continue;
        }
        $vinKey = '';
        $blob = drive_compact((string) $n['name']);
        foreach ($catalog['vin'] as $key => $ids) {
            if (strlen($key) >= 11 && str_contains($blob, $key)) {
                $vinKey = $key;
                break;
            }
        }
        if ($vinKey === '') {
            continue;
        }
        if (isset($catalog['ambiguous_vin'][$vinKey])) {
            foreach ($catalog['ambiguous_vin'][$vinKey] as $id) {
                $notes[$id] = 'ambiguous';
            }
            continue;
        }
        $ids = $catalog['vin'][$vinKey];
        if (count($ids) !== 1 || $hasFiles($ids[0])) {
            continue;
        }
        $parent = $byId[(string) ($n['parent'] ?? '')] ?? null;
        $folderClaim = $parent ? drive_claim_from($parent, $byId, $claims) : $emptyClaim;
        if ($folderClaim['ambiguous'] || $folderClaim['ids']) {
            continue;
        }
        if (!drive_is_vehicle_photo((string) $n['name'])) {
            continue;
        }
        $push($ids[0], $n, 'vin');
    }

    foreach ($byId as $folder) {
        if (empty($folder['folder'])) {
            continue;
        }
        $claim = $claims[(string) $folder['id']] ?? $emptyClaim;
        if ($claim['ambiguous'] || $claim['ids']) {
            continue;
        }
        $hits = [];
        $compact = drive_compact((string) $folder['name']);
        if (!preg_match('/(?:19|20)\d{2}/', (string) $folder['name'], $ym)) {
            continue;
        }
        $year = $ym[0];
        foreach ($catalog['brand'] as $sig => $ids) {
            [$brand, $model, $y] = explode('|', $sig);
            if ($y !== $year || $brand === '' || strlen($model) < 3) {
                continue;
            }
            if (!str_contains($compact, $brand) || !str_contains($compact, $model)) {
                continue;
            }
            foreach ($ids as $id) {
                $hits[$id] = true;
            }
        }
        $hitIds = array_map('strval', array_keys($hits));
        if (count($hitIds) !== 1) {
            if (count($hitIds) > 1) {
                foreach ($hitIds as $id) {
                    $notes[$id] = 'ambiguous';
                }
            }
            continue;
        }
        $only = $hitIds[0];
        if (isset($catalog['ambiguous_brand'][$only]) || $hasFiles($only)) {
            if (isset($catalog['ambiguous_brand'][$only])) {
                $notes[$only] = 'ambiguous';
            }
            continue;
        }
        foreach ($byId as $n) {
            if (!empty($n['folder']) || !drive_is_vehicle_photo((string) $n['name'])) {
                continue;
            }
            if (!drive_under_folder($n, (string) $folder['id'], $byId)) {
                continue;
            }
            $parent = $byId[(string) ($n['parent'] ?? '')] ?? null;
            $folderClaim = $parent ? drive_claim_from($parent, $byId, $claims) : $emptyClaim;
            if ($folderClaim['ambiguous'] || $folderClaim['ids']) {
                continue;
            }
            $push($only, $n, 'brand');
        }
    }

    $byStock = [];
    $log = [];
    foreach ($vehicles as $v) {
        $id = (string) ($v['stockId'] ?? '');
        if ($id === '') {
            continue;
        }
        $files = drive_order_photo_files($buckets[$id] ?? [], $byId);
        $seenMd5 = [];
        $ordered = [];
        foreach ($files as $file) {
            $md5 = $file['md5'] ?? null;
            if (is_string($md5) && $md5 !== '') {
                if (isset($seenMd5[$md5])) {
                    continue;
                }
                $seenMd5[$md5] = true;
            }
            $ordered[] = $file;
            if (count($ordered) >= $limit) {
                break;
            }
        }
        $via = $ordered[0]['via'] ?? 'none';
        $byStock[$id] = [
            'file_ids' => array_column($ordered, 'id'),
            'files' => $ordered,
            'via' => $ordered ? $via : (($notes[$id] ?? '') === 'ambiguous' ? 'ambiguous' : 'none'),
            'note' => (string) ($notes[$id] ?? ''),
        ];
        if (isset($skip[$id])) {
            continue;
        }
        $plate = (string) ($v['plate'] ?? $id);
        if ($ordered) {
            continue;
        }
        if (($notes[$id] ?? '') === 'ambiguous') {
            $log[] = "{$plate}: ambiguo, no se asignan fotos";
        } else {
            $log[] = "{$plate}: sin fotos en el índice";
        }
    }

    return [
        'by_stock' => $byStock,
        'log' => $log,
        'conflicts' => drive_assignment_violations($vehicles, array_values($byId), ['by_stock' => $byStock]),
    ];
}

function drive_under_folder(array $node, string $folderId, array $byId): bool
{
    $cur = $node;
    $guard = 0;
    $seen = [];
    while ($cur && $guard++ < 16) {
        $id = (string) ($cur['id'] ?? '');
        if ($id === $folderId) {
            return true;
        }
        if ($id === '' || isset($seen[$id])) {
            break;
        }
        $seen[$id] = true;
        $pid = (string) ($cur['parent'] ?? '');
        $cur = $byId[$pid] ?? null;
    }
    return false;
}

function drive_order_photo_files(array $files, array $byId): array
{
    usort($files, static function (array $a, array $b) use ($byId): int {
        $pa = (string) ($byId[$a['parent']]['name'] ?? '');
        $pb = (string) ($byId[$b['parent']]['name'] ?? '');
        $na = preg_match('/nueva/i', $pa) ? 0 : 1;
        $nb = preg_match('/nueva/i', $pb) ? 0 : 1;
        if ($na !== $nb) {
            return $na <=> $nb;
        }
        $cmp = strnatcasecmp($pa, $pb);
        if ($cmp !== 0) {
            return $cmp;
        }
        $nc = strnatcasecmp((string) $a['name'], (string) $b['name']);
        if ($nc !== 0) {
            return $nc;
        }
        return strcmp((string) ($a['image_time'] ?? ''), (string) ($b['image_time'] ?? ''));
    });
    return $files;
}

/**
 * Revisa las asignaciones ya hechas. Una foto dentro de una carpeta con patente
 * o "ID n" solo puede ir al auto de esa carpeta.
 *
 * @param array<int, array<string, mixed>> $vehicles
 * @param array<int, array<string, mixed>> $nodes
 * @param array{by_stock: array<string, array<string, mixed>>} $match
 * @return string[]
 */
function drive_assignment_violations(array $vehicles, array $nodes, array $match): array
{
    $byStock = [];
    foreach ($vehicles as $v) {
        $byStock[(string) ($v['stockId'] ?? '')] = $v;
    }
    $byId = [];
    foreach ($nodes as $n) {
        if (($n['id'] ?? '') !== '') {
            $byId[$n['id']] = $n;
        }
    }
    $problems = [];
    $seen = [];
    foreach ($match['by_stock'] as $stock => $hit) {
        $veh = $byStock[(string) $stock] ?? null;
        if (!$veh) {
            $problems[] = "stock desconocido {$stock}";
            continue;
        }
        $plate = drive_clean_plate((string) ($veh['plate'] ?? ''));
        foreach ($hit['files'] ?? [] as $file) {
            $fid = (string) ($file['id'] ?? '');
            if ($fid === '') {
                continue;
            }
            if (isset($seen[$fid])) {
                $problems[] = "archivo {$fid} asignado a {$seen[$fid]} y a {$stock}";
                continue;
            }
            $seen[$fid] = (string) $stock;
            $plates = [];
            $stocks = [];
            $cur = $byId[(string) ($file['parent'] ?? '')] ?? null;
            $guard = 0;
            $seenNodes = [];
            while ($cur && $guard++ < 16) {
                $nid = (string) ($cur['id'] ?? '');
                if ($nid !== '' && isset($seenNodes[$nid])) {
                    break;
                }
                $seenNodes[$nid] = true;
                foreach (drive_exact_plates((string) $cur['name']) as $p) {
                    $plates[$p] = true;
                }
                if (preg_match_all('/\bID\s*(\d+)\b/i', (string) $cur['name'], $mm)) {
                    foreach ($mm[1] as $num) {
                        $stocks[$num] = true;
                    }
                }
                $compact = drive_compact((string) $cur['name']);
                if ($compact !== '' && ctype_digit($compact)) {
                    $stocks[$compact] = true;
                }
                $pid = (string) ($cur['parent'] ?? '');
                $cur = $byId[$pid] ?? null;
            }
            $via = (string) ($file['via'] ?? ($hit['via'] ?? ''));
            if ($plates) {
                if ($plate === '' || !isset($plates[$plate])) {
                    $problems[] = "{$stock} ({$plate}) recibe {$file['name']} desde una carpeta de " . implode(',', array_keys($plates));
                }
                continue;
            }
            if ($stocks) {
                $sid = (string) ($veh['stockId'] ?? '');
                if (empty($veh['hasSheetId']) || !isset($stocks[$sid])) {
                    $problems[] = "{$stock} recibe {$file['name']} desde la carpeta ID " . implode(',', array_keys($stocks));
                }
                continue;
            }
            if ($via === 'o0') {
                $ok = drive_o0_mentions_plate((string) ($file['name'] ?? ''), $plate);
                $walk = $byId[(string) ($file['parent'] ?? '')] ?? null;
                $g = 0;
                while (!$ok && $walk && $g++ < 16) {
                    $ok = drive_o0_mentions_plate((string) $walk['name'], $plate);
                    $walk = $byId[(string) ($walk['parent'] ?? '')] ?? null;
                }
                if (!$ok) {
                    $problems[] = "{$stock} marcado o0 sin una patente equivalente en la ruta de {$file['name']}";
                }
                continue;
            }
            if ($via === 'file') {
                $named = in_array($plate, drive_exact_plates((string) ($file['name'] ?? '')), true)
                    || drive_o0_mentions_plate((string) ($file['name'] ?? ''), $plate);
                if (!$named) {
                    $problems[] = "{$stock} recibe {$file['name']} por nombre de archivo sin su patente";
                }
                continue;
            }
            if (in_array($via, ['brand', 'vin'], true)) {
                continue;
            }
            $problems[] = "{$stock} recibe {$file['name']} sin patente ni ID en la ruta (via {$via})";
        }
    }
    return $problems;
}

function drive_o0_mentions_plate(string $name, string $plate): bool
{
    if ($plate === '') {
        return false;
    }
    $want = drive_o0_key($plate);
    foreach (drive_loose_plate_tokens($name) as $tok) {
        if (drive_o0_key($tok) === $want) {
            return true;
        }
    }
    return false;
}
