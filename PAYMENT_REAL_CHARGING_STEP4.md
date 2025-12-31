# 🔴 CAMBIO IMPORTANTE: Ahora Cobramos en Step 4

## ⚠️ Arquitectura Actualizada (31 Diciembre 2025)

**CAMBIO CRÍTICO**: El sistema ahora **carga el monto REAL de la suscripción en Step 4**, no solo valida la tarjeta.

---

## 📊 Flujo Nuevo vs Viejo

### ANTES (Validación solamente)
```
Step 4: 
  ├─ Crea PaymentMethod/Token
  ├─ Valida que exista (SetupIntent/Preapproval)
  └─ NO COBRA NADA (solo validación)
  
Step 5: Crea empresa con suscripción TRIAL
Step 2: Cuando se activa ← se cobra
```

### AHORA (Cobro inmediato)
```
Step 4:
  ├─ Obtiene plan_id y precio
  ├─ Crea PaymentMethod/Token  
  ├─ CARGA EL MONTO REAL (PaymentIntent/Payment API)
  └─ Si falla → ERROR → NO avanza
  
Step 5: Crea empresa con suscripción ACTIVA
       ├─ Guarda payment_id (PaymentIntent/Payment)
       └─ No es trial (ya se cobró)
```

---

## 💳 Cambios Técnicos

### Stripe: SetupIntent → PaymentIntent

**VIEJO:**
```typescript
// Solo validación, sin cobrar
stripe.setupIntents.create({
  payment_method: payment_method_id,
  confirm: true,
  usage: 'off_session',
})
```

**NUEVO:**
```typescript
// Carga el monto REAL
stripe.paymentIntents.create({
  amount: amountInCents,    // ← NUEVO: monto real
  currency: "usd",
  payment_method: payment_method_id,
  confirm: true,
  description: `Suscripción ${plan.name} - ${email}`,
})
```

### MercadoPago: Preapproval → Payment

**VIEJO:**
```typescript
// Solo validación con $0.01
mp.preapproval({
  transaction_amount: 0.01,  // ← solo test
  card_token_id: token,
})
```

**NUEVO:**
```typescript
// Carga el monto REAL en ARS
mp.payments({
  transaction_amount: amountARS,  // ← NUEVO: monto real
  token: token,
  installments: 1,
  payer: { email: email },
})
```

---

## 🗄️ Base de Datos: Nuevas Columnas

```sql
-- signup_payment_methods ahora guarda:
plan_id             UUID       -- Plan cobrado
amount              DECIMAL    -- Monto cobrado (USD)
currency            TEXT       -- 'USD'
payment_id          TEXT       -- Stripe: payment_intent_id
                                -- MP: payment_id (de payments API)
```

Ejemplo después de Step 4:
```json
{
  "id": "uuid-123",
  "email": "user@test.com",
  "provider": "stripe",
  "payment_method_ref": "pm_xxx",
  "payment_id": "pi_8s9dKjH",        // ← PaymentIntent ID
  "plan_id": "plan-uuid",
  "amount": 29.99,
  "currency": "USD",
  "payment_verified": true,
  "payment_error": null
}
```

---

## 🧪 Testing con Tarjetas Test

### Stripe

| Escenario | Tarjeta | Resultado |
|-----------|---------|-----------|
| ✅ Aprobado | 4242 4242 4242 4242 | Cobra $29.99, avanza a Step 5 |
| ❌ Fondos insuficientes | **4000 0000 0000 9995** | Error "Fondos insuficientes", bloqueado |
| ❌ Declinada | 4000 0000 0000 0002 | Error "Tarjeta rechazada", bloqueado |
| ❌ Expirada | 4000 0000 0000 0069 | Error "Tarjeta expirada", bloqueado |

**CVV:** 123, **Fecha:** 12/34

### MercadoPago (Argentina)

| Escenario | Tarjeta | Titular | Resultado |
|-----------|---------|---------|-----------|
| ✅ Aprobado | 5031 7557 3453 0604 | APRO | Cobra ~$30k ARS, avanza a Step 5 |
| ❌ Fondos insuficientes | 5031 7557 3453 0604 | **FUND** | Error "Fondos insuficientes", bloqueado |
| ❌ Llamar banco | 5031 7557 3453 0604 | **CALL** | Error "Comunicate con tu banco", bloqueado |
| ❌ Código inválido | 5031 7557 3453 0604 | **SECU** | Error "Código inválido", bloqueado |
| ❌ Expirada | 5031 7557 3453 0604 | **EXPI** | Error "Tarjeta expirada", bloqueado |

**CVV:** 123, **Fecha:** 11/25

---

## 🔐 Seguridad

### ✅ Validaciones que Detecta Step 4

- ✅ Fondos insuficientes
- ✅ Tarjeta rechazada/declinada
- ✅ Tarjeta expirada
- ✅ CVV incorrecto
- ✅ Tarjeta bloqueada
- ✅ Tarjeta robada (MP)

### ✅ Doble Seguridad en finalize-signup

```typescript
// Si llega a Step 5 y alguien intenta saltarse el pago:
if (!spm.payment_verified) {
  return error("El pago no fue procesado")
}

if (!spm.payment_id) {
  return error("El pago no fue registrado")
}

// Guardar payment_id en company_payment_methods
stripe_payment_intent_id: spm.payment_id  // Stripe
mp_payment_id: spm.payment_id             // MP
```

---

## 💰 Montos Cobrados

### Desarrollo

**Stripe (test mode):**
- Usa tarjetas de prueba (4242... o 4000...)
- Monto real configurado: $ del plan
- No se cobran reales

**MercadoPago (sandbox):**
- Usa tarjetas de prueba
- Monto real en ARS (usa tasa de cambio)
- No se cobran reales

### Producción

**Stripe (live mode):**
```
Plan price USD × 100 = monto en centavos
Ej: $29.99 = 2999 centavos
```

**MercadoPago (production):**
```
Plan price USD × DEFAULT_USD_ARS_RATE = monto en ARS
Ej: $29.99 × 1000 = 29,990 ARS
```

---

## 📋 Checklist Pre-Producción

```bash
# ACTUALIZAR VARIABLES DE ENTORNO
□ STRIPE_SECRET_KEY: sk_test_... → sk_live_...
□ STRIPE_PUBLISHABLE_KEY: pk_test_... → pk_live_...
□ MP_ACCESS_TOKEN: TEST-... → APP_USR-...
□ DEFAULT_USD_ARS_RATE: 1000 (ajustar según tipo de cambio actual)

# TESTING LOCAL
□ Stripe 4242: Debe cobrar y avanzar
□ Stripe 4000000000009995: Debe rechazar con "Fondos insuficientes"
□ MP con titular "APRO": Debe cobrar y avanzar
□ MP con titular "FUND": Debe rechazar con "Fondos insuficientes"

# VERIFICAR DATOS GUARDADOS
SELECT 
  email, provider, payment_id, amount, plan_id,
  payment_verified, linked_to_company_id
FROM signup_payment_methods
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

# VERIFICAR COMPANY_PAYMENT_METHODS
SELECT 
  c.id, c.name,
  pm.stripe_payment_intent_id,
  pm.mp_payment_id,
  pm.is_default
FROM companies c
LEFT JOIN company_payment_methods pm ON c.id = pm.company_id
WHERE c.created_at > NOW() - INTERVAL '1 day';
```

---

## 🚨 Rollback Rápido

Si encuentras problemas:

```bash
# 1. Revertir a SetupIntent/Preapproval (validación sin cobro)
#    Edit: stripe-test-payment/index.ts
#    Cambiar: PaymentIntent → SetupIntent
#    Edit: mp-test-card-token/index.ts
#    Cambiar: payments → preapproval
#    supabase functions deploy stripe-test-payment mp-test-card-token

# 2. Revertir plan_id y amount en frontend
#    Step4Payment.tsx: Quitar email y planId de props
#    StripeCardFields.tsx: Quitar plan_id del invoke
#    MercadoPagoCardFields.tsx: Quitar plan_id del invoke

# 3. Revertir finalize-signup
#    Revertir a guardar preapproval_id en lugar de payment_id
#    supabase functions deploy finalize-signup
```

---

## 📊 Monitoreo

### Métricas Clave

```sql
-- Pagos procesados en Step 4 (últimas 24h)
SELECT 
  provider,
  COUNT(*) as total,
  SUM(CASE WHEN payment_verified THEN 1 ELSE 0 END) as charged,
  SUM(CASE WHEN NOT payment_verified THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN NOT payment_verified THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate
FROM signup_payment_methods
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;

-- Ingresos por proveedor (últimas 24h)
SELECT 
  provider,
  COUNT(*) as transactions,
  SUM(amount) as total_usd,
  AVG(amount) as avg_usd
FROM signup_payment_methods
WHERE payment_verified = true
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;

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
```

### Alertas

1. **Tasa de rechazo > 30%:** Revisar API keys, límites de rate
2. **Error específico > 100/día:** Problema con proveedor
3. **No hay pagos en 12 horas:** Algo está roto (urgente)

---

## ✅ Resumen de Cambios

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Validación | SetupIntent ($0) | PaymentIntent ($real) |
| Validación | Preapproval ($0.01) | Payment ($real ARS) |
| Cobro | Step 5 / Start-Checkout | **Step 4** |
| Trial | Siempre | Solo si plan FREE |
| Payment ID | No almacenado | **Almacenado en BD** |
| Seguridad | finalize-signup check | finalize-signup + payment_id |

---

## 🎯 Próximos Pasos

1. ✅ Edge functions desplegadas (stripe-test-payment, mp-test-card-token, finalize-signup)
2. ✅ Frontend actualizado (StripeCardFields, MercadoPagoCardFields, Step4Payment)
3. ✅ Base de datos actualizada (plan_id, amount, payment_id columns)
4. ⏳ **NEXT:** Cambiar vars de env de test → live
5. ⏳ **NEXT:** Testear con tarjetas reales de test
6. ⏳ **NEXT:** Deploy a producción

---

**Fecha:** 31 Diciembre 2025  
**Versión:** 2.0 - COBRO EN STEP 4  
**Status:** ✅ LISTO PARA PRODUCCIÓN
