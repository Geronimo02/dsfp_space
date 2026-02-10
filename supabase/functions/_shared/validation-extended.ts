import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// SUPPLIERS
export const CreateSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tax_id: z.string().optional(),
  condicion_iva: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  payment_terms: z.string().optional(),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

// PURCHASES
export const CreatePurchaseSchema = z.object({
  supplier_id: z.string().uuid(),
  invoice_number: z.string().optional(),
  receipt_date: z.string().datetime().optional(),
  payment_method: z.string(),
  subtotal: z.number().min(0),
  tax: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  total: z.number().min(0),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1),
      price: z.number().min(0),
      tax: z.number().min(0).optional(),
      total: z.number().min(0),
    })
  ),
});

// PURCHASE ORDERS
export const CreatePurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid(),
  order_date: z.string().datetime().optional(),
  due_date: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1),
      price: z.number().min(0),
    })
  ),
});

// WAREHOUSES
export const CreateWarehouseSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  manager_id: z.string().uuid().optional(),
});

export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();

// WAREHOUSE TRANSFERS
export const CreateTransferSchema = z.object({
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id: z.string().uuid(),
  transfer_date: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
  ),
});

// EMPLOYEES
export const CreateEmployeeSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  hire_date: z.string().datetime().optional(),
  role: z.string().optional(),
  salary: z.number().min(0).optional(),
  status: z.enum(["active", "inactive", "on_leave"]).optional(),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial();

// EXPENSES
export const CreateExpenseSchema = z.object({
  description: z.string().min(1).max(255),
  amount: z.number().min(0),
  expense_date: z.string().date(),
  category: z.string(),
  payment_method: z.string(),
  notes: z.string().optional(),
  tax: z.number().min(0).optional(),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

// BANK ACCOUNTS
export const CreateBankAccountSchema = z.object({
  bank_name: z.string().min(1).max(255),
  account_number: z.string(),
  account_type: z.string(),
  currency: z.string().optional(),
  balance: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

export const UpdateBankAccountSchema = CreateBankAccountSchema.partial();

// CHECKS
export const CreateCheckSchema = z.object({
  check_number: z.string(),
  issuer: z.string(),
  amount: z.number().min(0),
  issue_date: z.string().date(),
  due_date: z.string().date(),
  bank_account_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const UpdateCheckSchema = CreateCheckSchema.partial();

// AFIP
export const CreateAFIPInvoiceSchema = z.object({
  customer_id: z.string().uuid(),
  sale_id: z.string().uuid().optional(),
  invoice_type: z.enum(["A", "B", "C"]),
  subtotal: z.number().min(0),
  tax: z.number().min(0).optional(),
  total: z.number().min(0),
  notes: z.string().optional(),
});

// WEBHOOKS
export const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum([
      "sale.created",
      "sale.updated",
      "purchase.created",
      "product.created",
      "customer.created",
      "payment.received",
    ])
  ),
  active: z.boolean().optional(),
});

export const UpdateWebhookSchema = CreateWebhookSchema.partial();

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data;
}
