import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().optional(),
  description: z.string().optional(),
  price: z.number().min(0),
  cost: z.number().min(0).optional(),
  category_id: z.string().uuid().optional(),
  barcode: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  min_stock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  tipo_documento: z.string().optional(),
  condicion_iva: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export const CreateSaleSchema = z.object({
  customer_id: z.string().uuid().optional(),
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
      discount: z.number().min(0).optional(),
      total: z.number().min(0),
    })
  ),
});

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data;
}
