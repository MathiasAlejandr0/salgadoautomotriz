-- Salgado Automotriz · índice local de la carpeta de fotos de Drive.
-- El deploy por FTPS no ejecuta SQL. sync.php aplica este archivo con
-- CREATE TABLE IF NOT EXISTS en la primera corrida (no borra datos).
-- Importarlo a mano en phpMyAdmin es opcional y se puede repetir.
-- Base: la de salgado-config.php (en el servidor, ferna504_salgado).

CREATE TABLE IF NOT EXISTS drive_index (
  id VARCHAR(128) NOT NULL,
  nombre VARCHAR(1024) NOT NULL,
  ruta VARCHAR(2048) NULL,
  parent_id VARCHAR(128) NULL,
  md5 CHAR(32) NULL,
  modified VARCHAR(40) NULL,
  image_time VARCHAR(40) NULL,
  mime VARCHAR(160) NULL,
  is_folder TINYINT(1) NOT NULL DEFAULT 0,
  shortcut_target VARCHAR(128) NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY drive_index_parent_idx (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drive_sync_state (
  id TINYINT UNSIGNED NOT NULL,
  page_token VARCHAR(512) NULL,
  root_id VARCHAR(128) NULL,
  mode VARCHAR(16) NOT NULL DEFAULT 'full',
  indexed_at DATETIME(3) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
