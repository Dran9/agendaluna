# Agenda Luna - roadmap de coordinacion

## 1. Norte

Agenda Luna debe salir rapido sin verse barata. La ventaja competitiva no sera tener mas features que todos, sino resolver bien el flujo real de un centro pequeno: agenda, salas, terapeutas, pagos y comunicacion.

## 2. Fases

### Fase A - Cimientos vendibles

Objetivo: que la app exista, se vea como producto y tenga motor real.

Entregables:

- scaffold Node/Express + React/Vite;
- migraciones;
- seed Luna Mandala;
- design system Twilight aplicado;
- booking publico estatico con logo;
- admin shell;
- motor disponibilidad probado.

Gate:

- no doble reserva de terapeuta;
- no doble reserva de sala;
- booking no parece plantilla;
- logo visible y configurable.

### Fase B - Reserva real

Objetivo: que una persona pueda reservar de punta a punta.

Entregables:

- catalogo;
- disponibilidad por servicio;
- recomendacion de terapeuta;
- confirmacion;
- pago pendiente;
- Control muestra la cita;
- test_outbox WhatsApp.

Gate:

- cita creada con claims;
- round-robin avanza;
- errores de slot ocupado son claros;
- mobile booking usable.

### Fase C - Operacion diaria

Objetivo: secretaria/admin puede operar un dia real.

Entregables:

- Control con citas de hoy;
- cambiar estado;
- crear cita manual;
- cambiar sala/terapeuta con validacion;
- pagos pendientes;
- drawer de cita;
- audit log visible en detalle.

Gate:

- no se puede guardar conflicto;
- cada override pide motivo;
- flujo operativo no obliga a saltar entre paginas.

### Fase D - Terapeutas y economia

Objetivo: Luna ve que terapeuta produce que, y cuanto queda para el centro.

Entregables:

- Terapeutas CRUD;
- servicios por terapeuta;
- horarios/excepciones;
- porcentaje Luna/terapeuta;
- metricas por periodo;
- Finanzas por terapeuta.

Gate:

- se puede explicar el corte economico en una pantalla;
- los numeros salen de citas/pagos reales;
- no hay contabilidad formal innecesaria.

### Fase E - WhatsApp/OCR/Telegram

Objetivo: automatizar lo que mas quita tiempo.

Entregables:

- WhatsApp webhook;
- templates base;
- recordatorios;
- QR/instrucciones;
- recepcion de comprobantes;
- OCR Google Vision;
- cola de revision manual;
- Telegram agenda diaria para terapeutas.

Gate:

- ningun test envia WhatsApp real;
- comprobante dudoso va a revision;
- Telegram no expone datos clinicos sensibles.

### Fase F - Hardening Hostinger

Objetivo: dejar listo para produccion barata.

Entregables:

- env docs;
- build estatico servido por Express;
- logs razonables;
- health endpoint;
- rate limits publicos;
- backup/export basico;
- checklist deploy Hostinger.

Gate:

- arranca con `npm start`;
- migraciones idempotentes;
- `npm test` y `npm run build` pasan;
- modo `MESSAGING_PROVIDER=test_outbox` funciona.

## 3. Riesgos Principales

- Convertir Agenda Luna en Super Agenda antes de vender.
- Hacer UI funcional pero visualmente comun.
- Depender de Google Calendar para disponibilidad.
- Subestimar salas.
- Meter Redis/BullMQ antes de necesitarlos.
- No probar concurrencia de reservas.
- Hardcodear Luna Mandala y perder reventa.

## 4. Decisiones Que No Debe Tomar La Instancia Implementadora Sin Consultar

- Cambiar stack a Next/Nest/Tailwind.
- Agregar Redis/BullMQ en v1.
- Quitar claims por minuto.
- Hacer salas opcionales si el centro tiene salas.
- Convertir Google Calendar en fuente de disponibilidad.
- Reducir Terapeutas a CRUD sin metricas economicas.
- Cambiar el lenguaje visual de `design.md`.

## 5. Senales De Que Vamos Bien

- El booking se entiende sin instrucciones.
- El admin muestra lo importante del dia en menos de 5 segundos visuales.
- El logo del centro se siente parte natural del producto.
- La secretaria puede corregir una sala sin miedo.
- El terapeuta recibe informacion suficiente por Telegram sin entrar al admin.
- Daniel puede venderlo mostrando diseno y flujo, no solo promesas tecnicas.

