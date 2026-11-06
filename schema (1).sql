-- =====================================================================
-- Laundry Management System - full database schema (MySQL / MariaDB)
-- Works with XAMPP (MariaDB 10.4+) and MySQL 5.7+ / 8.x.
--
-- Usage (phpMyAdmin): open the "Import" tab and upload this file,
-- or run:  mysql -u root -p < schema.sql
--
-- After importing, create the superadmin from the project root:
--   node src/scripts/createStaff.js --role superadmin
-- =====================================================================

CREATE DATABASE IF NOT EXISTS db_laundry
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_laundry;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS tbl_payments;
DROP TABLE IF EXISTS tbl_order_items;
DROP TABLE IF EXISTS tbl_orders;
DROP TABLE IF EXISTS tbl_users;
DROP TABLE IF EXISTS tbl_staff;
DROP TABLE IF EXISTS tbl_services;
DROP TABLE IF EXISTS tbl_customers;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Customers (the shop's customer records)
-- ---------------------------------------------------------------------
CREATE TABLE tbl_customers (
  customer_id INT(11)      NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(100) NOT NULL,
  contact     VARCHAR(20)  NOT NULL,
  email       VARCHAR(100) NOT NULL,
  address     VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  KEY idx_customers_email (email),
  KEY idx_customers_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Services and prices
-- ---------------------------------------------------------------------
CREATE TABLE tbl_services (
  service_id     INT(11)       NOT NULL AUTO_INCREMENT,
  service_name   VARCHAR(100)  NOT NULL,
  price_per_kilo DECIMAL(10,2) NOT NULL,
  description    TEXT          NULL,
  PRIMARY KEY (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Staff accounts (staff / admin / superadmin) - separate from customers
-- ---------------------------------------------------------------------
CREATE TABLE tbl_staff (
  staff_id      INT(11)      NOT NULL AUTO_INCREMENT,
  email         VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('staff','admin','superadmin') NOT NULL DEFAULT 'staff',
  full_name     VARCHAR(100) NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_by    INT(11)      NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME     NULL,
  PRIMARY KEY (staff_id),
  UNIQUE KEY uq_staff_email (email),
  KEY idx_staff_created_by (created_by),
  CONSTRAINT fk_staff_created_by FOREIGN KEY (created_by)
    REFERENCES tbl_staff (staff_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Customer login accounts (linked to a customer record)
-- ---------------------------------------------------------------------
CREATE TABLE tbl_users (
  user_id       INT(11)      NOT NULL AUTO_INCREMENT,
  email         VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer') NOT NULL DEFAULT 'customer',
  full_name     VARCHAR(100) NOT NULL,
  customer_id   INT(11)      NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME     NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_customer (customer_id),
  CONSTRAINT fk_users_customer FOREIGN KEY (customer_id)
    REFERENCES tbl_customers (customer_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Orders
-- status: Pending Confirmation, Rejected, Pending, Processing, Ready,
--         Completed, Cancelled
-- order_source: 'Staff' (created by the shop) or 'Customer' (online request)
-- ---------------------------------------------------------------------
CREATE TABLE tbl_orders (
  order_id         INT(11)       NOT NULL AUTO_INCREMENT,
  customer_id      INT(11)       NOT NULL,
  service_id       INT(11)       NOT NULL,
  total_weight     DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
  total_amount     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  delivery_methods ENUM('Pickup','Delivery') NOT NULL DEFAULT 'Pickup',
  status           VARCHAR(50)   NOT NULL DEFAULT 'Pending',
  order_source     VARCHAR(20)   NOT NULL DEFAULT 'Staff',
  customer_notes   VARCHAR(500)  NULL,
  rejection_reason VARCHAR(255)  NULL,
  decided_by       INT(11)       NULL,
  decided_at       DATETIME      NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_service (service_id),
  KEY idx_orders_status (status),
  KEY idx_orders_decided_by (decided_by),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES tbl_customers (customer_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_service FOREIGN KEY (service_id)
    REFERENCES tbl_services (service_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_decided_by FOREIGN KEY (decided_by)
    REFERENCES tbl_staff (staff_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Garment items on an order
-- ---------------------------------------------------------------------
CREATE TABLE tbl_order_items (
  item_id        INT(11)       NOT NULL AUTO_INCREMENT,
  order_id       INT(11)       NOT NULL,
  clothe_type    VARCHAR(50)   NOT NULL,
  weight_in_kilo DECIMAL(5,2)  NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (item_id),
  KEY idx_items_order (order_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id)
    REFERENCES tbl_orders (order_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Payments (orders with payments can't be deleted: ON DELETE RESTRICT)
-- ---------------------------------------------------------------------
CREATE TABLE tbl_payments (
  payment_id      INT(11)       NOT NULL AUTO_INCREMENT,
  order_id        INT(11)       NOT NULL,
  payment_mode    VARCHAR(50)   NOT NULL,
  amount_paid     DECIMAL(10,2) NOT NULL,
  payment_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_status  ENUM('Unpaid','Partially Paid','Fully Paid') NOT NULL DEFAULT 'Unpaid',
  payment_date    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  KEY idx_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id)
    REFERENCES tbl_orders (order_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Starter services (edit or delete as you like)
-- ---------------------------------------------------------------------
INSERT INTO tbl_services (service_name, price_per_kilo, description) VALUES
  ('Wash & Fold',    50.00, 'Regular wash, dry and folded.'),
  ('Wash & Iron',    70.00, 'Wash, dry and pressed.'),
  ('Dry Cleaning',  150.00, 'For delicate and formal garments.'),
  ('Bedding & Comforters', 90.00, 'Blankets, bed sheets and comforters.');
