# Changelog

Todas las fechas estan en formato ISO (`YYYY-MM-DD`).
Este archivo registra cambios funcionales por fase, no cada commit individual.

## 2026-05-06 - Fase C0 - Admin Operations Minimo

### Added

- Backend admin operativo para terapeutas:
  - `POST /api/admin/therapists`
  - `PATCH /api/admin/therapists/:id`
  - `PUT /api/admin/therapists/:id/services`
  - `GET /api/admin/therapists/:id/schedule`
  - `PUT /api/admin/therapists/:id/schedule`
- Backend admin operativo para catalogo:
  - `POST /api/admin/services`
  - `PATCH /api/admin/services/:id`
  - `POST /api/admin/rooms`
  - `PATCH /api/admin/rooms/:id`
  - `GET /api/admin/catalog`
- Backend admin operativo para disponibilidad/citas:
  - `POST /api/admin/availability`
  - `POST /api/admin/appointments`
  - `GET /api/admin/appointments/:id`
  - `PATCH /api/admin/appointments/:id/status`
  - `PATCH /api/admin/appointments/:id/reschedule`
- Componentes UI base en `apps/admin/src/components/ui/`:
  - `Drawer.jsx`
  - `Modal.jsx`
  - `FormFields.jsx`
  - `SaveBar.jsx`
  - `FeedbackBanner.jsx`
  - `EmptyState.jsx`
- Test backend nuevo:
  - `test/admin-operations.test.js`

### Changed

- `apps/admin/src/views/ControlView.jsx`:
  - `Nueva cita` funcional con disponibilidad real.
  - Detalle de cita en drawer.
  - Acciones reales: `completed`, `cancelled`, `no_show`.
  - Reagendar/cambiar terapeuta/sala con validacion de disponibilidad y claims.
- `apps/admin/src/views/ClientsView.jsx`:
  - `Nuevo cliente` funcional.
  - Edicion de cliente funcional.
- `apps/admin/src/views/TherapistsView.jsx`:
  - Crear/editar terapeuta.
  - Asignacion de servicios.
  - Horario semanal simple.
- `apps/admin/src/views/SettingsView.jsx`:
  - Tabs operativos `Centro`, `Servicios`, `Salas`.
  - CRUD funcional para servicios y salas (crear/editar/activar/desactivar).
  - `Pagos/QR` y `Mensajes` visibles como proximos.
- `apps/admin/src/components/Topbar.jsx`:
  - Ayuda/notificaciones deshabilitadas con estado explicito.
- `apps/admin/src/components/Sidebar.jsx`:
  - Soporte de brand name/logo real del centro.
- `apps/admin/src/styles/app.css` y `apps/admin/src/styles/tokens.css`:
  - Ajustes de estilo para patron Twilight operativo, estados de carga/error/vacio y formularios/drawers.

### Safety And Business Rules

- Se mantiene MySQL como fuente de verdad operacional.
- Crear/reagendar cita manual reutiliza motor de disponibilidad + claims.
- No se introdujo Redis/BullMQ.
- Google Calendar no se usa como fuente de disponibilidad.

### Validation

- `npm test`: OK
- `npm run build`: OK
- `npm start`: OK
- `curl -s http://127.0.0.1:3000/api/health`: OK

### Related Docs

- `C0_ADMIN_OPERATIONS_DELIVERY_2026-05-06.md`
