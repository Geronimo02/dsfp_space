# API Enterprise-Grade Documentation

**Version:** 1.0  
**Base URL:** `https://<project-ref>.supabase.co/functions/v1/api-v1`  
**Authentication:** Bearer Token (JWT from Supabase Auth)

---

## Overview

This is an enterprise-grade REST API with:
- **Authentication & Authorization:** JWT-based with role-based access control (RBAC)
- **Rate Limiting:** Per-user and per-endpoint limits
- **Audit Logging:** All critical operations are logged
- **Validation:** Request validation with Zod schemas
- **Pagination:** Standardized pagination across list endpoints
- **Multi-tenancy:** Company-level isolation
- **Structured Logging:** JSON logs for observability

---

## Authentication

All endpoints (except `/health`) require authentication.

**Header:**
```
Authorization: Bearer <your_jwt_token>
```

Get JWT token from Supabase Auth:
```typescript
const { data } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});
const token = data.session.access_token;
```

---

## Rate Limiting

Rate limits are enforced per user and per endpoint category:

- **Default:** 100 requests/minute
- **Reports:** 30 requests/minute
- **Exports:** 10 requests/minute

**Headers returned:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706644800
```

**429 Response (Rate Limit Exceeded):**
```json
{
  "error": "Rate limit exceeded"
}
```

---

## Common Query Parameters

### Pagination
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 50, max: 100): Items per page
- `sort` (string): Field to sort by
- `order` (string: "asc" | "desc", default: "desc"): Sort order

### Search
- `search` (string): Search term (applied to relevant fields)

### Company Context
- `company_id` (UUID, required for most endpoints): Company identifier

**Example:**
```
GET /products?company_id=<uuid>&page=1&limit=50&search=laptop&sort=price&order=asc
```

---

## Standard Responses

### Success Response (List)
```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Success Response (Single)
```json
{
  "id": "uuid",
  "name": "Product Name",
  ...
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": { ... }
}
```

### HTTP Status Codes
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation failed
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Endpoints

### Health

#### `GET /health`
Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "ok",
  "time": "2026-01-30T12:00:00.000Z"
}
```

---

### Authentication & User

#### `GET /me`
Get current authenticated user info.

**Response:**
```json
{
  "userId": "uuid",
  "email": "user@example.com"
}
```

---

### Companies

#### `GET /companies`
List companies accessible by the current user.

**Response:**
```json
{
  "items": [
    {
      "company_id": "uuid",
      "role": "admin",
      "companies": {
        "id": "uuid",
        "name": "Company Name",
        "tax_id": "12345678",
        "razon_social": "Company Legal Name"
      }
    }
  ]
}
```

#### `GET /companies/:id`
Get company details.

**Parameters:**
- `id` (path, UUID): Company ID

**Query:**
- `company_id` (query, UUID): Same as path ID

**Response:**
```json
{
  "id": "uuid",
  "name": "Company Name",
  "tax_id": "12345678",
  ...
}
```

---

### Products

**Permissions Required:** `products` module

#### `GET /products`
List products with pagination and search.

**Query Parameters:**
- `company_id` (required, UUID)
- `page`, `limit`, `sort`, `order`, `search`

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Product Name",
      "sku": "SKU123",
      "price": 100.00,
      "stock": 50,
      ...
    }
  ],
  "pagination": { ... }
}
```

#### `GET /products/:id`
Get single product.

**Parameters:**
- `id` (path, UUID): Product ID

**Query:**
- `company_id` (required, UUID)

**Response:**
```json
{
  "id": "uuid",
  "name": "Product Name",
  ...
}
```

#### `POST /products`
Create a new product.

**Body:**
```json
{
  "company_id": "uuid",
  "name": "Product Name",
  "sku": "SKU123",
  "description": "Product description",
  "price": 100.00,
  "cost": 50.00,
  "category_id": "uuid",
  "barcode": "1234567890",
  "stock": 100,
  "min_stock": 10,
  "active": true
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  ...
}
```

#### `PUT /products/:id`
Update a product.

**Parameters:**
- `id` (path, UUID): Product ID

**Body:** (all fields optional)
```json
{
  "company_id": "uuid",
  "name": "Updated Name",
  "price": 120.00,
  ...
}
```

**Response:** `200 OK`

#### `DELETE /products/:id`
Delete a product.

**Parameters:**
- `id` (path, UUID): Product ID

**Query:**
- `company_id` (required, UUID)

**Response:** `200 OK`
```json
{
  "ok": true
}
```

---

### Customers

**Permissions Required:** `customers` module

#### `GET /customers`
List customers with pagination and search.

**Query Parameters:**
- `company_id` (required, UUID)
- `page`, `limit`, `sort`, `order`, `search`

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Customer Name",
      "email": "customer@example.com",
      "phone": "+1234567890",
      ...
    }
  ],
  "pagination": { ... }
}
```

#### `GET /customers/:id`
Get single customer.

#### `POST /customers`
Create a new customer.

**Body:**
```json
{
  "company_id": "uuid",
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+1234567890",
  "document": "12345678",
  "tipo_documento": "DNI",
  "condicion_iva": "Responsable Inscripto",
  "address": "123 Main St",
  "city": "Buenos Aires",
  "state": "CABA",
  "postal_code": "1000",
  "country": "Argentina"
}
```

**Response:** `201 Created`

#### `PUT /customers/:id`
Update a customer.

#### `DELETE /customers/:id`
Delete a customer.

---

### Sales

**Permissions Required:** `sales` module

#### `GET /sales`
List sales with details.

**Query Parameters:**
- `company_id` (required, UUID)
- `page`, `limit`, `sort`, `order`

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "customers": { "name": "Customer Name" },
      "payment_method": "cash",
      "subtotal": 100.00,
      "tax": 21.00,
      "discount": 0.00,
      "total": 121.00,
      "sale_items": [
        {
          "product_id": "uuid",
          "products": { "name": "Product Name" },
          "quantity": 2,
          "price": 50.00,
          "total": 100.00
        }
      ],
      ...
    }
  ],
  "pagination": { ... }
}
```

#### `GET /sales/:id`
Get single sale with items.

#### `POST /sales`
Create a new sale.

**Body:**
```json
{
  "company_id": "uuid",
  "customer_id": "uuid",
  "payment_method": "cash",
  "subtotal": 100.00,
  "tax": 21.00,
  "discount": 0.00,
  "total": 121.00,
  "notes": "Optional notes",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "price": 50.00,
      "discount": 0.00,
      "total": 100.00
    }
  ]
}
```

**Response:** `201 Created`

---

### Reports

**Permissions Required:** `reports` module

#### `GET /reports/sales-summary`
Get sales summary for a date range.

**Query Parameters:**
- `company_id` (required, UUID)
- `start` (required, ISO 8601 date)
- `end` (required, ISO 8601 date)

**Response:**
```json
{
  "companyId": "uuid",
  "start": "2026-01-01T00:00:00.000Z",
  "end": "2026-01-31T23:59:59.999Z",
  "count": 150,
  "subtotal": 15000.00,
  "total": 18150.00,
  "average_ticket": 121.00
}
```

#### `GET /reports/top-products`
Get top-selling products for a date range.

**Query Parameters:**
- `company_id` (required, UUID)
- `start` (required, ISO 8601 date)
- `end` (required, ISO 8601 date)
- `limit` (optional, integer, default: 10, max: 50)

**Response:**
```json
{
  "companyId": "uuid",
  "start": "2026-01-01T00:00:00.000Z",
  "end": "2026-01-31T23:59:59.999Z",
  "items": [
    {
      "product_id": "uuid",
      "name": "Product Name",
      "qty": 150,
      "total": 7500.00
    }
  ]
}
```

---

## Permissions Model

Each user has a role per company with granular permissions per module:

**Roles:**
- `admin`: Full access to all modules
- `manager`: Most modules, limited delete
- `cashier`: POS, sales, customers
- `accountant`: Read-only access to financial data
- `viewer`: Read-only access
- `warehouse`: Inventory management
- `technician`: Technical services
- `auditor`: Read-only audit access
- `employee`: Basic access

**Permissions per module:**
- `view`: Read data
- `create`: Create new records
- `edit`: Modify existing records
- `delete`: Delete records
- `export`: Export data

---

## Audit Logging

All critical operations are logged to `audit_logs` table:

**Logged Actions:**
- `create`, `read`, `update`, `delete`, `export`
- `login`, `logout`, `access_denied`

**Log Structure:**
```typescript
{
  user_id: string;
  company_id: string | null;
  action: AuditAction;
  resource: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}
```

---

## Error Handling

### Validation Errors (422)
```json
{
  "error": "Validation failed: name: Required, price: Expected number, received string"
}
```

### Permission Errors (403)
```json
{
  "error": "Forbidden: requires create permission on products"
}
```

### Not Found (404)
```json
{
  "error": "Not found"
}
```

---

## Example Usage

### JavaScript/TypeScript
```typescript
const API_BASE = 'https://<project-ref>.supabase.co/functions/v1/api-v1';
const token = '<your_jwt_token>';

// List products
const response = await fetch(
  `${API_BASE}/products?company_id=<uuid>&page=1&limit=50`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
);
const data = await response.json();

// Create product
const newProduct = await fetch(`${API_BASE}/products`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    company_id: '<uuid>',
    name: 'New Product',
    price: 100.00,
    stock: 50,
  }),
});
```

### cURL
```bash
# Get companies
curl -H "Authorization: Bearer <token>" \
  https://<project-ref>.supabase.co/functions/v1/api-v1/companies

# Create customer
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "<uuid>",
    "name": "Customer Name",
    "email": "customer@example.com"
  }' \
  https://<project-ref>.supabase.co/functions/v1/api-v1/customers
```

---

## Next Steps

Planned features:
- Suppliers, Purchases, Inventory endpoints
- Webhooks for events
- Bulk operations
- Advanced filtering
- GraphQL alternative
- SDKs (JavaScript, Python, PHP)
- OpenAPI spec export

---

**Support:** Contact your administrator or check internal docs.
