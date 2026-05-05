# Agenda Luna

Agenda Luna es una agenda boutique para centros terapeuticos pequenos: varios terapeutas, varios servicios, salas limitadas, pagos por comprobante y comunicacion por WhatsApp/Telegram.

No es una version reducida de Super Agenda. Es un producto nuevo con otra restriccion principal: debe correr primero en **Hostinger Web/Node.js**, no en VPS. La arquitectura debe ser liviana hoy y migrable manana.

## Documentos

- `AGENDA_LUNA_PRODUCT_ARCHITECTURE.md`: producto, alcance, arquitectura y modelo de datos.
- `DESIGN_BRIEF_AGENDA_LUNA.md`: aplicacion de `design.md` a Agenda Luna.
- `IMPLEMENTATION_HANDOFF_CODEX53.md`: instrucciones directas para que Codex 5.3 implemente.
- `ROADMAP_ENGINEERING_PLAN.md`: fases, gates y riesgos de ejecucion.
- `design.md`: lenguaje visual activo.
- `superagenda.md`: deprecado; conservar solo como referencia historica.

## Decision De Producto

Agenda Luna v1 resuelve lo minimo valioso con alta calidad:

- booking publico mobile-first;
- seleccion por servicio o terapeuta;
- sugerencia automatica de terapeuta;
- round-robin simple;
- salas como recurso interno;
- Control para secretaria/admin;
- pagina de terapeutas con metricas y porcentaje economico;
- pagos, QR, comprobantes y OCR;
- WhatsApp para clientes;
- Telegram para terapeutas.

## Decision Tecnica

v1 corre en Hostinger Web/Node.js:

- Node.js + Express;
- MySQL/MariaDB;
- React + Vite;
- cron interno en el proceso Node;
- jobs persistidos en MySQL;
- locks con MySQL `GET_LOCK`;
- claims por minuto en MySQL;
- sin Redis/BullMQ todavia.

La app debe quedar preparada para v2 en Hostinger VPS:

- `locks` cambia de MySQL a Redis;
- `jobs` cambia de tabla MySQL a BullMQ;
- `worker` se separa del proceso API;
- Google Calendar sigue siendo espejo opcional;
- MySQL sigue siendo la verdad operacional.
