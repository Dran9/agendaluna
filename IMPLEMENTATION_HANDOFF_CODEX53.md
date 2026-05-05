# Implementacion Agenda Luna - handoff para Codex 5.3

## 1. Rol

Eres la instancia implementadora. Tu objetivo es crear el codigo inicial de Agenda Luna en este folder.

No continues Super Agenda. No portes su monorepo. No uses `superagenda.md` como especificacion activa.

## 2. Contexto

Agenda Luna v1 corre en Hostinger Web/Node.js. No usar VPS como requisito inicial.

La version VPS futura puede agregar Redis/BullMQ, pero v1 debe funcionar sin eso.

## 3. Stack Obligatorio

- Node.js + Express.
- MySQL/MariaDB con `mysql2`.
- React + Vite para admin y booking.
- CSS plano + variables.
- Phosphor Icons.
- Zod.
- JWT.
- Google Vision API.
- WhatsApp Cloud API.
- Telegram Bot API.

No usar:

- NestJS;
- Redis;
- BullMQ;
- Tailwind;
- shadcn;
- Prisma/Drizzle en v1;
- Socket.IO;
- Next.js.

## 4. Primer Entregable Esperado

Crear scaffold funcional:

```txt
package.json
server/index.js
server/db/pool.js
server/db/migrate.js
server/db/migrations/0001_core.sql
server/routes/*
server/services/*
apps/admin/*
apps/booking/*
shared/*
test/*
```

Scripts minimos:

```json
{
  "start": "node server/index.js",
  "dev:server": "node --watch server/index.js",
  "dev:admin": "vite apps/admin --host 127.0.0.1 --port 5173",
  "dev:booking": "vite apps/booking --host 127.0.0.1 --port 5174",
  "build": "npm run build:admin && npm run build:booking",
  "build:admin": "vite build apps/admin --outDir ../../dist/admin --emptyOutDir",
  "build:booking": "vite build apps/booking --outDir ../../dist/booking --emptyOutDir",
  "migrate": "node server/db/migrate.js",
  "test": "node --test \"test/**/*.test.js\""
}
```

Ajusta scripts si Vite exige otra forma, pero conserva la intencion: una app Node que sirva builds estaticos.

## 5. Orden De Trabajo

### Fase 0 - Base

1. Crear package y estructura.
2. Crear pool MySQL con:
   - `dns.setDefaultResultOrder('ipv4first')`;
   - `timezone: '-04:00'`;
   - `SET time_zone = '-04:00'` por conexion.
3. Crear migrador SQL simple.
4. Crear `env.js` con lectura validada de variables.
5. Crear health endpoint.

### Fase 1 - DB Core

Crear migracion inicial con:

- centers;
- center_settings;
- files;
- admin_users;
- services;
- therapists;
- therapist_services;
- rooms;
- service_rooms;
- resource_schedules;
- resource_blocks;
- clients;
- appointments;
- appointment_resource_claims;
- payments;
- wa_messages;
- scheduled_jobs;
- round_robin_state;
- telegram_links;
- audit_logs;
- idempotency_keys.

### Fase 2 - Motor De Disponibilidad

Servicios:

- `availability.service.js`
- `roundRobin.service.js`
- `claims.service.js`
- `locks.service.js`

Implementar:

- listar slots por servicio/fecha;
- filtrar por terapeuta opcional;
- validar sala compatible;
- validar horarios;
- validar bloqueos;
- validar claims;
- recomendar terapeuta;
- confirmar cita con transaccion e idempotencia.

Tests obligatorios:

- no permite doble reserva de terapeuta;
- no permite doble reserva de sala;
- permite dos citas simultaneas si terapeutas y salas son distintos;
- respeta terapeuta elegido;
- round-robin avanza al siguiente terapeuta disponible.

### Fase 3 - Booking Publico

Endpoints:

- `GET /api/public/catalog`
- `POST /api/public/availability`
- `POST /api/public/identify`
- `POST /api/public/hold`
- `POST /api/public/confirm`
- `POST /api/public/manage-token`
- `POST /api/public/reschedule`
- `POST /api/public/cancel`
- `POST /api/public/support-request`

UI:

- primera pantalla con logo y servicios;
- elegir terapeuta;
- buscar guia por WhatsApp;
- calendario;
- slots;
- datos minimos;
- confirmacion.

### Fase 4 - Admin

Endpoints internos con JWT:

- Control: citas por rango, acciones de cita, pagos pendientes.
- Clientes: CRUD, timeline.
- Terapeutas: CRUD, servicios, horarios, excepciones, porcentajes.
- Finanzas: resumen, pagos, corte por terapeuta.
- Ajustes: centro, logo, servicios, salas, QR, templates.

UI:

- shell Twilight;
- Control;
- Clientes;
- Terapeutas;
- Finanzas;
- Ajustes.

### Fase 5 - WhatsApp/OCR/Telegram

Implementar adapters:

- `messaging/whatsappLive.adapter.js`
- `messaging/testOutbox.adapter.js`
- `ocr/googleVision.service.js`
- `telegram/telegram.service.js`

Endpoints:

- `GET /api/webhook/whatsapp`
- `POST /api/webhook/whatsapp`
- `POST /api/admin/payments/:id/manual-verify`
- `POST /api/admin/therapists/:id/telegram-link`

## 6. Diseno

Leer `DESIGN_BRIEF_AGENDA_LUNA.md` y `design.md` antes de tocar UI.

Crear primero:

- tokens CSS;
- componentes base;
- mock data;
- pantallas estaticas;
- despues conectar API.

La UI no puede parecer plantilla. Si una pantalla parece generica, detener y corregir antes de agregar features.

Si hay herramienta de generacion visual disponible, crear conceptos para las pantallas principales antes de codificar. Si no la hay, crear mockups estaticos HTML/CSS primero y revisarlos en navegador. No saltar directo a CRUD funcional sin direccion visual.

QA visual minimo:

- revisar booking en mobile y desktop;
- revisar admin en desktop;
- revisar dark/light mode;
- verificar que el logo real o placeholder de logo no rompa layout;
- corregir overflow, wrapping torpe, botones desalineados y estados vacios pobres.

## 7. Hostinger

Reglas de deploy:

- Express sirve `/admin` desde `dist/admin`.
- Express sirve `/` o `/booking` desde `dist/booking`.
- No asumir build remoto.
- El build puede commitearse o subirse segun flujo real de Hostinger.
- Variables sensibles solo en `.env`, nunca en codigo.

Variables esperadas:

```env
PORT=3000
NODE_ENV=production
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
WA_TOKEN=
WA_PHONE_ID=
WA_VERIFY_TOKEN=
META_APP_SECRET=
GOOGLE_VISION_API_KEY=
TELEGRAM_BOT_TOKEN=
MESSAGING_PROVIDER=test_outbox
```

## 8. Criterios De Aceptacion Inicial

El primer corte se considera bueno si:

- `npm test` pasa;
- `npm run build` pasa;
- migraciones corren en DB local;
- booking muestra servicios y logo;
- booking devuelve slots reales con terapeuta+sala;
- confirmar cita crea claims de terapeuta y sala;
- admin Control muestra cita creada;
- Terapeutas muestra metricas basicas;
- Finanzas muestra pago pendiente;
- WhatsApp esta en `test_outbox`;
- UI revisada en desktop y mobile.

## 9. Prohibiciones

- No resolver disponibilidad con Google Calendar.
- No crear cita si no hay sala.
- No dejar llamadas directas a Meta/Telegram dispersas en rutas.
- No hardcodear Luna Mandala en logica; debe venir de settings/seed.
- No usar `superagenda.md` como fuente activa.
- No convertir `App.jsx` en archivo gigante.
- No implementar features futuras antes del MVP.
