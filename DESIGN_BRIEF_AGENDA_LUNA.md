# Agenda Luna - brief de diseno

## 1. Fuente Visual

`design.md` es la guia visual activa. Describe el lenguaje Twilight: indigo profundo, violeta suave, slates frios, dark mode real, layout estable y una sensacion de calma trabajando.

Para Agenda Luna, Twilight se usa como base, pero debe sentirse mas boutique, sensible y premium que una herramienta corporativa generica.

## 2. Objetivo Comercial Del Diseno

El diseno debe ser un argumento de venta.

Cuando un centro vea Agenda Luna debe sentir:

- esto no es una plantilla barata;
- el booking publico puede representar bien a mi centro;
- el admin es bello pero operativo;
- la experiencia guia al cliente sin confusion;
- el sistema entiende la realidad de terapeutas, salas y pagos.

## 3. Identidad Marca Blanca

Desde el primer dia debe existir espacio claro para logo y marca:

- logo en booking publico;
- brand mark en sidebar admin;
- nombre del centro en topbar/admin;
- favicon configurable;
- colores opcionales por centro, sin romper la base Twilight;
- texto de bienvenida configurable.

Para Luna Mandala, el primer viewport debe dar protagonismo a:

- logo Luna Mandala;
- nombre Luna Mandala;
- servicios terapeuticos;
- accion de guia por WhatsApp.

## 4. Booking Publico

Debe ser mobile-first, elegante y muy claro.

Primera pantalla:

- header compacto con logo;
- nombre del centro como senal principal;
- seleccion por servicio como accion primaria;
- opcion de elegir terapeuta;
- boton secundario "Buscar guia" hacia WhatsApp;
- acceso discreto a "Gestionar mi cita".

No debe sentirse como landing page ni como marketing. Es una herramienta de reserva hermosa.

### Estado Servicio Seleccionado

Cuando el cliente elige servicio:

- mostrar terapeuta recomendado en una tarjeta/panel claro;
- explicar en una linea: "Disponible para este servicio y horario";
- permitir cambiar terapeuta;
- luego calendario y slots.

### Estado Guia

"Buscar guia" abre WhatsApp con texto prellenado:

```txt
Hola, quisiera orientacion para elegir una terapia en Luna Mandala.
```

Registrar evento interno si el usuario ya estaba identificado.

## 5. Admin

Admin usa shell Twilight:

- sidebar de 80px;
- topbar compacta;
- contenido amplio;
- Phosphor icons;
- dark/light mode;
- CSS variables;
- sin Tailwind.

Menu:

- Control
- Clientes
- Terapeutas
- Finanzas
- Ajustes

## 6. Control

Control es la pantalla mas importante.

Debe responder rapido:

- que pasa hoy;
- que citas necesitan accion;
- que comprobantes llegaron;
- que salas estan ocupadas;
- que pagos faltan;
- que terapeuta tiene proxima sesion.

Layout sugerido:

- columna principal: timeline/lista de citas del dia;
- rail lateral: salas y ocupacion;
- banda superior: KPIs operativos compactos;
- drawer de cita para detalle.

No sobrecargar con graficos. Control es operacion, no analytics.

## 7. Terapeutas

La pagina Terapeutas debe ser mas que CRUD.

Debe mostrar:

- lista/directorio de terapeutas;
- sesiones del mes;
- ingresos generados;
- porcentaje Luna;
- estimado terapeuta;
- servicios ofrecidos;
- alertas de disponibilidad;
- estado Telegram.

El detalle del terapeuta debe permitir:

- perfil publico;
- servicios;
- horarios;
- excepciones;
- porcentajes;
- datos de contacto;
- Telegram.

## 8. Finanzas

Finanzas debe ser simple y entendible:

- total ingresado;
- pendiente;
- verificado;
- por terapeuta;
- porcentaje Luna;
- porcentaje terapeuta;
- comprobantes en revision.

No construir contabilidad formal en v1.

## 9. Componentes Visuales

Usar los tokens de `design.md`.

Componentes iniciales:

- `AppShell`
- `Sidebar`
- `Topbar`
- `BrandMark`
- `Button`
- `IconButton`
- `Card`
- `Panel`
- `Badge`
- `Input`
- `Select`
- `Tabs`
- `Drawer`
- `Modal`
- `EmptyState`
- `AppointmentRow`
- `TherapistCard`
- `PaymentStatusBadge`
- `RoomRail`

## 10. Reglas Duras

- No Tailwind.
- No Lucide.
- No Material Icons.
- No webfonts.
- No emojis en UI, salvo banderas en selector de pais si se usa.
- No gradientes en botones.
- No paginas con hero marketing antes de la experiencia real.
- No cards dentro de cards.
- No inventar paletas beige/espirituales genericas.
- No usar `superagenda.md` como diseno.

## 11. Proceso De UI Para Codex 5.3

Antes de implementar pantallas finales:

1. Crear mockups estaticos o conceptos visuales de:
   - booking primera pantalla;
   - booking servicio seleccionado;
   - admin Control;
   - Terapeutas;
   - Finanzas.
2. Verificar que respetan `design.md`.
3. Confirmar que hay espacio real para logo.
4. Implementar componentes base.
5. Implementar pantallas.
6. Levantar dev server.
7. Revisar desktop y mobile con navegador.
8. Corregir cualquier sensacion amateur antes de seguir agregando features.

