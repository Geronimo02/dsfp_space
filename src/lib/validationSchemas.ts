import { z } from "zod";

/**
 * Common validation schemas for reuse across forms
 */

// Basic field validations
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email inválido")
  .max(255, "El email debe tener máximo 255 caracteres")
  .or(z.literal(""));

export const phoneSchema = z
  .string()
  .max(20, "El teléfono debe tener máximo 20 caracteres")
  .optional();

export const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es requerido")
  .max(200, "El nombre debe tener máximo 200 caracteres");

export const descriptionSchema = z
  .string()
  .max(1000, "La descripción debe tener máximo 1000 caracteres")
  .optional();

export const addressSchema = z
  .string()
  .max(500, "La dirección debe tener máximo 500 caracteres")
  .optional();

export const taxIdSchema = z
  .string()
  .max(50, "El identificador fiscal debe tener máximo 50 caracteres")
  .optional();

export const documentSchema = z
  .string()
  .max(50, "El documento debe tener máximo 50 caracteres")
  .optional();

// Password validation (strong)
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "La contraseña debe contener al menos una mayúscula")
  .regex(/[a-z]/, "La contraseña debe contener al menos una minúscula")
  .regex(/[0-9]/, "La contraseña debe contener al menos un número");

// Password confirmation
export const passwordConfirmSchema = (passwordField: string = "password") =>
  z
    .object({
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Las contraseñas no coinciden",
      path: ["confirmPassword"],
    });

// Number validations
export const priceSchema = z
  .number({ invalid_type_error: "El precio debe ser un número" })
  .min(0, "El precio no puede ser negativo")
  .max(999999999, "El precio es demasiado grande");

export const quantitySchema = z
  .number({ invalid_type_error: "La cantidad debe ser un número" })
  .int("La cantidad debe ser un número entero")
  .min(0, "La cantidad no puede ser negativa");

export const percentageSchema = z
  .number({ invalid_type_error: "El porcentaje debe ser un número" })
  .min(0, "El porcentaje no puede ser negativo")
  .max(100, "El porcentaje no puede ser mayor a 100");

// Date validations
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)");

export const futureDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido")
  .refine(
    (date) => new Date(date) >= new Date(new Date().setHours(0, 0, 0, 0)),
    "La fecha no puede ser en el pasado"
  );

// Customer schema
export const customerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  document: documentSchema,
  address: addressSchema,
  credit_limit: priceSchema.optional(),
  payment_terms: z.string().optional(),
  notes: descriptionSchema,
});

// Product schema
export const productSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  sku: z.string().max(100, "El SKU debe tener máximo 100 caracteres").optional(),
  barcode: z.string().max(100, "El código de barras debe tener máximo 100 caracteres").optional(),
  price: priceSchema,
  cost: priceSchema.optional(),
  stock: quantitySchema,
  min_stock: quantitySchema.optional(),
  category: z.string().max(100, "La categoría debe tener máximo 100 caracteres").optional(),
  active: z.boolean().default(true),
});

// Supplier schema
export const supplierSchema = z.object({
  name: nameSchema,
  contact_name: z.string().max(200, "El nombre de contacto debe tener máximo 200 caracteres").optional(),
  email: emailSchema,
  phone: phoneSchema,
  address: addressSchema,
  tax_id: taxIdSchema,
  payment_terms: z.string().max(200, "Los términos de pago deben tener máximo 200 caracteres").optional(),
  credit_limit: priceSchema.optional(),
  notes: descriptionSchema,
  active: z.boolean().default(true),
});

// Employee schema
export const employeeSchema = z.object({
  first_name: z.string().trim().min(1, "El nombre es requerido").max(100),
  last_name: z.string().trim().min(1, "El apellido es requerido").max(100),
  document_type: z.string().optional(),
  document_number: documentSchema,
  email: emailSchema,
  phone: phoneSchema,
  hire_date: dateSchema,
  position: z.string().max(100, "El cargo debe tener máximo 100 caracteres").optional(),
  department: z.string().max(100, "El departamento debe tener máximo 100 caracteres").optional(),
  base_salary: priceSchema.optional(),
  active: z.boolean().default(true),
});

// Company settings schema
export const companySettingsSchema = z.object({
  company_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  tax_id: taxIdSchema,
  address: addressSchema,
  default_tax_rate: percentageSchema,
  card_surcharge_rate: percentageSchema,
});

// Sale schema (partial - for validation)
export const saleItemSchema = z.object({
  product_id: z.string().uuid("ID de producto inválido"),
  quantity: quantitySchema.min(1, "La cantidad debe ser mayor a 0"),
  unit_price: priceSchema,
  discount_percentage: percentageSchema.optional(),
});

export const saleSchema = z.object({
  customer_id: z.string().uuid("ID de cliente inválido").optional(),
  payment_method: z.string().min(1, "El método de pago es requerido"),
  items: z.array(saleItemSchema).min(1, "Debe agregar al menos un producto"),
  notes: descriptionSchema,
});

/**
 * Helper function to validate data against a schema
 * Returns { success: boolean, data?: T, errors?: ZodError }
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { 
    success: false, 
    errors: result.error,
    errorMessages: result.error.errors.map(e => e.message)
  };
}
