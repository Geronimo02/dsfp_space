# DSFP Platform - Sistema de Gestión Empresarial SaaS

**Plataforma multi-tenant completa** con módulos de POS, inventario, contabilidad, CRM, RRHH y reportes.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-%23007ACC)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-93%20passing-brightgreen)](./PROJECT_DOCUMENTATION.md#sistema-de-testing)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://lovable.dev/projects/5670e5fc-c3f6-4b61-9f11-214ae88eb9ef)

---

## 📚 Documentación Completa

**👉 [Ver PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** - Documentación técnica completa del proyecto

Este documento incluye:
- 🏗️ Arquitectura y tecnologías
- 📈 Historia detallada de mejoras (Fases 0-4)
- 🎯 Features principales (POS, Pagos, Wizard de registro)
- 🧪 Sistema de testing (93 tests)
- 🚀 Deployment y migraciones
- ⚡ Optimizaciones de performance (80-90% más rápido)
- ♿ Accesibilidad WCAG 2.1 AA
- 🔒 Seguridad y query limits

---

## 🚀 Quick Start

### Requisitos
- Node.js 18+ & npm ([instalar con nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Cuenta de Supabase

### Instalación

```bash
# Clonar el repositorio
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar desarrollo
npm run dev
```

### Variables de Entorno

Crear `.env` en la raíz:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_MERCADOPAGO_PUBLIC_KEY=TEST-...
```

---

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Servidor dev (http://localhost:5173)
npm run build            # Build producción
npm run preview          # Preview del build

# Testing
npm test                 # Ejecutar 93 tests
npm test -- --watch      # Watch mode
npm run test:ui          # UI visual
npm run test:coverage    # Reporte cobertura

# Linting
npm run lint             # ESLint
```

---

## 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Páginas** | 67+ |
| **Tests** | 93 (cobertura ~20%) |
| **Edge Functions** | 4 deployadas |
| **Módulos** | 15+ empresariales |
| **WCAG Compliance** | AA (6 componentes) |
| **Performance** | <500ms navegación (caché) |

---

## 🏗️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript (strict mode)
- **Build**: Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **State**: React Query (TanStack)
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest + Testing Library
- **Pagos**: Stripe + Mercado Pago

---

## 🎯 Features Principales

### ✅ Wizard de Registro (5 pasos)
- Datos de cuenta → Plan → Método de pago → Módulos → Confirmación
- Integración con Stripe y Mercado Pago
- 11 países soportados

### 💳 Sistema de Pagos
- Múltiples métodos de pago (estilo Amazon Prime)
- Stripe + Mercado Pago
- Gestión de tarjetas guardadas

### 🛒 POS (Punto de Venta)
- Multi-moneda (5 monedas)
- Pagos multi-método
- Recargos por cuotas
- Programa de fidelización

### 📊 Gestión Empresarial
- Inventario, productos, clientes, proveedores
- Facturación y comprobantes AFIP
- Contabilidad y reportes
- RRHH y nómina
- CRM y seguimiento

---

## 🔒 Seguridad

- ✅ TypeScript strict mode
- ✅ 24 queries con límites (protección DoS)
- ✅ Sanitización SQL en búsquedas
- ✅ RLS (Row Level Security) en todas las tablas
- ✅ Sin credenciales hardcodeadas
- ✅ Validación con Zod

---

## ⚡ Performance

| Métrica | Mejora |
|---------|--------|
| Navegación (con caché) | -80-90% (2-5s → <500ms) |
| Requests por página | -70-100% (8-15 → 0-3) |
| Código POS | -11.4% (1798 → 1593 líneas) |

**Optimizaciones**:
- React Query con caché 5-10 min
- Lazy loading universal (67+ páginas)
- Queries condicionales con `enabled`
- Debouncing en búsquedas (300-500ms)

---

## ♿ Accesibilidad

- ✅ WCAG 2.1 Nivel AA (6 componentes)
- ✅ 70+ ARIA attributes
- ✅ Navegación completa por teclado
- ✅ Skip link ("Saltar al contenido")
- ✅ Live regions y estados
- ✅ Compatible con lectores de pantalla

---

## 📝 Desarrollo con Lovable

**Lovable Project**: https://lovable.dev/projects/5670e5fc-c3f6-4b61-9f11-214ae88eb9ef

### Usar Lovable
- Visita el [proyecto en Lovable](https://lovable.dev/projects/5670e5fc-c3f6-4b61-9f11-214ae88eb9ef)
- Los cambios se commitean automáticamente

### Usar IDE Local
- Clona el repo y pushea cambios
- Los cambios se reflejan en Lovable

### GitHub Codespaces
- Click en "Code" → "Codespaces" → "New codespace"
- Edita y commitea directamente

---

## 🚀 Deployment

### Via Lovable
1. Abrir [Lovable](https://lovable.dev/projects/5670e5fc-c3f6-4b61-9f11-214ae88eb9ef)
2. Click en **Share → Publish**
3. Configurar dominio custom (opcional)

### Dominio Custom
- Project > Settings > Domains > Connect Domain
- [Guía completa](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## 📚 Documentación Adicional

| Documento | Descripción |
|-----------|-------------|
| **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** | 📄 **Documentación técnica completa** (consolidada) |
| `.env.example` | Template de variables de entorno |
| `supabase/migrations/` | Migraciones SQL |
| `vitest.config.ts` | Configuración de tests |

---

## 🧪 Testing

**93 tests** automatizados con Vitest + Testing Library

```bash
npm test                    # Ejecutar todos
npm test -- --watch         # Watch mode
npm run test:ui             # Interfaz visual
npm test -- useAuth.test.tsx  # Test específico
```

**Cobertura actual**: ~20%  
**Objetivo Fase 3**: 30-40%

---

## 🤝 Contribución

1. Fork el proyecto
2. Crear branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

**Antes de PR**:
- ✅ `npm test` - Tests passing
- ✅ `npm run build` - Build sin errores
- ✅ `npm run lint` - Sin warnings críticos

---

## 📞 Soporte

- **Lovable Project**: [Ver proyecto](https://lovable.dev/projects/5670e5fc-c3f6-4b61-9f11-214ae88eb9ef)
- **Lovable Docs**: https://docs.lovable.dev
- **Supabase**: https://supabase.com/dashboard

---

## 📄 Licencia

Este proyecto es privado y su uso está restringido.

---

## ✅ Estado del Proyecto

**Última actualización**: 6 de Febrero, 2026  
**Fase actual**: ✅ Fase 2 Completada  
**Build**: ✅ Passing  
**Tests**: ✅ 93 passing  
**TypeScript**: ✅ Strict mode, sin errores  
**Próxima fase**: Fase 3 - Testing avanzado + PaymentEngine

---

**📖 Para información detallada, ver [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)**
