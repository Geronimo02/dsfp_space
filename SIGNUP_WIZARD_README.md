# Wizard de Registro - DSFP

Sistema completo de registro empresarial con checkout de pagos.

## Componentes creados

### Páginas
- `/src/pages/SignupWizard.tsx` - Wizard principal de registro
- `/src/pages/SignupSuccess.tsx` - Página de confirmación post-pago
- `/src/pages/SignupCancel.tsx` - Página de cancelación de pago

### Componentes
- `/src/components/signup/SignupStepper.tsx` - Stepper visual de pasos
- `/src/components/signup/Step1Account.tsx` - Paso 1: Datos de cuenta
- `/src/components/signup/Step2Plan.tsx` - Paso 2: Selección de plan
- `/src/components/signup/Step3Modules.tsx` - Paso 3: Selección de módulos
- `/src/components/signup/Step4Confirmation.tsx` - Paso 4: Confirmación y pago

### Hooks
- `/src/hooks/useSignupWizard.tsx` - Manejo de estado del wizard + localStorage

## Rutas configuradas

- `/signup` - Wizard de registro
- `/signup/success?intent_id=xxx` - Confirmación de pago
- `/signup/cancel?intent_id=xxx` - Cancelación de pago

## Flujo completo

### 1. Registro (5 pasos)

**Paso 1 - Datos de cuenta:**
- Email (validado)
- Nombre completo
- Nombre de empresa
- Contraseña (mínimo 8 caracteres)

**Paso 2 - Elegir plan:**
- Lista planes desde `subscription_plans` (activos)
- Muestra: nombre, descripción, precio, billing_period
- Badge especial para plan FREE (7 días gratis)

**Paso 3 - Módulos adicionales:**
- 6 módulos disponibles: Inventario, Reportes, POS, Contabilidad, CRM, RRHH
- $10 USD/mes por módulo
- Selección múltiple con chips visuales

**Paso 4 - Confirmación:**
- Resumen completo de cuenta, plan y módulos
- Selector de provider: Mercado Pago o Stripe
- Cálculo total: plan base + módulos
- Botón "Confirmar y proceder al pago"

### 2. Procesamiento de pago

Al confirmar Paso 4:
1. Llama a `create-intent` Edge Function con:
   ```json
   {
     "email": "...",
     "full_name": "...",
     "company_name": "...",
     "plan_id": "...",
     "modules": ["inventory", "reports"],
     "provider": "mercadopago"
   }
   ```

2. Recibe `intent_id` y guarda en localStorage

3. Llama a `start-checkout` con:
   ```json
   {
     "intent_id": "...",
     "success_url": "https://tu-app.com/signup/success?intent_id=xxx",
     "cancel_url": "https://tu-app.com/signup/cancel?intent_id=xxx"
   }
   ```

4. Recibe `checkout_url` y redirige al procesador de pagos

### 3. Post-pago

**Éxito (`/signup/success`):**
- Polling cada 2 segundos al endpoint REST de `signup_intents`
- Cuando `status === "paid_ready"`:
  - Llama a `finalize-signup` con `{ intent_id, password }`
  - Limpia localStorage
  - Redirige a `/auth`
- Si 60 segundos sin confirmación: muestra opción de reintentar

**Cancelación (`/signup/cancel`):**
- Muestra mensaje "Pago cancelado"
- Botones: "Volver al registro" o "Ir al login"

## Estados del intent

- `draft` - Intent creado, no hay checkout
- `checkout_created` - Checkout iniciado, esperando pago
- `paid_ready` - Pago confirmado, listo para finalizar
- `completed` - Cuenta creada exitosamente
- `canceled` - Proceso cancelado

## Persistencia

### localStorage
- `signup_wizard_data` - Datos del formulario (auto-guardado)
- `signup_intent_id` - ID del intent actual

Se limpia automáticamente al completar el registro.

## Plan FREE especial

ID: `460d1274-59bc-4c99-a815-c3c1d52d0803`

- Badge: "7 días gratis • Requiere tarjeta"
- Mensaje: "No se cobrará hoy. Al finalizar los 7 días de prueba, se debitará automáticamente el plan Básico."

## Edge Functions requeridas

Asegúrate de que estén deployadas:

1. ✅ `create-intent` - Crear signup intent
2. ✅ `start-checkout` - Iniciar checkout (Stripe/MercadoPago)
3. ✅ `finalize-signup` - Crear usuario y empresa post-pago
4. ✅ `mercadopago-webhook` - Webhook de Mercado Pago (con --no-verify-jwt)

## Variables de entorno

Frontend (`.env`):
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

Supabase Edge Functions:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MP_ACCESS_TOKEN` (para Mercado Pago)
- `STRIPE_SECRET_KEY` (para Stripe)
- `DEFAULT_USD_ARS_RATE` (opcional, fallback tipo de cambio)

## Validaciones

- Email: formato válido
- Password: mínimo 8 caracteres
- Plan: requerido
- Módulos: opcional (0 a N)
- Provider: Stripe o Mercado Pago

## Logs

Todos los componentes logean en consola:
- `[SignupWizard]` - Acciones del wizard
- `[SignupSuccess]` - Polling de estado
- `[create-intent]` - Edge function

## Testing

Ruta de desarrollo: `/dev/signup-tester` (mantiene el tester original)

## Estilos

Usa componentes shadcn/ui existentes:
- Card, Button, Input, Label
- Badge, RadioGroup, Separator
- Loader2, Check icons de lucide-react

Diseño responsive con Tailwind CSS, coherente con Auth.tsx y Dashboard.

## Próximos pasos opcionales

- [ ] Agregar Edge Function `get-intent-status` dedicada (actualmente usa REST directo)
- [ ] Implementar reintentos de pago desde `/signup/cancel`
- [ ] Agregar analytics/tracking de conversión
- [ ] Internacionalización (i18n)
- [ ] Tests unitarios con Vitest
