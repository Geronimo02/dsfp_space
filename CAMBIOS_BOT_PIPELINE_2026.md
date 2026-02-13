# Cambios recientes en el proyecto (13/02/2026)

## 1. Pipeline de Solicitudes de Bots Personalizados

### Migraciones SQL
- **Nueva migración:**
  - [supabase/migrations/20260211200000_bot_implementation_requests.sql](supabase/migrations/20260211200000_bot_implementation_requests.sql):
    - Crea la tabla `bot_implementation_requests` para gestionar el pipeline de solicitudes de bots personalizados.
    - Crea la tabla `bot_request_activity_log` para el historial de actividades de cada solicitud.
    - Define el enum `bot_request_status` para los estados del pipeline.
    - Políticas RLS para control de acceso y triggers para logging y timestamps.
  - [supabase/migrations/20260211210000_ai_conversations.sql](supabase/migrations/20260211210000_ai_conversations.sql):
    - Crea tablas para historial de conversaciones de IA (`ai_conversations` y `ai_conversation_messages`).
    - Políticas RLS y triggers para manejo seguro y actualizado de conversaciones.

### Tipos y Configuración
- **Nuevo archivo de tipos:**
  - [src/types/botRequests.ts](src/types/botRequests.ts):
    - Define los tipos TypeScript para solicitudes, actividad y formulario de bots.
    - Exporta la configuración de etapas del pipeline (`BOT_REQUEST_STAGES`).

## 2. Componentes de UI para el Pipeline

- **Nuevo diálogo de solicitud:**
  - [src/components/contact/ContactUsDialog.tsx](src/components/contact/ContactUsDialog.tsx):
    - Formulario para que usuarios soliciten un bot personalizado.
    - Maneja validaciones, envío y feedback visual.

- **Detalle de solicitud y pipeline:**
  - [src/components/contact/BotRequestDetailDialog.tsx](src/components/contact/BotRequestDetailDialog.tsx):
    - Muestra detalles, historial y permite avanzar etapas del pipeline (admin).
    - Soporta edición de notas, presupuesto, QA, activación, etc.

- **Badge de estado:**
  - [src/components/contact/BotRequestStatusBadge.tsx](src/components/contact/BotRequestStatusBadge.tsx):
    - Muestra el estado de la solicitud con color e ícono.

- **Página de gestión:**
  - [src/pages/BotImplementationRequests.tsx](src/pages/BotImplementationRequests.tsx):
    - Página principal para ver, filtrar y gestionar solicitudes de bots.
    - Incluye cards de pipeline, filtros, listado y acceso a los diálogos anteriores.

## 3. Backend/Funcionalidad

- **Función Supabase:**
  - [supabase/functions/ai-assistant/index.ts](supabase/functions/ai-assistant/index.ts):
    - Refactor y ampliación de la función para análisis de negocio y chat IA.
    - Ahora soporta historial de conversaciones y contexto extendido.
    - Mejoras en prompts, manejo de errores y logging.

## 4. Resumen de nuevas funcionalidades
- Pipeline completo para solicitudes de bots personalizados (formulario, gestión, actividad, estados).
- Soporte para admins y usuarios finales.
- Historial de actividad y logging automático de cambios de estado.
- Integración con Supabase y políticas de seguridad (RLS).
- UI moderna y adaptada a flujos reales de negocio.

---

**Archivos principales modificados o agregados:**
- [supabase/migrations/20260211200000_bot_implementation_requests.sql](supabase/migrations/20260211200000_bot_implementation_requests.sql)
- [supabase/migrations/20260211210000_ai_conversations.sql](supabase/migrations/20260211210000_ai_conversations.sql)
- [src/types/botRequests.ts](src/types/botRequests.ts)
- [src/components/contact/ContactUsDialog.tsx](src/components/contact/ContactUsDialog.tsx)
- [src/components/contact/BotRequestDetailDialog.tsx](src/components/contact/BotRequestDetailDialog.tsx)
- [src/components/contact/BotRequestStatusBadge.tsx](src/components/contact/BotRequestStatusBadge.tsx)
- [src/pages/BotImplementationRequests.tsx](src/pages/BotImplementationRequests.tsx)
- [supabase/functions/ai-assistant/index.ts](supabase/functions/ai-assistant/index.ts)

Si necesitás el detalle de cada archivo, avísame.