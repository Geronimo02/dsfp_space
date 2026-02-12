# Manual de Usuario — CRM

Guía práctica para usar todas las funcionalidades actuales del módulo CRM.

---

## 1) Acceso al CRM

Desde el menú principal:
- **CRM > Oportunidades**
- **CRM > Pipelines**
- **CRM > Reporting**

> Nota: el acceso puede variar según tu rol (owner/team/manager/admin).

---

## 2) Oportunidades

### 2.1 Crear oportunidad
1. Ir a **CRM > Oportunidades**.
2. Click en **Nueva oportunidad**.
3. Completar campos (nombre, email, teléfono, pipeline, etapa, valor, probabilidad, etc.).
4. Guardar.

**Campos clave**:
- **Email** y **Teléfono**: obligatorios para crear/editar.
- **Pipeline** y **Etapa**: determinan el flujo comercial (pueden quedar vacíos).
- **Valor**: monto estimado.
- **Probabilidad**: % de cierre.
- **Responsable**: dueño de la oportunidad.
- **Tags**: clasificación flexible.

### 2.2 Editar oportunidad
- Click en el nombre de la oportunidad para abrir el panel.
- Editar los campos necesarios y guardar.

### 2.3 Estado y cierre
- **Ganado/Perdido** puede definirse desde la oportunidad.
- El sistema usa este estado en KPIs y reporting.

### 2.4 Score
- El listado incluye la columna **Score**.
- El score se calcula por reglas (ver sección 6).

---

## 3) Filtros, vistas y exportación

### 3.1 Filtros
Podés filtrar por:
- Pipeline
- Etapa
- Responsable
- Estado
- Rango de fechas
- Monto

### 3.2 Vistas guardadas
- Guardá filtros con un nombre y recuperalos más tarde.

### 3.3 Acciones masivas
1. Seleccioná múltiples oportunidades.
2. Usá **Edición masiva** para:
   - Cambiar etapa
   - Cambiar responsable
   - Agregar tag
3. **Eliminar** oportunidades seleccionadas si tenés permisos.

### 3.4 Exportación
- Exportá resultados filtrados a **CSV** o **XLSX**.

---

## 4) Actividades e Historial

### 4.1 Actividades
Dentro de una oportunidad:
- Registrar **llamadas**, **emails**, **tareas**, **reuniones** y **notas**.
- Agregar fecha de vencimiento y detalles.

### 4.2 Historial
- Accedé al **Historial** para ver cambios relevantes y eventos.

---

## 5) Pipelines (Kanban)

### 5.1 Gestión de pipelines
- Crear nuevos pipelines con sus etapas.
- Editar nombre y etapas.
- Eliminar pipelines si corresponde.

### 5.2 Tablero Kanban
- Visualizá oportunidades por etapa.
- Arrastrá y soltá para mover entre etapas.
- Creá oportunidades rápidas por etapa.
- Asigná oportunidades existentes a un pipeline.

---

## 6) Automatizaciones (SLA / Auto-assign / Recordatorios)

Configuración en **CRM > Pipelines**:
- **SLA por etapa**: define fecha límite.
- **Auto-asignar responsable**: asignación automática al entrar en etapa.
- **Recordatorio**: crea tarea automática antes del SLA.

---

## 7) Notificaciones

Recibirás alertas in-app y por email sobre:
- Cambios de etapa
- Asignaciones automáticas
- Recordatorios generados

Configurable en **Notificaciones**.

---

## 8) Mensajes (Email / WhatsApp)

Dentro de una oportunidad:
- **Enviar mensajes** usando plantillas.
- **Historial de envíos** con estado (queued/sent/failed).
- **WhatsApp** requiere credenciales de Twilio por empresa.

---

## 9) Scoring de oportunidades

En **CRM > Pipelines**:
- Crear reglas por **monto**, **probabilidad**, **etapa**, **estado**, **fuente** o **tags**.
- Asignar **puntos** y activar/desactivar reglas.
- **Recalcular** scores manualmente si es necesario.

---

## 10) Reporting (KPIs y Embudos)

En **CRM > Reporting**:
- **KPIs**: total de oportunidades, valor total, tasa de cierre, ciclo promedio.
- **Valor por pipeline** (gráfico).
- **Embudo por pipeline** (conteo por etapa).
- **Filtro por fechas** (rápido o personalizado).

---

## 11) Roles y permisos (Seguridad)

- **Owner**: ve y edita solo sus oportunidades.
- **Team**: ve oportunidades de su empresa.
- **Manager/Admin**: acceso completo.

Roles disponibles en el sistema: **owner**, **team**, **manager**, **admin**.

> La asignación de roles se realiza a nivel empresa desde **Ajustes > Roles CRM**.

---

## 12) Observabilidad (Errores)

- Errores críticos se reportan con Sentry.
- Logs estructurados para diagnóstico.

---

## 13) Buenas prácticas

- Usá **pipelines y etapas** consistentes para reportes claros.
- Definí **SLA y recordatorios** por etapa para seguimiento.
- Configurá **scoring** para priorizar oportunidades.
- Usá **vistas guardadas** para flujos repetitivos.

---

## 14) Solución de problemas

- Si no ves oportunidades: revisá permisos/rol.
- Si falta WhatsApp: configurá credenciales en Notificaciones.
- Si el score no actualiza: usá **Recalcular scores**.

---

