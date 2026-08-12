INSERT OR IGNORE INTO products (sku,barcode,name,department,unit,cost_price,selling_price,quantity,imported_at) VALUES
('DEMO-BF-RUMP','290100000001','Bees Rump','Beef','kg',118.00,189.99,46.5,datetime('now')),
('DEMO-BF-TBONE','290100000002','Bees T-Bone','Beef','kg',112.00,184.99,52.8,datetime('now')),
('DEMO-BF-FILLET','290100000003','Bees Fillet','Beef','kg',165.00,269.99,14.2,datetime('now')),
('DEMO-BF-MINCE','290100000004','Bees Maalvleis','Beef','kg',82.00,119.99,68.4,datetime('now')),
('DEMO-BF-BRISKET','290100000005','Bees Brisket','Beef','kg',88.00,139.99,31.7,datetime('now')),
('DEMO-BF-BONE','290100000006','Bees Bene','Beef','kg',91.00,18.99,84.6,datetime('now')),
('DEMO-BF-FAT','290100000007','Bees Vet','Beef','kg',91.00,9.99,39.2,datetime('now')),
('DEMO-CH-WHOLE','290200000001','Heel Hoender','Chicken','kg',42.00,69.99,75.0,datetime('now')),
('DEMO-CH-FILLET','290200000002','Hoender Fillet','Chicken','kg',68.00,109.99,38.5,datetime('now')),
('DEMO-LM-CHOP','290300000001','Lam Tjops','Lamb','kg',126.00,199.99,28.4,datetime('now')),
('DEMO-LM-LEG','290300000002','Skaapboud','Lamb','kg',118.00,179.99,24.1,datetime('now')),
('DEMO-GM-WORS','290400000001','Wildswors','Game','kg',89.00,139.99,19.6,datetime('now')),
('DEMO-DL-BILT','290500000001','Biltong','Biltong / Deli','kg',185.00,349.99,17.8,datetime('now')),
('DEMO-DL-DROE','290500000002','Droëwors','Biltong / Deli','kg',172.00,329.99,13.9,datetime('now')),
('DEMO-TA-PLATE1','600100000001','Plate 1 – Steak & Chips','Takeaways','each',42.00,79.99,35,datetime('now')),
('DEMO-TA-PLATE4','600100000004','Plate 4 – Pap & Wors','Takeaways','each',31.00,64.99,42,datetime('now')),
('DEMO-DR-COLA','600200000001','Koeldrank Cola 2L','Cold Drinks','each',21.50,34.99,72,datetime('now')),
('DEMO-BA-ROLL','600300000001','Vars Broodrolletjies 6pk','Bakery','each',12.00,22.99,28,datetime('now')),
('DEMO-GR-SPICE','600400000001','George''s Braai Spice','Groceries','each',18.00,34.99,55,datetime('now')),
('DEMO-GR-SAUCE','600400000002','Braaisous 500ml','Groceries','each',24.00,39.99,37,datetime('now'));

INSERT OR IGNORE INTO pos_sales (sale_number,payment_method,account_number,subtotal,total,status,created_at) VALUES
('DEMO-POS-001','Card',NULL,764.96,764.96,'PAID',datetime('now','-20 days')),
('DEMO-POS-002','Cash',NULL,839.93,839.93,'PAID',datetime('now','-17 days')),
('DEMO-POS-003','EFT',NULL,1003.92,1003.92,'PAID',datetime('now','-14 days')),
('DEMO-POS-004','Card',NULL,994.90,994.90,'PAID',datetime('now','-11 days')),
('DEMO-POS-005','Cash',NULL,1358.88,1358.88,'PAID',datetime('now','-8 days')),
('DEMO-POS-006','Card',NULL,1104.87,1104.87,'PAID',datetime('now','-5 days')),
('DEMO-POS-007','Cash',NULL,731.91,731.91,'PAID',datetime('now','-3 days')),
('DEMO-POS-008','Card',NULL,1189.88,1189.88,'PAID',datetime('now','-1 day'));

INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,2.4,'kg',189.99,455.98 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-001' AND p.sku='DEMO-BF-RUMP';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,1.8,'kg',119.99,215.98 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-001' AND p.sku='DEMO-BF-MINCE';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,4.0,'each',22.99,91.96 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-001' AND p.sku='DEMO-BA-ROLL';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,3.0,'kg',184.99,554.97 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-002' AND p.sku='DEMO-BF-TBONE';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,2.0,'kg',109.99,219.98 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-002' AND p.sku='DEMO-CH-FILLET';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,1.0,'each',64.99,64.99 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-002' AND p.sku='DEMO-TA-PLATE4';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,3.6,'kg',189.99,683.96 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-003' AND p.sku='DEMO-BF-RUMP';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,2.0,'kg',159.98,319.96 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-003' AND p.sku='DEMO-LM-CHOP';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,2.5,'kg',269.99,674.98 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-004' AND p.sku='DEMO-BF-FILLET';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,1.0,'kg',319.92,319.92 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-004' AND p.sku='DEMO-DL-BILT';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,4.2,'kg',184.99,776.96 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-005' AND p.sku='DEMO-BF-TBONE';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,3.4,'kg',119.99,407.97 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-005' AND p.sku='DEMO-BF-MINCE';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,5.0,'each',34.99,174.95 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-005' AND p.sku='DEMO-DR-COLA';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,3.1,'kg',189.99,588.97 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-006' AND p.sku='DEMO-BF-RUMP';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,2.2,'kg',139.99,307.98 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-006' AND p.sku='DEMO-BF-BRISKET';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,6.0,'each',34.99,209.94 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-006' AND p.sku='DEMO-GR-SPICE';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,4.0,'kg',119.99,479.96 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-007' AND p.sku='DEMO-BF-MINCE';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,3.6,'each',69.99,251.96 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-007' AND p.sku='DEMO-CH-WHOLE';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,4.4,'kg',184.99,813.96 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-008' AND p.sku='DEMO-BF-TBONE';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,2.2,'kg',139.99,307.98 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-008' AND p.sku='DEMO-GM-WORS';
INSERT OR IGNORE INTO pos_sale_items (sale_id,product_id,product_name,quantity,unit,unit_price,line_total)
SELECT s.id,p.id,p.name,1.0,'kg',67.94,67.94 FROM pos_sales s,products p WHERE s.sale_number='DEMO-POS-008' AND p.sku='DEMO-DL-DROE';

INSERT OR IGNORE INTO waste_records (id,product_id,product_name,quantity,reason,value,created_at)
SELECT 80001,id,name,3.4,'Trim loss',3.4*cost_price,datetime('now','-9 days') FROM products WHERE sku='DEMO-BF-RUMP';
INSERT OR IGNORE INTO waste_records (id,product_id,product_name,quantity,reason,value,created_at)
SELECT 80002,id,name,5.8,'Processing loss',5.8*cost_price,datetime('now','-6 days') FROM products WHERE sku='DEMO-BF-MINCE';
INSERT OR IGNORE INTO waste_records (id,product_id,product_name,quantity,reason,value,created_at)
SELECT 80003,id,name,2.1,'Spoilage',2.1*cost_price,datetime('now','-2 days') FROM products WHERE sku='DEMO-CH-FILLET';

INSERT OR IGNORE INTO stock_counts (id,count_number,product_id,product_name,expected_quantity,counted_quantity,variance,reason,created_at)
SELECT 80001,'DEMO-CNT-001',id,name,50.0,46.5,-3.5,'Routine physical count',datetime('now','-4 days') FROM products WHERE sku='DEMO-BF-RUMP';
INSERT OR IGNORE INTO stock_counts (id,count_number,product_id,product_name,expected_quantity,counted_quantity,variance,reason,created_at)
SELECT 80002,'DEMO-CNT-002',id,name,41.0,39.2,-1.8,'Processing variance',datetime('now','-3 days') FROM products WHERE sku='DEMO-BF-FAT';

INSERT OR IGNORE INTO customer_accounts (account_number,name,credit_limit,balance,payment_terms_days,status) VALUES
('ACC-1001','Karoo Lodge',25000,4380.50,30,'ACTIVE'),('ACC-1002','Blue Crane Guesthouse',15000,1875.00,14,'ACTIVE');
INSERT OR IGNORE INTO suppliers (name,payment_terms_days,contact,active) VALUES
('Garden Route Meat Suppliers',7,'accounts@gardenroutemeat.example',1),('Outeniqua Poultry',14,'044 000 2200',1);
INSERT OR IGNORE INTO supplier_invoices (supplier_id,invoice_number,delivery_date,due_date,amount,balance,status,created_at)
SELECT id,'DEMO-GRM-1048',date('now','-5 days'),date('now','1 day'),68420.00,68420.00,'OPEN',datetime('now','-5 days') FROM suppliers WHERE name='Garden Route Meat Suppliers';
INSERT OR IGNORE INTO supplier_invoices (supplier_id,invoice_number,delivery_date,due_date,amount,balance,status,created_at)
SELECT id,'DEMO-OP-7721',date('now','-10 days'),date('now','3 days'),18350.00,18350.00,'OPEN',datetime('now','-10 days') FROM suppliers WHERE name='Outeniqua Poultry';

INSERT INTO business_settings (key,value,updated_at) VALUES ('monthly_operating_expenses','48500',datetime('now')) ON CONFLICT(key) DO UPDATE SET value='48500',updated_at=datetime('now');
