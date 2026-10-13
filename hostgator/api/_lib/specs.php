<?php
declare(strict_types=1);

/*
 * Ficha técnica referencial por marca/modelo (misma tabla que RG Motors,
 * lib/vehicles/techSpecs.ts) + lo que se pueda leer del texto del modelo.
 * La planilla no trae combustible ni transmisión: se completan desde aquí.
 */

function spec_norm(string $s): string
{
    $s = mb_strtolower(fold_accents($s), 'UTF-8');
    return trim(preg_replace('/[^a-z0-9.]+/', ' ', $s) ?? '');
}

/** @return array<string, mixed>|null */
function lookup_tech_spec(string $brand, string $model, int $year): ?array
{
    $b = spec_norm($brand);
    $m = spec_norm($model);
    $has = fn (string $re) => (bool) preg_match($re, $m);
    $rules = [
        [str_contains($b, 'mitsubishi') && $has('/l200|katana/') && $year >= 2024, ['engine' => '2.4L Biturbo Diésel', 'power' => '201 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'mitsubishi') && $has('/l200|katana/'), ['engine' => '2.4L Turbo Diésel', 'power' => '152 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'mitsubishi') && $has('/montero/') && $has('/3\.0/'), ['engine' => '3.0L V6', 'doors' => 5, 'fuel' => 'Bencina', 'traction' => '4x4']],
        [str_contains($b, 'toyota') && $has('/hilux/') && $has('/\bsr\b/') && $has('/4x4/'), ['engine' => '2.8L Turbo Diésel', 'power' => '201 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'toyota') && $has('/hilux/'), ['engine' => '2.4L Turbo Diésel', 'power' => '148 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'toyota') && $has('/raize/'), ['engine' => '1.2L Dual VVT-i', 'power' => '87 HP', 'doors' => 5, 'fuel' => 'Bencina', 'traction' => '4x2']],
        [str_contains($b, 'nissan') && $has('/navara/'), ['engine' => '2.3L Bi-Turbo Diésel', 'power' => '190 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'ford') && $has('/raptor/'), ['engine' => '3.5L V6 EcoBoost Twin-Turbo', 'power' => '450 HP', 'doors' => 4, 'fuel' => 'Bencina', 'traction' => '4x4', 'transmission' => 'Automática']],
        [str_contains($b, 'ford') && $has('/ranger/'), ['engine' => '2.0L Bi-Turbo Diésel', 'power' => '210 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'chevrolet') && $has('/colorado/'), ['engine' => '2.8L Duramax Turbo Diésel', 'power' => '200 HP', 'doors' => 4, 'fuel' => 'Diésel', 'transmission' => 'Automática']],
        [str_contains($b, 'chevrolet') && $has('/d.?max/'), ['engine' => '2.5L Turbo Diésel', 'power' => '163 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'volkswagen') && $has('/amarok/'), ['engine' => '2.0L BiTDI Diésel', 'power' => '180 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'volkswagen') && $has('/saveiro/'), ['engine' => '1.6L MSI', 'power' => '110 HP', 'fuel' => 'Bencina', 'traction' => '4x2']],
        [str_contains($b, 'maxus') && $has('/t60/'), ['engine' => '2.0L Turbo Diésel', 'power' => '163 HP', 'doors' => 4, 'fuel' => 'Diésel']],
        [str_contains($b, 'peugeot') && $has('/partner/') && $has('/1\.6|hdi/'), ['engine' => '1.6L BlueHDi', 'power' => '92 HP', 'doors' => 5, 'fuel' => 'Diésel', 'traction' => '4x2']],
        [str_contains($b, 'peugeot') && $has('/partner/'), ['engine' => '1.5L BlueHDi', 'power' => '100 HP', 'doors' => 5, 'fuel' => 'Diésel', 'traction' => '4x2']],
        [str_contains($b, 'peugeot') && $has('/expert/'), ['engine' => '2.0L BlueHDi', 'power' => '120 HP', 'doors' => 4, 'fuel' => 'Diésel', 'traction' => '4x2']],
        [str_contains($b, 'peugeot') && $has('/boxer/'), ['engine' => '2.2L BlueHDi', 'doors' => 4, 'fuel' => 'Diésel', 'traction' => '4x2']],
        [str_contains($b, 'hyundai') && $has('/porter/'), ['engine' => '2.5L CRDi Diésel', 'power' => '130 HP', 'doors' => 2, 'fuel' => 'Diésel', 'traction' => '4x2']],
        [str_contains($b, 'hino') && $has('/xzu/'), ['engine' => '4.0L Diésel', 'power' => '150 HP', 'doors' => 2, 'fuel' => 'Diésel', 'traction' => '4x2']],
        [str_contains($b, 'mercedes') && $has('/ml\s*300/'), ['engine' => '3.0L V6 CDI Diésel', 'power' => '190 HP', 'doors' => 5, 'fuel' => 'Diésel', 'traction' => '4x4', 'transmission' => 'Automática']],
        [str_contains($b, 'mercedes') && $has('/gle\s*300\s*d/'), ['engine' => '2.0L Turbo Diésel', 'power' => '245 HP', 'doors' => 5, 'fuel' => 'Diésel', 'traction' => '4x4', 'transmission' => 'Automática']],
    ];
    foreach ($rules as [$match, $spec]) {
        if ($match) {
            return $spec;
        }
    }
    return null;
}

/**
 * Combustible y transmisión: primero lo que dice el modelo (CVT, AUT, HDI...),
 * luego la ficha referencial. Sin dato confiable queda null ("Consultar").
 * @return array{fuel: ?string, transmission: ?string, engine: ?string, doors: ?int, traction: ?string, power: ?string}
 */
function vehicle_specs(string $brand, string $model, int $year): array
{
    $m = ' ' . strtoupper(fold_accents($model)) . ' ';
    $fuel = null;
    if (preg_match('/DIESEL|\bHDI\b|BLUEHDI|\bCRDI\b|\bDCI\b|\bTDI\b|\bTD\b|\bCDI\b|\bD\b(?=\s+\d)|DURAMAX/', $m)) {
        $fuel = 'Diésel';
    } elseif (preg_match('/HIBRID|HYBRID|\bHEV\b/', $m)) {
        $fuel = 'Híbrido';
    } elseif (preg_match('/ELECTRIC|\bEV\b/', $m)) {
        $fuel = 'Eléctrico';
    } elseif (preg_match('/BENCINA|GASOLINA|PURETECH|\bMPI\b|\bGDI\b|\bVVT/', $m)) {
        $fuel = 'Bencina';
    }
    $tr = null;
    if (preg_match('/\b(CVT|DCT|AUT|AUTO|AT|IVT|DSG)\b|AUTOM|TIPTRONIC/', $m)) {
        $tr = 'Automática';
    } elseif (preg_match('/\b(MT|MEC)\b|MECAN|MANUAL/', $m)) {
        $tr = 'Manual';
    }
    $traction = preg_match('/\b4X4\b|\b4WD\b|\bAWD\b/', $m) ? '4x4' : (preg_match('/\b4X2\b|\b2WD\b/', $m) ? '4x2' : null);
    $spec = lookup_tech_spec($brand, $model, $year) ?? [];
    if ($fuel === null && !isset($spec['fuel'])) {
        $fuel = gasoline_only_model($brand, $model);
    }
    return [
        'fuel' => $fuel ?? ($spec['fuel'] ?? null),
        'transmission' => $tr ?? ($spec['transmission'] ?? null),
        'engine' => $spec['engine'] ?? null,
        'doors' => isset($spec['doors']) ? (int) $spec['doors'] : null,
        'traction' => $traction ?? ($spec['traction'] ?? null),
        'power' => $spec['power'] ?? null,
    ];
}

/**
 * Modelos que en Chile se venden solo en bencina (sin versión diésel/híbrida en el país
 * para estos años). Si hay duda, no se lista y queda "Consultar".
 */
function gasoline_only_model(string $brand, string $model): ?string
{
    $b = spec_norm($brand);
    $m = ' ' . spec_norm($model) . ' ';
    $list = [
        'chery' => '/tiggo [28]\b/', 'chevrolet' => '/spark|tracker/', 'citroen' => '/\bc3 .*1\.2/',
        'ford' => '/expedition|edge|ecosport/', 'geely' => '/coolray/', 'hyundai' => '/accent|i20|creta|atos|tucson gl 2\.0|tucson 2\.0|grand i10|gran i10/',
        'jetour' => '/x70/', 'kia' => '/soluto|morning/', 'mercedes' => '/\bcla 250\b/', 'mg' => '/^ 3 $|\bzx\b/', 'mini' => '/cooper/',
        'nissan' => '/x trail/', 'opel' => '/mokka 1\.2t/', 'renault' => '/clio/', 'suzuki' => '/baleno|celerio|spresso|swift/',
        'volkswagen' => '/voyage/', 'volvo' => '/\bs60 t4\b/',
    ];
    foreach ($list as $brandKey => $re) {
        if (str_contains($b, $brandKey) && preg_match($re, $m)) {
            return 'Bencina';
        }
    }
    if (str_contains($b, 'volkswagen') && preg_match('/delivery/', $m)) {
        return 'Diésel';
    }
    return null;
}
