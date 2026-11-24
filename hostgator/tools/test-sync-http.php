<?php
declare(strict_types=1);

/**
 * Pruebas del disparo HTTP, desbloqueo idempotente de las 13 y reporte /api/sync/status.
 * No toca MySQL ni Drive.
 *
 *   php hostgator/tools/test-sync-http.php
 */

$failed = 0;

function check(bool $ok, string $msg): void
{
    global $failed;
    if ($ok) {
        fwrite(STDOUT, "ok  {$msg}\n");
        return;
    }
    $failed++;
    fwrite(STDERR, "FAIL {$msg}\n");
}

$cfg = tempnam(sys_get_temp_dir(), 'salgado-cfg-');
file_put_contents($cfg, "<?php\nreturn ['sync_cron_secret' => 'test-secret-32chars_abcdefghij'];\n");
putenv('SALGADO_CONFIG=' . $cfg);

require dirname(__DIR__) . '/api/_lib/sync_http.php';

check(function_exists('salgado_sync_main'), 'el sync se puede llamar como función');
check(function_exists('salgado_sync_is_running'), 'hay detección de corrida en curso');
check(sync_cron_secret() === 'test-secret-32chars_abcdefghij', 'lee el secreto de la config');

$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer test-secret-32chars_abcdefghij';
$_SERVER['HTTP_X_SYNC_SECRET'] = '';
check(sync_request_secret() === 'test-secret-32chars_abcdefghij', 'acepta Authorization Bearer');
check(sync_secret_ok(), 'el Bearer válido pasa');

$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer otro-secreto-32chars_xxxxxxxx';
check(!sync_secret_ok(), 'un Bearer distinto no pasa');

unset($_SERVER['HTTP_AUTHORIZATION'], $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
$_SERVER['HTTP_X_SYNC_SECRET'] = 'test-secret-32chars_abcdefghij';
check(sync_request_secret() === 'test-secret-32chars_abcdefghij', 'acepta X-Sync-Secret');
check(sync_secret_ok(), 'la cabecera X-Sync-Secret válida pasa');

$_SERVER['HTTP_X_SYNC_SECRET'] = 'corto';
check(!sync_secret_ok(), 'un secreto corto o distinto no pasa');

unset($_SERVER['HTTP_X_SYNC_SECRET'], $_SERVER['HTTP_AUTHORIZATION']);
check(sync_request_secret() === '', 'sin cabecera no hay secreto');
check(!sync_secret_ok(), 'sin cabecera no autoriza');

// Prueba con hash SHA-256 desplegado sin secreto en salgado-config.php.
$hashSecret = 'deployed-secret-value-over-16-chars';
$hashFile = tempnam(sys_get_temp_dir(), 'salgado-hash-');
file_put_contents($hashFile, hash('sha256', $hashSecret) . "\n");
putenv('SALGADO_SYNC_SECRET_HASH_FILE=' . $hashFile);
check(sync_secret_hash() === hash('sha256', $hashSecret), 'lee el hash SHA-256 desplegado');
check(sync_configured(), 'sync_configured acepta sync-secret.sha256');
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $hashSecret;
check(sync_secret_ok(), 'valida contra sync-secret.sha256');
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer wrong-secret-over-16-chars';
check(!sync_secret_ok(), 'rechaza secreto incorrecto contra hash');
unset($_SERVER['HTTP_AUTHORIZATION']);
// Subproceso limpio sin salgado-config para probar solo el hash desplegado.
$cfgEmpty = tempnam(sys_get_temp_dir(), 'salgado-cfg-empty-');
file_put_contents($cfgEmpty, "<?php\nreturn [];\n");
$sub = 'putenv("SALGADO_CONFIG=' . $cfgEmpty . '"); putenv("SALGADO_SYNC_SECRET_HASH_FILE=' . $hashFile . '"); '
    . 'require "' . dirname(__DIR__) . '/api/_lib/sync_http.php"; '
    . '$_SERVER["HTTP_AUTHORIZATION"]="Bearer ' . $hashSecret . '"; '
    . 'echo (sync_cron_secret()==="" && sync_configured() && sync_secret_ok()) ? "OK" : "FAIL";';
$out = trim((string) shell_exec(escapeshellarg(PHP_BINARY) . ' -r ' . escapeshellarg($sub)));
check($out === 'OK', 'sin clave en salgado-config funciona solo con sync-secret.sha256');
putenv('SALGADO_SYNC_SECRET_HASH_FILE');
@unlink($hashFile);
@unlink($cfgEmpty);
putenv('SALGADO_CONFIG=' . $cfg);

// Prueba SQLite: desbloqueo único de las 13 aprobadas + conservación de las otras 8 + status.
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE vehicles (id TEXT PRIMARY KEY, stock_id TEXT, brand TEXT, model TEXT, year INTEGER, source TEXT, published INTEGER, archived_at TEXT, photos_locked INTEGER, updated_at TEXT)');
$pdo->exec('CREATE TABLE vehicle_images (id TEXT PRIMARY KEY, vehicle_id TEXT, storage_path TEXT)');
$pdo->exec('CREATE TABLE sync_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT, finished_at TEXT, ok INTEGER, vehicles INTEGER, removed INTEGER, message TEXT, log TEXT)');

$approved13 = salgado_sync_approved_unlock_plates();
$other8 = ['RGBP23', 'RGGZ96', 'RRKB78', 'RZTG13', 'RZVK91', 'RZWV49', 'THSR65', 'VFRF57'];
$insV = $pdo->prepare('INSERT INTO vehicles (id, stock_id, brand, model, year, source, published, archived_at, photos_locked, updated_at) VALUES (?, ?, ?, ?, 2022, ?, 1, NULL, ?, ?)');
$insI = $pdo->prepare('INSERT INTO vehicle_images (id, vehicle_id, storage_path) VALUES (?, ?, ?)');

foreach ($approved13 as $p) {
    $insV->execute(['sa-' . $p, $p, 'Marca', 'Modelo', 'sheet', 1, '2026-11-24 03:00:00.000']);
    $insI->execute(['img-' . $p, 'sa-' . $p, '/uploads/drive/' . $p . '.webp']);
}
foreach ($other8 as $p) {
    $insV->execute(['sa-' . $p, $p, 'Marca', 'Modelo', 'sheet', 1, '2026-11-24 03:00:00.000']);
    $insI->execute(['img-' . $p, 'sa-' . $p, '/uploads/curated/x/01.webp']);
}
// Un sin carpeta (0 fotos) y una galería Drive incompleta (10 de 12).
$insV->execute(['sa-KRGK29', 'KRGK29', 'Suzuki', 'Grand Vitara', 'sheet', 0, '2026-11-24 03:00:00.000']);
$insV->execute(['sa-ZRF009', 'ZRF009', 'Dongfeng', 'DB200ZH', 'sheet', 0, '2026-11-24 03:00:00.000']);
$insI->execute(['img-z1', 'sa-ZRF009', '/uploads/drive/z1.webp']);

salgado_sync_ensure_state_tables($pdo);
$unlocked = salgado_sync_unlock_approved($pdo, '2026-11-24 20:15:00.000');
check($unlocked === 13, 'desbloquea exactamente las 13 aprobadas');

$stillLocked = $pdo->query('SELECT stock_id FROM vehicles WHERE photos_locked = 1 ORDER BY stock_id')->fetchAll(PDO::FETCH_COLUMN);
check($stillLocked === $other8, 'las otras 8 bloqueadas quedan intactas');

// Si luego el admin vuelve a bloquear una de las 13, la segunda corrida no la toca.
$pdo->exec("UPDATE vehicles SET photos_locked = 1 WHERE stock_id = 'DDLJ95'");
$second = salgado_sync_unlock_approved($pdo, '2026-11-24 21:00:00.000');
check($second === 0, 'el desbloqueo es único e idempotente');
check((int) $pdo->query("SELECT photos_locked FROM vehicles WHERE stock_id = 'DDLJ95'")->fetchColumn() === 1, 'respeta un bloqueo posterior del admin');

// Status reporta sin carpeta, bloqueados e incompletos.
$pdo->exec("INSERT INTO sync_runs (started_at, finished_at, ok, vehicles, removed, message) VALUES ('2026-11-24 20:15:00.000', '2026-11-24 20:16:00.000', 1, 23, 4, 'ok')");
salgado_sync_save_report($pdo, [
    'generated_at' => '2026-11-24T23:16:00Z',
    'drive_ok' => true,
    'missing_drive_folder' => [['stock_id' => 'KRGK29', 'via' => 'none']],
    'drive_expected' => ['ZRF009' => 11, 'DDLJ95' => 12],
    'deferred_stocks' => [],
], '2026-11-24 20:16:00.000');
$st = salgado_sync_build_status($pdo, false);
check($st['missing_drive_folder_count'] === 1 && ($st['missing_drive_folder'][0]['stock_id'] ?? '') === 'KRGK29', 'status lista autos sin carpeta en Drive');
check($st['locked_count'] === 9, 'status lista los bloqueados activos');
check($st['incomplete_count'] === 1 && ($st['incomplete_galleries'][0]['stock_id'] ?? '') === 'ZRF009', 'status lista galerías incompletas');

$index = (string) file_get_contents(dirname(__DIR__) . '/api/index.php');
check(str_contains($index, "route === 'sync' && \$method === 'POST'"), 'POST /api/sync está en el router');
check(str_contains($index, "route === 'sync/status' && \$method === 'GET'"), 'GET /api/sync/status está en el router');
check(str_contains($index, 'h_sync_run()') && str_contains($index, 'h_sync_status()'), 'el router llama a los handlers');

$sync = (string) file_get_contents(dirname(__DIR__) . '/api/_cron/sync.php');
check(str_contains($sync, 'function salgado_sync_main()'), 'salgado_sync_main existe');
check(str_contains($sync, 'exit(salgado_sync_main())'), 'el CLI termina con el código de la corrida');
check(str_contains($sync, 'http_response_code(403)'), 'el script CLI sigue respondiendo 403 si se abre por la web');
check(str_contains($sync, 'SCRIPT_FILENAME'), 'el 403 solo aplica cuando el script es la entrada');
check(str_contains($sync, 'salgado_sync_unlock_approved'), 'sync.php ejecuta el desbloqueo único');

$ht = (string) file_get_contents(dirname(__DIR__) . '/public/.htaccess');
check(str_contains($ht, 'RewriteRule ^api/(_lib|_cron)(/|$) - [F,L]'), 'no se puede pedir /api/_cron ni /api/_lib por HTTP');
check(str_contains($ht, 'RewriteRule ^api/(.+)$ api/index.php'), '/api/sync cae en el router');

$wf = (string) file_get_contents(dirname(__DIR__, 2) . '/.github/workflows/sync-inventario.yml');
check(str_contains($wf, 'secrets.SYNC_CRON_SECRET'), 'el workflow de sync usa el secreto de GitHub');
check(str_contains($wf, 'cron:'), 'el workflow de sync está programado');
check(!preg_match('/echo\s+["\']\$\{?SYNC_CRON_SECRET/', $wf), 'el workflow de sync no imprime el valor del secreto');

$dwf = (string) file_get_contents(dirname(__DIR__, 2) . '/.github/workflows/deploy-hostgator.yml');
check(str_contains($dwf, 'sync-secret.sha256'), 'el deploy genera el hash SHA-256 para sync HTTP');
check(str_contains($dwf, '/api/sync?full=1'), 'el deploy dispara sync completo al terminar');
check(!preg_match('/echo\s+["\']\$\{?SYNC_CRON_SECRET/', $dwf), 'el deploy no imprime el valor del secreto');

@unlink($cfg);
putenv('SALGADO_CONFIG');

if ($failed > 0) {
    fwrite(STDERR, "Fallaron {$failed} comprobaciones\n");
    exit(1);
}
fwrite(STDOUT, "test-sync-http ok\n");
exit(0);
