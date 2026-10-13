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

    // Opcional: carpeta de fotos subidas (por defecto public_html/uploads).
    // 'uploads_dir' => '/home/cpaneluser/public_html/uploads',
];