# Agenda Luna - C0 Admin Operations Delivery (2026-05-06)

## Objetivo de esta entrega

Convertir el admin en una herramienta operativa minima para secretaria/admin,
sin cambiar stack ni introducir infraestructura fuera de v1.

## Resumen de alcance implementado

### Backend admin

Se implementaron endpoints en `server/routes/admin.route.js` para:

- CRUD de terapeutas:
  - `POST /api/admin/therapists`
  - `PATCH /api/admin/therapists/:id`
- Servicios por terapeuta:
  - `PUT /api/admin/therapists/:id/services`
- Horario semanal simple de terapeuta:
  - `GET /api/admin/therapists/:id/schedule`
  - `PUT /api/admin/therapists/:id/schedule`
- CRUD de servicios:
  - `POST /api/admin/services`
  - `PATCH /api/admin/services/:id`
- CRUD de salas:
  - `POST /api/admin/rooms`
  - `PATCH /api/admin/rooms/:id`
- Catalogo admin:
  - `GET /api/admin/catalog`
- Disponibilidad admin (para flujo de cita manual):
  - `POST /api/admin/availability`
- Citas admin:
  - `POST /api/admin/appointments`
  - `GET /api/admin/appointments/:id`
  - `PATCH /api/admin/appointments/:id/status`
  - `PATCH /api/admin/appointments/:id/reschedule`

### Regla critica de operacion (doble reserva)

- Crear/reagendar cita manual usa el mismo motor de disponibilidad y claims.
- No se inserta cita directa saltando validacion.
- Se mantiene garantia de no doble reserva con claims MySQL por recurso/minuto.
- Cambios de estado terminal (`completed`, `cancelled`, `no_show`) liberan claims.
- Se registran eventos en `audit_logs` para cambios de estado y reschedule.

### Frontend admin

Se conectaron vistas y flujos reales:

- Control:
  - Nueva cita funcional (drawer)
  - Consulta de disponibilidad
  - Confirmacion de cita manual
  - Click en cita abre detalle
  - Acciones: completar, cancelar, no-show
  - Reagendar/cambiar terapeuta/sala con validacion backend
- Clientes:
  - Nuevo cliente funcional
  - Editar cliente funcional
  - Timeline refrescado despues de guardar
- Terapeutas:
  - Nuevo terapeuta
  - Editar terapeuta
  - Guardar porcentaje/comision
  - Asignar servicios
  - Guardar horario semanal simple
- Ajustes:
  - Tabs: Centro, Servicios, Salas, Pagos/QR, Mensajes
  - Centro funcional (guardar)
  - Servicios funcional: crear/editar/activar/desactivar
  - Salas funcional: crear/editar/activar/desactivar
  - Pagos/QR y Mensajes marcados como proximos

### Componentes base UI agregados

En `apps/admin/src/components/ui/`:

- `Drawer.jsx`
- `Modal.jsx`
- `FormFields.jsx`
- `SaveBar.jsx`
- `FeedbackBanner.jsx`
- `EmptyState.jsx`

## Diseno y UX aplicados

- CSS plano con variables (sin Tailwind).
- Phosphor Icons como libreria unica de iconos.
- Botones sin accion real removidos o deshabilitados de forma explicita.
- Estados de carga, error y vacio implementados.
- Sidebar con brand mark/logo visible.
- Sin cards dentro de cards como patron dominante en vistas operativas.

## Tests agregados

Archivo nuevo:

- `test/admin-operations.test.js`

Casos cubiertos (`node:test`):

- Crear/editar cliente
- Crear/editar terapeuta
- Asignar servicios a terapeuta
- Guardar horario semanal
- Crear/editar servicio
- Crear/editar sala
- Crear cita admin sin doble reserva
- Rechazar cita admin si terapeuta o sala estan tomados
- Cambiar estado de cita y registrar audit log

## Validacion ejecutada

Comandos corridos en esta entrega:

```bash
npm test
npm run build
npm start
curl -s http://127.0.0.1:3000/api/health
```

Resultado:

- `npm test`: OK
- `npm run build`: OK
- `npm start`: OK
- `/api/health`: OK

## Archivos principales modificados

- `server/routes/admin.route.js`
- `apps/admin/src/App.jsx`
- `apps/admin/src/views/ControlView.jsx`
- `apps/admin/src/views/ClientsView.jsx`
- `apps/admin/src/views/TherapistsView.jsx`
- `apps/admin/src/views/SettingsView.jsx`
- `apps/admin/src/components/Sidebar.jsx`
- `apps/admin/src/components/Topbar.jsx`
- `apps/admin/src/styles/app.css`
- `apps/admin/src/styles/tokens.css`
- `apps/admin/src/components/ui/*` (nuevos)
- `test/admin-operations.test.js` (nuevo)

## Fuera de alcance en esta entrega

- Redis/BullMQ
- Cambios de stack (Next/Nest/Tailwind/Prisma/Drizzle)
- Funcionalidad completa de Pagos/QR y Mensajes en Ajustes
- Automatizacion visual e2e (Playwright)
