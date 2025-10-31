-- Clear existing role permissions
DELETE FROM role_permissions;

-- ========================================
-- ADMIN - Full access to everything
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('admin', 'products', true, true, true, true, true),
('admin', 'sales', true, true, true, true, true),
('admin', 'customers', true, true, true, true, true),
('admin', 'suppliers', true, true, true, true, true),
('admin', 'purchases', true, true, true, true, true),
('admin', 'reports', true, true, true, true, true),
('admin', 'employees', true, true, true, true, true),
('admin', 'settings', true, true, true, true, true),
('admin', 'cash_register', true, true, true, true, true),
('admin', 'technical_services', true, true, true, true, true),
('admin', 'quotations', true, true, true, true, true),
('admin', 'delivery_notes', true, true, true, true, true),
('admin', 'promotions', true, true, true, true, true),
('admin', 'returns', true, true, true, true, true),
('admin', 'credit_notes', true, true, true, true, true);

-- ========================================
-- MANAGER - Almost full access except critical settings
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('manager', 'products', true, true, true, true, true),
('manager', 'sales', true, true, true, true, true),
('manager', 'customers', true, true, true, true, true),
('manager', 'suppliers', true, true, true, true, true),
('manager', 'purchases', true, true, true, true, true),
('manager', 'reports', true, false, false, false, true),
('manager', 'employees', true, false, false, false, false), -- Solo activar/desactivar
('manager', 'cash_register', true, true, true, false, true),
('manager', 'technical_services', true, true, true, true, true),
('manager', 'quotations', true, true, true, true, true),
('manager', 'delivery_notes', true, true, true, true, true),
('manager', 'promotions', true, true, true, true, true),
('manager', 'returns', true, true, true, true, true),
('manager', 'credit_notes', true, true, true, true, true);
-- NO settings access

-- ========================================
-- CASHIER - Limited to sales operations
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('cashier', 'sales', true, true, false, false, false),
('cashier', 'cash_register', true, true, true, false, false), -- Solo su turno
('cashier', 'customers', true, true, false, false, false), -- Básico
('cashier', 'products', true, false, false, false, false), -- Solo consulta
('cashier', 'technical_services', true, true, false, false, false), -- Ticket básico
('cashier', 'quotations', true, false, false, false, false),
('cashier', 'delivery_notes', true, false, false, false, false),
('cashier', 'returns', true, false, false, false, false);
-- NO: suppliers, purchases, reports, employees, settings, promotions, credit_notes

-- ========================================
-- WAREHOUSE - Inventory and suppliers management
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('warehouse', 'products', true, true, true, false, true), -- No delete
('warehouse', 'suppliers', true, true, true, false, true),
('warehouse', 'purchases', true, true, true, false, true),
('warehouse', 'reports', true, false, false, false, false), -- Dashboard limitado
('warehouse', 'delivery_notes', true, true, true, false, true),
('warehouse', 'returns', true, true, true, false, true);
-- NO: sales, cash_register, customers (directo), settings, employees

-- ========================================
-- ACCOUNTANT - Financial reports and read access
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('accountant', 'sales', true, false, false, false, true),
('accountant', 'customers', true, false, false, false, true),
('accountant', 'suppliers', true, false, false, false, true),
('accountant', 'reports', true, false, false, false, true),
('accountant', 'cash_register', true, false, false, false, true),
('accountant', 'purchases', true, false, false, false, true),
('accountant', 'quotations', true, false, false, false, true),
('accountant', 'delivery_notes', true, false, false, false, true),
('accountant', 'returns', true, false, false, false, true),
('accountant', 'credit_notes', true, true, true, false, true), -- Puede gestionar notas de crédito
('accountant', 'promotions', true, false, false, false, true),
('accountant', 'technical_services', true, false, false, false, true);
-- NO: products (edit), employees, settings

-- ========================================
-- TECHNICIAN - Only technical services
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('technician', 'technical_services', true, true, true, false, false),
('technician', 'customers', true, false, false, false, false), -- Solo lectura
('technician', 'products', true, false, false, false, false); -- Solo consulta
-- NO: todo lo demás

-- ========================================
-- AUDITOR - Read-only access to everything except settings
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('auditor', 'products', true, false, false, false, true),
('auditor', 'sales', true, false, false, false, true),
('auditor', 'customers', true, false, false, false, true),
('auditor', 'suppliers', true, false, false, false, true),
('auditor', 'purchases', true, false, false, false, true),
('auditor', 'reports', true, false, false, false, true),
('auditor', 'cash_register', true, false, false, false, true),
('auditor', 'technical_services', true, false, false, false, true),
('auditor', 'quotations', true, false, false, false, true),
('auditor', 'delivery_notes', true, false, false, false, true),
('auditor', 'promotions', true, false, false, false, true),
('auditor', 'returns', true, false, false, false, true),
('auditor', 'credit_notes', true, false, false, false, true);
-- NO: settings, employees, any write operations

-- ========================================
-- VIEWER - Dashboard only
-- ========================================
-- Viewer has no specific module permissions, only dashboard access