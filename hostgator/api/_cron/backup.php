<?php
declare(strict_types=1);

/*
 * Respaldo diario de MySQL. Guarda .sql.gz FUERA de public_html
 * (/home/<usuario>/salgado-backups) y deja solo los últimos 7.
 * cPanel → Cron Jobs (diario, 04:15):
 *   15 4 * * * /usr/local/bin/php /home/<usuario>/public_html/api/_cron/backup.php >/dev/null 2>&1
 * Usa mysqldump si el hosting lo permite; si no, un volcado equivalente en PHP.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

require dirname(__DIR__) . '/_lib/app.php';

$dir = rtrim((string) cfg('backup_dir', dirname(__DIR__, 3) . '/salgado-backups'), '/\\');
$keep = max(1, (int) cfg('backup_keep', 7));
if (!is_dir($dir) && !mkdir($dir, 0700, true)) {
    fwrite(STDERR, "No se pudo crear {$dir}\n");
    exit(1);
}
$name = (string) cfg('db_name', '');
$file = $dir . '/' . $name . '-' . gmdate('Ymd-His') . '.sql.gz';

function dump_with_mysqldump(string $file): bool
{
    if (!function_exists('proc_open') || in_array('proc_open', array_map('trim', explode(',', (string) ini_get('disable_functions'))), true)) {
        return false;
    }
    $bin = trim((string) @shell_exec('command -v mysqldump 2>/dev/null'));
    if ($bin === '') {
        return false;
    }
    $cmd = [$bin, '--single-transaction', '--quick', '--routines', '--no-tablespaces', '--default-character-set=utf8mb4',
        '-h', (string) cfg('db_host', 'localhost'), '-P', (string) cfg('db_port', 3306), '-u', (string) cfg('db_user', ''), (string) cfg('db_name', '')];
    // La clave va por variable de entorno, nunca en la línea de comandos.
    $env = ['MYSQL_PWD' => (string) cfg('db_pass', ''), 'PATH' => getenv('PATH') ?: '/usr/bin:/bin'];
    $p = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $env);
    if (!is_resource($p)) {
        return false;
    }
    $gz = gzopen($file, 'wb6');
    while (!feof($pipes[1])) {
        gzwrite($gz, (string) fread($pipes[1], 1 << 16));
    }
    gzclose($gz);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $code = proc_close($p);
    if ($code !== 0) {
        fwrite(STDERR, "mysqldump falló ({$code}): " . trim((string) $err) . "\n");
        @unlink($file);
        return false;
    }
    return true;
}

function dump_with_pdo(string $file): bool
{
    $pdo = db();
    $gz = gzopen($file, 'wb6');
    gzwrite($gz, "-- Respaldo Salgado Automotriz " . gmdate('c') . "\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");
    foreach ($pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_NUM) as [$table]) {
        $create = $pdo->query('SHOW CREATE TABLE `' . str_replace('`', '``', $table) . '`')->fetch(PDO::FETCH_NUM)[1];
        gzwrite($gz, "DROP TABLE IF EXISTS `{$table}`;\n{$create};\n");
        $stmt = $pdo->query('SELECT * FROM `' . str_replace('`', '``', $table) . '`');
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $vals = array_map(fn ($v) => $v === null ? 'NULL' : $pdo->quote((string) $v), $row);
            gzwrite($gz, "INSERT INTO `{$table}` VALUES (" . implode(',', $vals) . ");\n");
        }
        gzwrite($gz, "\n");
    }
    gzwrite($gz, "SET FOREIGN_KEY_CHECKS=1;\n");
    return gzclose($gz);
}

$ok = dump_with_mysqldump($file) || dump_with_pdo($file);
if (!$ok || !is_file($file) || filesize($file) < 100) {
    fwrite(STDERR, "Respaldo fallido\n");
    exit(1);
}
@chmod($file, 0600);
$all = glob($dir . '/' . $name . '-*.sql.gz') ?: [];
rsort($all);
foreach (array_slice($all, $keep) as $old) {
    @unlink($old);
}
fwrite(STDOUT, 'Respaldo OK: ' . basename($file) . ' (' . filesize($file) . " bytes)\n");
