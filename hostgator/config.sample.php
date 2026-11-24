<?php
// Copia este archivo a /home/<usuario-cpanel>/salgado-config.php (FUERA de public_html)
// y completa los valores en el servidor. Nunca lo subas a git.
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'cpaneluser_salgado',
    'db_user' => 'cpaneluser_salgado',
    'db_pass' => 'CAMBIAR',

    // Consignaciones: a quién llega el correo y desde qué casilla del dominio sale.
    'consigna_to' => 'contacto@salgadoautomotriz.cl',
    'mail_from' => 'no-reply@salgadoautomotriz.cl',
    'mail_from_name' => 'Salgado Automotriz',

    // Inventario (cron). Planilla pública de lectura + carpeta FOTOS de Drive.
    'sheet_id' => '1BG2uR6APbXEMvVvRmdR-Nn0Vko6eobJ6Xam0XX41Ldc',
    'sheet_tab' => 'SALGADO AUTOMOTRIZ',
    'drive_folder_id' => '1T_FkTaF9rFf97kM14MvdYzJHSYg-WLgo',
    // Tope de carpetas que el sync abre por corrida. La raíz ya tiene cientos
    // de carpetas por patente; 200 dejaba sin fotos a las últimas.
    // 'drive_index_max_listings' => 800,
    // Opcional. Con esta clave el índice usa files.list (md5, atajos, HEIC).
    // Sin ella se usa la vista embebida pública.
    // 'drive_api_key' => '',
    // changes.list solo funciona con OAuth (una API key no alcanza). Sin estas
    // tres claves cada sync reindexa la carpeta completa, una vez por subcarpeta.
    // 'drive_oauth_client_id' => '',
    // 'drive_oauth_client_secret' => '',
    // 'drive_oauth_refresh_token' => '',

    // Opcional: carpeta de fotos subidas (por defecto public_html/uploads).
    // 'uploads_dir' => '/home/cpaneluser/public_html/uploads',
];

    // Opcional: el deploy ya sube el hash SHA-256 de SYNC_CRON_SECRET a api/_lib/sync-secret.sha256.
    // Puedes dejar esto vacío si usas ese secreto en GitHub Actions.
    // Genera uno largo, de 32 caracteres o más. Nunca lo subas a git.
    // 'sync_cron_secret' => '',
    // Fotos nuevas por corrida (el resto se descarga en la siguiente).
    // 'sync_photo_budget' => 400,
