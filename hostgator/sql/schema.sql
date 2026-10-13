-- Salgado Automotriz · MySQL 5.7+/MariaDB 10.3+ (cPanel HostGator)
-- Importar una vez en phpMyAdmin sobre la base vacía.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS vehicles (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  source ENUM('sheet','admin') NOT NULL DEFAULT 'admin',
  sort_rank INT NOT NULL DEFAULT 0,
  stock_id VARCHAR(64) NULL,
  plate VARCHAR(16) NULL,
  slug VARCHAR(160) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  model VARCHAR(160) NOT NULL,
  year SMALLINT NOT NULL,
  version VARCHAR(160) NULL,
  category VARCHAR(60) NOT NULL,
  fuel VARCHAR(20) NULL,
  transmission VARCHAR(20) NULL,
  mileage INT NULL,
  color VARCHAR(60) NULL,
  doors TINYINT NULL,
  engine VARCHAR(80) NULL,
  price BIGINT NOT NULL,
  description TEXT NULL,
  location VARCHAR(120) NULL,
  origin VARCHAR(60) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Disponible',
  published TINYINT(1) NOT NULL DEFAULT 1,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY vehicles_slug_uidx (slug),
  UNIQUE KEY vehicles_stock_uidx (stock_id),
  UNIQUE KEY vehicles_plate_uidx (plate),
  KEY vehicles_catalog_idx (published, category, brand, price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vehicle_images (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  vehicle_id VARCHAR(64) NOT NULL,
  storage_path VARCHAR(1024) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  KEY vehicle_images_vehicle_idx (vehicle_id, sort_order),
  CONSTRAINT vehicle_images_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_leads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  telefono VARCHAR(40) NULL,
  mensaje TEXT NULL,
  vehicle_slug VARCHAR(160) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  KEY contact_leads_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS financing_leads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  telefono VARCHAR(40) NOT NULL,
  vehicle_slug VARCHAR(160) NULL,
  pie BIGINT NULL,
  plazo INT NULL,
  renta BIGINT NULL,
  mensaje TEXT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  KEY financing_leads_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  ciudad VARCHAR(80) NULL,
  rating TINYINT NOT NULL,
  texto TEXT NOT NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  KEY reviews_published_idx (published, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  last_login_at DATETIME(3) NULL,
  UNIQUE KEY admin_users_email_uidx (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  k CHAR(64) NOT NULL,
  ts INT UNSIGNED NOT NULL,
  KEY rate_limits_k_idx (k, ts),
  KEY rate_limits_ts_idx (ts)
) ENGINE=InnoDB DEFAULT CHARSET=ascii;

CREATE TABLE IF NOT EXISTS sync_runs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  ok TINYINT(1) NOT NULL DEFAULT 0,
  vehicles INT NULL,
  removed INT NULL,
  message VARCHAR(500) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;