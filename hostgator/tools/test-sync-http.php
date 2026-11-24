<?php
declare(strict_types=1);

/**
 * Pruebas del disparo HTTP del sync (auth, rutas, 403 del script CLI).
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

$index = (string) file_get_contents(dirname(__DIR__) . '/api/index.php');
check(str_contains($index, "route === 'sync' && \$method === 'POST'"), 'POST /api/sync está en el router');
check(str_contains($index, "route === 'sync/status' && \$method === 'GET'"), 'GET /api/sync/status está en el router');
check(str_contains($index, 'h_sync_run()') && str_contains($index, 'h_sync_status()'), 'el router llama a los handlers');

$sync = (string) file_get_contents(dirname(__DIR__) . '/api/_cron/sync.php');
check(str_contains($sync, 'function salgado_sync_main()'), 'salgado_sync_main existe');
check(str_contains($sync, 'exit(salgado_sync_main())'), 'el CLI termina con el código de la corrida');
// El 403 sigue si Apache ejecuta _cron/sync.php, no si el archivo se incluye.
check(str_contains($sync, 'http_response_code(403)'), 'el script CLI sigue respondiendo 403 si se abre por la web');
check(str_contains($sync, 'SCRIPT_FILENAME'), 'el 403 solo aplica cuando el script es la entrada');

$ht = (string) file_get_contents(dirname(__DIR__) . '/public/.htaccess');
check(str_contains($ht, 'RewriteRule ^api/(_lib|_cron)(/|$) - [F,L]'), '_no se puede pedir /api/_cron por HTTP');
check(str_contains($ht, 'RewriteRule ^api/(.+)$ api/index.php'), '/api/sync cae en el router');

$wf = (string) file_get_contents(dirname(__DIR__, 2) . '/.github/workflows/sync-inventario.yml');
check(str_contains($wf, 'secrets.SYNC_CRON_SECRET'), 'el workflow usa el secreto de GitHub');
check(str_contains($wf, 'cron:'), 'el workflow está programado');
check(!preg_match('/echo\s+[\"\']\$\{?SYNC_CRON_SECRET/', $wf), 'el workflow no imprime el valor del secreto');

@unlink($cfg);
putenv('SALGADO_CONFIG');

if ($failed > 0) {
    fwrite(STDERR, "Fallaron {$failed} comprobaciones\n");
    exit(1);
}
fwrite(STDOUT, "test-sync-http ok\n");
exit(0);
