-- =============================================
-- PASO 3: PERMISOS POR DEFECTO PARA CADA ROL
-- =============================================

INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
-- ADMIN (acceso total)
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

-- MANAGER (casi todo, menos empleados y configuración crítica)
('manager', 'products', true, true, true, true, true),
('manager', 'sales', true, true, true, true, true),
('manager', 'customers', true, true, true, true, true),
('manager', 'suppliers', true, true, true, true, true),
('manager', 'purchases', true, true, true, true, true),
('manager', 'reports', true, false, false, false, true),
('manager', 'employees', true, false, false, false, false),
('manager', 'settings', true, false, true, false, false),
('manager', 'cash_register', true, true, true, false, true),
('manager', 'technical_services', true, true, true, true, true),

-- CASHIER (solo ventas y caja)
('cashier', 'products', true, false, false, false, false),
('cashier', 'sales', true, true, false, false, false),
('cashier', 'customers', true, false, false, false, false),
('cashier', 'suppliers', false, false, false, false, false),
('cashier', 'purchases', false, false, false, false, false),
('cashier', 'reports', true, false, false, false, false),
('cashier', 'employees', false, false, false, false, false),
('cashier', 'settings', false, false, false, false, false),
('cashier', 'cash_register', true, true, true, false, false),
('cashier', 'technical_services', true, true, false, false, false),

-- ACCOUNTANT (enfocado en finanzas y reportes)
('accountant', 'products', true, false, true, false, true),
('accountant', 'sales', true, false, false, false, true),
('accountant', 'customers', true, true, true, false, true),
('accountant', 'suppliers', true, true, true, false, true),
('accountant', 'purchases', true, true, true, false, true),
('accountant', 'reports', true, false, false, false, true),
('accountant', 'employees', false, false, false, false, false),
('accountant', 'settings', false, false, false, false, false),
('accountant', 'cash_register', true, false, true, false, true),
('accountant', 'technical_services', true, false, false, false, true),

-- VIEWER (solo lectura)
('viewer', 'products', true, false, false, false, false),
('viewer', 'sales', true, false, false, false, false),
('viewer', 'customers', true, false, false, false, false),
('viewer', 'suppliers', true, false, false, false, false),
('viewer', 'purchases', true, false, false, false, false),
('viewer', 'reports', true, false, false, false, true),
('viewer', 'employees', false, false, false, false, false),
('viewer', 'settings', false, false, false, false, false),
('viewer', 'cash_register', true, false, false, false, false),
('viewer', 'technical_services', true, false, false, false, false),

-- EMPLOYEE (rol básico existente - acceso limitado)
('employee', 'products', true, false, false, false, false),
('employee', 'sales', true, true, false, false, false),
('employee', 'customers', true, false, false, false, false),
('employee', 'suppliers', false, false, false, false, false),
('employee', 'purchases', false, false, false, false, false),
('employee', 'reports', false, false, false, false, false),
('employee', 'employees', false, false, false, false, false),
('employee', 'settings', false, false, false, false, false),
('employee', 'cash_register', true, true, false, false, false),
('employee', 'technical_services', true, true, false, false, false)
ON CONFLICT (role, module) DO NOTHING;