<?php
declare(strict_types=1);

/**
 * Patente descubierta, solo control interno.
 * Estas copias no se publican. Los originales en Drive no se tocan.
 *
 * @return string[]
 */
function excluded_photo_ids(): array
{
    return [
        '12r117X8qGUx_lafA3QtAG7Zn1t7ISbEZ',
        '1jpTqLG94T0wcu2jP2yQ4qjgorcGwt1v2',
        '14QjKWJhmABVnPnkML7oMQCf5iOOfgW5M',
        '1-2GpzKOG6fnq9Db2Au5XkziiLRKRBEZb',
        '1SQfNDe92otcV6LrZQcbv7j73qC60Fm--',
        '1FuQhTnPg-mQsj4AOh517qpr9juU7Kt2b',
        '1HTuLTrrvbIaa7oTGBtXj0brigTNNLbhd',
        '150cS7K-VaciUz7eApuelnDR_lX2621L7',
        '1I6MBYKc3q2qB1zpIC1qjJgM8kIMxjdwe',
        '1DIXw7rXpisjEqRfXw9CV2_ny6_57Bfkw',
        '13N773co-fApMOOykvO4IUjZlWrMnaMUn',
        '1FM5M8c8lsXX7iBeeeXj57dS2l17ftLOc',
        '13WOW7SOgXSQ16vvq28bmOJWu1VCqzjiD',
        '1oH9wWADmrkjJc5BjFdeUmO98TSpFMysX',
        '1hGNh2EQekfvgeTRfqUi210-2LvPWq_Ih',
        '1TON0ZV35F_PYkkZqqEdX3R40rrLCjbSz',
    ];
}

function is_photo_excluded($id): bool
{
    if (!is_string($id) && !is_int($id)) {
        return false;
    }
    $id = trim((string) $id);
    if ($id === '') {
        return false;
    }
    static $set = null;
    if ($set === null) {
        $set = array_fill_keys(excluded_photo_ids(), true);
    }
    return isset($set[$id]);
}

function path_has_excluded_photo(?string $path): bool
{
    if ($path === null || $path === '') {
        return false;
    }
    foreach (excluded_photo_ids() as $id) {
        if (str_contains($path, $id)) {
            return true;
        }
    }
    return false;
}

function image_record_is_excluded(array $img): bool
{
    if (is_photo_excluded($img['drive_file_id'] ?? null)) {
        return true;
    }
    return path_has_excluded_photo(isset($img['storage_path']) ? (string) $img['storage_path'] : null)
        || path_has_excluded_photo(isset($img['thumb_path']) ? (string) $img['thumb_path'] : null);
}

/**
 * Quita las fotos excluidas y deja la primera restante como portada (sort_order 0).
 *
 * @param array<int, array> $images
 * @return array<int, array>
 */
function images_without_excluded(array $images): array
{
    $out = [];
    foreach ($images as $img) {
        if (!is_array($img) || image_record_is_excluded($img)) {
            continue;
        }
        $out[] = $img;
    }
    foreach ($out as $i => &$img) {
        $img['sort_order'] = $i;
    }
    unset($img);
    return $out;
}

/**
 * Suma fotos de Drive sin contar las excluidas dentro del tope.
 *
 * @param array<int, array{id?: string, name?: string}> $files
 * @param array<string, true> $seen
 * @param string[] $ids
 */
function collect_public_photo_ids(array $files, array &$seen, array &$ids, int $limit): void
{
    foreach ($files as $f) {
        if (count($ids) >= $limit) {
            return;
        }
        if (!is_array($f)) {
            continue;
        }
        $id = trim((string) ($f['id'] ?? ''));
        $key = mb_strtolower((string) ($f['name'] ?? ''));
        if ($id === '' || $key === '' || isset($seen[$key])) {
            continue;
        }
        if (is_photo_excluded($id)) {
            continue;
        }
        $seen[$key] = true;
        $ids[] = $id;
    }
}

/** Borra la copia local <id>.webp y <id>_t.webp. No falla si ya no están. No toca Drive. */
function remove_excluded_drive_files(string $dir, string $fileId): void
{
    if (!is_photo_excluded($fileId) || !preg_match('/^[A-Za-z0-9_-]+$/', $fileId)) {
        return;
    }
    $dir = rtrim($dir, '/\\');
    foreach ([$fileId . '.webp', $fileId . '_t.webp'] as $name) {
        $path = $dir . '/' . $name;
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
