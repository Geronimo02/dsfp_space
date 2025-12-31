# 🔒 Guía de Verificación de Pago - Producción

## 📋 Resumen Ejecutivo

**Problema Original**: Las cuentas se creaban incluso con tarjetas sin fondos (FUND test card).

**Solución Implementada**: Validación de pago **REAL** en Step 4 del signup, antes de permitir avanzar a Step 5. Ahora, si la tarjeta no tiene fondos o es inválida, **NO** se crea la cuenta bajo ningún concepto.

---

## 🏗️ Arquitectura de Validación

### Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            STEP 4: PAYMENT                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼────────┐            ┌────────▼────────┐
            │  MERCADOPAGO   │            │     STRIPE      │
            └───────┬────────┘            └────────┬────────┘
                    │                               │
          ┌─────────▼─────────┐          ┌─────────▼─────────┐
          │  MP Bricks SDK    │          │  Stripe Elements  │
          │  createCardToken  │          │ createPaymentMethod
          └─────────┬─────────┘          └─────────┬─────────┘
                    │                               │
                    │ token_id                      │ payment_method_id
                    │                               │
          ┌─────────▼──────────────┐     ┌─────────▼──────────────┐
          │ mp-test-card-token     │     │ stripe-test-payment    │
          │ =====================  │     │ =====================  │
          │ 1. Crear preapproval   │     │ 1. Crear SetupIntent   │
          │    con $0.01           │     │    con confirm:true    │
          │ 2. Validar fondos      │     │ 2. Confirmar método    │
          │ 3. Detectar FUND/CALL  │     │ 3. Validar fondos      │
          │ 4. Cancelar preapproval│     │ 4. Detectar declines   │
          └─────────┬──────────────┘     └─────────┬──────────────┘
                    │                               │
                    │ {verified: true/false}        │ {verified: true/false}
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │ ❌ verified=false  │
                         │ BLOQUEA Step 4     │
                         │ Muestra error      │
                         │ NO avanza a Step 5 │
                         └────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │ ✅ verified=true   │
                         │ Guarda en DB       │
                         │ payment_verified=1 │
                         │ Avanza a Step 5    │
                         └──────────┬─────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────┐
│                            STEP 5: FINALIZE                             │
│  finalize-signup valida payment_verified=true antes de crear company   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Análisis en Profundidad

### Estado Actual del Sistema

#### ✅ MercadoPago - IMPLEMENTADO Y FUNCIONANDO

**Método**: Preapproval con $0.01

```typescript
// supabase/functions/mp-test-card-token/index.ts
const preapproval = await fetch("https://api.mercadopago.com/preapproval", {
  method: "POST",
  body: JSON.stringify({
    reason: "Verificación de tarjeta para registro",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 0.01, // $0.01 para validar
      currency_id: "ARS",
    },
    card_token_id: token, // Token de MP Bricks
    status: "authorized",
  }),
});

// Si la tarjeta tiene "FUND" en el nombre → error cause[0].code = "2067"
// Inmediatamente se cancela el preapproval
```

**Validaciones que detecta**:
- ✅ Fondos insuficientes (FUND)
- ✅ Llamar al emisor (CALL)
- ✅ Tarjeta robada (SECU)
- ✅ Tarjeta expirada (EXPI)
- ✅ CVV incorrecto
- ✅ Datos inválidos

**Flujo**:
1. Usuario completa formulario MP Bricks
2. MP Bricks devuelve `token` (válido 5 minutos)
3. Frontend invoca `mp-test-card-token` **INMEDIATAMENTE**
4. Función crea preapproval con el token
5. MP valida fondos en tiempo real
6. Si falla → retorna error, UI bloqueada
7. Si pasa → cancela preapproval, guarda `payment_verified=true`

#### ✅ Stripe - IMPLEMENTADO Y DESPLEGADO

**Método**: SetupIntent con `confirm:true`

```typescript
// supabase/functions/stripe-test-payment/index.ts
const setupIntent = await stripe.setupIntents.create({
  payment_method: payment_method_id,
  confirm: true, // Confirmar inmediatamente
  usage: "off_session", // Para uso futuro
  automatic_payment_methods: {
    enabled: true,
    allow_redirects: "never",
  },
});

// Stripe valida en tiempo real:
// - Fondos disponibles
// - Tarjeta no declinada
// - Datos válidos
// - No expirada
```

**Validaciones que detecta**:
- ✅ Fondos insuficientes (`insufficient_funds`)
- ✅ Tarjeta declinada genérica (`card_declined`)
- ✅ Tarjeta expirada (`expired_card`)
- ✅ CVV incorrecto (`incorrect_cvc`)
- ✅ Método de pago inválido (`payment_method_invalid`)
- ✅ Procesamiento fallido (`processing_error`)

**Flujo**:
1. Usuario completa formulario Stripe Elements
2. Frontend crea PaymentMethod con `stripe.createPaymentMethod()`
3. Frontend invoca `stripe-test-payment` **INMEDIATAMENTE**
4. Función crea SetupIntent y lo confirma
5. Stripe valida fondos en tiempo real
6. Si falla → retorna error, UI bloqueada
7. Si pasa → guarda `payment_verified=true`

---

## 🚀 Cambios para Producción

### 1. Variables de Entorno - Edge Functions

#### Archivo: `supabase/.env` (para desarrollo local)

```bash
# ================================
# STRIPE - CAMBIAR A PRODUCCIÓN
# ================================
# ❌ DESARROLLO (test mode)
STRIPE_SECRET_KEY=sk_test_51QaGBMBFHZ9mNWfqPQkR2FQ4T9Kp...

# ✅ PRODUCCIÓN (live mode) - USAR ESTA
STRIPE_SECRET_KEY=sk_live_YOUR_PRODUCTION_KEY_HERE

# ================================
# MERCADOPAGO - CAMBIAR A PRODUCCIÓN
# ================================
# ❌ DESARROLLO (sandbox)
MP_ACCESS_TOKEN=TEST-1234567890-123456-abcdef1234567890...

# ✅ PRODUCCIÓN (live) - USAR ESTA
MP_ACCESS_TOKEN=APP_USR-1234567890-123456-abcdef1234567890...
```

#### En Supabase Dashboard

1. Ve a: `Project Settings` → `Edge Functions` → `Secrets`
2. Actualiza:
   - `STRIPE_SECRET_KEY` → Clave live (`sk_live_...`)
   - `MP_ACCESS_TOKEN` → Token de producción (`APP_USR-...`)

### 2. Variables de Entorno - Frontend

#### Archivo: `.env.production`

```bash
# ================================
# STRIPE PUBLISHABLE KEY
# ================================
# ❌ DESARROLLO
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51QaGBMBFHZ9mNWfq...

# ✅ PRODUCCIÓN - USAR ESTA
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY_HERE

# ================================
# MERCADOPAGO PUBLIC KEY
# ================================
# ❌ DESARROLLO
VITE_MERCADOPAGO_PUBLIC_KEY=TEST-abc123...

# ✅ PRODUCCIÓN - USAR ESTA
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-abc123-prod...
```

### 3. Ajustes Opcionales de Validación

Si quieres ser **MÁS ESTRICTO** en producción:

#### MercadoPago - Aumentar monto de prueba

```typescript
// supabase/functions/mp-test-card-token/index.ts
transaction_amount: 1.00, // Cambiar de $0.01 → $1.00 para validar más fondos
```

**Ventaja**: Detecta tarjetas con < $1 en la cuenta  
**Desventaja**: Bloquea temporalmente $1 en la tarjeta del usuario (se cancela inmediatamente)

#### Stripe - Configuración adicional

```typescript
// supabase/functions/stripe-test-payment/index.ts
const setupIntent = await stripe.setupIntents.create({
  payment_method: payment_method_id,
  confirm: true,
  usage: "off_session",
  
  // ✅ AGREGAR ESTO EN PRODUCCIÓN
  metadata: {
    environment: "production",
    signup_email: email,
    timestamp: new Date().toISOString(),
  },
  
  // ✅ OPCIONAL: Validar dirección de facturación
  payment_method_options: {
    card: {
      request_three_d_secure: "automatic", // 3D Secure si es necesario
    },
  },
});
```

---

## 🧪 Testing Pre-Producción

### Plan de Pruebas Completo

#### 1. Testing con Tarjetas de Desarrollo

##### MercadoPago - Tarjetas de Prueba

| Escenario | Tarjeta | Titular | Resultado Esperado |
|-----------|---------|---------|-------------------|
| ✅ Aprobada | 5031 7557 3453 0604 | APRO | Pasa validación, avanza a Step 5 |
| ❌ Fondos insuficientes | 5031 7557 3453 0604 | **FUND** | Error "Fondos insuficientes", bloqueado en Step 4 |
| ❌ Llamar emisor | 5031 7557 3453 0604 | **CALL** | Error "Comunicate con tu banco", bloqueado |
| ❌ Tarjeta robada | 5031 7557 3453 0604 | **SECU** | Error "Tarjeta bloqueada", bloqueado |
| ❌ Expirada | Cualquiera | Fecha < hoy | Error "Tarjeta expirada", bloqueado |

**CVV**: 123 (cualquiera)  
**Fecha**: 11/25 (cualquiera futura)

##### Stripe - Tarjetas de Prueba

| Escenario | Tarjeta | Resultado Esperado |
|-----------|---------|-------------------|
| ✅ Aprobada | 4242 4242 4242 4242 | Pasa validación, avanza a Step 5 |
| ❌ Fondos insuficientes | **4000 0000 0000 9995** | Error "Fondos insuficientes", bloqueado |
| ❌ Declinada genérica | 4000 0000 0000 0002 | Error "Pago rechazado", bloqueado |
| ❌ Tarjeta expirada | 4000 0000 0000 0069 | Error "Tarjeta expirada", bloqueado |
| ❌ CVV incorrecto | 4000 0000 0000 0127 | Error "Código de seguridad incorrecto", bloqueado |

**CVV**: 123  
**Fecha**: 12/34 (cualquiera futura)  
**ZIP**: 12345

#### 2. Checklist de Validación

```bash
# ANTES DE PRODUCCIÓN - VERIFICAR:

□ MP: Tarjeta con titular "FUND" es RECHAZADA en Step 4
□ MP: Error muestra "Fondos insuficientes" en español
□ MP: UI permanece en Step 4, NO avanza a Step 5
□ MP: No se crea registro en signup_companies

□ Stripe: Tarjeta 4000000000009995 es RECHAZADA en Step 4
□ Stripe: Error muestra "Fondos insuficientes" en español
□ Stripe: UI permanece en Step 4, NO avanza a Step 5
□ Stripe: No se crea registro en signup_companies

□ MP: Tarjeta válida (titular "APRO") PASA validación
□ MP: payment_verified=true en signup_payment_methods
□ MP: Avanza a Step 5 sin errores

□ Stripe: Tarjeta 4242424242424242 PASA validación
□ Stripe: payment_verified=true en signup_payment_methods
□ Stripe: Avanza a Step 5 sin errores

□ finalize-signup rechaza si payment_verified=false
□ finalize-signup crea company solo si payment_verified=true
```

#### 3. Validación en Base de Datos

```sql
-- Verificar que NO se crean cuentas con payment_verified=false
SELECT 
  spm.email,
  spm.payment_provider,
  spm.payment_verified,
  spm.payment_error,
  sc.company_name,
  spm.created_at
FROM signup_payment_methods spm
LEFT JOIN signup_companies sc ON spm.email = sc.email
WHERE spm.payment_verified = false
  AND sc.id IS NOT NULL; -- ❌ Este query NO debe retornar filas

-- Ver todos los rechazos de pago
SELECT 
  email,
  payment_provider,
  payment_error,
  created_at
FROM signup_payment_methods
WHERE payment_verified = false
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🔐 Seguridad y Compliance

### PCI DSS Compliance

✅ **NO guardamos números de tarjeta** - Solo tokens de Stripe/MP  
✅ **NO guardamos CVV** - Nunca llega al backend  
✅ **Comunicación HTTPS** - Edge functions usan TLS 1.3  
✅ **Tokens de un solo uso** - MP tokens expiran en 5 minutos  
✅ **Validación en tiempo real** - Fraude detectado antes de signup

### Rate Limiting (RECOMENDADO para Producción)

```typescript
// AGREGAR EN: supabase/functions/stripe-test-payment/index.ts
// Y EN: supabase/functions/mp-test-card-token/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Verificar intentos recientes
const { data: attempts, error } = await supabase
  .from("signup_payment_methods")
  .select("created_at")
  .eq("email", email)
  .eq("payment_verified", false)
  .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Últimas 1 hora

if (attempts && attempts.length >= 5) {
  return new Response(
    JSON.stringify({
      error: "Demasiados intentos fallidos. Intenta nuevamente en 1 hora.",
    }),
    { status: 429 }
  );
}
```

### Logs y Auditoría

```typescript
// En cada edge function, agregar logging:
console.log(`[${payment_provider}] Validation attempt:`, {
  email: email,
  timestamp: new Date().toISOString(),
  verified: result.verified,
  error: result.error || null,
  // ❌ NUNCA loggear: card numbers, CVV, tokens completos
});
```

**Acceso a logs**:
```bash
# Ver logs en tiempo real
supabase functions logs stripe-test-payment --tail
supabase functions logs mp-test-card-token --tail
```

---

## 💰 Costos de Validación

### MercadoPago
- **Preapproval**: $0.01 bloqueados temporalmente
- **Cancelación**: Inmediata, sin costo
- **Costo final**: $0 (se cancela antes de cobrar)

### Stripe
- **SetupIntent**: $0 (gratis)
- **Confirmación**: $0 (gratis)
- **Costo final**: $0

**Total por signup**: **$0** 🎉

---

## 🚨 Plan de Rollback

Si encuentras problemas en producción:

### Rollback Rápido (5 minutos)

```bash
# 1. Revertir edge functions a versión anterior
cd "c:\Users\juanm\OneDrive\Desktop\Trabajo\App Finanzas\dsfp_space"
git log --oneline supabase/functions/stripe-test-payment/index.ts
git checkout <commit-hash> supabase/functions/stripe-test-payment/index.ts
supabase functions deploy stripe-test-payment

git log --oneline supabase/functions/mp-test-card-token/index.ts
git checkout <commit-hash> supabase/functions/mp-test-card-token/index.ts
supabase functions deploy mp-test-card-token

# 2. Desactivar validación en frontend (temporal)
# Editar: src/components/signup/StripeCardFields.tsx
# Comentar línea de validación:
# const testResult = await supabase.functions.invoke("stripe-test-payment", ...);

# 3. Rebuild y deploy frontend
npm run build
# Deploy según tu método (Vercel/Netlify/etc)
```

### Desactivar Validación en BD (ÚLTIMA OPCIÓN)

```sql
-- Si necesitas permitir signups sin validación temporalmente
UPDATE signup_payment_methods
SET payment_verified = true
WHERE email = 'email-especifico@ejemplo.com'
  AND payment_verified = false;
```

⚠️ **SOLO usar en emergencias** - Revisa manualmente el método de pago después.

---

## 📊 Monitoreo Post-Deployment

### Métricas Clave

```sql
-- Tasa de rechazo por proveedor (últimas 24h)
SELECT 
  payment_provider,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN payment_verified THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN NOT payment_verified THEN 1 ELSE 0 END) as rejected,
  ROUND(100.0 * SUM(CASE WHEN NOT payment_verified THEN 1 ELSE 0 END) / COUNT(*), 2) as rejection_rate
FROM signup_payment_methods
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY payment_provider;

-- Errores más comunes
SELECT 
  payment_error,
  COUNT(*) as occurrences
FROM signup_payment_methods
WHERE payment_verified = false
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY payment_error
ORDER BY occurrences DESC
LIMIT 10;

-- Signups exitosos vs rechazados por día
SELECT 
  DATE(created_at) as date,
  payment_verified,
  COUNT(*) as count
FROM signup_payment_methods
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), payment_verified
ORDER BY date DESC;
```

### Alertas Recomendadas

1. **Tasa de rechazo > 50%**: Posible problema con API keys o configuración
2. **Error específico > 100/hora**: Problema con proveedor de pagos
3. **No hay signups en 6 horas**: Validación bloqueando TODO (revisar urgente)

---

## ✅ Checklist Final de Deployment

```bash
# PRODUCCIÓN - DEPLOYMENT CHECKLIST

□ Variables de entorno actualizadas en Supabase Dashboard
  □ STRIPE_SECRET_KEY → sk_live_...
  □ MP_ACCESS_TOKEN → APP_USR-...

□ Variables de entorno actualizadas en frontend (.env.production)
  □ VITE_STRIPE_PUBLISHABLE_KEY → pk_live_...
  □ VITE_MERCADOPAGO_PUBLIC_KEY → APP_USR-...

□ Edge functions desplegadas
  □ supabase functions deploy stripe-test-payment
  □ supabase functions deploy mp-test-card-token
  □ supabase functions deploy verify-signup-payment
  □ supabase functions deploy finalize-signup

□ Frontend buildeado y desplegado
  □ npm run build
  □ Deploy a production

□ Testing completado
  □ MP: Tarjeta rechazada bloquea signup ✓
  □ MP: Tarjeta aprobada permite signup ✓
  □ Stripe: Tarjeta rechazada bloquea signup ✓
  □ Stripe: Tarjeta aprobada permite signup ✓
  □ finalize-signup valida payment_verified ✓

□ Monitoreo configurado
  □ Dashboard de métricas activo
  □ Alertas de tasas de rechazo configuradas
  □ Logs de edge functions monitoreados

□ Plan de rollback documentado y accesible

□ Equipo notificado de cambios en producción
```

---

## 🎯 Resumen de Cambios

### ¿Qué cambia en producción?

1. **Variables de entorno**: Test/Sandbox → Live/Production keys
2. **Montos opcionales**: Puedes aumentar de $0.01 a $1.00 en MP para mayor seguridad
3. **Rate limiting**: Agregar protección contra ataques (recomendado)
4. **Logging**: Configurar alertas para tasas de rechazo anormales

### ¿Qué NO cambia?

- El código de las edge functions (funciona igual)
- El flujo de validación (Step 4 → validación → Step 5)
- La lógica de rechazo/aprobación
- El frontend (mismo código React)

---

## 📞 Soporte

### Si algo falla en producción:

1. **Revisar logs**: `supabase functions logs <function-name> --tail`
2. **Verificar API keys**: Confirmar que sean live keys válidas
3. **Consultar BD**: Ver `signup_payment_methods` para errores específicos
4. **Rollback**: Seguir plan de rollback arriba
5. **Contacto**: Revisar dashboard de Stripe/MercadoPago para issues conocidos

---

**Fecha de última actualización**: 2 de Enero, 2025  
**Versión del documento**: 1.0  
**Autor**: Sistema de Verificación de Pago DSFP
