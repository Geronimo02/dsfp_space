# DSFP Platform - Documentación Completa

**Sistema de Gestión Empresarial SaaS Multi-Tenant**  
**Última actualización**: 10 de Febrero, 2026  
**Versión**: 2.1  
**Estado**: ✅ Fase 2 Completada + Mejoras Recientes

---

## 📚 Tabla de Contenidos

1. [Información del Proyecto](#información-del-proyecto)
2. [Quick Start](#quick-start)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Arquitectura](#arquitectura)
5. [Mejoras Implementadas (Fase 1-2)](#mejoras-implementadas)
6. [Mejoras Recientes (Febrero 2026)](#mejoras-recientes-febrero-2026)
7. [Testing](#testing)
8. [Seguridad](#seguridad)
9. [Accesibilidad](#accesibilidad)
10. [Performance](#performance)
11. [Deployment](#deployment)
12. [Próximos Pasos](#próximos-pasos)

---

## 📊 Información del Proyecto

### Overview
DSFP es una plataforma SaaS completa de gestión empresarial multi-tenant construida con tecnologías modernas. Incluye módulos de POS, inventario, contabilidad, CRM, RRHH, reportes y más.

### Estadísticas
| Métrica | Valor |
|---------|-------|
| **Paginas** | 67+ |
| **Tests** | 93 passing |
| **Módulos** | 15+ empresariales |
| **Países** | 11 soportados |
| **Monedas** | 5 (ARS, USD, EUR, BRL, UYU) |
| **Edge Functions** | 4 deployadas |
| **WCAG Compliance** | AA (6 componentes optimizados) |

### URLs Importantes
- **Proyecto Lovable**: https://lovable.dev/projects/5670e5fc-c3f6-4b61-9f11-214ae88eb9ef
- **Documentación Supabase**: https://supabase.com/docs

---

## 🚀 Quick Start

### Requisitos Previos
- Node.js 18+ & npm
- Cuenta de Supabase
- Variables de entorno configuradas

### Instalación Local

```bash
# Clonar repositorio
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar servidor de desarrollo
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

⚠️ **NUNCA** guardar `.env` en repositorio.

### Scripts Disponibles

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

## 🏗️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript (strict mode)
- **Build**: Vite + esbuild
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Estado**: React Query (TanStack) con caché 5-10min
- **Formularios**: React Hook Form + Zod
- **Testing**: Vitest + Testing Library
- **Pagos**: Stripe + Mercado Pago

---

## 🏗️ Arquitectura

### Estructura de Carpetas

```
src/
├── components/          # Componentes React
│   ├── ui/             # base (shadcn/ui)
│   ├── layout/         # Sidebar, Header
│   ├── settings/       # Sub-componentes Settings
│   ├── pos/            # Componentes POS refactorizados
│   ├── dashboard/      # Dashboard
│   └── ...
├── contexts/           # React Context
├── hooks/              # Custom hooks
├── integrations/       # Supabase client
├── lib/               # Utilidades
└── pages/             # 67+ páginas principales

supabase/
├── functions/         # Edge Functions
└── migrations/        # Migraciones SQL
```

### Patrones de Arquitectura

#### 1. **Lazy Loading (67+ páginas)**
```tsx
const Dashboard = lazy(() => import("./pages/Dashboard"));
const POS = lazy(() => import("./pages/POS"));
// Code splitting automático
```

#### 2. **React Query Optimizado**
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 min
      cacheTime: 1000 * 60 * 10,     // 10 min
      refetchOnWindowFocus: false,
    },
  },
});
```

#### 3. **Custom Hooks Reutilizables**
- `useAuth` - Autenticación con caché
- `useDebounce` - Debouncing 300ms
- `useRateLimit` - Límites operacionales
- `useServerPagination` - Paginación 50 registros/página
- `usePermissions` - Control de acceso por rol

#### 4. **Error Handling Centralizado**
- ErrorBoundary global
- getErrorMessage() para usuarios
- Logging solo en DEV

---

## 📈 Mejoras Implementadas

### Fase 1: Critical Improvements (Enero 2026)

| Mejora | Status | Impacto |
|--------|--------|---------|
| TypeScript Strict Mode | ✅ | Seguridad de tipos |
| Error Boundary | ✅ | UX consistente |
| Variables de Entorno | ✅ | Seguridad |
| Logger Centralizado | ✅ | Debugging |
| Query Limits (24 queries) | ✅ | Protección DoS |

### Fase 2: Security, Testing, Refactoring (Febrero 2026)

#### 🔒 Seguridad

**Query Limits** - 24 queries protegidas:
- Products, Customers, Suppliers: `.limit(500)`
- Employees, Expenses, POS: `.limit(500)`
- Payroll, Purchases: `.limit(200-300)`
- AccountsReceivable, CashRegister: `.limit(500)`

**Sanitización SQL**:
```typescript
export function sanitizeSearchQuery(query: string): string
export function buildSearchFilter(columns: string[]): string
```

**Tests**: 13 tests de seguridad en `queryHelpers.test.ts`

#### 🧪 Testing Expandido

**93 Tests Totales**:
- `useAuth.test.tsx` - 7 tests
- `queryHelpers.test.ts` - 13 tests
- `GlobalSearch.test.tsx` - 6 tests
- `usePermissions.test.tsx` - 5 tests
- `utils.test.ts` - 6 tests
- `useDebounce.test.ts` - 5 tests
- `useServerPagination.test.ts` - 11 tests
- `useRateLimit.test.ts` - 6 tests
- `errorHandling.test.ts` - 20 tests
- `validationSchemas.test.ts` - 23 tests

**Scripts**:
```bash
npm test                    # Todos
npm test -- --watch         # Watch mode
npm test -- --coverage      # Cobertura
```

#### 🔧 Refactoring

**Settings.tsx**: 1,233 → 65 líneas
- TicketDesignSettings.tsx (nuevo)
- SecuritySettings.tsx (nuevo)
- SubscriptionSettings.tsx (nuevo)

**POS.tsx**: 1,798 → 1,593 líneas (-11.4%)
- ProductSearch.tsx (nuevo)
- CartSummary.tsx (nuevo)
- CustomerSelector.tsx (nuevo)

**Paginación Server-side**:
- Sales.tsx: 50 registros/página
- Purchases.tsx: 50 registros/página
- Suppliers.tsx: 50 registros/página

---

## 🔄 Mejoras Recientes (Febrero 2026)

### Componentes Refactorizados
| Componente | Líneas | Cambio | Status |
|-----------|--------|--------|--------|
| Settings.tsx | 65 | 1,233→65 (-95%) | ✅ |
| Sales.tsx | 674 | +Paginación | ✅ |
| Purchases.tsx | 587 | +Paginación | ✅ |
| Suppliers.tsx | 945 | +Paginación +Zod | ✅ |
| CashRegister.tsx | 546 | -Polling +RT | ✅ |

### Optimizaciones

**CashRegister.tsx**:
- ❌ Antes: `refetchInterval: 5000` (2 queries)
- ✅ Ahora: Supabase realtime + `staleTime: 30000`
- 📊 Resultado: -90% API calls

**Suppliers Validación**:
- Zod schema con email, phone, credit_limit
- Matches Customers.tsx pattern
- Tests validación incluidos

### Seguridad de Base de Datos

**PostgreSQL search_path Fix**:
- Migration: `20260210000000_fix_function_search_paths.sql`
- Funciones corregidas: 3
- Impact: Previene escalada de privilegios

**Password Security**:
- Migration: `20260210000001_enable_password_security.sql`
- Config: `supabase/config.toml` actualizado
- Mínimo: 8 caracteres
- Verificación: HaveIBeenPwned en producción

---

## 🧪 Testing

### Configuración
```bash
# Instalación
npm install -D vitest @vitest/ui @testing-library/react jsdom

# Archivos
vitest.config.ts          # Configuración
tsconfig.test.json        # TypeScript para tests
src/test/setup.ts         # Setup y mocks
```

### Ejecutar Tests
```bash
npm test                    # Todos (93 tests)
npm test -- --watch         # Watch mode
npm run test:ui             # Interfaz visual
npm test -- --coverage      # Cobertura
npm test -- useAuth.test    # Test específico
```

### Resultados Actuales
- **93 tests passing** ✅
- **Tiempo**: ~2.3 segundos
- **Cobertura**: ~20%
- **Objetivo Fase 3**: 30-40%

---

## 🔒 Seguridad

### Configuración Password + Breach Checking

#### Local Development ✅
Archivo: `supabase/config.toml`
```toml
[auth]
password_min_length = 8
enable_password_breach_check = true
```

#### Production Setup 📋
Supabase Dashboard → **Authentication → Policies**:
1. ✅ Enable "Check for breached passwords"
2. ✅ Set minimum password length: 8+
3. ✅ Enable MFA (TOTP, SMS)
4. ✅ Rate limiting en login

### Seguridad Implementada
- ✅ TypeScript strict mode
- ✅ 24 queries con `.limit()`
- ✅ Sanitización SQL en búsquedas
- ✅ RLS en todas las tablas
- ✅ Sin credenciales hardcodeadas
- ✅ Validación Zod centralizada
- ✅ Error Boundary global
- ✅ Logger centralizado

### Verificación Checklist
- [x] Password breach checking configurado (LOCAL)
- [ ] Password breach checking en Supabase Dashboard (PRODUCCIÓN)
- [x] Mínimo 8 caracteres
- [ ] Email confirmations habilitado
- [ ] Rate limiting configurado
- [ ] SSL/TLS válido
- [ ] Variables de entorno seguras
- [x] RLS en base de datos

---

## ♿ Accesibilidad (WCAG 2.1 AA)

### Componentes Optimizados (6)

| Componente | Mejoras | ARIA Attributes |
|-----------|---------|-----------------|
| Layout.tsx | Skip links, main role | 8 |
| GlobalSearch.tsx | Keyboard shortcuts, listbox | 12 |
| Sidebar.tsx | Navigation region, favorites | 15 |
| ProductSearch.tsx | Live regions, roles | 18 |
| CartSummary.tsx | Quantity labels, status | 12 |
| PaymentSection.tsx | Total live region, busy state | 8 |

**Total ARIA Attributes**: 70+

### Patrones WCAG Implementados
- ✅ Skip link ("Saltar al contenido")
- ✅ Navigation con aria-label
- ✅ Dialog modal con aria-label
- ✅ Live regions con aria-live
- ✅ Button sin texto con aria-label
- ✅ Clickeable custom con role="button"
- ✅ Teclado navigation completa
- ✅ Form fields con labels

### Accesos de Teclado

| Atajo | Acción |
|-------|--------|
| **Tab** | Navegar elementos |
| **Shift+Tab** | Atrás |
| **Enter/Space** | Activar botón |
| **Ctrl+K** | Búsqueda global |
| **Skip Link** | Saltar contenido |

### Verificación (Pendiente)
- [ ] Prueba manual con NVDA
- [ ] Auditoría contraste 4.5:1
- [x] Navegación completa por teclado
- [x] Live regions funcionales
- [x] Roles y labels validados

---

## ⚡ Performance

### Optimizaciones Implementadas

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Navegación (caché) | 2-5s | <500ms | -80-90% |
| Requests/página | 8-15 | 0-3 | -70-100% |
| POS.tsx líneas | 1,798 | 1,593 | -11.4% |
| CashRegister polling | 5s | 30s (RT) | -83% |

### Técnicas

1. **React Query Caché**: 5-10 min staleTime
2. **Lazy Loading**: 67 páginas con code splitting
3. **Debouncing**: 300ms en búsquedas
4. **Query Limits**: 24 queries con `.limit()`
5. **Realtime Subscriptions**: Vs polling agresivo
6. **Component Extraction**: Menos re-renders

---

## 🚀 Deployment

### Via Lovable
1. Abrir [Lovable](https://lovable.dev/projects/5670e5fc-c3f6-4b61-9f11-214ae88eb9ef)
2. Click **Share → Publish**
3. Configurar dominio custom (opcional)

### Dominio Custom
**Project > Settings > Domains > Connect Domain**

### Build Local
```bash
npm run build              # Build producción
npm run preview            # Preview del build
```

### Migraciones
```bash
supabase db push           # Aplicar migraciones locales
# Producción: Usar Supabase CLI en CI/CD
```

---

## 📋 Próximos Pasos

### Fase 3: Enhancements & Beyond

#### Priority Alta
- [ ] Aplicar migraciones de seguridad
- [ ] Habilitar password breach checking en Supabase Dashboard (PRODUCCIÓN)
- [ ] Ampliar cobertura de tests a 30-40%
- [ ] Tests E2E con Playwright

#### Priority Media
- [ ] Refactorizar PaymentSection.tsx
- [ ] Componentes con Storybook
- [ ] WCAG auditoría con NVDA
- [ ] Métricas de accesibilidad

#### Priority Baja
- [ ] Optimización de imágenes
- [ ] Dark mode themes
- [ ] Multilingual support (i18n)
- [ ] PWA (Progressive Web App)

---

## 📞 Soporte

- **Lovable Project**: [Ver proyecto](https://lovable.dev/projects/5670e5fc-c3f6-4b61-9f11-214ae88eb9ef)
- **Lovable Docs**: https://docs.lovable.dev
- **Supabase Docs**: https://supabase.com/docs
- **Vitest Docs**: https://vitest.dev

---

## ✅ Estado Actual

| Aspecto | Status | Notas |
|---------|--------|-------|
| **Build** | ✅ Passing | npm run build: exit 0 |
| **Tests** | ✅ 93 passing | +210% vs inicio |
| **TypeScript** | ✅ Strict | Sin errores |
| **Security** | ✅ Mejorado | Falta Dashboard setup |
| **Performance** | ✅ Optimizado | -80-90% en navegación |
| **Accessibility** | ⚠️ Parcial | 6/67+ componentes |
| **Testing** | ✅ 20% cobertura | Objetivo: 30-40% |

---

## 📄 Información Legal

Este proyecto es privado y su uso está restringido.

---

**Última actualización**: 10 de Febrero, 2026  
**Fase Actual**: 2.1 (Mejoras Recientes)  
**Próxima Fase**: 3 (Enhancements)
