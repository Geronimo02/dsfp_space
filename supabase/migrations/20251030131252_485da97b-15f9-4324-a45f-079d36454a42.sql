-- Actualizar permisos según especificación de roles

-- Limpiar permisos existentes
DELETE FROM role_permissions;

-- ========================================
-- ADMIN: Acceso total a todo
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('admin', 'sales', true, true, true, true, true),
('admin', 'cash_register', true, true, true, true, true),
('admin', 'products', true, true, true, true, true),
('admin', 'customers', true, true, true, true, true),
('admin', 'suppliers', true, true, true, true, true),
('admin', 'purchases', true, true, true, true, true),
('admin', 'promotions', true, true, true, true, true),
('admin', 'technical_services', true, true, true, true, true),
('admin', 'reports', true, true, true, true, true),
('admin', 'employees', true, true, true, true, true),
('admin', 'settings', true, true, true, true, true),
('admin', 'quotations', true, true, true, true, true),
('admin', 'delivery_notes', true, true, true, true, true),
('admin', 'returns', true, true, true, true, true),
('admin', 'credit_notes', true, true, true, true, true);

-- ========================================
-- MANAGER: Todo excepto configuración crítica
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('manager', 'sales', true, true, true, true, true),
('manager', 'cash_register', true, true, true, true, true),
('manager', 'products', true, true, true, true, true),
('manager', 'customers', true, true, true, true, true),
('manager', 'suppliers', true, true, true, true, true),
('manager', 'purchases', true, true, true, true, true),
('manager', 'promotions', true, true, true, true, true),
('manager', 'technical_services', true, true, true, true, true),
('manager', 'reports', true, true, true, true, true),
('manager', 'employees', true, false, true, false, true),
('manager', 'settings', false, false, false, false, false),
('manager', 'quotations', true, true, true, true, true),
('manager', 'delivery_notes', true, true, true, true, true),
('manager', 'returns', true, true, true, true, true),
('manager', 'credit_notes', true, true, true, true, true);

-- ========================================
-- CASHIER: Flujo de ventas limitado
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('cashier', 'sales', true, true, false, false, false),
('cashier', 'cash_register', true, true, false, false, false),
('cashier', 'products', true, false, false, false, false),
('cashier', 'customers', true, true, true, false, false),
('cashier', 'suppliers', false, false, false, false, false),
('cashier', 'purchases', false, false, false, false, false),
('cashier', 'promotions', false, false, false, false, false),
('cashier', 'technical_services', false, false, false, false, false),
('cashier', 'reports', false, false, false, false, false),
('cashier', 'employees', false, false, false, false, false),
('cashier', 'settings', false, false, false, false, false),
('cashier', 'quotations', true, true, false, false, false),
('cashier', 'delivery_notes', true, true, false, false, false),
('cashier', 'returns', true, true, false, false, false),
('cashier', 'credit_notes', true, false, false, false, false);

-- ========================================
-- WAREHOUSE: Gestión de inventario y proveedores
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('warehouse', 'sales', false, false, false, false, false),
('warehouse', 'cash_register', false, false, false, false, false),
('warehouse', 'products', true, true, true, false, true),
('warehouse', 'customers', false, false, false, false, false),
('warehouse', 'suppliers', true, true, true, false, true),
('warehouse', 'purchases', true, true, true, false, true),
('warehouse', 'promotions', false, false, false, false, false),
('warehouse', 'technical_services', false, false, false, false, false),
('warehouse', 'reports', false, false, false, false, false),
('warehouse', 'employees', false, false, false, false, false),
('warehouse', 'settings', false, false, false, false, false),
('warehouse', 'quotations', false, false, false, false, false),
('warehouse', 'delivery_notes', true, true, true, false, true),
('warehouse', 'returns', true, true, true, false, true),
('warehouse', 'credit_notes', false, false, false, false, false);

-- ========================================
-- ACCOUNTANT: Reportes y finanzas
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('accountant', 'sales', true, false, false, false, true),
('accountant', 'cash_register', true, false, false, false, true),
('accountant', 'products', true, false, false, false, true),
('accountant', 'customers', true, false, true, false, true),
('accountant', 'suppliers', true, false, true, false, true),
('accountant', 'purchases', true, false, false, false, true),
('accountant', 'promotions', true, false, false, false, true),
('accountant', 'technical_services', true, false, false, false, true),
('accountant', 'reports', true, true, true, false, true),
('accountant', 'employees', false, false, false, false, false),
('accountant', 'settings', false, false, false, false, false),
('accountant', 'quotations', true, false, false, false, true),
('accountant', 'delivery_notes', true, false, false, false, true),
('accountant', 'returns', true, false, false, false, true),
('accountant', 'credit_notes', true, true, true, false, true);

-- ========================================
-- TECHNICIAN: Servicios técnicos
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('technician', 'sales', false, false, false, false, false),
('technician', 'cash_register', false, false, false, false, false),
('technician', 'products', true, false, false, false, false),
('technician', 'customers', true, true, false, false, false),
('technician', 'suppliers', false, false, false, false, false),
('technician', 'purchases', false, false, false, false, false),
('technician', 'promotions', false, false, false, false, false),
('technician', 'technical_services', true, true, true, false, false),
('technician', 'reports', false, false, false, false, false),
('technician', 'employees', false, false, false, false, false),
('technician', 'settings', false, false, false, false, false),
('technician', 'quotations', false, false, false, false, false),
('technician', 'delivery_notes', false, false, false, false, false),
('technician', 'returns', false, false, false, false, false),
('technician', 'credit_notes', false, false, false, false, false);

-- ========================================
-- AUDITOR: Solo lectura y exportación
-- ========================================
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('auditor', 'sales', true, false, false, false, true),
('auditor', 'cash_register', true, false, false, false, true),
('auditor', 'products', true, false, false, false, true),
('auditor', 'customers', true, false, false, false, true),
('auditor', 'suppliers', true, false, false, false, true),
('auditor', 'purchases', true, false, false, false, true),
('auditor', 'promotions', true, false, false, false, true),
('auditor', 'technical_services', true, false, false, false, true),
('auditor', 'reports', true, false, false, false, true),
('auditor', 'employees', false, false, false, false, false),
('auditor', 'settings', false, false, false, false, false),
('auditor', 'quotations', true, false, false, false, true),
('auditor', 'delivery_notes', true, false, false, false, true),
('auditor', 'returns', true, false, false, false, true),
('auditor', 'credit_notes', true, false, false, false, true);