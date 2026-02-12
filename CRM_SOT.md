# CRM — SOT (Single Source of Truth)

Documento vivo para ingeniería y producto. Resume arquitectura, cambios por fases y funcionalidades visibles para usuarios.

---

## Alcance
Este documento cubre el módulo CRM: oportunidades, pipelines, etiquetas, actividades, vistas guardadas, filtros, acciones masivas, exportaciones y performance.

---

## Arquitectura (resumen técnico)

### Capas
- **UI**: componentes y páginas React.
- **Domain**: DTOs, mappers, services, validaciones (Zod).
- **Data**: repositorios Supabase (queries y mapping).
- **DB**: migraciones SQL con tablas, índices y RLS.

### Rutas principales
- CRM > Oportunidades
- CRM > Pipelines (kanban)

---

## Fase 0 — Base arquitectónica

### Objetivo
Unificar modelo y validaciones, separar dominio/datos/UI y resolver inconsistencias históricas.

### Entregado (Dev)
- DTOs + mappers + repos + services en dominio CRM.
- Schemas Zod para validación de oportunidades, pipelines, tags, actividades.
- Refactor de `OpportunityDrawer` y `OpportunitiesList` para usar services y DTOs.

### Archivos clave
- Dominio: `src/domain/crm/dtos/*`, `src/domain/crm/mappers/*`, `src/domain/crm/services/*`, `src/domain/crm/validation/*`
- Datos: `src/data/crm/*`

### Funcionalidad para usuario
- Edición/creación de oportunidades más estable.
- Datos consistentes en formularios y listados.

---

## Fase 1 — Actividades e historial

### Objetivo
Agregar seguimiento operativo dentro de oportunidades.

### Entregado (Dev)
- Tablas `crm_activities` y `crm_activity_log` con RLS e índices.
- CRUD de actividades (crear/editar/eliminar) y log de acciones.
- Tabs en `OpportunityDrawer`: Detalles / Actividad / Historial.

### Archivos clave
- DB: `supabase/migrations/20260211_create_crm_activities.sql`
- UI: `src/components/crm/OpportunityDrawer.tsx`
- Dominio: `src/domain/crm/dtos/activity*`, `mappers`, `services`, `validation`

### Funcionalidad para usuario
- Registrar llamadas, emails, tareas, reuniones y notas.
- Ver historial de acciones en la oportunidad.

---

## Fase 2 — Funcionalidades avanzadas

### Objetivo
Mejorar productividad con vistas guardadas, filtros persistentes, acciones masivas y exportación.

### Entregado (Dev)
- Vistas guardadas por usuario/empresa (`crm_saved_views`).
- Barra de filtros con persistencia en URL.
- Selección masiva + modal de edición masiva.
- Exportación CSV/XLS con filtros activos.

### Archivos clave
- DB: `supabase/migrations/20260211_create_crm_saved_views.sql`
- UI: `src/pages/Opportunities.tsx`, `src/components/crm/OpportunitiesList.tsx`

### Funcionalidad para usuario
- Guardar vistas con filtros y recuperarlas luego.
- Filtrar por pipeline, etapa, responsable, status, fechas y monto.
- Editar o eliminar oportunidades en bloque.
- Exportar resultados filtrados a Excel/CSV.

---

## Fase 3 — Performance y escalabilidad

### Objetivo
Reducir latencia y carga en listados y kanban.

### Entregado (Dev)
- Índices en `crm_opportunities`.
- Conteo estimado en listados.
- Select de columnas específicas (sin `select(*)`).
- Prefetch pipelines/owners/tags y menos refetch.
- Virtualización en `OpportunitiesList`.
- Memoización y normalización de filtros.

### Archivos clave
- DB: `supabase/migrations/20260211_add_crm_opportunities_indexes.sql`
- Repos: `src/data/crm/opportunityRepository.ts`, `src/data/crm/pipelineRepository.ts`
- UI: `src/components/crm/OpportunitiesList.tsx`, `src/components/crm/OpportunityDrawer.tsx`, `src/pages/Opportunities.tsx`

### Funcionalidad para usuario
- Listados más rápidos, menor latencia y scroll fluido.
- Menos recargas al cambiar pestañas/ventanas.

---

## Fase 4 — Automatizaciones (SLA / auto-assign / reminders)

### Objetivo
Automatizar reglas por etapa para reducir trabajo manual y mejorar cumplimiento de SLA.

### Entregado (Dev)
- Tabla `crm_stage_rules` con RLS, índices y trigger `updated_at`.
- Columna `sla_due_at` en `crm_opportunities`.
- Servicio de reglas por etapa con upsert, listado y aplicación automática.
- Aplicación automática de reglas en creación y cambio de etapa.
- UI de reglas por etapa en Pipelines (SLA, auto-asignación, recordatorio).
- Notificaciones in-app + email para eventos CRM.

### Archivos clave
- DB: `supabase/migrations/20260211_create_crm_stage_rules.sql`
- DB: `supabase/migrations/20260211_add_crm_notification_preferences.sql`
- Dominio: `src/domain/crm/dtos/stageRule.ts`, `mappers/stageRuleMapper.ts`, `services/stageRuleService.ts`, `validation/stageRuleSchema.ts`
- Dominio: `src/domain/crm/services/crmNotificationService.ts`
- Datos: `src/data/crm/stageRuleRepository.ts`
- UI: `src/components/crm/Pipelines.tsx`
- UI: `src/components/NotificationCenter.tsx`, `src/pages/NotificationSettings.tsx`

### Funcionalidad para usuario
- Definir SLA por etapa (días).
- Auto-asignar responsable al ingresar a una etapa.
- Crear recordatorios automáticos asociados al SLA.
- Recibir notificaciones en la app y por email sobre eventos CRM.

---

## Fase 5 — Integraciones (Email / WhatsApp / Calendario)

### Objetivo
Integrar envío y tracking de mensajes con plantillas y logs centralizados.

### Entregado (Dev)
- Tablas de plantillas y logs de mensajes CRM.
- Edge Function `send-crm-message` para envíos email/WhatsApp.
- UI de envío desde oportunidad con selección de plantilla.
- Logs visibles en la oportunidad con estado (queued/sent/failed).
- Calendario: pendiente de integración.
- Credenciales WhatsApp (Twilio) por empresa con UI.
- Tab dedicado de Mensajes en la oportunidad.

### Archivos clave
- DB: `supabase/migrations/20260211_create_crm_message_templates_logs.sql`
- DB: `supabase/migrations/20260211_create_crm_whatsapp_credentials.sql`
- Función: `supabase/functions/send-crm-message/index.ts`
- Dominio: `src/domain/crm/dtos/messageTemplate.ts`, `messageLog.ts`, `services/messageTemplateService.ts`, `services/messageLogService.ts`
- UI: `src/components/crm/OpportunityDrawer.tsx`
- UI: `src/pages/NotificationSettings.tsx`

### Funcionalidad para usuario
- Enviar emails o WhatsApp desde la oportunidad.
- Guardar y reutilizar plantillas.
- Ver historial de envíos y estados.

---

## Fase 6 — Scoring de oportunidades

### Objetivo
Asignar puntajes automáticos según reglas configurables para priorizar oportunidades.

### Entregado (Dev)
- Tabla `crm_scoring_rules` con RLS e índices.
- Columnas `score_total` y `score_updated_at` en `crm_opportunities`.
- Servicio de reglas de scoring con cálculo y recálculo masivo.
- Cálculo automático en creación/edición de oportunidades.
- UI para crear/editar/eliminar reglas y forzar recálculo.
- Columna de score en la lista de oportunidades.

### Archivos clave
- DB: `supabase/migrations/20260211_create_crm_scoring_rules.sql`
- Dominio: `src/domain/crm/dtos/scoringRule.ts`, `mappers/scoringRuleMapper.ts`, `services/scoringRuleService.ts`, `validation/scoringRuleSchema.ts`
- Datos: `src/data/crm/scoringRuleRepository.ts`
- UI: `src/components/crm/ScoringRules.tsx`, `src/components/crm/Pipelines.tsx`, `src/components/crm/OpportunitiesList.tsx`

### Funcionalidad para usuario
- Definir reglas por campo (monto, probabilidad, etapa, estado, fuente, tags).
- Ver score en listado de oportunidades.
- Recalcular scores en un click.

---

## Fase 7 — Reporting (Dashboards y embudos)

### Objetivo
Visualizar KPIs y embudos por pipeline para monitorear desempeño comercial.

### Entregado (Dev)
- Dashboard de KPIs CRM (totales, valor, tasa de cierre, ciclo promedio).
- Gráfico de valor por pipeline.
- Embudos por pipeline con conteo por etapa.
- Filtro por rango de fechas (rápido y personalizado).

### Archivos clave
- UI: `src/pages/CrmReports.tsx`
- UI: `src/components/layout/Sidebar.tsx`
- Router: `src/App.tsx`

### Funcionalidad para usuario
- Consultar KPIs de oportunidades filtrados por fecha.
- Comparar valor total por pipeline.
- Ver el embudo por etapa dentro de cada pipeline.

---

## Fase 8 — Seguridad y observabilidad (Roles CRM)

### Objetivo
Restringir acceso a datos CRM según roles owner/team/manager y reforzar RLS.

### Entregado (Dev)
- Funciones SQL de ayuda para rol y acceso a oportunidades.
- RLS extendido por rol en oportunidades y entidades relacionadas.
- Restricción de escritura para reglas y credenciales sensibles.

### Archivos clave
- DB: `supabase/migrations/20260211_add_crm_security_rls_roles.sql`

### Funcionalidad para usuario
- Owner solo ve y edita oportunidades asignadas.
- Team ve oportunidades de su compañía.
- Manager/admin con acceso completo.

---

## Notas operativas
- Las selecciones masivas se persisten en `localStorage` por empresa.
- Exportaciones respetan filtros activos.
- Las actividades registran log de acciones para auditoría interna.

---

## Pendiente opcional (próximos pasos sugeridos)
- Prefetch de páginas siguientes en listados.
- Ajustes finos de virtualización por altura dinámica de filas.

---

## Mantenimiento del documento
Actualizar este archivo ante cambios en:
- esquema de DB CRM,
- contratos de DTOs y services,
- experiencia de usuario (filtros, vistas, acciones masivas, exportaciones).
