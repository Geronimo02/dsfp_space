# DSFP Space API - Enterprise Grade v2.0

**Version:** 2.0 Enterprise  
**Status:** Production Ready  
**Last Updated:** January 30, 2026  
**Base URL:** `https://your-supabase.functions.supabase.co`

## Overview

Complete REST API for DSFP Space ERP/POS system with 60+ endpoints covering:
- Suppliers & Purchases Management
- Warehouse & Inventory Control
- Employee & Payroll Management
- Accounting & Bank Operations
- AFIP Integration (Argentina)
- Webhooks & Event System
- Bulk Operations & Imports
- Advanced Reporting & Analytics

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Handling](#error-handling)
4. [Suppliers Management](#suppliers-management)
5. [Purchases](#purchases)
6. [Warehouses & Inventory](#warehouses--inventory)
7. [Employees](#employees)
8. [Expenses](#expenses)
9. [Accounting](#accounting)
10. [AFIP Integration](#afip-integration)
11. [Webhooks](#webhooks)
12. [Bulk Operations](#bulk-operations)
13. [Reports & Analytics](#reports--analytics)

---

## Authentication

All endpoints (except `/health`) require JWT authentication via Supabase Auth.

### Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Get Current User

```http
GET /me
```

**Response (200 OK)**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "role": "manager",
  "company_id": "company-uuid",
  "modules": ["products", "sales", "customers", "reports"]
}
```

---

## Rate Limiting

- **Default:** 100 requests/minute per user
- **Reports:** 30 requests/minute (heavier operations)
- **Exports:** 10 requests/minute (very expensive)

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706571600
```

**HTTP 429** - Too Many Requests: When rate limit exceeded

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "code": 400,
  "request_id": "uuid",
  "details": {
    "field": "error details"
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Suppliers Management

### List Suppliers

```http
GET /suppliers?page=1&limit=50&search=acme&sort=name&order=asc
```

**Required Permission:** `suppliers:view`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50, max: 100)
- `search` (string): Search by name or tax_id
- `sort` (string): Sort field (default: created_at)
- `order` (string): `asc` or `desc` (default: asc)

**Response (200 OK)**
```json
{
  "suppliers": [
    {
      "id": "supplier-uuid",
      "name": "ACME Corp",
      "email": "contact@acme.com",
      "phone": "+54 11 2345-6789",
      "tax_id": "30-12345678-9",
      "condicion_iva": "IVA Responsable Inscripto",
      "address": "Av. Corrientes 1000",
      "payment_terms": "30 days net",
      "created_at": "2026-01-20T10:30:00Z",
      "updated_at": "2026-01-20T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

### Create Supplier

```http
POST /suppliers
```

**Required Permission:** `suppliers:create`

**Request Body**
```json
{
  "name": "ACME Corp",
  "email": "contact@acme.com",
  "phone": "+54 11 2345-6789",
  "tax_id": "30-12345678-9",
  "condicion_iva": "IVA Responsable Inscripto",
  "address": "Av. Corrientes 1000",
  "city": "Buenos Aires",
  "state": "CABA",
  "postal_code": "1045",
  "country": "AR",
  "payment_terms": "30 days net"
}
```

**Response (201 Created)**
```json
{
  "id": "supplier-uuid",
  "name": "ACME Corp",
  "created_at": "2026-01-30T15:45:00Z"
}
```

### Update Supplier

```http
PUT /suppliers/:id
```

**Required Permission:** `suppliers:edit`

**Request Body** (all fields optional)
```json
{
  "name": "ACME Corporation",
  "payment_terms": "60 days net"
}
```

### Delete Supplier

```http
DELETE /suppliers/:id
```

**Required Permission:** `suppliers:delete`

---

## Purchases

### List Purchases

```http
GET /purchases?page=1&limit=50&sort=created_at&order=desc
```

**Required Permission:** `purchases:view`

**Response (200 OK)**
```json
{
  "purchases": [
    {
      "id": "purchase-uuid",
      "supplier": { "name": "ACME Corp" },
      "invoice_number": "INV-2026-001",
      "receipt_date": "2026-01-30T09:00:00Z",
      "payment_method": "bank_transfer",
      "status": "completed",
      "subtotal": 5000.00,
      "tax": 1050.00,
      "total": 6050.00,
      "items": [
        {
          "product": { "name": "Widget A" },
          "quantity": 100,
          "price": 50.00,
          "total": 5000.00
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 234 }
}
```

### Create Purchase

```http
POST /purchases
```

**Required Permission:** `purchases:create`

**Request Body**
```json
{
  "supplier_id": "supplier-uuid",
  "invoice_number": "INV-2026-001",
  "receipt_date": "2026-01-30T09:00:00Z",
  "payment_method": "bank_transfer",
  "subtotal": 5000.00,
  "tax": 1050.00,
  "discount": 0.00,
  "total": 6050.00,
  "items": [
    {
      "product_id": "product-uuid",
      "quantity": 100,
      "price": 50.00,
      "tax": 0.00,
      "total": 5000.00
    }
  ]
}
```

**Response (201 Created)**
```json
{
  "id": "purchase-uuid",
  "status": "pending",
  "created_at": "2026-01-30T15:45:00Z"
}
```

**Automatic Actions:**
- Product stock increases by quantity
- Audit log created
- Webhook triggered: `purchase.created`

---

## Warehouses & Inventory

### List Warehouses

```http
GET /warehouses
```

**Required Permission:** `inventory:view`

**Response (200 OK)**
```json
{
  "warehouses": [
    {
      "id": "warehouse-uuid",
      "name": "Main Warehouse",
      "code": "WH-001",
      "address": "Calle Principal 123",
      "manager": { "name": "John Doe" },
      "total_products": 1250
    }
  ]
}
```

### Create Warehouse

```http
POST /warehouses
```

**Required Permission:** `inventory:create`

**Request Body**
```json
{
  "name": "Secondary Warehouse",
  "code": "WH-002",
  "description": "Cold storage facility",
  "address": "Av. Industrial 456",
  "city": "Moreno",
  "manager_id": "employee-uuid"
}
```

### Transfer Between Warehouses

```http
POST /warehouses/:from_id/transfer/:to_id
```

**Required Permission:** `inventory:edit`

**Request Body**
```json
{
  "transfer_date": "2026-01-30T10:00:00Z",
  "notes": "Stock consolidation",
  "items": [
    {
      "product_id": "product-uuid",
      "quantity": 50
    }
  ]
}
```

**Response (201 Created)**
```json
{
  "id": "transfer-uuid",
  "status": "completed",
  "from_warehouse": "WH-001",
  "to_warehouse": "WH-002",
  "items_transferred": 1
}
```

### Inventory Alerts

Get low-stock alerts:

```http
GET /reports/inventory-status
```

**Response (200 OK)**
```json
{
  "alerts": [
    {
      "id": "product-uuid",
      "name": "Widget A",
      "stock": 5,
      "min_stock": 10,
      "price": 50.00
    }
  ],
  "count": 12
}
```

---

## Employees

### List Employees

```http
GET /employees?page=1&limit=50&search=john&sort=name
```

**Required Permission:** `employees:view`

**Response (200 OK)**
```json
{
  "employees": [
    {
      "id": "employee-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+54 11 1234-5678",
      "document": "30-12345678-9",
      "hire_date": "2025-01-15T00:00:00Z",
      "role": "sales_manager",
      "salary": 50000.00,
      "status": "active"
    }
  ],
  "meta": { "page": 1, "total": 45 }
}
```

### Create Employee

```http
POST /employees
```

**Required Permission:** `employees:create`

**Request Body**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+54 11 8765-4321",
  "document": "27-87654321-0",
  "hire_date": "2026-01-30T00:00:00Z",
  "role": "cashier",
  "salary": 35000.00,
  "status": "active"
}
```

### Update Employee

```http
PUT /employees/:id
```

**Required Permission:** `employees:edit`

---

## Expenses

### List Expenses

```http
GET /expenses?page=1&limit=50&sort=expense_date&order=desc
```

**Required Permission:** `expenses:view`

**Response (200 OK)**
```json
{
  "expenses": [
    {
      "id": "expense-uuid",
      "description": "Office supplies",
      "amount": 250.00,
      "expense_date": "2026-01-30",
      "category": "supplies",
      "payment_method": "credit_card",
      "tax": 0.00,
      "created_at": "2026-01-30T10:15:00Z"
    }
  ],
  "meta": { "page": 1, "total": 342 }
}
```

### Create Expense

```http
POST /expenses
```

**Required Permission:** `expenses:create`

**Request Body**
```json
{
  "description": "Monthly subscriptions",
  "amount": 500.00,
  "expense_date": "2026-01-30",
  "category": "software",
  "payment_method": "bank_transfer",
  "tax": 105.00,
  "notes": "Annual software licenses"
}
```

---

## Accounting

### List Bank Accounts

```http
GET /bank-accounts
```

**Required Permission:** `accounting:view`

**Response (200 OK)**
```json
{
  "bank_accounts": [
    {
      "id": "account-uuid",
      "bank_name": "Banco Nación",
      "account_number": "1234567890",
      "account_type": "checking",
      "currency": "ARS",
      "balance": 125000.00,
      "active": true
    }
  ]
}
```

### Create Bank Account

```http
POST /bank-accounts
```

**Required Permission:** `accounting:create`

**Request Body**
```json
{
  "bank_name": "Banco Santander",
  "account_number": "0987654321",
  "account_type": "savings",
  "currency": "ARS",
  "balance": 50000.00,
  "active": true
}
```

### Record Bank Movement

```http
POST /bank-accounts/:id/movements
```

**Request Body**
```json
{
  "type": "deposit",
  "amount": 10000.00,
  "date": "2026-01-30T14:30:00Z",
  "description": "Customer payment received"
}
```

**Automatic Actions:**
- Account balance updated
- Movement recorded with timestamp
- Audit log created

### List Checks

```http
GET /checks?page=1&limit=50&sort=due_date
```

**Required Permission:** `accounting:view`

### Create Check

```http
POST /checks
```

**Required Permission:** `accounting:create`

**Request Body**
```json
{
  "check_number": "001234",
  "issuer": "ACME Corp",
  "amount": 5000.00,
  "issue_date": "2026-01-30",
  "due_date": "2026-02-15",
  "bank_account_id": "account-uuid",
  "notes": "Payment for invoice INV-2026-001"
}
```

---

## AFIP Integration

### List AFIP Invoices

```http
GET /afip/invoices?page=1&limit=50&sort=created_at&order=desc
```

**Required Permission:** `accounting:view`

**Response (200 OK)**
```json
{
  "invoices": [
    {
      "id": "afip-invoice-uuid",
      "customer": { "name": "Cliente XYZ" },
      "invoice_type": "A",
      "subtotal": 5000.00,
      "tax": 1050.00,
      "total": 6050.00,
      "status": "approved",
      "afip_number": "0001-00123456",
      "created_at": "2026-01-30T09:00:00Z"
    }
  ],
  "meta": { "page": 1, "total": 456 }
}
```

### Issue AFIP Invoice

```http
POST /afip/invoices
```

**Required Permission:** `accounting:create`

**Request Body**
```json
{
  "customer_id": "customer-uuid",
  "sale_id": "sale-uuid",
  "invoice_type": "A",
  "subtotal": 5000.00,
  "tax": 1050.00,
  "total": 6050.00,
  "notes": "Sale completed on 2026-01-30"
}
```

**Response (201 Created)**
```json
{
  "id": "afip-invoice-uuid",
  "afip_number": "0001-00123457",
  "status": "pending",
  "created_at": "2026-01-30T15:45:00Z"
}
```

**Automatic Actions:**
- AFIP submission queued
- Webhook triggered: `invoice.issued`
- Audit log created

---

## Webhooks

### List Webhooks

```http
GET /webhooks
```

**Required Permission:** `settings:view`

**Response (200 OK)**
```json
{
  "webhooks": [
    {
      "id": "webhook-uuid",
      "url": "https://your-api.com/webhooks/sales",
      "events": ["sale.created", "sale.updated"],
      "active": true,
      "created_at": "2026-01-20T10:00:00Z"
    }
  ]
}
```

### Create Webhook

```http
POST /webhooks
```

**Required Permission:** `settings:create`

**Request Body**
```json
{
  "url": "https://your-api.com/webhooks/events",
  "events": [
    "sale.created",
    "sale.updated",
    "purchase.created",
    "payment.received",
    "invoice.issued"
  ],
  "active": true
}
```

### Webhook Events

**Available Events:**
- `sale.created` - New sale created
- `sale.updated` - Sale updated
- `purchase.created` - Purchase received
- `purchase.updated` - Purchase updated
- `product.created` - New product added
- `product.updated` - Product modified
- `customer.created` - New customer added
- `payment.received` - Payment processed
- `invoice.issued` - AFIP invoice issued

### Webhook Payload Example

```json
{
  "event": "sale.created",
  "timestamp": "2026-01-30T15:45:00Z",
  "data": {
    "sale_id": "sale-uuid",
    "customer_id": "customer-uuid",
    "total": 1500.00
  }
}
```

### Update Webhook

```http
PUT /webhooks/:id
```

### Delete Webhook

```http
DELETE /webhooks/:id
```

---

## Bulk Operations

### Import Data

```http
POST /bulk/import/products
```

**Valid Resources:** `products`, `customers`, `suppliers`, `employees`

**Request Body**
```json
{
  "items": [
    {
      "name": "Product 1",
      "price": 100.00,
      "stock": 50,
      "sku": "PRD-001"
    },
    {
      "name": "Product 2",
      "price": 200.00,
      "stock": 25,
      "sku": "PRD-002"
    }
  ]
}
```

**Response (201 Created)**
```json
{
  "operation_id": "bulk-op-uuid",
  "status": "completed",
  "processed": 2,
  "errors": []
}
```

### Check Bulk Operation Status

```http
GET /bulk/status/:id
```

**Response (200 OK)**
```json
{
  "id": "bulk-op-uuid",
  "status": "completed",
  "progress": 100,
  "processed": 2,
  "total": 2,
  "errors": []
}
```

---

## Reports & Analytics

### Sales Summary

```http
GET /reports/sales-summary
```

**Required Permission:** `reports:view`

**Response (200 OK)**
```json
{
  "total_sales": 125000.00,
  "count": 234,
  "average": 534.19,
  "by_payment_method": {
    "cash": { "total": 50000.00, "count": 100 },
    "card": { "total": 75000.00, "count": 134 }
  }
}
```

### Inventory Status

```http
GET /reports/inventory-status
```

**Required Permission:** `reports:view`

**Response (200 OK)**
```json
{
  "alerts": [
    {
      "id": "product-uuid",
      "name": "Widget A",
      "stock": 5,
      "min_stock": 10,
      "price": 50.00
    }
  ],
  "count": 12
}
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
const API_BASE = "https://your-supabase.functions.supabase.co";

async function createSupplier(token: string, supplier: any) {
  const response = await fetch(`${API_BASE}/suppliers`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(supplier)
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

async function listSuppliers(token: string, page: number = 1) {
  const response = await fetch(
    `${API_BASE}/suppliers?page=${page}&limit=50`,
    {
      headers: { "Authorization": `Bearer ${token}` }
    }
  );

  return response.json();
}

// Usage
try {
  const supplier = await createSupplier(token, {
    name: "ACME Corp",
    email: "contact@acme.com"
  });
  console.log("Created:", supplier);
} catch (error) {
  console.error(error);
}
```

### cURL

```bash
# Create supplier
curl -X POST https://your-supabase.functions.supabase.co/suppliers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ACME Corp",
    "email": "contact@acme.com",
    "phone": "+54 11 2345-6789"
  }'

# List suppliers
curl https://your-supabase.functions.supabase.co/suppliers?page=1&limit=50 \
  -H "Authorization: Bearer $TOKEN"

# Create bulk import
curl -X POST https://your-supabase.functions.supabase.co/bulk/import/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"name": "Product 1", "price": 100}
    ]
  }'
```

---

## RBAC Matrix

### Modules (49)
`products`, `sales`, `customers`, `reports`, `suppliers`, `purchases`, `employees`, `payroll`, `accounting`, `bank_movements`, `checks`, `afip`, `invoices`, `inventory`, `warehouses`, `inventory_transfers`, `expenses`, `settings`, `webhooks`, `roles`, `users`, `audit_logs`, `payments`, `pos`, `orders`, `delivery`, `returns`, `commissions`, `integrations`, `support`, `tickets`, `knowledge_base`, `email_config`, `cash_register`, `cash_movements`, `discounts`, `promotions`, `loyalty`, `gift_cards`, `subscriptions`, `taxes`, `iva_config`, `withholding`, `stamp_duties`, `billing`, `quotations`, `timesheets`, `performance`, `training`

### Roles (9)
- **admin** - Full system access
- **manager** - Department management
- **cashier** - Sales & cash operations
- **accountant** - Accounting & reporting
- **viewer** - Read-only access
- **warehouse** - Inventory management
- **technician** - System maintenance
- **auditor** - Audit trail access
- **employee** - Limited personal access

### Permissions per Module (5)
1. `view` - Can see data
2. `create` - Can create records
3. `edit` - Can modify records
4. `delete` - Can remove records
5. `export` - Can export data

---

## Audit Logging

All operations are automatically logged with:
- **User ID** - Who performed the action
- **Action** - create, read, update, delete, export, login, logout
- **Resource** - Table/module affected
- **Timestamp** - When it happened
- **Metadata** - Additional context

**Access audit logs via:**
```http
GET /audit-logs?resource=sales&action=create&limit=100
```

---

## Best Practices

1. **Always handle rate limits** - Check `X-RateLimit-Remaining` header
2. **Cache permission results** - 5-minute TTL on permission checks
3. **Use pagination** - Don't fetch all records at once
4. **Implement webhooks** - React to events in real-time
5. **Bulk import** - Use bulk operations for large datasets (100+ items)
6. **Audit trails** - Review audit logs for compliance
7. **Error handling** - Implement retry logic for 5xx errors
8. **Webhook security** - Validate webhook signatures

---

## Migration from Previous API

If migrating from v1.0:
- All endpoints prefixed with `/api-v1/` still work
- New endpoints available at `/` root
- Authentication unchanged
- Rate limits increased by 2x
- New modules added: suppliers, purchases, warehouses, employees

---

## Support

- **Documentation:** See [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Issues:** Create GitHub issue
- **Email:** support@dsfpspace.com
- **Webhook Testing:** Use [RequestBin](https://requestbin.io/)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-01-30 | Enterprise modules added (suppliers, purchases, employees, AFIP, webhooks) |
| 1.0 | 2026-01-15 | Core API (companies, products, customers, sales, reports) |
