# Sistema de Gestión de Tarjetas de Pago - Estilo Amazon Prime

## 📋 Resumen de Cambios

Se ha implementado un sistema completo de gestión de tarjetas de pago similar a Amazon Prime, permitiendo a los usuarios:

1. **Guardar múltiples tarjetas de crédito/débito** (Stripe)
2. **Autorizar pagos con Mercado Pago**
3. **Gestionar métodos de pago** (establecer predeterminado, eliminar)
4. **Agregar tarjetas durante el registro** (signup wizard)
5. **Gestionar tarjetas desde Settings** (pestaña de suscripción)

---

## 🗂️ Archivos Creados/Modificados

### ✅ Nuevos Archivos Creados

1. **`src/components/settings/PaymentMethodsManager.tsx`**
   - Componente principal para gestión de métodos de pago
   - Interfaz estilo Amazon Prime con tarjetas visuales
   - Soporte para múltiples tarjetas y Mercado Pago
   - Funcionalidad para establecer método predeterminado

2. **`src/components/signup/Step3Payment.tsx`**
   - Nuevo paso en el wizard de registro
   - Permite agregar tarjeta durante el signup (opcional)
   - Integración con Stripe Elements

3. **`supabase/migrations/20231224_create_company_payment_methods.sql`**
   - Nueva tabla `company_payment_methods`
   - Políticas RLS para seguridad
   - Triggers para asegurar un solo método predeterminado
   - Índices para mejor performance

### 🔄 Archivos Modificados

1. **`src/pages/Settings.tsx`**
   - Actualizada pestaña "Suscripción"
   - Integración del componente `PaymentMethodsManager`
   - Eliminadas funciones obsoletas de Stripe/MercadoPago
   - Interfaz mejorada y más limpia

2. **`src/pages/SignupWizard.tsx`**
   - Agregado Step3Payment entre Plan y Modules
   - Ahora son 5 pasos en lugar de 4

3. **`src/components/signup/SignupStepper.tsx`**
   - Actualizado para mostrar 5 pasos
   - Nuevo paso "Método de pago"

4. **`src/hooks/useSignupWizard.tsx`**
   - Actualizado límite máximo de pasos de 4 a 5

### 📄 Archivos Renombrados

- `Step3Modules.tsx` → `Step4Modules.tsx`
- `Step4Confirmation.tsx` → `Step5Confirmation.tsx`

---

## 🗄️ Base de Datos

### Nueva Tabla: `company_payment_methods`

```sql
CREATE TABLE company_payment_methods (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  type TEXT NOT NULL, -- 'card' o 'mercadopago'
  
  -- Stripe card details
  stripe_payment_method_id TEXT,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  holder_name TEXT,
  
  -- MercadoPago details
  mp_preapproval_id TEXT,
  mp_payer_id TEXT,
  
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Políticas RLS
- Solo usuarios de la empresa pueden ver sus métodos de pago
- Solo admins/managers pueden agregar/editar/eliminar
- Trigger automático para asegurar un solo método predeterminado por empresa

---

## 🚀 Pasos para Implementar

### 1. Ejecutar Migración SQL

```bash
# Conectarse a Supabase y ejecutar la migración
psql -h [TU_DB_HOST] -U postgres -d postgres -f supabase/migrations/20231224_create_company_payment_methods.sql
```

O desde el Dashboard de Supabase:
1. Ir a SQL Editor
2. Copiar y pegar el contenido de `20231224_create_company_payment_methods.sql`
3. Ejecutar

### 2. Crear Edge Functions Necesarias

Necesitas crear/actualizar estas Edge Functions en Supabase:

#### `create-signup-setup-intent`
```typescript
// Para crear setup intent durante el signup (antes de que exista la empresa)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const { email, name } = await req.json()
  
  const setupIntent = await stripe.setupIntents.create({
    payment_method_types: ['card'],
    metadata: {
      email,
      name,
    }
  })
  
  return new Response(
    JSON.stringify({ client_secret: setupIntent.client_secret }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

#### `save-stripe-payment-method`
```typescript
// Para guardar el payment method en la tabla company_payment_methods
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')!
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  
  const { payment_method_id } = await req.json()
  
  // Obtener detalles del payment method de Stripe
  const pm = await stripe.paymentMethods.retrieve(payment_method_id)
  
  // Obtener company_id del usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)
    .single()
  
  // Guardar en la tabla
  await supabase
    .from('company_payment_methods')
    .insert({
      company_id: companyUser.company_id,
      type: 'card',
      stripe_payment_method_id: payment_method_id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
      holder_name: pm.billing_details?.name,
      is_default: true, // Primera tarjeta es predeterminada
    })
  
  return new Response(JSON.stringify({ success: true }))
})
```

### 3. Regenerar Tipos de TypeScript

```bash
# Desde la raíz del proyecto
npx supabase gen types typescript --project-id [TU_PROJECT_ID] > src/integrations/supabase/types.ts
```

Esto eliminará los errores de TypeScript relacionados con `company_payment_methods`.

### 4. Variables de Entorno

Asegúrate de tener estas variables en tu `.env`:

```env
VITE_STRIPE_PUBLIC_KEY=pk_test_...
VITE_SUPABASE_URL=https://....supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 🎨 Características de la UI

### PaymentMethodsManager Component

- **Diseño tipo Amazon Prime**:
  - Tarjetas visuales con iconos de marca
  - Badge para método predeterminado
  - Botones para establecer como predeterminado y eliminar
  
- **Estado vacío atractivo**:
  - Mensaje claro cuando no hay tarjetas
  - Call-to-action prominente

- **Seguridad**:
  - Muestra solo últimos 4 dígitos
  - Datos encriptados en Stripe

### Signup Wizard - Step3Payment

- **Opcional**: El usuario puede saltar este paso
- **Integración Stripe Elements**: Formulario de pago seguro
- **Opción Mercado Pago**: Se configura después del registro
- **UX fluida**: Transición suave entre pasos

---

## 📱 Uso

### En Settings

```tsx
import { PaymentMethodsManager } from "@/components/settings/PaymentMethodsManager";

// En tu componente
<PaymentMethodsManager 
  companyId={currentCompany?.id}
  showTitle={true}
  compact={false}
/>
```

### Propiedades

- `companyId`: ID de la empresa (requerido)
- `showTitle`: Mostrar título "Tus tarjetas de pago" (default: true)
- `compact`: Modo compacto con menos spacing (default: false)

---

## 🔒 Seguridad

1. **RLS (Row Level Security)**: Solo usuarios autorizados ven sus métodos de pago
2. **Stripe Elements**: Los datos de tarjeta nunca pasan por tu servidor
3. **Tokens**: Se guardan tokens de Stripe, nunca números de tarjeta completos
4. **HTTPS**: Todas las comunicaciones encriptadas

---

## 🧪 Testing

1. **Tarjetas de prueba Stripe**:
   - `4242 4242 4242 4242` - Visa exitosa
   - `4000 0000 0000 0002` - Tarjeta declinada
   - Cualquier CVC, fecha futura

2. **Flujos a probar**:
   - ✅ Agregar primera tarjeta (debe ser predeterminada automáticamente)
   - ✅ Agregar segunda tarjeta
   - ✅ Cambiar tarjeta predeterminada
   - ✅ Eliminar tarjeta
   - ✅ Saltar paso de pago en signup
   - ✅ Agregar tarjeta durante signup

---

## 🐛 Troubleshooting

### Error: "company_payment_methods" not found
- **Solución**: Ejecutar la migración SQL

### Error de tipos TypeScript
- **Solución**: Regenerar tipos con `supabase gen types`

### Payment method no se guarda
- **Solución**: Verificar que la Edge Function `save-stripe-payment-method` esté deployada

### No aparecen las tarjetas guardadas
- **Solución**: Verificar políticas RLS en `company_payment_methods`

---

## 📚 Referencias

- [Stripe Setup Intents](https://stripe.com/docs/payments/setup-intents)
- [Stripe Elements React](https://stripe.com/docs/stripe-js/react)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✨ Próximas Mejoras

- [ ] Agregar billing address en tarjetas
- [ ] Soporte para PayPal
- [ ] Recordatorio antes de vencimiento de tarjeta
- [ ] Auto-renovación de suscripción
- [ ] Historial de pagos por tarjeta
