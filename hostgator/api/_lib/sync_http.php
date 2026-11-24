<?php
declare(strict_types=1);

/*
 * Disparo y estado del sync de planilla + Drive, sin cron de cPanel.
 * POST /api/sync  — secreto en Authorization: Bearer o cabecera X-Sync-Secret.
 * GET  /api/sync/status — resumen de la última corrida y unidades sin foto.
 * El secreto vive en salgado-config.php (sync_cron_secret) o en la variable
 * de entorno SYNC_CRON_SECRET. Nunca se escribe en logs ni en la respuesta.
 */

require_once __DIR__ . '/app.php';
require_once dirname(__DIR__) . '/_cron/sync.php';

function sync_cron_secret(): string
{
    $fromCfg = trim((string) cfg('sync_cron_secret', ''));
    if ($fromCfg !== '') {
        return $fromCfg;
    }
    return trim((string) (getenv('SYNC_CRON_SECRET') ?: ''));
}

function sync_request_secret(): string
{
    $headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
    foreach ($headers as $name => $value) {
        if (strcasecmp((string) $name, 'Authorization') === 0
            && preg_match('/^Bearer\s+(\S+)/i', (string) $value, $m)) {
            return $m[1];
        }
        if (strcasecmp((string) $name, 'X-Sync-Secret') === 0) {
            return trim((string) $value);
        }
    }
    $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^Bearer\s+(\S+)/i', $auth, $m)) {
        return $m[1];
    }
    return trim((string) ($_SERVER['HTTP_X_SYNC_SECRET'] ?? ''));
}

function sync_secret_ok(): bool
{
    $expected = sync_cron_secret();
    $got = sync_request_secret();
    if ($expected === '' || strlen($expected) < 16 || $got === '') {
        return false;
    }
    return hash_equals($expected, $got);
}

function require_sync_secret(): void
{
    if (sync_cron_secret() === '' || strlen(sync_cron_secret()) < 16) {
        fail(503, 'Sync HTTP no configurado');
    }
    if (!sync_secret_ok()) {
        fail(401, 'No autorizado');
    }
}

function salgado_sync_php_bin(): string
{
    foreach (['/usr/local/bin/php', '/usr/bin/php'] as $bin) {
        if (is_executable($bin)) {
            return $bin;
        }
    }
    $built = PHP_BINARY ?: '';
    return $built !== '' ? $built : 'php';
}

function salgado_sync_exec_disabled(): bool
{
    $raw = (string) ini_get('disable_functions');
    $disabled = array_map(static fn ($s) => strtolower(trim($s)), explode(',', $raw));
    return in_array('exec', $disabled, true) || !function_exists('exec');
}

/** Arranca el CLI en segundo plano. False si exec no está disponible. */
function salgado_sync_spawn(): bool
{
    $script = realpath(dirname(__DIR__) . '/_cron/sync.php');
    if ($script === false || salgado_sync_exec_disabled()) {
        return false;
    }
    $logDir = (string) cfg('log_dir', dirname(__DIR__, 3) . '/salgado-logs');
    if (!is_dir($logDir) && !@mkdir($logDir, 0750, true) && !is_dir($logDir)) {
        $logDir = sys_get_temp_dir();
    }
    $out = $logDir . '/sync-http.log';
    $cmd = escapeshellarg(salgado_sync_php_bin()) . ' ' . escapeshellarg($script)
        . ' >> ' . escapeshellarg($out) . ' 2>&1 &';
    exec($cmd);
    return true;
}

function salgado_sync_placeholder_rows(PDO $pdo): array
{
    $sql = "SELECT v.stock_id, v.brand, v.model, v.year,
                   COUNT(i.id) AS photos
            FROM vehicles v
            LEFT JOIN vehicle_images i
              ON i.vehicle_id = v.id
             AND i.storage_path IS NOT NULL
             AND i.storage_path NOT LIKE '%placeholder%'
            WHERE v.published = 1
              AND v.source = 'sheet'
              AND (v.archived_at IS NULL OR v.archived_at = '')
            GROUP BY v.id, v.stock_id, v.brand, v.model, v.year
            HAVING photos = 0
            ORDER BY v.stock_id";
    try {
        return $pdo->query($sql)->fetchAll() ?: [];
    } catch (Throwable $e) {
        return [];
    }
}

function salgado_sync_status_payload(bool $withLog = false): array
{
    $pdo = db();
    $run = $pdo->query(
        'SELECT id, started_at, finished_at, ok, vehicles, removed, message'
        . ($withLog ? ', log' : '')
        . ' FROM sync_runs ORDER BY id DESC LIMIT 1'
    )->fetch() ?: null;

    $placeholders = [];
    foreach (salgado_sync_placeholder_rows($pdo) as $row) {
        $placeholders[] = [
            'stock_id' => (string) $row['stock_id'],
            'brand' => (string) $row['brand'],
            'model' => (string) $row['model'],
            'year' => (int) $row['year'],
        ];
    }

    $published = 0;
    try {
        $published = (int) $pdo->query(
            "SELECT COUNT(*) FROM vehicles WHERE published = 1 AND (archived_at IS NULL OR archived_at = '')"
        )->fetchColumn();
    } catch (Throwable $e) {
        $published = 0;
    }

    $last = null;
    if (is_array($run)) {
        $last = [
            'id' => (int) $run['id'],
            'started_at' => iso($run['started_at'] ?? null),
            'finished_at' => iso($run['finished_at'] ?? null),
            'ok' => (bool) $run['ok'],
            'vehicles' => $run['vehicles'] !== null ? (int) $run['vehicles'] : null,
            'removed' => $run['removed'] !== null ? (int) $run['removed'] : null,
            'message' => $run['message'] !== null ? (string) $run['message'] : null,
        ];
        if ($withLog && isset($run['log'])) {
            $last['log'] = mb_substr((string) $run['log'], 0, 20000);
        }
    }

    $running = salgado_sync_is_running()
        || ($run && ($run['finished_at'] ?? null) === null && !empty($run['started_at']));

    return [
        'running' => $running,
        'last_run' => $last,
        'published' => $published,
        'placeholders' => $placeholders,
        'placeholder_count' => count($placeholders),
    ];
}

function h_sync_status(): void
{
    require_sync_secret();
    if (!rate_limit('sync-status:' . client_ip(), 30, 60)) {
        too_many();
    }
    json_out(salgado_sync_status_payload(true));
}

function h_sync_run(): void
{
    require_sync_secret();
    if (!rate_limit('sync-run:' . client_ip(), 10, 3600)) {
        too_many();
    }
    if (salgado_sync_is_running()) {
        json_out([
            'ok' => false,
            'accepted' => false,
            'error' => 'Ya hay un sync en curso',
            'status' => salgado_sync_status_payload(false),
        ], 409);
    }

    ignore_user_abort(true);
    @set_time_limit(0);

    if (salgado_sync_spawn()) {
        json_out([
            'ok' => true,
            'accepted' => true,
            'mode' => 'background',
            'message' => 'Sync iniciado en segundo plano. Consulte GET /api/sync/status.',
        ], 202);
    }

    $payload = json_encode([
        'ok' => true,
        'accepted' => true,
        'mode' => 'inline',
        'message' => 'Sync aceptado. Consulte GET /api/sync/status.',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    http_response_code(202);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('Content-Length: ' . (string) strlen((string) $payload));
    header('Connection: close');
    echo $payload;
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        if (function_exists('session_write_close')) {
            @session_write_close();
        }
        while (ob_get_level() > 0) {
            @ob_end_flush();
        }
        @flush();
    }
    salgado_sync_main();
}
