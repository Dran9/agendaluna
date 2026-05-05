# Agenda Luna - instrucciones para agentes Codex

## Fuente de verdad

Leer en este orden:

1. `README.md`
2. `AGENDA_LUNA_PRODUCT_ARCHITECTURE.md`
3. `DESIGN_BRIEF_AGENDA_LUNA.md`
4. `IMPLEMENTATION_HANDOFF_CODEX53.md`
5. `design.md`

`superagenda.md` queda deprecado para este proyecto. Puede usarse solo como contexto historico de origen, nunca como especificacion activa.

## Decision central

Agenda Luna no es Super Agenda reducida. Es una app nueva, Hostinger Node.js-first, para centros terapeuticos pequenos con varios terapeutas y salas limitadas.

La distincion comercial y tecnica es:

- Agenda Luna v1: Hostinger Web/Node.js, Express, MySQL, React/Vite, cron interno, sin Redis.
- Agenda Luna v2 o Super Agenda: Hostinger VPS, procesos separados, Redis/BullMQ, workers dedicados y mas infraestructura.

## Reglas tecnicas

- MySQL/MariaDB es la fuente de verdad para citas, salas, terapeutas, pagos y disponibilidad.
- Google Calendar es espejo opcional outbound. Nunca decide disponibilidad.
- Redis no existe en v1. Preparar adaptadores para migrar locks/jobs a Redis/BullMQ despues.
- La garantia contra doble reserva vive en claims MySQL por recurso/minuto.
- No implementar recurrencia compleja en v1.
- No crear arquitectura enterprise si no resuelve una necesidad real de Luna Mandala.
- No copiar el monorepo de Super Agenda.
- Reusar ideas de agenda4.0 donde encajen con Hostinger: Express, MySQL, cron interno, WhatsApp, OCR, Telegram Mini App.

## Reglas de diseno

- `design.md` es la guia visual activa.
- Usar CSS plano con variables, no Tailwind.
- Usar Phosphor Icons, no mezclar librerias.
- Reservar espacio visible para logo/brand mark del centro desde el primer dia.
- Booking publico debe ser mobile-first y sentirse premium.
- Admin debe ser operativo, claro y bello, no una plantilla generica.
- Antes de implementar UI grande, crear/validar mockups o pantallas estaticas de referencia.

## Alcance esperado de la primera implementacion

Crear una base funcional, no una demo decorativa:

- Booking publico con eleccion por servicio, por terapeuta y boton de guia por WhatsApp.
- Motor de disponibilidad con terapeuta + sala.
- Round-robin simple y explicable.
- Admin con Control, Clientes, Terapeutas, Finanzas y Ajustes.
- Pagos con comprobantes, OCR Google Vision y revision manual.
- WhatsApp webhook, recordatorios y mensajes base.
- Telegram para terapeutas como canal interno inicial.

