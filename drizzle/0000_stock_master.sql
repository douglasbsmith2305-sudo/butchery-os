CREATE TABLE IF NOT EXISTS `departments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL UNIQUE,
  `code` text NOT NULL UNIQUE,
  `active` integer DEFAULT true NOT NULL
);
CREATE TABLE IF NOT EXISTS `products` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sku` text NOT NULL UNIQUE,
  `barcode` text,
  `name` text NOT NULL,
  `department` text NOT NULL,
  `unit` text DEFAULT 'each' NOT NULL,
  `cost_price` real DEFAULT 0 NOT NULL,
  `selling_price` real DEFAULT 0 NOT NULL,
  `quantity` real DEFAULT 0 NOT NULL,
  `imported_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `products_department_idx` ON `products` (`department`);
