CREATE TABLE IF NOT EXISTS centers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/La_Paz',
  locale VARCHAR(10) NOT NULL DEFAULT 'es-BO',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS center_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  brand_name VARCHAR(160) NOT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  whatsapp_number VARCHAR(40) DEFAULT NULL,
  support_whatsapp_text VARCHAR(255) DEFAULT NULL,
  primary_color VARCHAR(16) DEFAULT NULL,
  accent_color VARCHAR(16) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_center_settings_center (center_id),
  CONSTRAINT fk_center_settings_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS files (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  file_kind ENUM('logo', 'voucher', 'document', 'other') NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  metadata_json JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_files_center_kind (center_id, file_kind),
  CONSTRAINT fk_files_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'admin', 'operator') NOT NULL DEFAULT 'operator',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_center_email (center_id, email),
  CONSTRAINT fk_admin_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  name VARCHAR(140) NOT NULL,
  description TEXT DEFAULT NULL,
  duration_min SMALLINT UNSIGNED NOT NULL,
  base_price_cents INT UNSIGNED NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'BOB',
  is_featured TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_services_center_active (center_id, is_active),
  CONSTRAINT fk_services_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS therapists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(140) NOT NULL,
  bio_short VARCHAR(255) DEFAULT NULL,
  avatar_file_id BIGINT UNSIGNED DEFAULT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  email VARCHAR(190) DEFAULT NULL,
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 60.00,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_therapists_center_active (center_id, is_active),
  CONSTRAINT fk_therapists_center FOREIGN KEY (center_id) REFERENCES centers(id),
  CONSTRAINT fk_therapists_avatar FOREIGN KEY (avatar_file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS therapist_services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  therapist_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  round_robin_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_therapist_service (therapist_id, service_id),
  KEY idx_therapist_services_center_service (center_id, service_id),
  CONSTRAINT fk_therapist_services_center FOREIGN KEY (center_id) REFERENCES centers(id),
  CONSTRAINT fk_therapist_services_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id),
  CONSTRAINT fk_therapist_services_service FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rooms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_room_name_by_center (center_id, name),
  CONSTRAINT fk_rooms_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_rooms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_service_room (service_id, room_id),
  KEY idx_service_rooms_center_service (center_id, service_id),
  CONSTRAINT fk_service_rooms_center FOREIGN KEY (center_id) REFERENCES centers(id),
  CONSTRAINT fk_service_rooms_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_service_rooms_room FOREIGN KEY (room_id) REFERENCES rooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resource_schedules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  resource_type ENUM('therapist', 'room') NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_resource_schedule_lookup (center_id, resource_type, resource_id, weekday, is_active),
  CONSTRAINT chk_schedule_weekday CHECK (weekday BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resource_blocks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  resource_type ENUM('therapist', 'room') NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_resource_blocks_lookup (center_id, resource_type, resource_id, starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(140) NOT NULL,
  whatsapp_phone VARCHAR(40) NOT NULL,
  email VARCHAR(190) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_phone_by_center (center_id, whatsapp_phone),
  KEY idx_clients_center_name (center_id, full_name),
  CONSTRAINT fk_clients_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  therapist_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'pending',
  source ENUM('booking', 'admin', 'telegram') NOT NULL DEFAULT 'booking',
  payment_status ENUM('pending', 'verified', 'rejected', 'needs_review') NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_appointments_center_range (center_id, starts_at, ends_at),
  KEY idx_appointments_center_status (center_id, status),
  CONSTRAINT fk_appointments_center FOREIGN KEY (center_id) REFERENCES centers(id),
  CONSTRAINT fk_appointments_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_appointments_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id),
  CONSTRAINT fk_appointments_room FOREIGN KEY (room_id) REFERENCES rooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointment_resource_claims (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  appointment_id INT UNSIGNED NOT NULL,
  resource_type ENUM('therapist', 'room') NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  claim_time DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_resource_minute (center_id, resource_type, resource_id, claim_time),
  KEY idx_appointment (appointment_id),
  CONSTRAINT fk_claims_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  appointment_id INT UNSIGNED NOT NULL,
  amount_cents INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BOB',
  status ENUM('pending', 'verified', 'rejected', 'needs_review') NOT NULL DEFAULT 'pending',
  method ENUM('transfer', 'cash', 'card', 'other') NOT NULL DEFAULT 'transfer',
  voucher_file_id BIGINT UNSIGNED DEFAULT NULL,
  ocr_json JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payments_center_status (center_id, status),
  CONSTRAINT fk_payments_center FOREIGN KEY (center_id) REFERENCES centers(id),
  CONSTRAINT fk_payments_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_payments_voucher FOREIGN KEY (voucher_file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  appointment_id INT UNSIGNED DEFAULT NULL,
  direction ENUM('inbound', 'outbound') NOT NULL,
  provider_message_id VARCHAR(191) DEFAULT NULL,
  template_name VARCHAR(120) DEFAULT NULL,
  status VARCHAR(60) NOT NULL,
  payload_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_wa_center_direction (center_id, direction),
  CONSTRAINT fk_wa_center FOREIGN KEY (center_id) REFERENCES centers(id),
  CONSTRAINT fk_wa_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  kind VARCHAR(120) NOT NULL,
  payload_json JSON NOT NULL,
  run_at DATETIME NOT NULL,
  status ENUM('pending', 'running', 'done', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  last_error TEXT DEFAULT NULL,
  locked_by VARCHAR(120) DEFAULT NULL,
  locked_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_jobs_center_status_runat (center_id, status, run_at),
  CONSTRAINT fk_jobs_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS round_robin_state (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  last_therapist_id INT UNSIGNED DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rr_center_service (center_id, service_id),
  CONSTRAINT fk_rr_center FOREIGN KEY (center_id) REFERENCES centers(id),
  CONSTRAINT fk_rr_service FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_rr_therapist FOREIGN KEY (last_therapist_id) REFERENCES therapists(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telegram_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  therapist_id INT UNSIGNED NOT NULL,
  telegram_user_id VARCHAR(120) NOT NULL,
  telegram_username VARCHAR(120) DEFAULT NULL,
  linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_telegram_therapist_active (therapist_id, is_active),
  CONSTRAINT fk_telegram_center FOREIGN KEY (center_id) REFERENCES centers(id),
  CONSTRAINT fk_telegram_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  actor_type ENUM('system', 'admin', 'therapist', 'client') NOT NULL,
  actor_id INT UNSIGNED DEFAULT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(120) NOT NULL,
  metadata_json JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_center_date (center_id, created_at),
  CONSTRAINT fk_audit_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  scope VARCHAR(80) NOT NULL,
  idem_key VARCHAR(120) NOT NULL,
  request_hash CHAR(64) DEFAULT NULL,
  response_status SMALLINT UNSIGNED DEFAULT NULL,
  response_json JSON DEFAULT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_idempotency_scope_key (center_id, scope, idem_key),
  KEY idx_idempotency_expiry (expires_at),
  CONSTRAINT fk_idempotency_center FOREIGN KEY (center_id) REFERENCES centers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
