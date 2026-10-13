-- Salgado Automotriz · migración 2 (paridad con RG). Solo ALTER TABLE, no destructiva.
-- Importar UNA vez en phpMyAdmin sobre ferna504_salgado ANTES de subir los archivos nuevos.
SET NAMES utf8mb4;

ALTER TABLE vehicles
  ADD COLUMN traction VARCHAR(20) NULL AFTER engine,
  ADD COLUMN power VARCHAR(40) NULL AFTER traction,
  ADD COLUMN photos_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER featured,
  ADD COLUMN archived_at DATETIME(3) NULL AFTER photos_locked,
  ADD KEY vehicles_archived_idx (source, archived_at);

ALTER TABLE vehicle_images
  ADD COLUMN thumb_path VARCHAR(1024) NULL AFTER storage_path,
  ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'drive' AFTER thumb_path,
  ADD COLUMN drive_file_id VARCHAR(128) NULL AFTER source;

-- Fotos ya subidas a mano: quedan marcadas y protegidas del sync de Drive.
UPDATE vehicle_images SET source = 'upload' WHERE storage_path LIKE '/uploads/vehicles/%';
UPDATE vehicles v SET photos_locked = 1
  WHERE EXISTS (SELECT 1 FROM vehicle_images i WHERE i.vehicle_id = v.id AND i.source = 'upload');

ALTER TABLE sync_runs
  ADD COLUMN log MEDIUMTEXT NULL AFTER message;
