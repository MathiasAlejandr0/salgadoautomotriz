<?php
// Solo pruebas locales: emula las reglas de public/.htaccess con `php -S`.
// php -S 127.0.0.1:8090 -t dist/public_html hostgator/tools/dev-router.php
$root = $_SERVER['DOCUMENT_ROOT'];
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (str_contains($path, '..')) {
    http_response_code(400);
    return true;
}
if (preg_match('#^/api/(_lib|_cron)(/|$)#', $path) || preg_match('#^/uploads/.*\.php#i', $path)) {
    http_response_code(403);
    return true;
}
if (str_starts_with($path, '/api/')) {
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require $root . '/api/index.php';
    return true;
}
if ($path !== '/' && str_ends_with($path, '/')) {
    header('Location: ' . rtrim($path, '/'), true, 301);
    return true;
}
if ($path === '/') {
    $path = '/index.html';
}
if (preg_match('#^/catalogo/detalle/([a-z0-9-]+)$#', $path, $m)) {
    $path = is_file("{$root}/catalogo/detalle/{$m[1]}.html") ? "/catalogo/detalle/{$m[1]}.html" : '/catalogo/detalle/_.html';
} elseif (!is_file($root . $path) && is_file($root . $path . '.html')) {
    $path .= '.html';
}
$file = $root . $path;
if (!is_file($file)) {
    http_response_code(404);
    $file = $root . '/404.html';
}
$types = ['html' => 'text/html; charset=utf-8', 'js' => 'application/javascript', 'css' => 'text/css', 'svg' => 'image/svg+xml',
    'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'ico' => 'image/x-icon',
    'json' => 'application/json', 'txt' => 'text/plain', 'xml' => 'application/xml', 'woff2' => 'font/woff2'];
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
readfile($file);
return true;