<?php
declare(strict_types=1);

/*
 * Optimización de fotos con GD: redimensiona, guarda WebP y una miniatura.
 * Se usa al subir fotos en el admin y en el sync (copia local de Drive).
 */

const IMG_MAX = 1600;
const THUMB_MAX = 560;

function gd_from_string(string $bytes)
{
    if (!function_exists('imagecreatefromstring')) {
        return false;
    }
    $info = @getimagesizefromstring($bytes);
    if (!$info || !in_array($info[2] ?? 0, [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
        return false;
    }
    $img = @imagecreatefromstring($bytes);
    if (!$img) {
        return false;
    }
    if (($info[2] ?? 0) === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($bytes));
        $rot = [3 => 180, 6 => -90, 8 => 90][(int) ($exif['Orientation'] ?? 1)] ?? 0;
        if ($rot) {
            $r = imagerotate($img, $rot, 0);
            if ($r) {
                imagedestroy($img);
                $img = $r;
            }
        }
    }
    return $img;
}

function gd_scaled($img, int $max)
{
    $w = imagesx($img);
    $h = imagesy($img);
    if ($w <= $max && $h <= $max) {
        return $img;
    }
    $scale = $max / max($w, $h);
    $out = imagescale($img, max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)), IMG_BICUBIC);
    return $out ?: $img;
}

/**
 * Escribe <base>.webp (máx 1600 px) y <base>_t.webp (máx 560 px).
 * Sin soporte WebP cae a JPEG. Devuelve [ruta grande, ruta miniatura] o null.
 * @return array{0: string, 1: string}|null
 */
function save_optimized(string $bytes, string $dirAbs, string $base): ?array
{
    $img = gd_from_string($bytes);
    if (!$img) {
        return null;
    }
    if (!is_dir($dirAbs) && !@mkdir($dirAbs, 0755, true)) {
        imagedestroy($img);
        return null;
    }
    $webp = function_exists('imagewebp');
    $ext = $webp ? 'webp' : 'jpg';
    $write = function ($im, string $file, int $q) use ($webp): bool {
        if ($webp) {
            imagepalettetotruecolor($im);
            return imagewebp($im, $file, $q);
        }
        return imagejpeg($im, $file, $q);
    };
    $big = gd_scaled($img, IMG_MAX);
    $ok = $write($big, "{$dirAbs}/{$base}.{$ext}.tmp", 80) && rename("{$dirAbs}/{$base}.{$ext}.tmp", "{$dirAbs}/{$base}.{$ext}");
    $thumb = gd_scaled($big, THUMB_MAX);
    $ok = $ok && $write($thumb, "{$dirAbs}/{$base}_t.{$ext}.tmp", 72) && rename("{$dirAbs}/{$base}_t.{$ext}.tmp", "{$dirAbs}/{$base}_t.{$ext}");
    unset($img, $big, $thumb); // PHP 8: GD libera al salir de alcance
    return $ok ? ["{$base}.{$ext}", "{$base}_t.{$ext}"] : null;
}
