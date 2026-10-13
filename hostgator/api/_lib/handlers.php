<?php
declare(strict_types=1);

const STATUSES = ['Disponible', 'En reserva', 'Vendido', 'Borrador'];

function public_image_path(string $p): string
{
    if ($p === '' || str_starts_with($p, 'http') || str_starts_with($p, '/')) {
        return $p;
    }
    return '/uploads/' . ltrim($p, '/');
}

// ── Público ───────────────────────────────────────────────

function h_public_vehicles(): void
{
    header('Cache-Control: public, max-age=60');
    $list = load_vehicles('v.published = 1', [], "CASE WHEN v.source = 'sheet' THEN v.sort_rank ELSE -1 END ASC, v.created_at DESC");
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['vehicles' => $list], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function h_public_vehicle(string $slug): void
{
    $list = load_vehicles('v.published = 1 AND v.slug = ?', [$slug]);
    if (!$list) {
        json_out(['error' => 'No encontrado'], 404);
    }
    json_out(['vehicle' => $list[0]]);
}

function h_public_reviews(): void
{
    $stmt = db()->query('SELECT * FROM reviews WHERE published = 1 ORDER BY created_at DESC LIMIT 12');
    json_out(['reviews' => array_map('review_out', $stmt->fetchAll())]);
}

function review_out(array $r): array
{
    return [
        'id' => $r['id'],
        'nombre' => $r['nombre'],
        'ciudad' => $r['ciudad'],
        'rating' => (int) $r['rating'],
        'texto' => $r['texto'],
        'published' => (bool) $r['published'],
        'created_at' => iso($r['created_at']),
    ];
}

function h_contact_lead(): void
{
    require_same_origin();
    if (!rate_limit('contact', 5, 600)) {
        too_many();
    }
    $body = read_json(32000);
    if (honeypot_tripped($body)) {
        json_out(['ok' => true]);
    }
    if (!is_array($body)) {
        fail(400, 'Cuerpo inválido');
    }
    $nombre = v_str($body['nombre'] ?? null, 120);
    $email = v_email($body['email'] ?? null);
    if ($nombre === null || mb_strlen($nombre) < 2 || $email === null) {
        json_out(['error' => 'Nombre y email válidos son requeridos'], 400);
    }
    db()->prepare('INSERT INTO contact_leads (id, nombre, email, telefono, mensaje, vehicle_slug, created_at) VALUES (?,?,?,?,?,?,?)')
        ->execute([
            uuid4(), $nombre, $email,
            v_opt_str($body['telefono'] ?? null, 40),
            v_opt_str($body['mensaje'] ?? null, 2000),
            v_opt_str($body['vehicle_slug'] ?? null, 120),
            now_db(),
        ]);
    json_out(['ok' => true]);
}

function h_financing_lead(): void
{
    require_same_origin();
    if (!rate_limit('financing', 5, 600)) {
        too_many();
    }
    $body = read_json(32000);
    if (honeypot_tripped($body)) {
        json_out(['ok' => true]);
    }
    if (!is_array($body)) {
        fail(400, 'Cuerpo inválido');
    }
    $nombre = v_str($body['nombre'] ?? null, 120);
    $email = v_email($body['email'] ?? null);
    $telefono = v_str($body['telefono'] ?? null, 40);
    if ($nombre === null || mb_strlen($nombre) < 2 || $email === null || $telefono === null || mb_strlen($telefono) < 8) {
        json_out(['error' => 'Nombre, email y teléfono son requeridos'], 400);
    }
    $precio = v_opt_num($body['precio'] ?? null);
    $mensaje = v_opt_str($body['mensaje'] ?? null, 2000);
    if ($mensaje === null && $precio !== null) {
        $mensaje = 'Precio vehículo: $' . (string) round($precio);
    }
    $pie = v_opt_num($body['pie'] ?? null);
    $plazo = v_opt_num($body['plazo'] ?? null);
    $renta = v_opt_num($body['renta'] ?? null);
    if ($pie !== null && ($pie < 0 || $pie > 500000000)) {
        json_out(['error' => 'El pie está fuera de rango'], 400);
    }
    if ($plazo !== null && ($plazo < 6 || $plazo > 84)) {
        json_out(['error' => 'El plazo debe estar entre 6 y 84 meses'], 400);
    }
    if ($renta !== null && ($renta < 0 || $renta > 500000000)) {
        json_out(['error' => 'La renta está fuera de rango'], 400);
    }
    db()->prepare('INSERT INTO financing_leads (id, nombre, email, telefono, vehicle_slug, pie, plazo, renta, mensaje, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        ->execute([
            uuid4(), $nombre, $email, $telefono,
            v_opt_str($body['vehicle_slug'] ?? null, 120),
            $pie === null ? null : (int) round($pie),
            $plazo === null ? null : (int) round($plazo),
            $renta === null ? null : (int) round($renta),
            $mensaje,
            now_db(),
        ]);
    json_out(['ok' => true]);
}

function h_consigna(): void
{
    require_same_origin();
    if (!rate_limit('consigna', 3, 1800)) {
        too_many();
    }
    $body = read_json(7000000);
    if (honeypot_tripped($body)) {
        json_out(['ok' => true]);
    }
    if (!is_array($body)) {
        fail(400, 'Cuerpo inválido');
    }
    $nombre = v_str($body['nombre'] ?? null, 120);
    $telefono = v_str($body['telefono'] ?? null, 40);
    if ($nombre === null || mb_strlen($nombre) < 2 || $telefono === null || mb_strlen($telefono) < 8) {
        json_out(['ok' => false, 'error' => 'Faltan nombre o WhatsApp.'], 400);
    }
    $email = null;
    $emailRaw = v_opt_str($body['email'] ?? null, 254);
    if ($emailRaw) {
        $email = v_email($emailRaw);
        if ($email === null) {
            json_out(['ok' => false, 'error' => 'El correo no es válido.'], 400);
        }
    }
    $patente = strtoupper(v_opt_str($body['patente'] ?? null, 12) ?? '');
    $marca = v_opt_str($body['marca'] ?? null, 60) ?? '';
    $modelo = v_opt_str($body['modelo'] ?? null, 80) ?? '';
    $year = v_opt_str($body['year'] ?? null, 4) ?? '';
    $kms = v_opt_str($body['kms'] ?? null, 20) ?? '';
    $notas = v_opt_str($body['notas'] ?? null, 2000) ?? '';
    if ($marca === '' && $modelo === '' && $patente === '') {
        json_out(['ok' => false, 'error' => 'Indica al menos marca, modelo o patente.'], 400);
    }
    if ($year !== '' && !preg_match('/^\d{4}$/', $year)) {
        json_out(['ok' => false, 'error' => 'El año no es válido.'], 400);
    }

    $fotos = [];
    $total = 0;
    $raw = is_array($body['fotos'] ?? null) ? array_slice($body['fotos'], 0, 8) : [];
    foreach ($raw as $item) {
        if (!is_array($item) || !is_string($item['data'] ?? null) || trim($item['data']) === '') {
            continue;
        }
        $data = preg_replace('/^data:[^;]+;base64,/', '', trim($item['data'])) ?? '';
        if ($data === '') {
            continue;
        }
        if (strlen($data) > 900000 || strlen($data) % 4 !== 0 || !preg_match('#^[A-Za-z0-9+/]+={0,2}$#', $data)) {
            json_out(['ok' => false, 'error' => 'Una de las fotos no es válida o pesa demasiado.'], 400);
        }
        $total += strlen($data);
        if ($total > 6500000) {
            json_out(['ok' => false, 'error' => 'Las fotos pesan demasiado en conjunto.'], 400);
        }
        $name = preg_replace('/[^\w.\- ]+/', '', v_opt_str($item['name'] ?? null, 80) ?? ('foto-' . (count($fotos) + 1))) ?? '';
        $fotos[] = ['filename' => str_ends_with($name, '.jpg') ? $name : (($name ?: 'foto') . '.jpg'), 'content' => $data];
    }

    $dash = '—';
    $mensaje = implode("\n", array_filter([
        'Consignación',
        'Patente: ' . ($patente ?: $dash),
        'Marca: ' . ($marca ?: $dash),
        'Modelo: ' . ($modelo ?: $dash),
        'Año: ' . ($year ?: $dash),
        'Km: ' . ($kms ?: $dash),
        'Fotos: ' . count($fotos),
        $notas,
    ], fn ($l) => $l !== ''));

    $saved = false;
    try {
        db()->prepare('INSERT INTO contact_leads (id, nombre, email, telefono, mensaje, created_at) VALUES (?,?,?,?,?,?)')
            ->execute([uuid4(), $nombre, $email ?? 'sin-correo@salgadoautomotriz.cl', $telefono, $mensaje, now_db()]);
        $saved = true;
    } catch (Throwable $e) {
        error_log('[consigna] ' . $e->getMessage());
    }

    $mailed = false;
    $to = (string) cfg('consigna_to', '');
    if ($to !== '') {
        $titulo = trim(implode(' ', array_filter([$marca, $modelo, $year, $patente]))) ?: 'sin ficha';
        $subject = mb_substr(str_replace(["\r", "\n"], ' ', "Consigna: {$titulo} · {$nombre}"), 0, 180);
        $rows = [
            'Nombre' => $nombre, 'WhatsApp' => $telefono, 'Correo' => $email ?: $dash,
            'Patente' => $patente ?: $dash, 'Marca' => $marca ?: $dash, 'Modelo' => $modelo ?: $dash,
            'Año' => $year ?: $dash, 'Kilometraje' => $kms ?: $dash, 'Notas' => $notas ?: $dash,
            'Fotos adjuntas' => (string) count($fotos),
        ];
        $html = '<h2>Nueva consignación — Salgado Automotriz</h2><p>Un cliente dejó su vehículo para que lo contacten.</p>'
            . '<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">';
        foreach ($rows as $k => $v) {
            $html .= '<tr><td><b>' . esc($k) . '</b></td><td>' . nl2br(esc($v)) . '</td></tr>';
        }
        $html .= '</table>';
        $mailed = send_mail($to, $subject, $html, $mensaje, $email, $fotos);
    }

    if ($saved || $mailed) {
        json_out(['ok' => true]);
    }
    json_out(['ok' => false, 'error' => 'No se pudo registrar la consignación. Escríbenos por WhatsApp.'], 503);
}

/** Correo vía mail() del hosting (cPanel firma DKIM del dominio). */
function send_mail(string $to, string $subject, string $html, string $text, ?string $replyTo, array $attachments): bool
{
    $from = (string) cfg('mail_from', 'no-reply@salgadoautomotriz.cl');
    $fromName = (string) cfg('mail_from_name', 'Salgado Automotriz');
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $boundary = 'b' . bin2hex(random_bytes(12));
    $alt = 'a' . bin2hex(random_bytes(12));
    $headers = [
        'MIME-Version: 1.0',
        'From: ' . mb_encode_mimeheader($fromName, 'UTF-8') . " <{$from}>",
        "Content-Type: multipart/mixed; boundary=\"{$boundary}\"",
    ];
    if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers[] = "Reply-To: {$replyTo}";
    }
    $body = "--{$boundary}\r\nContent-Type: multipart/alternative; boundary=\"{$alt}\"\r\n\r\n"
        . "--{$alt}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text)) . "\r\n"
        . "--{$alt}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($html)) . "\r\n--{$alt}--\r\n";
    foreach ($attachments as $a) {
        $name = preg_replace('/[^\w.\- ]+/', '', (string) $a['filename']) ?: 'foto.jpg';
        $body .= "--{$boundary}\r\nContent-Type: image/jpeg; name=\"{$name}\"\r\n"
            . "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$name}\"\r\n\r\n"
            . chunk_split((string) $a['content']) . "\r\n";
    }
    $body .= "--{$boundary}--\r\n";
    $override = cfg('mail_capture_dir');
    if ($override) {
        // Solo pruebas locales: guarda el correo en disco en vez de enviarlo.
        @mkdir((string) $override, 0775, true);
        return (bool) file_put_contents(rtrim((string) $override, '/\\') . '/' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.eml',
            'To: ' . $to . "\r\nSubject: " . $subject . "\r\n" . implode("\r\n", $headers) . "\r\n\r\n" . $body);
    }
    return mail($to, mb_encode_mimeheader($subject, 'UTF-8'), $body, implode("\r\n", $headers), '-f' . $from);
}

// ── Autenticación ─────────────────────────────────────────

function h_signin(): void
{
    require_same_origin();
    if (!rate_limit('signin', 8, 900)) {
        too_many();
    }
    $body = read_json(8000);
    $email = is_array($body) ? v_email($body['email'] ?? null) : null;
    $password = is_array($body) ? v_str($body['password'] ?? null, 128) : null;
    if ($email === null || $password === null) {
        json_out(['error' => 'Email y contraseña son requeridos'], 400);
    }
    $stmt = db()->prepare('SELECT id, email, password_hash, is_active FROM admin_users WHERE email = ? LIMIT 1');
    $stmt->execute([mb_strtolower($email)]);
    $user = $stmt->fetch();
    // Verifica siempre para no revelar por tiempo si el correo existe.
    $hash = $user['password_hash'] ?? '$2y$10$abcdefghijklmnopqrstuuJ0yQ0h3ZqvW1V8w6n2mHNWv4E8G9Hy2';
    $ok = password_verify($password, $hash);
    if (!$user || !$ok) {
        json_out(['error' => 'Credenciales inválidas'], 401);
    }
    if (!(bool) $user['is_active']) {
        json_out(['error' => 'Esta cuenta no tiene permisos de administrador'], 403);
    }
    if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
        db()->prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }
    db()->prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?')->execute([now_db(), $user['id']]);
    start_session();
    session_regenerate_id(true);
    $_SESSION['admin_id'] = $user['id'];
    $_SESSION['admin_email'] = $user['email'];
    $_SESSION['seen_at'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    set_csrf_cookie($_SESSION['csrf']);
    json_out(['ok' => true]);
}

function h_signout(): void
{
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 42000, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    }
    setcookie('salgado_csrf', '', ['expires' => time() - 42000, 'path' => '/', 'samesite' => 'Strict']);
    session_destroy();
    header('Location: /admin/login', true, 302);
    exit;
}

function h_me(): void
{
    $admin = require_admin();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    set_csrf_cookie($_SESSION['csrf']);
    json_out(['ok' => true, 'email' => $admin['email']]);
}

// ── Admin: vehículos ──────────────────────────────────────

function normalize_fuel($v): ?string
{
    $k = mb_strtolower(fold_accents(trim((string) $v)));
    $map = ['bencina' => 'Bencina', 'gasolina' => 'Bencina', 'diesel' => 'Diésel', 'hibrido' => 'Híbrido', 'electrico' => 'Eléctrico'];
    return $map[$k] ?? null;
}

function normalize_transmission($v): ?string
{
    $k = mb_strtolower(fold_accents(trim((string) $v)));
    if ($k === '') {
        return null;
    }
    if (str_starts_with($k, 'aut')) {
        return 'Automática';
    }
    if (str_starts_with($k, 'man') || str_starts_with($k, 'mec')) {
        return 'Manual';
    }
    return null;
}

function opt_trim($v): ?string
{
    if ($v === null) {
        return null;
    }
    $t = trim((string) $v);
    return $t === '' ? null : $t;
}

function vehicle_input(array $in, string $slug): array
{
    $brand = trim((string) ($in['brand'] ?? ''));
    $model = trim((string) ($in['model'] ?? ''));
    $year = $in['year'] ?? null;
    $price = $in['price'] ?? null;
    if ($brand === '' || $model === '') {
        fail(400, 'Marca y modelo son requeridos');
    }
    if (!is_numeric($year) || (int) $year != $year || $year < 1980 || $year > 2100) {
        fail(400, 'Año fuera de rango');
    }
    if (!is_numeric($price) || $price <= 0 || $price > 2000000000) {
        fail(400, 'Precio inválido');
    }
    if (!preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug)) {
        fail(400, 'El slug no es válido');
    }
    $mileage = ($in['mileage'] ?? null) === null || ($in['mileage'] ?? null) === '' ? null : $in['mileage'];
    if ($mileage !== null && (!is_numeric($mileage) || $mileage < 0)) {
        fail(400, 'Kilometraje inválido');
    }
    $doors = $in['doors'] ?? null;
    if ($doors !== null && (!is_numeric($doors) || (int) $doors != $doors || $doors < 1 || $doors > 7)) {
        fail(400, 'Cantidad de puertas inválida');
    }
    $status = in_array($in['status'] ?? null, STATUSES, true) ? $in['status'] : 'Disponible';
    $featured = !empty($in['featured']);
    return [
        'slug' => $slug,
        'brand' => mb_substr($brand, 0, 80),
        'model' => mb_substr($model, 0, 160),
        'year' => (int) $year,
        'version' => opt_trim($in['version'] ?? null),
        'category' => opt_trim($in['category'] ?? null) ?? 'SUV',
        'fuel' => normalize_fuel($in['fuel'] ?? null),
        'transmission' => normalize_transmission($in['transmission'] ?? null),
        'mileage' => $mileage === null ? null : (int) round((float) $mileage),
        'color' => opt_trim($in['color'] ?? null),
        'doors' => $doors === null ? null : (int) $doors,
        'engine' => opt_trim($in['engine'] ?? null),
        'price' => (int) round((float) $price),
        'description' => opt_trim($in['description'] ?? null),
        'plate' => opt_trim($in['plate'] ?? null),
        'stock_id' => opt_trim($in['stock_id'] ?? null),
        'location' => opt_trim($in['location'] ?? null),
        'origin' => opt_trim($in['origin'] ?? null),
        'status' => $status,
        'published' => ($status === 'Disponible' || $status === 'En reserva') ? 1 : 0,
        'featured' => ($featured && $status !== 'Borrador' && $status !== 'Vendido') ? 1 : 0,
    ];
}

function replace_images(string $vehicleId, $images): void
{
    if (!is_array($images)) {
        return;
    }
    $pdo = db();
    $pdo->prepare('DELETE FROM vehicle_images WHERE vehicle_id = ?')->execute([$vehicleId]);
    $ins = $pdo->prepare('INSERT INTO vehicle_images (id, vehicle_id, storage_path, sort_order, created_at) VALUES (?,?,?,?,?)');
    $i = 0;
    foreach ($images as $img) {
        $p = is_array($img) ? trim((string) ($img['storage_path'] ?? '')) : '';
        if ($p === '' || mb_strlen($p) > 1000) {
            continue;
        }
        if (!preg_match('#^(https://|/)#', $p)) {
            continue;
        }
        $ins->execute([uuid4(), $vehicleId, $p, $i, now_db()]);
        if (++$i >= 12) {
            break;
        }
    }
}

function one_vehicle(string $id): array
{
    $list = load_vehicles('v.id = ?', [$id]);
    if (!$list) {
        fail(404, 'No encontrado');
    }
    return as_admin_vehicle($list[0]);
}

function h_admin_create_vehicle(): void
{
    $in = read_json(1000000);
    if (!is_array($in)) {
        fail(400, 'JSON inválido');
    }
    $brand = trim((string) ($in['brand'] ?? ''));
    $model = trim((string) ($in['model'] ?? ''));
    if ($brand === '' || $model === '' || empty($in['year']) || empty($in['price'])) {
        fail(400, 'Marca, modelo, año y precio son requeridos');
    }
    $slugRaw = trim((string) ($in['slug'] ?? '')) ?: slugify("{$brand} {$model} {$in['year']} " . substr((string) time(), -4));
    $slug = trim(preg_replace('/-+/', '-', $slugRaw) ?? '', '-');
    $row = vehicle_input($in, $slug);
    $id = uuid4();
    $now = now_db();
    $cols = array_keys($row);
    $sql = 'INSERT INTO vehicles (id, source, created_at, updated_at, ' . implode(', ', $cols) . ') VALUES (?, \'admin\', ?, ?, '
        . implode(', ', array_fill(0, count($cols), '?')) . ')';
    db()->prepare($sql)->execute(array_merge([$id, $now, $now], array_values($row)));
    if (!empty($in['vehicle_images'])) {
        replace_images($id, $in['vehicle_images']);
    }
    json_out(['vehicle' => one_vehicle($id)]);
}

function h_admin_update_vehicle(string $slug): void
{
    $patch = read_json(1000000);
    if (!is_array($patch)) {
        fail(400, 'JSON inválido');
    }
    $cur = load_vehicles('v.slug = ?', [$slug]);
    if (!$cur) {
        json_out(['error' => 'No encontrado'], 404);
    }
    $current = $cur[0];
    $merged = array_merge($current, $patch, ['slug' => $slug, 'id' => $current['id']]);
    $row = vehicle_input($merged, $slug);
    $sets = implode(', ', array_map(fn ($c) => "{$c} = ?", array_keys($row)));
    db()->prepare("UPDATE vehicles SET {$sets}, updated_at = ? WHERE id = ?")
        ->execute(array_merge(array_values($row), [now_db(), $current['id']]));
    if (array_key_exists('vehicle_images', $patch)) {
        replace_images($current['id'], $patch['vehicle_images']);
    }
    json_out(['vehicle' => one_vehicle($current['id'])]);
}

function h_admin_delete_vehicle(string $slug): void
{
    $stmt = db()->prepare('SELECT id FROM vehicles WHERE slug = ?');
    $stmt->execute([$slug]);
    $id = $stmt->fetchColumn();
    if (!$id) {
        json_out(['error' => 'No encontrado'], 404);
    }
    db()->prepare('DELETE FROM vehicles WHERE id = ?')->execute([$id]);
    $dir = uploads_dir() . '/vehicles/' . $id;
    if (is_dir($dir)) {
        foreach (glob($dir . '/*') ?: [] as $f) {
            @unlink($f);
        }
        @rmdir($dir);
    }
    json_out(['ok' => true]);
}

function uploads_dir(): string
{
    return rtrim((string) cfg('uploads_dir', dirname(__DIR__, 2) . '/uploads'), '/\\');
}

/** Sube fotos (multipart: slug + photos[]). Se re-codifican a JPEG (sin EXIF ni código). */
function h_admin_upload(): void
{
    $slug = (string) ($_POST['slug'] ?? '');
    if (!preg_match('/^[a-z0-9-]{1,160}$/', $slug)) {
        fail(400, 'slug requerido');
    }
    $stmt = db()->prepare('SELECT id FROM vehicles WHERE slug = ?');
    $stmt->execute([$slug]);
    $vehicleId = $stmt->fetchColumn();
    if (!$vehicleId) {
        fail(404, 'No encontrado');
    }
    $files = $_FILES['photos'] ?? null;
    if (!$files || !is_array($files['tmp_name'])) {
        fail(400, 'Adjunta al menos una foto');
    }
    $count = db()->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1, COUNT(*) FROM vehicle_images WHERE vehicle_id = ?');
    $count->execute([$vehicleId]);
    [$next, $existing] = $count->fetch(PDO::FETCH_NUM);
    $next = (int) $next;
    $existing = (int) $existing;
    $dir = uploads_dir() . '/vehicles/' . $vehicleId;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        fail(500, 'No se pudo crear la carpeta de fotos');
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $ins = db()->prepare('INSERT INTO vehicle_images (id, vehicle_id, storage_path, sort_order, created_at) VALUES (?,?,?,?,?)');
    $saved = 0;
    foreach ($files['tmp_name'] as $i => $tmp) {
        if ($existing + $saved >= 12) {
            break;
        }
        if (($files['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
            continue;
        }
        if ((int) $files['size'][$i] > 10 * 1024 * 1024) {
            fail(413, 'Cada foto debe pesar menos de 10 MB');
        }
        $mime = $finfo->file($tmp);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || !getimagesize($tmp)) {
            fail(400, 'Solo se aceptan fotos JPG, PNG o WebP');
        }
        $name = bin2hex(random_bytes(10)) . '.jpg';
        $dest = $dir . '/' . $name;
        if (!reencode_jpeg($tmp, $mime, $dest)) {
            fail(400, 'No se pudo procesar la foto');
        }
        $ins->execute([uuid4(), $vehicleId, '/uploads/vehicles/' . $vehicleId . '/' . $name, $next++, now_db()]);
        $saved++;
    }
    if (!$saved) {
        fail(400, 'No se recibió ninguna foto válida');
    }
    db()->prepare('UPDATE vehicles SET updated_at = ? WHERE id = ?')->execute([now_db(), $vehicleId]);
    json_out(['vehicle' => one_vehicle((string) $vehicleId), 'saved' => $saved]);
}

function reencode_jpeg(string $src, string $mime, string $dest): bool
{
    if (!function_exists('imagecreatefromjpeg')) {
        return $mime === 'image/jpeg' && move_uploaded_file($src, $dest);
    }
    $img = match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($src),
        'image/png' => @imagecreatefrompng($src),
        'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : false,
        default => false,
    };
    if (!$img) {
        return false;
    }
    $w = imagesx($img);
    $h = imagesy($img);
    $max = 2000;
    if ($w > $max || $h > $max) {
        $scale = $max / max($w, $h);
        $img2 = imagescale($img, (int) round($w * $scale), (int) round($h * $scale));
        if ($img2) {
            imagedestroy($img);
            $img = $img2;
        }
    }
    $ok = imagejpeg($img, $dest, 85);
    imagedestroy($img);
    return $ok;
}

// ── Admin: leads y reseñas ────────────────────────────────

function lead_score(string $type, bool $read, ?string $slug): string
{
    if ($type === 'financiamiento') {
        return $read ? 'tibio' : 'caliente';
    }
    if (!$read && $slug) {
        return 'caliente';
    }
    return $read ? 'frio' : 'tibio';
}

function h_admin_leads(): void
{
    $pdo = db();
    $leads = [];
    foreach ($pdo->query('SELECT * FROM contact_leads ORDER BY created_at DESC LIMIT 200')->fetchAll() as $r) {
        $read = (bool) $r['is_read'];
        $leads[] = [
            'id' => 'contact:' . $r['id'], 'type' => 'contacto', 'nombre' => $r['nombre'],
            'email' => $r['email'] ?? '-', 'telefono' => $r['telefono'] ?? '', 'mensaje' => $r['mensaje'] ?? '',
            'vehicle_slug' => $r['vehicle_slug'], 'created_at' => iso($r['created_at']), 'read' => $read,
            'score' => lead_score('contacto', $read, $r['vehicle_slug']),
        ];
    }
    foreach ($pdo->query('SELECT * FROM financing_leads ORDER BY created_at DESC LIMIT 200')->fetchAll() as $r) {
        $read = (bool) $r['is_read'];
        $leads[] = [
            'id' => 'financing:' . $r['id'], 'type' => 'financiamiento', 'nombre' => $r['nombre'],
            'email' => $r['email'], 'telefono' => $r['telefono'], 'mensaje' => $r['mensaje'] ?? '',
            'vehicle_slug' => $r['vehicle_slug'], 'created_at' => iso($r['created_at']), 'read' => $read,
            'score' => lead_score('financiamiento', $read, $r['vehicle_slug']),
        ];
    }
    usort($leads, fn ($a, $b) => strcmp((string) $b['created_at'], (string) $a['created_at']));
    json_out(['leads' => $leads]);
}

function h_admin_mark_lead(): void
{
    $body = read_json(8000);
    $id = is_array($body) ? (string) ($body['id'] ?? '') : '';
    if ($id === '') {
        json_out(['error' => 'id requerido'], 400);
    }
    [$kind, $raw] = array_pad(explode(':', $id, 2), 2, '');
    if (($kind !== 'contact' && $kind !== 'financing') || $raw === '') {
        json_out(['error' => 'id requerido'], 400);
    }
    $table = $kind === 'contact' ? 'contact_leads' : 'financing_leads';
    db()->prepare("UPDATE {$table} SET is_read = 1 WHERE id = ?")->execute([$raw]);
    json_out(['ok' => true]);
}

function h_admin_reviews(): void
{
    $rows = db()->query('SELECT * FROM reviews ORDER BY created_at DESC')->fetchAll();
    json_out(['reviews' => array_map('review_out', $rows)]);
}

function h_admin_upsert_review(): void
{
    $in = read_json(32000);
    if (!is_array($in)) {
        fail(400, 'JSON inválido');
    }
    $nombre = trim((string) ($in['nombre'] ?? ''));
    $texto = trim((string) ($in['texto'] ?? ''));
    if (mb_strlen($nombre) < 2 || mb_strlen($texto) < 4) {
        fail(400, 'Nombre y texto son requeridos');
    }
    $rating = (int) ($in['rating'] ?? 0) ?: 5;
    if ($rating < 1 || $rating > 5) {
        fail(400, 'La nota debe estar entre 1 y 5');
    }
    $id = uuid4();
    db()->prepare('INSERT INTO reviews (id, nombre, ciudad, rating, texto, published, created_at) VALUES (?,?,?,?,?,?,?)')
        ->execute([$id, mb_substr($nombre, 0, 80), opt_trim($in['ciudad'] ?? null), $rating, mb_substr($texto, 0, 2000),
            ($in['published'] ?? true) !== false ? 1 : 0, now_db()]);
    $stmt = db()->prepare('SELECT * FROM reviews WHERE id = ?');
    $stmt->execute([$id]);
    json_out(['review' => review_out($stmt->fetch())]);
}