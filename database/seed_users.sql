-- Demo login accounts for Bharat Health Grid.
-- Run after database/schema.sql. This does not change healthcare tables.
-- Password for every account is BHG@12345. Only the bcrypt hash is stored.
--
--   national.admin       NATIONAL_ADMIN     India
--   tn.admin             STATE_ADMIN        Tamil Nadu
--   coimbatore.officer   DISTRICT_OFFICER   Coimbatore
--   sulur.staff          PHC_STAFF          Sulur

USE bharat_health_grid;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  name VARCHAR(120) NOT NULL,
  role ENUM('NATIONAL_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER', 'PHC_STAFF') NOT NULL,
  state_id INT UNSIGNED NULL,
  district_id INT UNSIGNED NULL,
  phc_id INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  CONSTRAINT fk_users_state FOREIGN KEY (state_id) REFERENCES states (id),
  CONSTRAINT fk_users_district FOREIGN KEY (district_id) REFERENCES districts (id),
  CONSTRAINT fk_users_phc FOREIGN KEY (phc_id) REFERENCES phcs (id),
  CONSTRAINT chk_users_scope CHECK (
    (role = 'NATIONAL_ADMIN' AND state_id IS NULL AND district_id IS NULL AND phc_id IS NULL)
    OR (role = 'STATE_ADMIN' AND state_id IS NOT NULL AND district_id IS NULL AND phc_id IS NULL)
    OR (role = 'DISTRICT_OFFICER' AND state_id IS NOT NULL AND district_id IS NOT NULL AND phc_id IS NULL)
    OR (role = 'PHC_STAFF' AND state_id IS NOT NULL AND district_id IS NOT NULL AND phc_id IS NOT NULL)
  )
) ENGINE=InnoDB;

INSERT INTO users (username, password_hash, name, role, state_id, district_id, phc_id, is_active)
VALUES
  ('national.admin', '$2b$10$Y.xjjt5W7jQLzAo06Ts.qOhhd7.9WISi9rWqK9SuMMW15Gp3LWw7S', 'Manivelan', 'NATIONAL_ADMIN', NULL, NULL, NULL, 1),
  ('tn.admin', '$2b$10$Y.xjjt5W7jQLzAo06Ts.qOhhd7.9WISi9rWqK9SuMMW15Gp3LWw7S', 'Tamil Nadu Admin', 'STATE_ADMIN', 1, NULL, NULL, 1),
  ('coimbatore.officer', '$2b$10$Y.xjjt5W7jQLzAo06Ts.qOhhd7.9WISi9rWqK9SuMMW15Gp3LWw7S', 'Coimbatore Officer', 'DISTRICT_OFFICER', 1, 1, NULL, 1),
  ('sulur.staff', '$2b$10$Y.xjjt5W7jQLzAo06Ts.qOhhd7.9WISi9rWqK9SuMMW15Gp3LWw7S', 'Sulur Staff', 'PHC_STAFF', 1, 1, 1, 1)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  name = VALUES(name),
  role = VALUES(role),
  state_id = VALUES(state_id),
  district_id = VALUES(district_id),
  phc_id = VALUES(phc_id),
  is_active = VALUES(is_active);
