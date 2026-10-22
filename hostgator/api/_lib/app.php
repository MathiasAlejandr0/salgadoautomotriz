<?php
declare(strict_types=1);

/*
 * Núcleo del backend PHP de Salgado Automotriz (HostGator / cPanel).
 * La configuración (credenciales MySQL, correo) vive FUERA de public_html:
 * /home/<usuario>/salgado-config.php. Ver hostgator/config.sample.php.
 */

const FALLBACK_IMAGE = '/placeholder-car.svg';

function cfg(string $key, $default = null)
{
    static $config = null;
    if ($config === null) {
        $config = [];
        $candidates = [];
        $env = getenv('SALGADO_CONFIG');
        if ($env) {
            $candidates[] = $env;
        }
        // public_html/api/_lib -> /home/<usuario>
        $candidates[] = dirname(__DIR__, 3) . '/salgado-config.php';
        foreach ($candidates as $file) {
            if (is_file($file)) {
                $loaded = require $file;
                if (is_array($loaded)) {
                    $config = $loaded;
                }
                break;
            }
        }
    }
    return array_key_exists($key, $config) ? $config[$key] : $default;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $host = (string) cfg('db_host', 'localhost');
        $port = (int) cfg('db_port', 3306);
        $name = (string) cfg('db_name', '');
        if ($name === '') {
            throw new RuntimeException('Base de datos no configurada');
        }
        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
        $pdo = new PDO($dsn, (string) cfg('db_user', ''), (string) cfg('db_pass', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
    }
    return $pdo;
}

class HttpError extends Exception
{
    public int $status;
    public function __construct(int $status, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $message): void
{
    throw new HttpError($status, $message);
}

function read_json(int $maxBytes)
{
    $declared = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($declared > $maxBytes) {
        fail(413, 'Solicitud demasiado grande');
    }
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || trim($raw) === '') {
        fail(400, 'JSON inválido');
    }
    if (strlen($raw) > $maxBytes) {
        fail(413, 'Solicitud demasiado grande');
    }
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        fail(400, 'JSON inválido');
    }
    return $data;
}

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 64);
}

/** true si la petición está permitida. Global (MySQL), no por proceso. */
function rate_limit(string $bucket, int $limit, int $windowSeconds): bool
{
    $key = hash('sha256', $bucket . '|' . client_ip());
    $now = time();
    $pdo = db();
    $pdo->prepare('DELETE FROM rate_limits WHERE k = ? AND ts < ?')->execute([$key, $now - $windowSeconds]);
    if (random_int(1, 50) === 1) {
        $pdo->prepare('DELETE FROM rate_limits WHERE ts < ?')->execute([$now - 86400]);
    }
    $count = $pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE k = ?');
    $count->execute([$key]);
    if ((int) $count->fetchColumn() >= $limit) {
        return false;
    }
    $pdo->prepare('INSERT INTO rate_limits (k, ts) VALUES (?, ?)')->execute([$key, $now]);
    return true;
}

function too_many(): void
{
    fail(429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
}

function honeypot_tripped($body): bool
{
    return is_array($body) && isset($body['company_website']) && is_string($body['company_website'])
        && trim($body['company_website']) !== '';
}

/** Bloquea POST de otros sitios (el navegador siempre manda Origin en fetch POST). */
function require_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $originPort = parse_url($origin, PHP_URL_PORT);
    if ($originPort) {
        $originHost .= ':' . $originPort;
    }
    if ($originHost !== $host) {
        fail(403, 'Origen no permitido');
    }
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function iso($datetime): ?string
{
    if ($datetime === null || $datetime === '') {
        return null;
    }
    $d = new DateTimeImmutable((string) $datetime, new DateTimeZone('UTC'));
    return $d->format('Y-m-d\TH:i:s.v\Z');
}

function now_db(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.v');
}

function fold_accents(string $s): string
{
    return strtr($s, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N',
        'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u', 'â' => 'a', 'ê' => 'e',
        'î' => 'i', 'ô' => 'o', 'û' => 'u', 'ç' => 'c', 'Ç' => 'C', 'ö' => 'o', 'ä' => 'a', 'ë' => 'e',
    ]);
}

function slugify(string $s): string
{
    $s = mb_strtolower(fold_accents($s), 'UTF-8');
    $s = preg_replace('/[^a-z0-9\s-]/', '', $s) ?? '';
    $s = preg_replace('/\s+/', '-', trim($s)) ?? '';
    return $s;
}

function is_plate_token(string $value): bool
{
    return (bool) preg_match('/^(?:[a-z]{4}\d{2}|[a-z]{2}\d{4})$/i', trim($value));
}

function numeric_stock(array $v): string
{
    $stock = preg_replace('/\D/', '', (string) ($v['stock_id'] ?? '')) ?? '';
    $plate = (string) ($v['plate'] ?? '');
    if ($stock === '' || ($plate !== '' && strtoupper($stock) === strtoupper($plate))) {
        return '';
    }
    return $stock;
}

/**
 * Slug público: marca-modelo-versión-año-id. La patente no entra.
 * Misma cuenta que lib/vehicle-public.ts, para que el HTML y la API coincidan.
 *
 * @param array<int, array> $vehicles
 * @return array<int, array{row: array, slug: string, legacy: array<int, string>}>
 */
function public_identity(array $vehicles): array
{
    $counts = [];
    foreach ($vehicles as $v) {
        $stock = numeric_stock($v);
        if ($stock === '') {
            continue;
        }
        $counts[$stock] = ($counts[$stock] ?? 0) + 1;
    }
    $used = [];
    $out = [];
    foreach ($vehicles as $v) {
        $legacy = [];
        $db = strtolower(trim((string) ($v['slug'] ?? '')));
        if ($db !== '') {
            $legacy[$db] = true;
        }
        $plate = trim((string) ($v['plate'] ?? ''));
        if ($plate !== '' && is_plate_token($plate)) {
            $legacy[slugify($v['brand'] . ' ' . $v['model'] . ' ' . $v['year'] . ' ' . $plate)] = true;
        }
        $slug = $db;
        $needs = str_starts_with((string) ($v['id'] ?? ''), 'sa-')
            || ($plate !== '' && is_plate_token($plate));
        if ($needs) {
            $stock = numeric_stock($v);
            $color = (string) ($v['color'] ?? '');
            $hash = substr(hash('sha256', $v['brand'] . '|' . $v['model'] . '|' . $v['year'] . '|' . $color . '|' . $stock . '|' . (int) $v['price']), 0, 6);
            $short = ($stock !== '' && ($counts[$stock] ?? 0) === 1 && !is_plate_token($stock)) ? $stock : 'n' . $hash;
            $version = (string) (($v['version'] ?? '') !== '' && $v['version'] !== null ? $v['version'] : $color);
            $slug = slugify(trim($v['brand'] . ' ' . $v['model'] . ' ' . $version . ' ' . $v['year'] . ' ' . $short));
            if (isset($used[$slug])) {
                $slug .= '-' . $short;
            }
        }
        $used[$slug] = true;
        unset($legacy[$slug]);
        $out[] = ['row' => $v, 'slug' => $slug, 'legacy' => array_keys($legacy)];
    }
    return $out;
}

function public_blurb(array $v): string
{
    $name = trim($v['brand'] . ' ' . $v['model'] . ' ' . $v['year']);
    $price = number_format((int) $v['price'], 0, ',', '.');
    return $name . ' por $' . $price . ' en Salgado Automotriz. Escríbenos por WhatsApp y agenda tu visita en Cardonal 15, Puerto Montt.';
}

function esc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// ── Sesión de administrador ────────────────────────────────

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('salgado_admin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '28800');
    session_start();
}

function set_csrf_cookie(string $token): void
{
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    setcookie('salgado_csrf', $token, [
        'expires' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => false,
        'samesite' => 'Strict',
    ]);
}

function require_admin(): array
{
    start_session();
    $id = $_SESSION['admin_id'] ?? null;
    $last = (int) ($_SESSION['seen_at'] ?? 0);
    if (!$id || ($last && time() - $last > 8 * 3600)) {
        fail(401, 'No autorizado');
    }
    $_SESSION['seen_at'] = time();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'HEAD') {
        require_same_origin();
        $sent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        $expected = (string) ($_SESSION['csrf'] ?? '');
        if ($expected === '' || !hash_equals($expected, $sent)) {
            fail(403, 'Token CSRF inválido. Recarga la página.');
        }
    }
    return ['id' => $id, 'email' => (string) ($_SESSION['admin_email'] ?? '')];
}

// ── Validación (espejo de lib/validation.ts) ───────────────

function v_str($v, int $max = 500): ?string
{
    if (!is_string($v)) {
        return null;
    }
    $t = trim($v);
    if ($t === '' || mb_strlen($t) > $max) {
        return null;
    }
    return $t;
}

function v_opt_str($v, int $max = 2000): ?string
{
    if ($v === null || $v === '' || !is_string($v)) {
        return null;
    }
    $t = trim($v);
    if (mb_strlen($t) > $max) {
        return null;
    }
    return $t;
}

function v_email($v): ?string
{
    $s = v_str($v, 254);
    if ($s === null || !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $s)) {
        return null;
    }
    return $s;
}

function v_opt_num($v): ?float
{
    if ($v === null || $v === '') {
        return null;
    }
    if (is_int($v) || is_float($v)) {
        return is_finite((float) $v) ? (float) $v : null;
    }
    if (is_string($v) && is_numeric(trim($v))) {
        return (float) trim($v);
    }
    return null;
}

/** Carpeta pública de fotos (public_html/uploads por defecto). */
function uploads_dir(): string
{
    return rtrim((string) cfg('uploads_dir', dirname(__DIR__, 2) . '/uploads'), '/\\');
}

// ── Vehículos ─────────────────────────────────────────────

function vehicle_row_out(array $r, array $images): array
{
    return [
        'id' => $r['id'],
        'slug' => $r['slug'],
        'brand' => $r['brand'],
        'model' => $r['model'],
        'year' => (int) $r['year'],
        'version' => $r['version'],
        'category' => $r['category'],
        'fuel' => $r['fuel'],
        'transmission' => $r['transmission'],
        'mileage' => $r['mileage'] === null ? null : (int) $r['mileage'],
        'color' => $r['color'],
        'doors' => $r['doors'] === null ? null : (int) $r['doors'],
        'engine' => $r['engine'],
        'traction' => $r['traction'] ?? null,
        'power' => $r['power'] ?? null,
        'price' => (int) $r['price'],
        'description' => $r['description'],
        'plate' => $r['plate'],
        'stock_id' => $r['stock_id'],
        'location' => $r['location'],
        'origin' => $r['origin'],
        'status' => $r['status'],
        'published' => (bool) $r['published'],
        'featured' => (bool) $r['featured'],
        'source' => $r['source'] ?? 'admin',
        'photos_locked' => (bool) ($r['photos_locked'] ?? false),
        'archived_at' => iso($r['archived_at'] ?? null),
        'created_at' => iso($r['created_at']),
        'updated_at' => iso($r['updated_at']),
        'vehicle_images' => $images,
    ];
}

/** @return array<int, array> */
function load_vehicles(string $where = '1=1', array $params = [], string $order = 'v.updated_at DESC'): array
{
    $stmt = db()->prepare("SELECT v.* FROM vehicles v WHERE {$where} ORDER BY {$order}");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    if (!$rows) {
        return [];
    }
    $ids = array_column($rows, 'id');
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $img = db()->prepare("SELECT * FROM vehicle_images WHERE vehicle_id IN ({$marks}) ORDER BY sort_order ASC");
    $img->execute($ids);
    $byVehicle = [];
    foreach ($img->fetchAll() as $i) {
        $byVehicle[$i['vehicle_id']][] = [
            'id' => $i['id'],
            'vehicle_id' => $i['vehicle_id'],
            'storage_path' => $i['storage_path'],
            'thumb_path' => $i['thumb_path'] ?? null,
            'source' => $i['source'] ?? 'drive',
            'sort_order' => (int) $i['sort_order'],
            'created_at' => iso($i['created_at']),
        ];
    }
    $out = [];
    foreach ($rows as $r) {
        $out[] = vehicle_row_out($r, $byVehicle[$r['id']] ?? []);
    }
    return $out;
}

function as_admin_vehicle(array $v): array
{
    $first = $v['vehicle_images'][0]['storage_path'] ?? '';
    $v['image'] = $first !== '' ? $first : FALLBACK_IMAGE;
    return $v;
}