<?php
// Uso local: php hostgator/tools/hash-password.php correo@dominio.cl
// Pide la contraseña sin mostrarla y entrega el INSERT para phpMyAdmin.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    exit;
}
$email = strtolower(trim($argv[1] ?? ''));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Uso: php hash-password.php correo@dominio.cl\n");
    exit(1);
}
fwrite(STDOUT, 'Contraseña (mín. 12 caracteres): ');
$pass = getenv('ADMIN_PASSWORD') ?: trim((string) fgets(STDIN));
if (strlen($pass) < 12) {
    fwrite(STDERR, "Muy corta\n");
    exit(1);
}
$hash = password_hash($pass, PASSWORD_DEFAULT);
$b = random_bytes(16);
$b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
$b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
$id = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
echo "\nINSERT INTO admin_users (id, email, password_hash, is_active, created_at) VALUES ('{$id}', '{$email}', '{$hash}', 1, UTC_TIMESTAMP(3))\n  ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1;\n";