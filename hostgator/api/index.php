<?php
declare(strict_types=1);

/*
 * Router único de /api/*. Apache (.htaccess) reescribe /api/<ruta> aquí.
 * Contratos idénticos a las rutas Next.js originales (app/api/**).
 */

require __DIR__ . '/_lib/app.php';
require __DIR__ . '/_lib/handlers.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

$path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$pos = strpos($path, '/api/');
$route = $pos === false ? '' : trim(substr($path, $pos + 5), '/');
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

try {
    switch (true) {
        case $route === 'vehicles' && $method === 'GET':
            h_public_vehicles();
            break;
        case (bool) preg_match('#^vehicles/([a-z0-9-]{1,160})$#', $route, $m) && $method === 'GET':
            h_public_vehicle($m[1]);
            break;
        case $route === 'reviews' && $method === 'GET':
            h_public_reviews();
            break;
        case $route === 'contact-lead' && $method === 'POST':
            h_contact_lead();
            break;
        case $route === 'financing-lead' && $method === 'POST':
            h_financing_lead();
            break;
        case $route === 'consigna' && $method === 'POST':
            h_consigna();
            break;
        case $route === 'auth/signin' && $method === 'POST':
            h_signin();
            break;
        case $route === 'auth/signout' && $method === 'POST':
            h_signout();
            break;
        case $route === 'auth/me' && $method === 'GET':
            h_me();
            break;
        case $route === 'admin/vehicles' && $method === 'GET':
            require_admin();
            json_out(['vehicles' => array_map('as_admin_vehicle', load_vehicles())]);
            break;
        case $route === 'admin/vehicles' && $method === 'POST':
            require_admin();
            h_admin_create_vehicle();
            break;
        case (bool) preg_match('#^admin/vehicles/([a-z0-9-]{1,160})$#', $route, $m) && $method === 'PUT':
            require_admin();
            h_admin_update_vehicle($m[1]);
            break;
        case (bool) preg_match('#^admin/vehicles/([a-z0-9-]{1,160})$#', $route, $m) && $method === 'DELETE':
            require_admin();
            h_admin_delete_vehicle($m[1]);
            break;
        case $route === 'admin/upload' && $method === 'POST':
            require_admin();
            h_admin_upload();
            break;
        case $route === 'admin/leads' && $method === 'GET':
            require_admin();
            h_admin_leads();
            break;
        case $route === 'admin/leads' && $method === 'PATCH':
            require_admin();
            h_admin_mark_lead();
            break;
        case $route === 'admin/reviews' && $method === 'GET':
            require_admin();
            h_admin_reviews();
            break;
        case $route === 'admin/reviews' && $method === 'POST':
            require_admin();
            h_admin_upsert_review();
            break;
        default:
            json_out(['error' => 'No encontrado'], 404);
    }
} catch (HttpError $e) {
    json_out(['ok' => false, 'error' => $e->getMessage()], $e->status);
} catch (PDOException $e) {
    error_log('[salgado api] ' . $e->getMessage());
    if ((string) $e->getCode() === '23000') {
        json_out(['error' => 'Ya existe un vehículo con esa patente, stock o slug'], 409);
    }
    json_out(['error' => 'Error interno'], 500);
} catch (Throwable $e) {
    error_log('[salgado api] ' . $e->getMessage());
    json_out(['error' => 'Error interno'], 500);
}