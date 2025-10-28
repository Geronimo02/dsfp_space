-- Delete existing role permissions to start fresh
DELETE FROM public.role_permissions;

-- CUSTOMERS PERMISSIONS
-- Admin: full access
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('admin', 'customers', true, true, true, true, true);

-- Manager: full access
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('manager', 'customers', true, true, true, true, true);

-- Cashier: view, create, limited edit
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('cashier', 'customers', true, true, true, false, false);

-- Accountant: view, edit (accounting data)
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('accountant', 'customers', true, false, true, false, true);

-- Technician: view, create (from technical service)
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('technician', 'customers', true, true, false, false, false);

-- Warehouse: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('warehouse', 'customers', true, false, false, false, false);

-- Auditor: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('auditor', 'customers', true, false, false, false, true);

-- PRODUCTS PERMISSIONS
-- Admin: full access
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('admin', 'products', true, true, true, true, true);

-- Manager: full access
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('manager', 'products', true, true, true, true, true);

-- Warehouse: view, create, edit
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('warehouse', 'products', true, true, true, false, false);

-- Cashier: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('cashier', 'products', true, false, false, false, false);

-- Accountant: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('accountant', 'products', true, false, false, false, true);

-- Technician: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('technician', 'products', true, false, false, false, false);

-- Auditor: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('auditor', 'products', true, false, false, false, true);

-- SUPPLIERS PERMISSIONS
-- Admin: full access
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('admin', 'suppliers', true, true, true, true, true);

-- Manager: full access
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('manager', 'suppliers', true, true, true, true, true);

-- Warehouse: view, create, edit
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('warehouse', 'suppliers', true, true, true, false, false);

-- Accountant: view, create, edit
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('accountant', 'suppliers', true, true, true, false, true);

-- Cashier: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('cashier', 'suppliers', true, false, false, false, false);

-- Technician: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('technician', 'suppliers', true, false, false, false, false);

-- Auditor: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('auditor', 'suppliers', true, false, false, false, true);

-- PROMOTIONS PERMISSIONS
-- Admin: full access
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('admin', 'promotions', true, true, true, true, true);

-- Manager: full access
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('manager', 'promotions', true, true, true, true, true);

-- Cashier: view, create (apply only)
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('cashier', 'promotions', true, true, false, false, false);

-- Accountant: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('accountant', 'promotions', true, false, false, false, true);

-- Warehouse: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('warehouse', 'promotions', true, false, false, false, false);

-- Technician: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('technician', 'promotions', true, false, false, false, false);

-- Auditor: view only
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_export)
VALUES ('auditor', 'promotions', true, false, false, false, true);