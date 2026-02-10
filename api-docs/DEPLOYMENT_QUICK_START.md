# 🚀 DEPLOYMENT QUICK START - DSFP Space API v2.0

## ✅ Pre-requisitos

- Cuenta de Supabase activa
- Supabase CLI instalado
- Proyecto Supabase configurado

---

## 📦 PASO 1: Instalar Supabase CLI

### Windows (PowerShell):
```powershell
scoop install supabase
```

O con npm:
```bash
npm install -g supabase
```

### Verificar instalación:
```bash
supabase --version
```

---

## 🔐 PASO 2: Login a Supabase

```bash
supabase login
```

---

## 🔗 PASO 3: Link a tu proyecto

```bash
cd c:\Users\fermi\OneDrive\Escritorio\Space\dsfp_space
supabase link --project-ref YOUR_PROJECT_REF
```

**¿Dónde encontrar el project-ref?**
1. Abre tu proyecto en https://supabase.com/dashboard
2. Ve a Settings → General
3. Copia el "Reference ID"

---

## 🗄️ PASO 4: Crear tablas necesarias (SQL)

### 4.1. Crear tabla de suppliers
```sql
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_suppliers_company ON suppliers(company_id);
CREATE INDEX idx_suppliers_name ON suppliers(name);
```

### 4.2. Crear tabla de purchases
```sql
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT,
  receipt_date DATE,
  payment_method TEXT NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_purchases_company ON purchases(company_id);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
```

### 4.3. Crear tabla de purchase_items
```sql
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);
```

### 4.4. Crear tabla de warehouses
```sql
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_warehouses_company ON warehouses(company_id);
```

### 4.5. Crear tabla de warehouse_stock
```sql
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);

CREATE INDEX idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX idx_warehouse_stock_product ON warehouse_stock(product_id);
```

### 4.6. Crear tabla de warehouse_transfers
```sql
CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  transfer_date DATE,
  notes TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_warehouse_transfers_company ON warehouse_transfers(company_id);
```

### 4.7. Crear tabla de employees
```sql
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  position TEXT,
  department TEXT,
  salary NUMERIC(12,2),
  hire_date DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_email ON employees(email);
```

### 4.8. Crear tabla de expenses
```sql
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL,
  payment_method TEXT,
  description TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_company ON expenses(company_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
```

### 4.9. Crear tabla de bank_accounts
```sql
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT,
  balance NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'ARS',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_accounts_company ON bank_accounts(company_id);
```

### 4.10. Crear tabla de bank_movements
```sql
CREATE TABLE IF NOT EXISTS bank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'deposit' or 'withdrawal'
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_movements_company ON bank_movements(company_id);
CREATE INDEX idx_bank_movements_account ON bank_movements(bank_account_id);
CREATE INDEX idx_bank_movements_date ON bank_movements(date);
```

### 4.11. Crear tabla de checks
```sql
CREATE TABLE IF NOT EXISTS checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payee TEXT,
  bank_name TEXT,
  status TEXT DEFAULT 'issued', -- 'issued', 'deposited', 'cashed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_checks_company ON checks(company_id);
CREATE INDEX idx_checks_status ON checks(status);
CREATE INDEX idx_checks_due_date ON checks(due_date);
```

### 4.12. Crear tabla de afip_invoices
```sql
CREATE TABLE IF NOT EXISTS afip_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_type TEXT NOT NULL, -- 'A', 'B', 'C', etc.
  invoice_number TEXT NOT NULL,
  cae TEXT, -- Código de Autorización Electrónico
  cae_expiration DATE,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'issued', 'rejected'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_afip_invoices_company ON afip_invoices(company_id);
CREATE INDEX idx_afip_invoices_sale ON afip_invoices(sale_id);
CREATE INDEX idx_afip_invoices_status ON afip_invoices(status);
```

### 4.13. Crear tabla de webhooks
```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- Array de eventos: ['sale.created', 'purchase.created', etc.]
  secret TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhooks_company ON webhooks(company_id);
CREATE INDEX idx_webhooks_active ON webhooks(active);
```

### 4.14. Crear tabla de bulk_operations
```sql
CREATE TABLE IF NOT EXISTS bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'import', 'export', 'delete'
  resource TEXT NOT NULL, -- 'products', 'customers', etc.
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'completed_with_errors', 'failed'
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  errors TEXT[],
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bulk_operations_company ON bulk_operations(company_id);
CREATE INDEX idx_bulk_operations_user ON bulk_operations(user_id);
CREATE INDEX idx_bulk_operations_status ON bulk_operations(status);
```

---

## 📝 PASO 5: Ejecutar las migraciones SQL

### Opción A: Desde el Dashboard de Supabase
1. Ve a https://supabase.com/dashboard
2. Abre tu proyecto
3. Ve a "SQL Editor"
4. Ejecuta cada bloque SQL del paso 4 uno por uno

### Opción B: Desde el CLI
```bash
# Crear un archivo de migración
supabase db diff --file create_enterprise_tables

# Edita el archivo y pega todos los SQL del paso 4

# Aplica la migración
supabase db push
```

---

## 🚀 PASO 6: Deploy de la función API

```bash
# Deploy de la función api-v1
supabase functions deploy api-v1
```

---

## 🔑 PASO 7: Configurar variables de entorno

Las siguientes variables ya están configuradas automáticamente en Supabase Functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## ✅ PASO 8: Test del endpoint

```bash
# Obtén tu URL de la función
# https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-v1

# Test de health check
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/api-v1/health
```

Deberías recibir:
```json
{
  "status": "ok",
  "time": "2026-01-30T..."
}
```

---

## 🎉 ¡LISTO!

Tu API enterprise está desplegada y lista para usar.

### 📚 Próximos pasos:
1. Lee [API_DOCUMENTATION_EXTENDED.md](API_DOCUMENTATION_EXTENDED.md) para todos los endpoints
2. Revisa [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md) para casos de prueba
3. Configura tus primeros webhooks
4. Importa datos usando bulk operations

### 🔐 Seguridad:
- Todos los endpoints requieren autenticación JWT
- RBAC habilitado por defecto
- Rate limiting: 100 req/min
- Auditoría completa de todas las operaciones

---

## 🆘 Troubleshooting

### Error: "Cannot find module"
- Esto es normal en VS Code. Deno resuelve los módulos en tiempo de ejecución.
- Los errores desaparecen cuando la función está desplegada.

### Error: "Forbidden"
- Verifica que el usuario tiene permisos en `role_permissions`
- Verifica que el usuario está asociado a la empresa en `company_users`

### Error: "Rate limit exceeded"
- Espera 1 minuto o ajusta el límite en `_shared/rateLimit.ts`

---

## 📞 Soporte

Para más ayuda:
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Índice completo
- [DEPLOYMENT_GUIDE_v2.md](DEPLOYMENT_GUIDE_v2.md) - Guía detallada
- [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) - Resumen ejecutivo
