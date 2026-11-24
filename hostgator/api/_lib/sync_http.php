<?php
declare(strict_types=1);

/*
 * Disparo y estado del sync de planilla + Drive, sin cron de cPanel.
 * POST /api/sync  — secreto en Authorization: Bearer o cabecera X-Sync-Secret.
 * GET  /api/sync/status — última corrida, faltantes sin carpeta, bloqueados e incompletas.
 * El secreto se valida contra salgado-config.php (sync_cron_secret), SYNC_CRON_SECRET
 * o el hash SHA-256 desplegado en api/_lib/sync-secret.sha256. Nunca se imprime.
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

function sync_secret_hash_path(): string
{
    $env = getenv('SALGADO_SYNC_SECRET_HASH_FILE');
    if (is_string($env) && $env !== '') {
        return $env;
    }
    return __DIR__ . '/sync-secret.sha256';
}

function sync_secret_hash(): string
{
    $file = sync_secret_hash_path();
    if (!is_file($file)) {
        return '';
    }
    $raw = strtolower(trim((string) @file_get_contents($file)));
    return preg_match('/^[a-f0-9]{64}$/', $raw) === 1 ? $raw : '';
}

function sync_configured(): bool
{
    return strlen(sync_cron_secret()) >= 16 || sync_secret_hash() !== '';
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
    $got = sync_request_secret();
    if (strlen($got) < 16) {
        return false;
    }
    $expected = sync_cron_secret();
    if (strlen($expected) >= 16 && hash_equals($expected, $got)) {
        return true;
    }
    $hash = sync_secret_hash();
    if ($hash !== '' && hash_equals($hash, hash('sha256', $got))) {
        return true;
    }
    return false;
}

function require_sync_secret(): void
{
    if (!sync_configured()) {
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
function salgado_sync_spawn(bool $full = false): bool
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
        . ($full ? ' --full' : '')
        . ' >> ' . escapeshellarg($out) . ' 2>&1 &';
    exec($cmd);
    return true;
}

function salgado_sync_last_report(PDO $pdo): ?array
{
    try {
        $stmt = $pdo->prepare('SELECT v FROM sync_state WHERE k = ? LIMIT 1');
        $stmt->execute(['last_report']);
        $raw = $stmt->fetchColumn();
        if (!is_string($raw) || $raw === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    } catch (Throwable $e) {
        return null;
    }
}

function salgado_sync_vehicle_photo_counts(PDO $pdo): array
{
    $sql = "SELECT v.stock_id, v.brand, v.model, v.year, v.source, v.photos_locked,
                   COUNT(i.id) AS photos
            FROM vehicles v
            LEFT JOIN vehicle_images i
              ON i.vehicle_id = v.id
             AND i.storage_path IS NOT NULL
             AND i.storage_path NOT LIKE '%placeholder%'
            WHERE v.published = 1
              AND (v.archived_at IS NULL OR v.archived_at = '')
            GROUP BY v.id, v.stock_id, v.brand, v.model, v.year, v.source, v.photos_locked
            ORDER BY v.stock_id";
    try {
        return $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch (Throwable $e) {
        return [];
    }
}

function salgado_sync_build_status(PDO $pdo, bool $withLog = false): array
{
    $run = $pdo->query(
        'SELECT id, started_at, finished_at, ok, vehicles, removed, message'
        . ($withLog ? ', log' : '')
        . ' FROM sync_runs ORDER BY id DESC LIMIT 1'
    )->fetch(PDO::FETCH_ASSOC) ?: null;

    $report = salgado_sync_last_report($pdo);
    $driveExpected = is_array($report['drive_expected'] ?? null) ? $report['drive_expected'] : [];
    $missingMap = [];
    foreach (is_array($report['missing_drive_folder'] ?? null) ? $report['missing_drive_folder'] : [] as $item) {
        if (is_array($item) && isset($item['stock_id'])) {
            $missingMap[(string) $item['stock_id']] = (string) ($item['via'] ?? 'none');
        }
    }

    $rows = salgado_sync_vehicle_photo_counts($pdo);
    $published = count($rows);
    $missing = [];
    $locked = [];
    $incomplete = [];

    foreach ($rows as $row) {
        $sid = (string) ($row['stock_id'] ?? '');
        $photos = (int) ($row['photos'] ?? 0);
        $isLocked = (int) ($row['photos_locked'] ?? 0) === 1;
        $base = [
            'stock_id' => $sid,
            'brand' => (string) ($row['brand'] ?? ''),
            'model' => (string) ($row['model'] ?? ''),
            'year' => (int) ($row['year'] ?? 0),
        ];
        if ((string) ($row['source'] ?? '') === 'sheet' && $photos === 0) {
            $missing[] = $base + ['via' => $missingMap[$sid] ?? 'none'];
        }
        $expected = isset($driveExpected[$sid]) ? (int) $driveExpected[$sid] : null;
        if ($isLocked) {
            $locked[] = $base + [
                'photos' => $photos,
                'drive_photos' => $expected,
            ];
            continue;
        }
        if ((string) ($row['source'] ?? '') === 'sheet' && $photos > 0 && $expected !== null && $photos < $expected) {
            $incomplete[] = $base + [
                'photos' => $photos,
                'drive_photos' => $expected,
            ];
        }
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
        'missing_drive_folder' => $missing,
        'missing_drive_folder_count' => count($missing),
        'placeholders' => $missing,
        'placeholder_count' => count($missing),
        'locked' => $locked,
        'locked_count' => count($locked),
        'incomplete_galleries' => $incomplete,
        'incomplete_count' => count($incomplete),
        'deferred_stocks' => is_array($report['deferred_stocks'] ?? null) ? array_values($report['deferred_stocks']) : [],
        'drive_ok' => $report['drive_ok'] ?? null,
        'last_report_at' => $report['generated_at'] ?? null,
    ];
}

function salgado_sync_status_payload(bool $withLog = false): array
{
    return salgado_sync_build_status(db(), $withLog);
}

function h_sync_status(): void
{
    require_sync_secret();
    if (!rate_limit('sync-status:' . client_ip(), 60, 60)) {
        too_many();
    }
    json_out(salgado_sync_status_payload(true));
}

function h_sync_run(): void
{
    require_sync_secret();
    if (!rate_limit('sync-run:' . client_ip(), 15, 3600)) {
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

    $full = (string) ($_GET['full'] ?? '') === '1';
    if (!$full) {
        $raw = (string) file_get_contents('php://input', false, null, 0, 4096);
        if ($raw !== '') {
            $body = json_decode($raw, true);
            if (is_array($body) && !empty($body['full'])) {
                $full = true;
            }
        }
    }

    ignore_user_abort(true);
    @set_time_limit(0);

    if (salgado_sync_spawn($full)) {
        json_out([
            'ok' => true,
            'accepted' => true,
            'mode' => 'background',
            'full' => $full,
            'message' => 'Sync iniciado en segundo plano. Consulte GET /api/sync/status.',
        ], 202);
    }

    if ($full) {
        putenv('SALGADO_SYNC_FULL=1');
    }

    $payload = json_encode([
        'ok' => true,
        'accepted' => true,
        'mode' => 'inline',
        'full' => $full,
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
