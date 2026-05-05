# Agenda Luna - producto y arquitectura

## 1. Que Es

Agenda Luna es una app de agendamiento para centros terapeuticos pequenos y medianos que necesitan vender y operar sesiones con varios terapeutas y salas limitadas.

El primer cliente objetivo es Luna Mandala. El mismo producto debe poder venderse a otros centros pequenos cambiando logo, nombre, colores, textos, servicios, terapeutas, salas y politicas.

## 2. Que No Es

Agenda Luna no es Super Agenda reducida.

Super Agenda apunta a instalaciones mas grandes en Hostinger VPS, con Redis/BullMQ, workers separados, modulos avanzados y mas infraestructura.

Agenda Luna v1 apunta a Hostinger Web/Node.js: costo bajo, despliegue simple, menos piezas, salida rapida al mercado.

## 3. Principios

1. La disponibilidad real se calcula en DB propia.
2. Google Calendar es espejo opcional, nunca fuente de verdad.
3. Las salas no son decision del cliente; son recurso interno.
4. El booking debe sugerir terapeuta cuando el cliente elige servicio.
5. El round-robin debe ser simple, explicable y corregible manualmente.
6. La secretaria/admin opera desde Control, no saltando entre modulos.
7. El diseno es parte del valor comercial.
8. La arquitectura debe permitir migrar a VPS sin reescribir la app.

## 4. Superficies

### Booking Publico

Mobile-first. Primera pantalla:

- logo del centro;
- nombre del centro;
- lista de servicios destacados;
- opcion "Elegir terapeuta";
- boton "Buscar guia" que abre WhatsApp con texto prellenado;
- accion para gestionar/reagendar/cancelar una cita existente.

Flujo por servicio:

1. Cliente elige servicio.
2. Backend calcula candidatos reales: terapeuta compatible + sala compatible + disponibilidad.
3. UI muestra una recomendacion: "Te ofrecemos trabajar con {terapeuta}".
4. Cliente acepta o cambia terapeuta.
5. Cliente elige fecha/hora.
6. Cliente deja WhatsApp y datos minimos.
7. Backend confirma cita, claims y pago pendiente.
8. WhatsApp envia confirmacion, QR/instrucciones y recordatorios.

### Admin

Menu inicial:

- Control
- Clientes
- Terapeutas
- Finanzas
- Ajustes

No crear "Salas" como pagina principal en v1. Las salas viven en Control y Ajustes.

### Telegram Terapeutas

Canal B2B interno con terapeutas:

- agenda del dia;
- avisos de nuevas citas;
- avisos de cambios/cancelaciones;
- bloqueo simple de disponibilidad;
- mini app futura para gestion de tiempos.

No enviar informacion clinica sensible por Telegram.

## 5. Alcance MVP

### Booking

- catalogo publico de servicios;
- elegir servicio;
- elegir terapeuta;
- sugerencia automatica;
- disponibilidad por terapeuta+sala;
- hold corto opcional con `GET_LOCK`;
- confirmacion con idempotencia;
- gestion de cita existente con token expirable;
- boton de guia a WhatsApp.

### Control

- citas de hoy;
- proximas citas;
- pagos pendientes;
- comprobantes recibidos;
- conflictos de sala/terapeuta;
- crear cita manual;
- cambiar terapeuta o sala con validacion;
- marcar completada, cancelada, no-show;
- drawer de cita con cliente, terapeuta, sala, pago, WhatsApp y audit trail.

### Clientes

- crear/editar cliente;
- buscar por nombre/telefono;
- historial de citas;
- pagos;
- timeline de eventos;
- notas internas.

### Terapeutas

- crear terapeuta;
- foto/logo/avatar;
- bio publica corta;
- servicios ofrecidos;
- disponibilidad semanal;
- excepciones;
- porcentaje/comision que deja al centro;
- sesiones del periodo;
- ingresos generados;
- monto estimado para Luna y para terapeuta;
- estado Telegram.

### Finanzas

- ingresos por periodo;
- pagos pendientes/verificados/rechazados;
- comprobantes OCR;
- corte por terapeuta;
- porcentaje Luna/terapeuta;
- export CSV.

### Ajustes

- datos del centro;
- logo;
- servicios;
- salas;
- QR/cuentas destino;
- politicas de cancelacion/reagendamiento;
- templates WhatsApp;
- usuarios admin.

## 6. Stack

Un solo repo y un solo package root para simplificar Hostinger.

```txt
agenda-luna/
  server/
    index.js
    db/
      pool.js
      migrate.js
      migrations/
    routes/
    services/
    jobs/
    adapters/
    utils/
  apps/
    admin/
    booking/
    telegram-mini/
  shared/
  test/
  package.json
```

Tecnologias:

- Node.js + Express;
- MySQL/MariaDB con `mysql2`;
- React + Vite;
- CSS plano con variables;
- Phosphor Icons;
- Zod para validacion;
- JWT para admin;
- Google Vision API;
- WhatsApp Cloud API;
- Telegram Bot API.

## 7. Preparacion Para VPS

Crear interfaces/adaptadores desde el inicio:

```txt
locks.service
  v1: MySQL GET_LOCK
  v2: Redis SET NX EX

jobs.service
  v1: tabla scheduled_jobs + setTimeout/cron interno
  v2: BullMQ + worker separado

messaging.service
  v1: WhatsApp live/test_outbox/log_only
  v2: igual, pero con cola

calendarMirror.service
  v1: job interno
  v2: worker BullMQ
```

La regla importante: Redis/BullMQ mejoran velocidad y resiliencia, pero no reemplazan la garantia de MySQL contra doble reserva.

## 8. Modelo De Datos Inicial

Usar migraciones SQL desde el primer dia.

Tablas core:

- `centers`
- `center_settings`
- `admin_users`
- `files`
- `services`
- `therapists`
- `therapist_services`
- `rooms`
- `service_rooms`
- `resource_schedules`
- `resource_blocks`
- `clients`
- `appointments`
- `appointment_resource_claims`
- `payments`
- `wa_messages`
- `scheduled_jobs`
- `round_robin_state`
- `telegram_links`
- `audit_logs`
- `idempotency_keys`

### Claims Por Minuto

Tabla clave:

```sql
CREATE TABLE appointment_resource_claims (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  center_id INT UNSIGNED NOT NULL,
  appointment_id INT UNSIGNED NOT NULL,
  resource_type ENUM('therapist','room') NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  claim_time DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_resource_minute (center_id, resource_type, resource_id, claim_time),
  KEY idx_appointment (appointment_id)
);
```

Regla v1: esta tabla contiene solo claims activos. Al cancelar, reagendar, completar o liberar una cita, borrar sus claims en la misma transaccion. El historial vive en `audit_logs`, no en esta tabla.

Motivo: Hostinger puede usar MariaDB y los unique con `NULL` o generated columns varian por version. Claims activos + borrado transaccional es mas simple y mas portable.

## 9. Algoritmo De Disponibilidad

Entrada:

- servicio;
- fecha;
- terapeuta opcional;
- duracion;
- hora candidata.

Validacion:

1. Servicio activo.
2. Terapeutas activos que ofrecen servicio.
3. Salas activas compatibles con servicio.
4. Horario del terapeuta.
5. Horario de sala.
6. Bloqueos de terapeuta/sala.
7. Claims existentes.
8. Antelacion minima y ventana de reserva.

Salida:

- slots reales;
- terapeuta recomendado;
- sala asignada internamente;
- razones simples para UI/admin.

## 10. Round-Robin Simple

No hacer IA ni fairness complejo en v1.

Para cada servicio:

1. Obtener candidatos reales para el slot.
2. Ordenar terapeutas por `round_robin_order`, luego `id`.
3. Leer `round_robin_state.last_therapist_id`.
4. Empezar desde el siguiente terapeuta disponible.
5. Si hay empate, preferir menor carga del periodo actual.
6. Confirmada la cita, actualizar `round_robin_state`.

Reglas:

- Si el cliente eligio terapeuta, se respeta si hay sala disponible.
- Si admin hace override, se registra motivo.
- Si terapeuta no tiene disponibilidad, no entra en el round-robin.

## 11. WhatsApp Y OCR

WhatsApp es canal principal para pacientes:

- confirmacion de cita;
- instrucciones/QR de pago;
- recordatorio;
- comprobante entrante;
- rechazo o validacion de comprobante;
- guia humana.

OCR:

- Google Vision extrae texto;
- parser reconoce monto, fecha, referencia, destinatario/cuenta;
- si coincide con pago pendiente, marcar `verified`;
- si hay duda, `needs_review`;
- si contradice monto/destinatario/fecha, `rejected` o `needs_review` segun severidad.

## 12. Criterios De No Alcance

No implementar en v1:

- Redis;
- BullMQ;
- Socket.IO;
- drag-and-drop avanzado;
- recurrencia semanal compleja;
- Super Agenda Control;
- multi-tenant self-service;
- IA conversacional;
- contabilidad formal;
- reportes enterprise.
