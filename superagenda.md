# DEPRECADO PARA AGENDA LUNA

Este documento queda conservado solo como contexto historico. No es la especificacion activa de Agenda Luna.

La fuente de verdad actual para Agenda Luna es:

1. `README.md`
2. `AGENDA_LUNA_PRODUCT_ARCHITECTURE.md`
3. `DESIGN_BRIEF_AGENDA_LUNA.md`
4. `IMPLEMENTATION_HANDOFF_CODEX53.md`
5. `design.md`

Agenda Luna v1 no debe implementar la arquitectura completa de Super Agenda. Debe ser Hostinger Web/Node.js-first, con MySQL como verdad, sin Redis/BullMQ en v1 y preparada para migracion futura a Hostinger VPS.

---

# Super Agenda
> Plan tecnico y de producto para una agenda modular, marca blanca e instalable por centro terapeutico.
> Fecha base: 2026-04-27.

---

## 1. Vision

**Super Agenda** es una plataforma configurable para centros terapeuticos que necesitan vender, agendar, administrar y cobrar sesiones con terapeutas, salas, clientes, pagos y comunicacion automatizada.

El producto no pertenece a ningun centro especifico. Cada cliente comercial recibe una instalacion propia del codebase, adaptada por configuracion, branding, modulos activos y pequenos ajustes de negocio cuando sean necesarios.

La idea arquitectonica es un edificio con cimientos estables:

- El **core** sostiene identidad, permisos, clientes, servicios, terapeutas, disponibilidad, citas, pagos basicos, integraciones y auditoria.
- Los **modulos** agregan funciones como salas, finanzas, CRM avanzado, insights, inbox, retencion, IA o monitoreo sin romper el core.
- La **marca blanca** permite cambiar nombre, logo, colores, textos, moneda, zona horaria, politicas, cuentas de pago, tono de comunicacion y apariencia visual sin tocar codigo.

---

## 2. Decisiones Base

### 2.0.1 Regla operativa vigente (2026-05-04)

- La fuente de verdad para slots, bloqueos, salas, terapeutas y citas es la DB de Super Agenda.
- Google Calendar queda como espejo opcional outbound para visibilidad del terapeuta.
- Ninguna lectura de FreeBusy o evento externo debe decidir disponibilidad en el motor core.
- Si el espejo externo falla, la cita sigue confirmada y operativa en DB.

### 2.0 Vocabulario del producto

Para evitar confusion entre lenguaje de usuario y arquitectura interna:

- **Paginas:** items visibles en el menu admin: Control, Clientes/CRM, Equipo, Finanzas, Insights y Ajustes.
- **Paneles:** bloques dentro de una pagina o drawers que se abren para mostrar detalle.
- **Paquetes internos:** unidades tecnicas del codebase, por ejemplo `availability-engine`, `rooms`, `payments`, `calendar-google`, `crm`.
- **Modulos comerciales:** capacidades activables por tier o instalacion. No necesariamente aparecen como item del menu.
- **Tiers:** planes comerciales o paquetes vendidos a cada centro.

Regla UX:

El admin debe sentir una app simple de 5-6 paginas. El codebase puede tener muchos paquetes internos si eso mantiene cimientos limpios.

Regla nueva:

**Agenda** y **Salas** no son paginas principales. Sus capacidades viven dentro de **Control**, que funciona como centro de operaciones del secretario. **Hoy** es solo la vista interna inicial de Control, enfocada en el dia actual. Internamente siguen existiendo `appointments`, `operations`, `rooms`, `availability` y `payments`, pero el usuario no debe saltar entre paginas para operar una cita.

### 2.1 No multitenant

Super Agenda no sera multitenant en esta etapa.

Cada centro terapeutico tendra:

- Su propia instalacion.
- Su propia base MySQL.
- Su propio Redis.
- Sus propias credenciales de Google, WhatsApp, OCR y proveedores opcionales.
- Su propio dominio/subdominio.
- Su propia configuracion de marca y modulos.

Esto reduce riesgo operativo, simplifica soporte, evita mezclar datos de clientes y permite vender personalizaciones sin contaminar el producto base.

### 2.2 Marca blanca, no forks conceptuales

Aunque cada venta pueda tener cambios propios, el producto debe mantener una arquitectura comun. Las diferencias normales deben resolverse por:

- `brand_settings`
- `system_settings`
- `feature_flags`
- `module_registry`
- `skins`
- `ui_settings`
- permisos por rol
- adaptadores de integraciones
- textos configurables

Solo se modifica codigo por cliente cuando el requerimiento realmente cambia una regla de negocio que no conviene generalizar.

### 2.2.1 Venta artesanal e instalacion por cliente

Super Agenda se vendera inicialmente de manera artesanal, no como SaaS masivo.

Modelo operativo:

- Se parte de un codebase poderoso y comun.
- Cada centro recibe instalacion propia.
- Cada centro tiene MySQL, Redis, `.env`, dominio, marca, modulos y credenciales separadas.
- Daniel puede hacer ajustes especificos por cliente cuando el contrato lo requiera.
- Las integraciones se activan manualmente o semiautomaticamente durante onboarding.

Esto implica que el producto debe tener dos capas:

1. **Base reusable:** arquitectura, modulos, migraciones, workers, UI, roles, integraciones y contratos de datos.
2. **Capa de instalacion:** configuracion, credenciales, marca, textos, modulos activos, reglas comerciales y pequenos overrides.

No se busca que cualquier persona se registre sola y empiece como en un SaaS comun. Se busca vender, instalar, configurar y dejar funcionando una instancia por centro.

#### 2.2.1.1 Instalador asistido

Debe existir un script o CLI de instalacion para evitar trabajo manual repetitivo.

Ejemplo:

```txt
pnpm superagenda init-client
```

El instalador debe pedir o recibir:

- nombre del centro
- dominio/subdominio
- timezone
- moneda
- modulos activos
- datos de MySQL
- datos de Redis
- claves de OCR/IA si aplica
- credenciales WhatsApp/Meta
- credenciales Google OAuth
- calendario oficial del centro
- emails/admins iniciales
- skin inicial

Y debe generar:

- `.env.production`
- `client.config.json`
- `brand_settings`
- `module_flags`
- migraciones ejecutadas
- usuario owner inicial
- health check de integraciones
- checklist de onboarding

#### 2.2.1.2 Credenciales e integraciones

Las credenciales deben vivir fuera del codigo.

Integraciones por instalacion:

- Google Calendar
- Google Sheets
- Google Contacts si se usa
- WhatsApp Cloud API / Meta
- OCR
- IA opcional si se activa alguna capacidad futura
- adaptadores de mensajeria de prueba

Regla:

El codebase debe usar adaptadores y settings tipados. Cambiar proveedor o credencial no debe requerir tocar logica central.

#### 2.2.1.2.1 Adaptadores de mensajeria y pruebas

WhatsApp real debe usarse con cuidado. Para desarrollar, probar onboarding, revisar templates y validar flujos sin tocar Meta/WhatsApp real ni arriesgar bloqueos, el sistema debe soportar adapters intercambiables:

- `whatsapp_live`: envia por Meta/WhatsApp Cloud API real.
- `whatsapp_sandbox`: usa entorno sandbox si el proveedor lo ofrece.
- `test_outbox`: guarda mensajes renderizados en una bandeja interna de pruebas.
- `log_only`: registra payloads y variables sin enviar nada.

Reglas:

- Ningun test automatizado debe enviar WhatsApp real.
- El instalador debe poder dejar una instancia en `MESSAGING_PROVIDER=test_outbox`.
- El admin/soporte debe poder ver la bandeja de pruebas con destinatario, template, variables, payload renderizado y estado simulado.
- Los webhooks entrantes tambien deben poder simularse para probar comprobantes, reagendamientos y respuestas.
- Antes de activar `whatsapp_live`, el centro debe pasar checklist de templates, numeros, permisos, webhooks y mensajes de prueba.
- `test_outbox` no reemplaza audit log ni `message_render_logs`; es una herramienta de QA/onboarding.

#### 2.2.1.3 OAuth Google en etapa artesanal

Para la etapa inicial se puede usar OAuth 2.0 con un Google Cloud Project controlado por Daniel.

Flujo deseado:

1. owner del centro entra a una URL de autorizacion.
2. autoriza calendarios/sheets/contactos necesarios.
3. Super Agenda guarda refresh token cifrado.
4. el instalador valida acceso a calendario oficial.
5. el admin asigna `calendar_id` a cada terapeuta.

Advertencia:

Usar una app Google en modo testing puede servir para primeras instalaciones controladas, pero tiene limites operativos: usuarios de prueba, pantallas de advertencia, posible expiracion/restriccion segun scopes y menor profesionalismo. Si el numero de clientes crece, conviene verificar/publicar la app OAuth o crear proyecto Google por cliente.

#### 2.2.1.4 Optimizar onboarding

Para que la venta artesanal no se vuelva insoportable, cada instalacion debe terminar con un checklist:

- API levantada
- worker levantado
- MySQL conectado
- Redis conectado
- Google OAuth valido
- calendario oficial detectado
- WhatsApp Cloud API responde
- templates de mensaje configurados
- skin aplicado
- booking publico probado
- cita de prueba creada
- evento GCal creado
- recordatorio de prueba enviado
- backup configurado

### 2.2.2 Super Agenda Control

Debe existir una app separada para Daniel: **Super Agenda Control**.

No es una pagina dentro del admin de cada centro. Es una consola central para gestionar todas las instalaciones vendidas de forma artesanal.

Objetivo:

- ver salud tecnica de cada instalacion
- detectar urgencias antes de que el centro escriba
- centralizar bugs, incidentes y soporte
- ver estado de Meta/WhatsApp, Google, OCR, workers, backups, dominios y versiones
- reducir necesidad de entrar manualmente a cada VPS o admin

Esto no contradice la regla de no multitenant. Las instalaciones siguen aisladas:

- DB propia
- Redis propio
- `.env` propio
- dominio propio
- credenciales propias
- marca y configuracion propia

Super Agenda Control solo guarda metadata tecnica y operativa minima. No debe copiar clientes, notas clinicas, comprobantes, conversaciones completas, pagos detallados ni informacion sensible del centro.

#### 2.2.2.1 Agente de salud por instalacion

Cada instalacion debe incluir un agente liviano de soporte, por ejemplo `support-agent` u `ops-agent`.

Responsabilidades:

- enviar heartbeat periodico a Super Agenda Control
- reportar version instalada y fecha de deploy
- reportar health checks de API, worker, MySQL, Redis y storage
- reportar estado resumido de Google Calendar, WhatsApp/Meta, OCR y colas
- reportar ultimo backup y resultado de restore check si existe
- agrupar errores repetidos para no generar ruido

Payload permitido:

- `instance_id`
- nombre publico del centro
- dominio
- timezone
- version/build
- modulos activos
- estado por componente
- severidad
- codigo de error normalizado
- timestamp
- trazas tecnicas redacted/anonymized

Payload prohibido:

- notas clinicas
- conversaciones completas de WhatsApp
- comprobantes de pago
- telefonos completos de clientes
- nombres de pacientes/clientes salvo que el centro autorice soporte puntual
- credenciales o tokens

#### 2.2.2.2 Roles y visibilidad de avisos

La misma falla debe tener distinto nivel de lectura segun quien la mira.

| Falla | Daniel en Super Agenda Control | Owner/admin del centro | Secretaria |
|---|---|---|---|
| Meta token vencido | detalle tecnico, instancia, webhook, ultimo error | "WhatsApp necesita reconexion" | "WhatsApp no esta enviando; usar contacto manual" |
| Template rechazado por Meta | nombre tecnico, razon, payload redacted | "Un mensaje necesita aprobacion/correccion" | no ve nada salvo impacto en citas de hoy |
| Google OAuth invalido | refresh/scope/sync error redacted | "Google Calendar requiere reconexion" | "Hay citas con sincronizacion pendiente" |
| Worker detenido | cola, job, ultimo error, version | "Automatizaciones demoradas" | "Recordatorios pendientes; revisar manualmente" |

El secretario del centro no debe interpretar Meta Health, OAuth, webhooks, colas, rate limits ni errores de proveedor. Solo debe ver consecuencias operativas cuando necesita actuar.

#### 2.2.2.3 Funciones iniciales de Super Agenda Control

Version minima:

- listado de instalaciones
- estado global: ok, warning, critical, offline
- filtros por centro, version, proveedor afectado y severidad
- timeline de incidentes por instalacion
- notas internas de soporte
- checklist de onboarding por centro
- historial de deploy/version
- estado de backups
- health checks manuales bajo demanda
- links seguros al admin de cada instancia

Acciones remotas futuras, solo si se implementan con seguridad:

- reintentar jobs fallidos
- pedir nuevo health check
- marcar incidente como conocido
- registrar tarea de soporte
- abrir flujo de reconexion para Google/Meta
- verificar backup

No debe permitir acciones peligrosas sin confirmacion, audit log y permisos propios del panel central.

### 2.3 Skins visuales

La parte visual debe ser muy modificable. No basta con cambiar logo y color primario.

Super Agenda debe tener un sistema de **skins**: paquetes de apariencia que cambian la expresion visual sin cambiar la logica del producto.

Un skin puede controlar:

- paleta completa
- tipografias
- radios
- densidad de UI
- sombras/bordes
- estilo de botones
- estilo de cards
- tono de iconografia
- fondos del booking publico
- estilo del calendario
- layout del hero o bienvenida
- estilo del admin
- modo claro/oscuro si aplica

El skin no debe cambiar reglas de negocio. Cambia presentacion, jerarquia visual y sensacion de marca.

Niveles de personalizacion:

1. **Brand basics:** logo, nombre, colores, favicon.
2. **Theme tokens:** paleta extendida, tipografia, radios, spacing, sombras.
3. **Skin preset:** combinacion completa de tokens y layouts.
4. **Client overrides:** ajustes pequenos por instalacion.

El booking publico debe sentirse totalmente propio de cada centro. El admin puede mantener una base mas consistente, pero tambien debe aceptar skins y densidades segun el cliente.

### 2.4 Responsividad por superficie

No todos los modulos deben ser responsivos al mismo nivel.

Politica:

- **Booking publico:** mobile-first obligatorio. Debe funcionar perfecto en celular.
- **Control operativa:** responsive hasta tablet/celular cuando sea razonable: operar citas del dia, salas, pagos, alertas, no-shows, buscar cliente y crear cita.
- **Modulos densos:** pueden ser desktop/tablet-first: finanzas, reportes, configuracion avanzada, builder de templates, administracion de permisos.
- **Secretaria:** debe funcionar muy bien en desktop/tablet; version movil solo para acciones basicas si aporta valor.
- **Owner/admin avanzado:** puede requerir pantalla grande para tareas complejas.

Esto evita gastar complejidad en hacer que pantallas naturalmente densas entren en un celular de forma mediocre. En vez de eso, cada modulo declara su soporte de viewport.

Cada modulo debe declarar:

```txt
responsive_profile: public_mobile | operational_responsive | desktop_first | desktop_only
```

El frontend debe mostrar avisos elegantes cuando una pantalla sea desktop-first y se abra en celular, ofreciendo acciones moviles alternativas si existen.

### 2.5 MySQL como verdad y calendario externo como espejo

La fuente de verdad operacional es interna.

**MySQL es la verdad de negocio y operacion:**

- clientes
- terapeutas
- servicios
- salas
- citas
- estados de pago
- permisos
- modulos activos
- auditoria
- configuracion
- historico financiero

**Google Calendar queda como espejo visible opcional para terapeutas:**

- si esta habilitado, cada cita confirmada se refleja hacia su calendario externo
- el terapeuta puede ver sus horas desde Google Calendar en su celular
- el sistema no depende de una app movil propia
- los bloqueos manuales operativos viven en Super Agenda (DB), no en FreeBusy

La disponibilidad efectiva se calcula combinando:

1. horarios configurados en MySQL
2. excepciones del centro, terapeuta y sala
3. ocupacion de salas en MySQL
4. bloqueos manuales internos (`resource_blocks`)
5. locks temporales en Redis

### 2.6 Sin recurrencia en el core

La recurrencia no sera parte del MVP ni del core principal.

Como las salas son limitadas, cada sesion debe reservarse segun disponibilidad real de:

- terapeuta
- sala
- servicio
- duracion
- buffers
- reglas de antelacion

Puede existir mas adelante un modulo opcional de "sugerir proxima sesion", pero no una serie recurrente automatica que reserve multiples fechas sin recalcular disponibilidad.

### 2.7 Control de complejidad

Super Agenda debe ser ambiciosa, pero no debe convertirse en una fantasia tecnica imposible de mantener.

Cada idea nueva debe evaluarse con este criterio:

```txt
valor operativo real
+ frecuencia de uso
+ impacto comercial
- complejidad tecnica
- peso de infraestructura
- riesgo de deuda tecnica
- riesgo de lentitud en VPS
- costo de soporte
```

Regla de producto:

- Lo que sostiene booking, Control, clientes, pagos, terapeutas, salas, mensajes y auditoria puede entrar al core.
- Lo que mejora productividad diaria pero no es indispensable puede entrar como modulo activable.
- Lo experimental, pesado o dependiente de IA debe entrar como modulo Pro/Enterprise o feature flag.
- Lo que requiere infraestructura cara, mucha concurrencia especializada o reglas dificiles de explicar debe pasar por diseno tecnico antes de codificarse.

Regla de arquitectura:

- Si una feature obliga a ensuciar el modelo de datos central, se redisenia o se convierte en modulo aislado.
- Si una feature baja la velocidad percibida de booking o Control, debe usar cache, workers o calculo diferido.
- Si una feature agrega estado complejo, debe tener auditoria, rollback o estrategia de recuperacion.
- Si una feature no se puede explicar en una pantalla de configuracion clara, probablemente no esta lista para producto.

Compromiso de desarrollo:

Cuando una solicitud aumente demasiado el peso, la deuda tecnica, la dificultad de soporte o la necesidad de infraestructura, se debe advertir explicitamente y proponer una alternativa mas simple.

---

## 3. Stack Recomendado

### 3.1 Runtime y backend

- **Node.js 24 LTS**
- **TypeScript**
- **NestJS con Fastify**
- **MySQL 8.4 LTS**
- **Drizzle ORM o SQL tipado sobre mysql2**
- **Redis 8.x**
- **BullMQ**
- **Socket.IO con Redis Adapter**

Razonamiento:

- Node 24 LTS da soporte largo para nuevas instalaciones.
- NestJS aporta modulos, inyeccion de dependencias, guards, interceptors y estructura clara para un modular monolith.
- Fastify mejora performance sin salir del ecosistema Node.
- MySQL 8.4 LTS es estable para VPS y evita volatilidad de ramas innovation.
- Redis resuelve cache, locks, rate limits y colas.
- BullMQ permite separar procesos web y workers.

### 3.2 Frontend

- **React 19**
- **Vite**
- **TypeScript**
- **TanStack Router**
- **TanStack Query**
- **Tailwind CSS**
- **shadcn/ui o sistema equivalente basado en componentes**
- **lucide-react**

No se recomienda Next.js por defecto para Super Agenda, porque el producto es una aplicacion operativa, no un sitio SEO. Vite + React da menos complejidad en VPS, builds simples y mejor control de cache estatica.

### 3.2.1 Sistema visual

El frontend debe construirse sobre tokens CSS y componentes capaces de recibir variantes desde un skin.

Requisitos:

- CSS variables generadas desde `skins.tokens_json`
- componentes con variantes controladas, no estilos inline dispersos
- preview de skin antes de publicar
- fallback a skin base si una variable falta
- separacion entre tokens globales y overrides por modulo
- export/import de skin en JSON para reutilizar estilos entre clientes

No todos los componentes tienen que ser infinitamente customizables. La regla es permitir mucha variacion visual sin abrir la puerta a combinaciones que rompan legibilidad, accesibilidad o flujo operativo.

### 3.3 Infraestructura

Hostinger VPS con Coolify y Docker Compose.

Servicios base:

```yaml
services:
  api:
    build: .
    command: node dist/apps/api/main.js
    depends_on: [mysql, redis]

  worker:
    build: .
    command: node dist/apps/worker/main.js
    depends_on: [mysql, redis]

  web:
    build: .
    command: serve dist/apps/web
    depends_on: [api]

  mysql:
    image: mysql:8.4
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:8
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
```

Coolify maneja deploy, variables, proxy, dominios y certificados.

---

## 4. Arquitectura

### 4.1 Forma general

Super Agenda debe ser un **modular monolith**.

No microservicios al inicio. No separar prematuramente. El monolito modular permite:

- transacciones claras
- deploy simple en VPS
- debugging mas facil
- menor costo operacional
- crecimiento ordenado por modulos

Estructura sugerida:

```txt
super-agenda/
  apps/
    api/
    worker/
    web-admin/
    web-booking/
    control/        # Super Agenda Control, desplegado separado para Daniel
  packages/
    core/
    db/
    modules/
    integrations/
    ui/
    config/
    shared/
    support-agent/  # heartbeat y reportes redacted desde cada instalacion
  infra/
    docker-compose.yml
    coolify.md
  docs/
```

### 4.1.1 Superficies de producto

Super Agenda tiene tres superficies separadas:

1. **Booking publico (`web-booking`)**
   - cara publica tipo Calendly para clientes
   - mobile-first obligatorio
   - permite identificar cliente, agendar, reagendar, cancelar segun politica, ver disponibilidad real y recibir instrucciones de pago
   - no expone salas como decision del cliente
   - puede permitir elegir terapeuta si el centro lo activa

2. **Admin del centro (`web-admin`)**
   - cara interna para owner/admin/secretaria/finance
   - incluye Control, Clientes, Equipo, Finanzas, Insights y Ajustes
   - Control opera citas, pagos, salas, no-shows, conflictos, recordatorios, clientes del dia y reasignaciones manuales

3. **Super Agenda Control (`control`)**
   - consola central de Daniel
   - monitorea salud tecnica de instalaciones
   - no mezcla datos clinicos ni financieros sensibles entre centros

Control no es Booking. Ambos consumen el mismo backend y el mismo motor de disponibilidad, pero resuelven problemas distintos:

```txt
Booking = experiencia publica guiada para que el cliente tome, mueva o cancele una hora.
Control = centro de operaciones interno para que el secretario opere, corrija y audite citas, salas, pagos y alertas.
Hoy = vista interna por defecto de Control para el dia actual.
```

### 4.2 Core obligatorio

El core existe en todas las instalaciones:

- `identity`: login, sesiones, refresh tokens
- `rbac`: roles, permisos, policies
- `branding`: marca blanca
- `skins`: apariencia visual, tokens y presets
- `settings`: configuracion tipada
- `clients`: clientes/pacientes/leads
- `catalog`: servicios, precios, duraciones
- `team`: terapeutas y equipo administrativo
- `calendar`: Google Calendar, calendar IDs, sync state
- `availability`: horarios, excepciones, buffers
- `appointments`: citas y estados
- `operations`: centro operativo, vistas, acciones, conflictos y contexto de cita
- `payments-basic`: QR, comprobantes, estados de pago
- `notifications`: centro interno de notificaciones, campanita, toasts, preferencias y entregas externas cuando aplique
- `message-templates`: textos configurables, variables, previews y triggers
- `files`: metadata de archivos
- `audit`: bitacora de cambios
- `modules`: registro de modulos y feature flags
- `support-agent`: health checks redacted hacia Super Agenda Control, sin pagina visible para el centro

### 4.2.1 Paginas visibles del admin

Menu recomendado inicial:

```txt
Control
Clientes
Equipo
Finanzas
Insights
Ajustes
```

Notas:

- **Control** es el centro de operaciones del secretario: citas del dia, salas, pagos, no-shows, conflictos, recordatorios, WhatsApp, reasignaciones y vista semanal operativa.
- **Hoy** es la vista inicial de Control, enfocada en el dia actual.
- **Clientes** incluye CRM deluxe: ficha 360, relacion, metricas, churn, fidelidad, notas, pagos, WhatsApp y timeline.
- **Equipo** es core operativo: terapeutas, disponibilidad, calendarios, enfoque publico, aranceles, servicios y estado activo/inactivo.
- **Salas** no es pagina visible. Es un recurso tactico interno dentro de Control y del motor de disponibilidad.
- **Finanzas** es control operativo/exportable, no contabilidad formal.
- **Insights** es la pagina de lectura historica; puede empezar liviana en Starter y crecer en Pro. Las alertas accionables del dia viven en Control.
- **Inbox** no necesita pagina propia al inicio; mensajes y comprobantes viven en Clientes, Control y Pagos/Finanzas.

Regla Control vs Insights:

- **Control** muestra eventos accionables: citas, pagos, conflictos, recordatorios, WhatsApp, salas y no-shows concretos.
- **Insights** muestra tendencias y lectura historica: tasa de no-show, ocupacion, crecimiento, retencion y motivos agregados.

### 4.3 Modulos activables

Modulos que se pueden activar por tier:

| Modulo | Proposito | Tier sugerido |
|---|---|---|
| `rooms` | salas, tipos de sala, disponibilidad y asignacion automatica | Standard |
| `secretary` | rol operativo, Control operativa, creacion manual de citas | Standard |
| `insights-basic` | pagina Insights liviana sobre citas, pagos, no-shows, ocupacion y clientes | Starter |
| `finance` | ingresos, gastos, liquidaciones, P&L | Pro |
| `crm-advanced` | relacion, fidelidad, churn, nurture y segmentacion de clientes | Pro |
| `insights-advanced` | comparativas, cohortes, segmentacion, tendencias y snapshots avanzados | Pro |
| `inbox` | bandeja WhatsApp, comprobantes, actividad | Standard/Pro |
| `retention` | reglas de seguimiento, clientes en riesgo | Pro |
| `therapist-success` | metas, reportes y seguimiento del terapeuta por WhatsApp | Pro/Enterprise |
| `meta-health` | estado resumido de WhatsApp/Meta para owner/admin; diagnostico tecnico vive en Super Agenda Control | Pro |
| `ai-assistant` | clasificacion, resumen, sugerencias, intent | Enterprise |
| `exports` | CSV, Excel, PDF | Pro |

Un modulo puede estar instalado en codigo pero desactivado por configuracion.

Nota:

Super Agenda Control no es un modulo comercial del centro. Es una app central de Daniel para soporte de todas las instalaciones.

### 4.4 Contrato de modulo

Cada modulo debe declarar:

```ts
export interface SuperAgendaModule {
  key: string;
  name: string;
  dependencies: string[];
  responsiveProfile: "public_mobile" | "operational_responsive" | "desktop_first" | "desktop_only";
  permissions: PermissionDefinition[];
  settingsSchema: ModuleSettingsSchema;
  routes?: ModuleRouteDefinition[];
  menuItems?: ModuleMenuItem[];
  workers?: QueueWorkerDefinition[];
  eventHandlers?: DomainEventHandler[];
  migrations?: MigrationDefinition[];
}
```

Reglas:

- Un modulo no puede asumir que otro existe si no lo declara como dependencia.
- El frontend consulta capabilities antes de mostrar pantallas.
- El backend valida permisos aunque el frontend oculte botones.
- Las migraciones de un modulo pueden crear tablas propias, pero no deben romper tablas core.
- El modulo declara su perfil responsivo para que UX, QA y soporte sepan en que pantallas debe funcionar plenamente.

---

## 5. Modelo de Datos Base

### 5.1 Configuracion y marca

Tablas sugeridas:

- `brand_settings`
- `skins`
- `skin_versions`
- `skin_assignments`
- `ui_settings`
- `system_settings`
- `module_settings`
- `feature_flags`
- `module_installations`

Campos clave en `brand_settings`:

- `center_name`
- `legal_name`
- `logo_url`
- `primary_color`
- `accent_color`
- `timezone`
- `locale`
- `currency`
- `public_booking_url`
- `whatsapp_display_name`
- `payment_instructions`
- `privacy_text`
- `cancellation_policy`

Campos de politica de cancelacion/reagendamiento sugeridos en `system_settings` o una tabla dedicada de politicas:

- `cancellation_min_notice_hours`
- `reschedule_min_notice_hours`
- `late_change_penalty_percent`
- `late_change_policy_text`
- `policy_message_template_key`

Valor de mock/default inicial:

```txt
minimo de antelacion: 6 horas
penalidad por cambio tardio/no asistencia: 50% de la sesion
```

Estas politicas deben administrarse desde Ajustes. El frontend no decide si una cita puede cancelarse o reagendarse; solo pinta lo que el backend devuelve en `available_actions`.

Campos clave en `skins`:

- `key`
- `name`
- `description`
- `status`
- `tokens_json`
- `layout_json`
- `component_variants_json`
- `created_by_user_id`
- `updated_by_user_id`

`tokens_json` debe cubrir:

- colores semanticos (`background`, `surface`, `text`, `muted`, `primary`, `accent`, `danger`, `success`)
- tipografias
- escala de tamanos
- spacing
- radios
- bordes
- sombras
- densidad (`comfortable`, `compact`, `clinical`, `editorial`)

`layout_json` debe permitir variantes por superficie:

- booking publico
- admin Control operativa
- vistas internas de Control
- formularios
- tablas
- modales/drawers

Regla:

Los skins deben ser versionados. Si un centro cambia su apariencia, debe poder volver a una version anterior sin perder configuracion funcional.

### 5.2 Usuarios, roles y permisos

No usar `ENUM` para roles.

Tablas:

- `users`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `sessions`
- `password_reset_tokens`

Roles iniciales sugeridos:

- `owner`
- `admin`
- `secretary`
- `finance`
- `viewer`

Permisos por accion:

- `appointments.read`
- `appointments.create`
- `appointments.update`
- `appointments.cancel`
- `clients.read`
- `clients.update`
- `payments.verify`
- `finance.read`
- `team.read`
- `team.update`
- `settings.update`
- `modules.manage`

### 5.3 Equipo, terapeutas y calendarios

La pagina **Equipo** es core operativo.

No debe quedar escondida dentro de Ajustes, porque define datos que afectan directamente:

- booking publico
- disponibilidad
- asignacion de citas
- Google Calendar
- salas compatibles
- precios/aranceles
- pagos y liquidaciones
- comunicacion con terapeutas

Equipo no es una pagina de RRHH completa. Es el lugar donde el centro administra terapeutas y equipo operativo en lo necesario para que la operativa de citas funcione.

Tablas:

- `therapists`
- `therapist_profiles`
- `therapist_services`
- `therapist_service_prices`
- `therapist_schedules`
- `therapist_exceptions`
- `calendar_accounts`
- `therapist_calendars`
- `calendar_sync_events`

Regla importante:

Cada terapeuta debe tener un `calendar_id` del Google Calendar oficial del centro. El calendario puede estar compartido con el correo personal/profesional del terapeuta para que lo vea desde su celular.

Campos relevantes:

- `therapists.display_name`
- `therapists.internal_name`
- `therapists.public_bio`
- `therapists.public_focus`
- `therapists.photo_url`
- `therapists.contact_phone`
- `therapists.contact_email`
- `therapists.active`
- `therapists.assignment_weight`
- `therapist_calendars.calendar_id`
- `therapist_calendars.calendar_name`
- `therapist_calendars.shared_with_email`
- `therapist_calendars.sync_enabled`
- `therapist_calendars.last_freebusy_check_at`

Cada terapeuta tambien tiene configuracion propia de disponibilidad:

- bloques semanales de trabajo
- excepciones por fecha
- servicios que ofrece
- duracion/buffer por servicio
- arancel/precio por servicio cuando difiere del precio base
- foto publica
- enfoque publico
- bio publica
- prioridad o peso de asignacion
- activo/inactivo

Ejemplo:

```txt
Dr. Feelgood
  lunes-viernes: 08:00-10:00, 17:00-20:00
  servicios: Reiki, Tarot
  calendar_id: centro.com_xxxxx@group.calendar.google.com
```

El bot nunca toma Google Calendar como unica disponibilidad. Google Calendar dice que esta ocupado o libre; la configuracion interna dice si ese horario es ofrecible al publico.

#### 5.3.1 Vista de Equipo

La pagina Equipo debe permitir:

- buscar terapeutas y miembros operativos
- filtrar por activo/inactivo, servicio, modalidad y disponibilidad
- crear terapeuta
- editar perfil publico
- editar datos internos
- asignar servicios
- configurar aranceles por servicio
- configurar disponibilidad semanal
- registrar excepciones
- asignar Google Calendar
- ver estado de sync
- pausar o activar terapeuta
- ver metricas operativas basicas

Metricas core dentro de Equipo:

- citas futuras
- sesiones completadas del periodo
- ocupacion aproximada
- cancelaciones/no-shows del periodo
- pagos o liquidaciones asociadas si Finanzas esta activo
- alertas de calendario/disponibilidad

Estas metricas ayudan a operar, pero no sustituyen la capa futura de exito del terapeuta.

#### 5.3.2 Capa futura de exito del terapeuta

Sobre Equipo puede existir un modulo activable `therapist-success`.

Este modulo no debe afectar el core de disponibilidad ni citas. Debe consumir eventos y snapshots para ofrecer al centro una gestion tipo Customer Success del terapeuta:

- metas mensuales por terapeuta
- clientes activos objetivo
- sesiones objetivo
- reportes por WhatsApp al terapeuta
- avance contra meta
- clientes nuevos asignados
- clientes que no volvieron a agendar
- oportunidades de seguimiento
- mensajes de check-in configurables

Ejemplo:

```txt
Bot: "Para mayo, cuantos clientes activos te gustaria sostener?"
Terapeuta: "55"
Sistema: guarda meta mensual y reporta avance por WhatsApp.
```

Reglas:

- es Pro/Enterprise, no MVP core
- debe requerir opt-in del terapeuta cuando envie mensajes directos
- no debe enviar datos clinicos ni conversaciones sensibles por WhatsApp
- debe usar lenguaje de alianza profesional, no vigilancia punitiva
- debe estar detras de templates, reglas y audit log

### 5.4 Servicios, salas y disponibilidad

Tablas:

- `services`
- `service_prices`
- `rooms`
- `room_schedules`
- `room_exceptions`
- `service_rooms`
- `room_assignment_state`
- `therapist_assignment_state`
- `room_assignment_overrides`
- `center_schedules`
- `center_exceptions`

Disponibilidad de cita:

```txt
servicio activo
+ terapeuta activo que ofrece el servicio
+ sala compatible disponible
+ horario del centro
+ horario del terapeuta
+ horario de sala
- excepciones
- busy de Google Calendar
- citas existentes
- locks Redis
= slots disponibles
```

### 5.4.1 Operativa de salas como recurso interno de Control

Las salas son recursos limitados y cambiantes. No son una pagina visible separada: son un recurso tactico dentro de **Control** y del motor de disponibilidad. El sistema propone y asigna automaticamente, pero el admin siempre puede cambiar manualmente desde la operacion del dia.

Motivo: no hay IoT ni sensor fisico que confirme que un terapeuta entro a la sala asignada. La asignacion real puede cambiar en el ultimo minuto.

Reglas:

- El bot asigna sala automaticamente cuando se confirma una cita.
- El admin puede cambiar sala antes o durante la operacion del dia.
- El sistema debe validar conflictos antes de guardar un cambio manual.
- El override manual debe quedar auditado.
- El cambio manual de sala debe actualizar la cita, los claims, la vista operativa y el evento de Google Calendar si corresponde.

Vistas obligatorias de salas dentro de Control:

1. **Mapa del dia:** grilla por sala y hora, con citas, terapeuta, servicio, cliente y estado.
2. **Linea de tiempo operativa:** lista cronologica de entradas/salidas por sala, pensada para secretaria/admin durante el dia.
3. **Panel de reasignacion:** vista para arrastrar/cambiar sala, detectar conflictos y confirmar overrides manuales.

El tablero tactico debe incluir calendario lateral, KPIs operativos, filtro por terapeuta, grilla de salas, tarjetas de cita, locks visibles y auditoria.

Requisitos UX del tablero tactico:

- Drag-and-drop de citas entre salas.
- Feedback en vivo mientras se arrastra: salas validas, invalidas y razon de bloqueo.
- Tarjetas con estado visual: futura, en curso, completada, bloqueada por otro usuario.
- Locks visibles: "editando por X" cuando otro admin tiene una cita bloqueada.
- Mensaje claro ante concurrencia: quien movio la cita, a que sala y hace cuantos segundos.
- Huecos clickeables para crear cita con sala/hora prellenadas.
- Columnas de salas colapsables si hay muchas salas visibles.
- Modo denso cuando hay mas de 5 salas visibles.
- Auditoria filtrada por defecto a cambios manuales recientes.
- Motivo obligatorio para reasignacion manual con tipos predefinidos.
- Modal de confirmacion claro: "Moviendo a {terapeuta} a {sala}" antes de confirmar.

Los motivos tipados no son solo texto administrativo. Son data operativa. Permiten medir por que se rompen las asignaciones automaticas y detectar problemas fisicos o de gestion del centro.

Preguntas que esta data debe poder responder:

- cuantas reasignaciones ocurren por dia/semana/mes
- que salas generan mas problemas tecnicos
- que porcentaje de cambios ocurre por limpieza pendiente
- que terapeutas piden mas cambios de sala
- cuantos cambios se deben a movilidad reducida del paciente
- cuantas urgencias rompen la planificacion normal
- que horarios concentran mas overrides
- que admins hacen mas reasignaciones

Esto alimenta Control e Insights historicos sin ensuciar el flujo principal.

Estados sugeridos de una asignacion de sala:

- `auto_assigned`
- `manually_changed`
- `pending_confirmation`
- `conflict`
- `released`

`room_assignment_overrides` debe guardar:

- `appointment_id`
- `old_room_id`
- `new_room_id`
- `reason_type`
- `reason`
- `therapist_id`
- `client_id`
- `service_id`
- `starts_at`
- `ends_at`
- `changed_by_user_id`
- `changed_at`
- `conflict_checked`
- `source_view` (`operations_room_grid`, `operations_drawer`, `api`)
- `notes`

Motivos iniciales:

- `technical_issue`
- `cleaning_pending`
- `patient_mobility`
- `therapist_preference`
- `urgent_reassignment`
- `other`

### 5.5 Citas

Tablas:

- `appointments`
- `appointment_participants`
- `appointment_room_assignments`
- `appointment_calendar_events`
- `appointment_resource_claims`
- `appointment_status_history`

Campos core de `appointments`:

- `client_id`
- `service_id`
- `therapist_id`
- `starts_at_utc`
- `ends_at_utc`
- `local_date`
- `local_time`
- `timezone`
- `status`
- `payment_status`
- `price_amount`
- `currency`
- `created_by_user_id`
- `source`

`appointment_calendar_events`:

- `appointment_id`
- `provider`
- `calendar_id`
- `event_id`
- `sync_status`
- `last_synced_at`
- `last_error`

Una cita confirmada no depende del espejo externo. Si falla Google Calendar despues de escribir DB, la cita sigue confirmada y solo cambia `sync_status` a `failed` para reintento/alerta.

### 5.6 Claims de recursos

Super Agenda debe tener una defensa final contra overlap dentro de MySQL, ademas del lock temporal en Redis.

Tabla sugerida:

- `appointment_resource_claims`

Columnas:

- `appointment_id`
- `resource_type` (`therapist`, `room`)
- `resource_id`
- `claim_time`
- `created_at`

Indice unico:

```sql
UNIQUE KEY uq_resource_minute (resource_type, resource_id, claim_time)
```

Regla:

Al crear una cita de 60 minutos se crean claims por minuto para:

- terapeuta asignado
- sala asignada, si el modulo de salas esta activo

Ejemplo:

```txt
10:00, 10:01, 10:02 ... 10:59
```

Si otra cita intenta usar el mismo terapeuta o la misma sala en cualquier minuto solapado, MySQL rechaza el insert por unique constraint.

Redis evita carreras de UX; `appointment_resource_claims` evita corrupcion de datos.

### 5.7 Pagos

Tablas:

- `payments`
- `payment_methods`
- `payment_proofs`
- `payment_verifications`
- `payment_status_history`
- `payment_ocr_results`

Regla:

El pago no debe vivir mezclado dentro de la cita. La cita tiene `payment_status` como snapshot operativo, pero el detalle vive en pagos.

OCR de comprobantes es parte fundamental del flujo de pagos. No es contabilidad ni lujo visual: reduce carga operativa y permite confirmar comprobantes con menos error humano.

Flujo minimo:

1. cliente o admin sube comprobante.
2. se crea `payment_proof`.
3. worker `ocr` procesa imagen/PDF.
4. OCR extrae monto, fecha, posible banco/metodo, texto bruto y confianza.
5. sistema compara monto esperado vs monto detectado.
6. si confianza y monto coinciden, queda como `needs_review_fast` o auto-verificable segun configuracion del centro.
7. si hay diferencia o baja confianza, queda en `manual_review`.
8. admin confirma/rechaza.
9. se actualiza `payment_status`, cita y timeline.

Regla de seguridad:

OCR ayuda, pero no debe ser autoridad ciega en MVP. La app debe permitir revision manual clara y guardar el texto bruto, proveedor OCR, confianza, usuario verificador y audit log.

### 5.8 Archivos

No guardar blobs pesados en MySQL salvo emergencia.

Tablas:

- `files`
- `file_links`

Storage inicial:

- volumen local en VPS

Storage futuro:

- S3-compatible
- Cloudflare R2
- Backblaze B2

### 5.9 Comunicaciones configurables

Los mensajes no deben estar hardcodeados en codigo de producto.

Tablas sugeridas:

- `message_templates`
- `message_template_versions`
- `message_triggers`
- `message_delivery_rules`
- `message_render_logs`

`message_templates`:

- `key`
- `channel` (`whatsapp`, `email`, `internal`, `test_outbox`, `log_only`)
- `name`
- `description`
- `status` (`draft`, `active`, `archived`)
- `body`
- `variables_schema`
- `default_locale`
- `requires_meta_approval`
- `meta_template_name`
- `created_by_user_id`
- `updated_by_user_id`

`message_triggers`:

- `trigger_key`
- `template_key`
- `enabled`
- `send_offset_minutes`
- `conditions`
- `audience`
- `fallback_template_key`

Triggers iniciales:

- `appointment.created`
- `appointment.confirmed`
- `appointment.created_admin`
- `appointment.reminder`
- `appointment.rescheduled`
- `appointment.cancelled`
- `payment.requested`
- `payment.reminder`
- `payment.proof_received`
- `payment.verified`
- `payment.rejected`
- `calendar.sync_failed`
- `operations.conflict_created`
- `operations.conflict_resolved`
- `operations.no_show_marked`
- `therapist.notification_new_appointment`
- `admin.system_alert`

Reglas:

- El admin puede editar textos, activar/desactivar triggers y cambiar horarios dentro de limites seguros.
- El sistema provee defaults, pero ninguna comunicacion comercial normal debe requerir cambio de codigo.
- Cada template debe tener preview con datos de ejemplo.
- Cada variable debe estar documentada en UI.
- Los templates de WhatsApp que requieran aprobacion Meta deben distinguir entre texto configurable interno y `meta_template_name`.
- Debe quedar version historica para saber que mensaje se envio en una fecha concreta.
- Si un template esta roto o desactivado, el sistema debe usar fallback o alertar al admin, no fallar silenciosamente.

### 5.9.1 Centro de notificaciones interno

Super Agenda no debe depender de apps externas para avisos administrativos internos. La operacion diaria del centro necesita un sistema propio dentro del admin.

La UI debe tener:

- campanita en el menu superior, visible en `web-admin`
- contador de no leidas
- centro de notificaciones desplegable o drawer
- toasts para avisos flotantes momentaneos
- filtros por tipo, severidad, estado y fecha
- accion para marcar leido/no leido
- accion para abrir el objeto relacionado
- preferencias por rol/usuario cuando aplique

Terminologia:

- **Toast:** aviso flotante breve para feedback inmediato. Desaparece solo y no debe contener informacion critica como unica copia.
- **Centro de notificaciones:** historial persistente consultable desde la campanita.
- **Notificacion persistente:** aviso guardado en base de datos hasta que el usuario lo lea, descarte o resuelva.

Regla UX:

- Los toasts sirven para confirmar o alertar en el momento.
- La campanita sirve para no perder eventos importantes.
- Control sigue siendo el lugar para resolver trabajo operativo; la notificacion debe llevar al drawer, cita, conflicto, cliente o pago correspondiente.

Eventos que deben generar notificaciones internas:

- cliente agenda cita desde Booking
- secretaria/admin crea cita manual
- cliente reagenda
- cliente cancela
- pago o comprobante recibido
- OCR exitoso
- OCR fallido y requiere revision
- pago verificado
- pago rechazado
- cita cercana con pago pendiente
- no-show marcado o detectado
- conflicto de sala
- conflicto de terapeuta
- fallo de sync con Google Calendar
- sync recuperado
- WhatsApp/Meta degradado o desconectado
- template rechazado o roto
- modulo activado/desactivado
- backup fallido

No todo debe interrumpir igual:

| Severidad | Persistente | Toast | Ejemplos |
|---|---|---|---|
| `info` | opcional | si | cita creada, pago verificado |
| `success` | opcional | si | OCR exitoso, sync recuperado |
| `warning` | si | si | pago pendiente cercano, template roto, OCR fallido |
| `critical` | si | si, destacado | conflicto de sala, GCal caido, WhatsApp desconectado |

Tablas sugeridas:

- `internal_notifications`
- `notification_deliveries`
- `notification_preferences`

`internal_notifications`:

- `id`
- `type`
- `severity`
- `title`
- `body`
- `entity_type`
- `entity_id`
- `action_url`
- `created_at`
- `expires_at`
- `dedupe_key`
- `resolved_at`

`notification_deliveries`:

- `notification_id`
- `user_id`
- `role_key`
- `read_at`
- `dismissed_at`
- `toast_shown_at`

`notification_preferences`:

- `user_id`
- `type`
- `toast_enabled`
- `bell_enabled`
- `email_enabled_future`
- `quiet_hours_json`

Reglas:

- Eventos criticos siempre crean notificacion persistente.
- Los toasts no reemplazan audit log ni timeline.
- Debe existir dedupe para no spamear la campanita con el mismo fallo repetido.
- Las notificaciones deben respetar RBAC: secretaria no ve finanzas avanzadas, finance no ve notas clinicas, terapeuta no ve datos de otros terapeutas.
- Las notificaciones tecnicas crudas pertenecen a Super Agenda Control; el centro ve mensajes accionables y comprensibles.
- Cada notificacion persistente debe poder navegar al contexto correcto: Control, cliente, pago, conflicto, ajustes o Super Agenda Control segun permiso.

### 5.10 CRM de relacion y retencion

El CRM de Super Agenda no es un embudo comercial tradicional. No esta centrado en mover leads por etapas de venta. Esta centrado en **crear, conocer y mantener clientes**.

La pagina Clientes/CRM debe ser **deluxe desde el inicio**. No es una decoracion analitica: la relacion con el cliente es el centro del negocio terapeutico. Las metricas y scores aqui son calculos simples derivados de citas, pagos, frecuencia y comunicacion; bien disenados, no estresan la arquitectura.

Principio:

```txt
CRM = memoria operativa + relacion + retencion + acciones oportunas
```

El cliente es la entidad central del sistema. Su ficha debe reunir:

- datos personales
- datos de contacto
- zona horaria
- fuente
- modalidad
- frecuencia esperada
- arancel/metodo de pago
- terapeuta principal
- terapeutas relacionados por servicio
- servicios usados
- historial de citas
- historial de pagos
- WhatsApp
- timeline completo
- notas administrativas
- notas clinicas con permisos restringidos
- notas por sesion
- tags
- alertas
- metricas de fidelidad y churn

#### 5.10.1 Tablas sugeridas

- `client_profiles`
- `client_therapist_relationships`
- `client_metrics`
- `client_segments`
- `client_segment_memberships`
- `client_tags`
- `client_notes`
- `session_notes`
- `clinical_note_intake_events`
- `client_relationship_events`
- `client_nurture_rules`
- `client_nurture_actions`
- `client_health_snapshots`
- `client_privacy_settings`

#### 5.10.2 Metricas principales

Metricas por cliente:

- `sessions_total`
- `sessions_completed`
- `sessions_cancelled`
- `sessions_no_show`
- `first_session_at`
- `last_session_at`
- `next_session_at`
- `days_since_last_session`
- `tenure_days`
- `attendance_rate`
- `cancellation_rate`
- `no_show_rate`
- `average_gap_days`
- `gap_variance`
- `expected_frequency_days`
- `adherence_rate`
- `lifetime_value`
- `paid_total`
- `pending_amount`
- `preferred_service_id`
- `usual_therapist_id`
- `active_therapist_count`
- `services_in_current_plan`
- `last_inbound_message_at`
- `last_outbound_message_at`
- `relationship_score`
- `churn_risk_score`
- `loyalty_score`

#### 5.10.3 Fidelidad

La fidelidad no debe medirse solo por dinero. En centros terapeuticos importan continuidad, antiguedad y confianza.

Componentes sugeridos:

```txt
loyalty_score =
  sesiones_completadas_score
  + antiguedad_score
  + constancia_score
  + asistencia_score
  + pago_al_dia_score
  + engagement_whatsapp_score
```

Ejemplos:

- muchas sesiones completadas -> mas fidelidad
- baja variacion entre sesiones -> mas constancia
- antiguedad alta -> mas relacion
- no-shows repetidos -> menor salud de relacion
- pagos pendientes reiterados -> alerta administrativa, no necesariamente mala relacion clinica

#### 5.10.4 Churn terapeutico

Churn aqui significa riesgo de que el cliente desaparezca o interrumpa su proceso.

No todos los clientes deben tener la misma regla. La regla depende de su frecuencia esperada:

| Frecuencia esperada | Riesgo sugerido | Perdido sugerido |
|---|---:|---:|
| Semanal | 10-14 dias sin proxima cita | 28-35 dias |
| Quincenal | 21-28 dias sin proxima cita | 45-60 dias |
| Mensual | 40-45 dias sin proxima cita | 75-90 dias |
| Irregular | regla por historico propio | regla por historico propio |

Estados derivados:

- `new`: todavia no completa primera sesion
- `active`: tiene cita futura o esta dentro de su frecuencia esperada
- `loyal`: alta constancia y antiguedad
- `watch`: se esta alejando de su patron normal
- `at_risk`: supero umbral de riesgo
- `lost`: supero umbral de perdido
- `paused`: pausa manual registrada
- `do_not_contact`: no contactar por preferencia o regla

#### 5.10.5 Nurture y seguimiento

El nurture debe ser configurable y respetuoso. No debe sentirse como spam ni reemplazar criterio clinico/administrativo.

Acciones sugeridas:

- mensaje de seguimiento despues de primera sesion
- recordatorio suave si no agenda dentro de su frecuencia esperada
- mensaje de reactivacion si entra en riesgo
- mensaje especial de retorno si esta perdido
- nota interna para que secretaria contacte manualmente
- alerta al admin si cliente de alta fidelidad deja de asistir
- sugerencia de proxima sesion despues de cita completada

Cada regla de nurture debe tener:

- segmento objetivo
- condiciones
- canal
- template configurable
- espera minima entre contactos
- limite maximo de intentos
- horario permitido
- opt-out
- aprobacion manual opcional

#### 5.10.6 Ficha 360 del cliente

La ficha debe tener tabs:

- **Resumen:** identidad, contacto, proxima cita, estado, scores, alertas.
- **Info general:** datos personales, administrativos, modalidad, arancel, fuente, timezone.
- **Equipo terapeutico:** terapeuta principal, terapeutas secundarios, servicios asociados y motivo de derivacion.
- **Citas:** historial, proximas, patrones, ausencias, cancelaciones.
- **Pagos:** historial, pendientes, evidencia, metodo preferido.
- **WhatsApp:** mensajes entrantes/salientes relacionados.
- **Timeline:** todo evento importante ordenado por fecha.
- **Relacion:** fidelidad, churn, frecuencia, cohortes, tags, acciones sugeridas.
- **Notas:** administrativas y clinicas con permisos separados.

Regla de permisos:

- notas clinicas y diagnostico deben tener permiso separado.
- secretaria puede ver datos operativos, pero no necesariamente diagnostico/notas clinicas.
- finanzas puede ver pagos, pero no notas clinicas.

#### 5.10.6.1 Equipo terapeutico del cliente

Un cliente puede trabajar con mas de un terapeuta y mas de un servicio.

Ejemplo:

```txt
Cliente A
  terapeuta principal: Dra. EMDR
  servicio principal: EMDR
  terapeuta secundario: Terapeuta B
  servicio secundario: masaje sacro craneal
  motivo: derivacion de Dra. EMDR
```

Tabla `client_therapist_relationships`:

- `client_id`
- `therapist_id`
- `service_id`
- `relationship_type` (`primary`, `secondary`, `referred`, `historical`)
- `referred_by_therapist_id`
- `started_at`
- `ended_at`
- `status` (`active`, `paused`, `ended`)
- `notes`

Reglas:

- Puede haber un terapeuta principal activo.
- Puede haber varios terapeutas secundarios activos.
- El historial no se borra cuando cambia terapeuta.
- Las metricas deben poder verse por cliente completo, por terapeuta y por servicio.
- La ficha debe mostrar claramente si el cliente cambio de terapeuta o si trabaja en paralelo con varios.

#### 5.10.6.2 Notas clinicas y notas por sesion

Debe existir mas de un tipo de nota:

- **Nota administrativa:** visible para equipo operativo autorizado.
- **Nota clinica general:** diagnostico, hipotesis, plan general, cuidado longitudinal.
- **Nota por sesion:** vinculada a una cita especifica.
- **Nota privada del terapeuta:** visible solo para ese terapeuta y roles superiores configurados.
- **Nota compartida del equipo terapeutico:** visible para terapeutas relacionados con el cliente.

Tabla `session_notes`:

- `appointment_id`
- `client_id`
- `therapist_id`
- `service_id`
- `note_type`
- `visibility`
- `source` (`manual`, `import`)
- `structured_note`
- `summary`
- `tags`
- `created_by_user_id`
- `review_status` (`draft`, `needs_review`, `approved`)
- `created_at`
- `updated_at`

Reglas:

- Una cita puede tener cero o varias notas.
- Una nota por sesion debe quedar vinculada a fecha/hora, terapeuta, cliente y servicio.
- El acceso a notas debe obedecer RBAC y relacion terapeutica.

#### 5.10.7 Segmentos utiles

Segmentos iniciales:

- nuevos sin primera sesion completada
- primera sesion completada, sin segunda agendada
- activos constantes
- clientes leales
- clientes de alta antiguedad
- clientes en riesgo
- clientes perdidos
- clientes con no-shows repetidos
- clientes con pagos pendientes
- clientes con alto LTV
- clientes sin respuesta a ultimos mensajes
- clientes por terapeuta habitual
- clientes por servicio habitual

Segmentos no son etapas de funnel. Son lentes operativos para cuidar la relacion.

#### 5.10.8 Eventos de relacion

Todo lo importante debe alimentar el timeline:

- cliente creado
- terapeuta principal asignado
- terapeuta secundario agregado
- derivacion interna registrada
- cita agendada
- cita completada
- cita cancelada
- no-show
- pago recibido
- pago verificado
- WhatsApp entrante
- WhatsApp saliente
- nota agregada
- nota de sesion agregada
- tag agregado/removido
- cambio de frecuencia esperada
- cambio de estado derivado
- nurture enviado
- cliente marcado como pausado
- cliente marcado como no contactar

#### 5.10.9 IA opcional

En tier Enterprise, IA puede ayudar a:

- resumir timeline
- sugerir proxima accion
- detectar cliente en riesgo por tono o patron
- clasificar mensajes
- generar borrador de seguimiento
- estructurar notas clinicas segun formato elegido

La IA no debe enviar mensajes sensibles sin reglas claras o aprobacion si el centro asi lo configura.

---

### 5.11 Control: centro de operaciones

Control no debe ser solo una tabla de citas. Debe ser el **centro de comando operativo** del centro.

En agenda4.0 hay prestaciones utiles que se deben conservar como patron:

- filtros por cliente, estado, fecha y orden
- paginacion
- estados editables desde la lista
- estado de pago visible
- envio/reenvio de recordatorios
- fila expandible con informacion adicional
- realtime administrativo via eventos
- acciones rapidas de cancelacion, no-show, pago y recordatorio
- vinculacion con Google Calendar

Pero para Super Agenda eso no alcanza. La operacion ahora depende de:

- terapeuta
- sala
- servicio
- horario real del terapeuta
- disponibilidad real de sala
- Google Calendar central
- pago
- recordatorios
- notas
- permisos por rol
- conflictos y reasignaciones manuales
- concurrencia entre usuarios y clientes reservando al mismo tiempo

Por eso Control debe redisenarse como superficie operativa con varias vistas internas, no como una sola tabla.

#### 5.11.1 Principio UX

La primera vista de Control, llamada **Hoy**, debe responder:

```txt
que esta pasando ahora
que viene despues
que necesita accion humana
que esta en conflicto
que se puede resolver en un click
```

La tabla historica sigue existiendo, pero no debe ser la vista principal de la operacion diaria.

Control debe mostrar no-shows del dia como alerta operativa. No es una metrica decorativa: un no-show puede liberar una sala, requerir reasignacion manual, cambiar el estado de pago, disparar seguimiento al cliente y afectar la lectura de ocupacion real.

#### 5.11.2 Vistas internas de Control

Vistas iniciales:

| Vista | Proposito | Perfil responsivo |
|---|---|---|
| `today_command` | vista Hoy: dia actual, proximas citas y alertas | operational_responsive |
| `day_timeline` | linea de tiempo por hora, ideal para secretaria | operational_responsive |
| `room_grid` | salas como columnas y horas como filas | desktop_first |
| `therapist_grid` | terapeutas como columnas y horas como filas | desktop_first |
| `list_table` | tabla historica, filtros, exportacion y auditoria | desktop_first |
| `week_calendar` | lectura semanal de carga y huecos | desktop_first |
| `conflict_queue` | cola de problemas a resolver | operational_responsive |

La UI debe permitir cambiar de vista sin perder fecha, filtros principales ni cita seleccionada.

#### 5.11.3 Command bar

La parte superior de Control debe ser una barra de comando, no un bloque grande de filtros.

Debe incluir:

- selector de fecha con acceso a hoy/manana/semana
- switch de vista
- busqueda global de cliente, telefono, terapeuta o servicio
- filtros rapidos por estado, pago, terapeuta, sala, servicio y no-show
- boton de nueva cita manual
- indicador de realtime/sync
- contador de conflictos abiertos
- contador de no-shows del dia si existen

Los filtros avanzados viven en un panel o drawer, no ocupan siempre el primer plano.

#### 5.11.3.1 Filtros y agrupaciones

Los filtros deben ser extremadamente faciles de establecer y combinar. Control es una herramienta de operacion diaria; filtrar no puede sentirse como llenar un formulario.

Filtros rapidos obligatorios:

- fecha o rango de fechas
- terapeuta
- sala
- servicio
- estado de cita
- estado de pago
- recordatorio pendiente/enviado/fallido
- Google Calendar sincronizado/fallido/pendiente
- cliente
- telefono
- modalidad
- fuente
- citas con conflicto
- citas sin sala
- citas sin terapeuta
- citas con nota pendiente

Ordenes obligatorios:

- fecha mas proxima
- fecha mas reciente
- hora ascendente
- hora descendente
- cliente A-Z
- cliente Z-A
- terapeuta A-Z
- sala A-Z
- pago pendiente primero
- conflictos primero
- creadas recientemente

Agrupaciones obligatorias:

- por dia
- por terapeuta
- por sala
- por servicio
- por estado de cita
- por estado de pago
- por modalidad
- por fuente
- por hora del dia
- por conflicto

La UI debe soportar:

- chips de filtros activos, removibles con un click
- presets guardados por usuario
- presets del sistema: "Hoy", "Pendientes de pago", "Sin confirmar", "Conflictos", "Mis citas", "Por sala"
- busqueda global siempre visible
- filtros avanzados colapsables
- limpiar todo
- guardar vista actual
- compartir vista por URL interna si el rol tiene permiso

Ejemplos de vistas guardadas:

```txt
Hoy por terapeuta
Semana por sala
Pendientes de pago
Conflictos operativos
Citas sin confirmar
Historial de cliente
```

Regla tecnica:

El frontend no debe filtrar datasets gigantes en memoria como estrategia principal. Para listas grandes, el backend debe resolver filtros, orden, agrupacion y paginacion en SQL. El frontend solo puede hacer refinamientos livianos sobre datos ya acotados.

Para mantener velocidad:

- indices MySQL sobre `starts_at`, `status`, `payment_status`, `therapist_id`, `room_id`, `service_id`, `client_id`
- DTOs especificos por vista
- paginacion o virtualizacion en tablas grandes
- cache Redis para conteos y vistas operativas del dia
- debounce en busquedas
- URL state para reproducir filtros sin recalcular todo innecesariamente

#### 5.11.4 Tarjeta o fila de cita

Cada cita debe mostrar, sin abrir detalles:

- hora inicio-fin
- cliente
- telefono o accion de contacto
- servicio
- terapeuta
- sala
- estado de cita
- estado de pago
- estado de recordatorio
- estado de sync GCal
- indicador de notas
- indicador de alerta o conflicto

La UI debe usar color con moderacion:

- barra lateral semantica para estado principal
- badges compactos para pago/sync/recordatorio
- iconos para acciones frecuentes
- no pintar filas completas salvo alerta critica

Acciones visibles segun rol:

- confirmar
- marcar completada
- marcar no-show
- cancelar
- reagendar
- cambiar sala
- cambiar terapeuta
- enviar recordatorio
- reenviar link de pago
- registrar pago manual
- agregar nota
- abrir ficha del cliente
- abrir evento en Google Calendar

Eliminar cita no debe ser una accion primaria visible todo el tiempo. Debe quedar protegida por permiso, confirmacion y audit log.

#### 5.11.5 Panel lateral de contexto

Al seleccionar una cita, se abre un drawer lateral con el contexto completo:

- resumen de cita
- cliente 360 resumido
- terapeuta y sala actual
- pagos y comprobantes
- ultimos mensajes WhatsApp
- notas de sesion
- timeline de cambios
- eventos GCal
- conflictos detectados
- acciones rapidas

Esto reemplaza la fila expandida gigante de agenda4.0. El drawer permite mantener Control visible mientras se opera el detalle.

#### 5.11.6 Cola de conflictos

El sistema debe elevar a primer plano lo que requiere intervencion humana.

Conflictos iniciales:

- `room_conflict`: dos citas reclaman la misma sala o la sala ya no esta disponible
- `therapist_conflict`: terapeuta ocupado por GCal o por otra cita
- `calendar_sync_failed`: cita existe en MySQL pero fallo GCal
- `calendar_missing_event`: cita confirmada sin `event_id`
- `payment_due_soon`: cita cercana con pago pendiente
- `unconfirmed_near_start`: cita cercana sin confirmacion
- `manual_override_needed`: no se pudo reasignar automaticamente
- `note_missing`: sesion completada sin nota cuando el servicio la requiere

Cada conflicto debe tener:

- severidad
- causa
- cita relacionada
- recurso afectado
- acciones sugeridas
- responsable sugerido
- audit trail

#### 5.11.7 Reasignacion manual desde Control

El admin debe poder cambiar sala o terapeuta desde Control.

Flujo de cambio de sala:

1. Admin elige "Cambiar sala".
2. Backend lista salas compatibles y libres para ese horario.
3. UI muestra disponibilidad y razon de bloqueo para las no disponibles.
4. Admin confirma.
5. Backend toma lock Redis.
6. Backend valida claims MySQL y GCal.
7. Backend libera claim anterior y crea claim nuevo.
8. Backend actualiza cita.
9. Backend actualiza evento GCal con nueva sala.
10. Backend emite evento realtime.
11. Audit log registra usuario, motivo y antes/despues.

Flujo de cambio de terapeuta:

1. Admin elige "Cambiar terapeuta".
2. Backend lista terapeutas compatibles con el servicio.
3. UI muestra disponibilidad real para ese horario.
4. Admin confirma.
5. Backend valida terapeuta, sala, GCal, claims y permisos.
6. Si cambia `calendar_id`, backend mueve o recrea evento en el calendario del nuevo terapeuta.
7. Backend actualiza relacion operativa de la cita.
8. Audit log conserva terapeuta anterior y nuevo.

#### 5.11.8 Realtime y concurrencia en Control

Control debe actualizarse cuando cambie cualquiera de estos elementos:

- cita creada
- cita reagendada
- cita cancelada
- cita completada
- pago actualizado
- sala reasignada
- terapeuta reasignado
- recordatorio enviado
- nota creada
- conflicto creado/resuelto
- sync GCal fallida o recuperada

Socket.IO debe emitir eventos por canales:

```txt
center:operations
operations:date:{yyyy-mm-dd}
room:{room_id}
therapist:{therapist_id}
appointment:{appointment_id}
```

La UI puede hacer optimistic update para acciones simples, pero debe reconciliarse con la respuesta del backend. Si el backend rechaza una accion por conflicto, la UI debe explicar la causa y ofrecer alternativas.

#### 5.11.9 Endpoints sugeridos

```txt
GET  /api/admin/operations/day?date=YYYY-MM-DD
GET  /api/admin/operations/timeline?date=YYYY-MM-DD
GET  /api/admin/operations/rooms?date=YYYY-MM-DD
GET  /api/admin/operations/therapists?date=YYYY-MM-DD
GET  /api/admin/operations/list
GET  /api/admin/operations/conflicts
GET  /api/admin/operations/appointments/:id/context

POST /api/admin/operations/appointments
POST /api/admin/operations/appointments/:id/action
POST /api/admin/operations/appointments/:id/reassign-room
POST /api/admin/operations/appointments/:id/reassign-therapist
POST /api/admin/operations/appointments/:id/reschedule
POST /api/admin/operations/bulk-action
```

`POST /appointments/:id/action` debe aceptar acciones tipadas, por ejemplo:

```txt
confirm
complete
no_show
cancel
send_reminder
send_payment_link
mark_paid
request_note
resolve_conflict
```

#### 5.11.10 Datos minimos para la UI

El backend debe entregar DTOs listos para pintar, sin obligar al frontend a reconstruir reglas complejas.

Campos sugeridos:

- `appointment_id`
- `starts_at`
- `ends_at`
- `local_date_label`
- `local_time_label`
- `client_summary`
- `service_summary`
- `therapist_summary`
- `room_summary`
- `appointment_status`
- `payment_status`
- `reminder_status`
- `calendar_sync_status`
- `notes_summary`
- `risk_flags`
- `available_actions`
- `permissions`
- `audit_summary`

`available_actions` evita que el frontend duplique logica de permisos y estados.

#### 5.11.11 Diseno visual esperado

Direccion visual:

- producto operativo, denso y elegante
- mucha claridad jerarquica
- menos filas gigantes y menos ruido visual
- acciones frecuentes con iconos y tooltips
- detalles en drawer, no en paneles dispersos
- estados semanticos consistentes
- modo compacto para secretaria
- modo amplio para owner/admin

Problemas del diseno actual de agenda4.0 que no se deben repetir:

- tabla como unica forma mental del modulo
- demasiada dependencia de filas expandibles
- acciones destructivas demasiado visibles
- recurrencia ocupando espacio central cuando no sera core
- poca visibilidad de sala y terapeuta como recursos reales
- ausencia de cola de conflictos
- detalles de pago, recordatorio y calendario dispersos
- dificil lectura del "ahora" operativo

#### 5.11.12 Alcance por fases

MVP Control operativa:

- `today_command`
- `day_timeline`
- `list_table`
- drawer de cita
- acciones de estado
- acciones de pago basico
- envio de recordatorio
- realtime basico
- audit log

Etapa salas dentro de Control:

- `room_grid`
- cambio manual de sala
- conflictos de sala
- Socket.IO por sala

Fase Equipo:

- `therapist_grid`
- cambio manual de terapeuta
- conflictos de terapeuta
- visibilidad por permisos

Fase Pro:

- `conflict_queue`
- bulk actions
- exportacion
- command palette
- analitica operacional

### 5.12 Finanzas Enterprise

Finanzas es un modulo de tier alto. Debe ser uno de los argumentos fuertes de venta, pero su alcance debe estar bien limitado.

Principio:

```txt
Finanzas de Super Agenda = control financiero operativo de citas, cobros, terapeutas, facturas solicitadas, liquidaciones y exportaciones.
No es contabilidad general.
```

No debe intentar reemplazar QuickBooks, Xero, un ERP, bancos, caja ni al contador. Debe entregar datos limpios, trazables y exportables para que el centro pueda conciliar fuera de la app con facturas, banco, caja y contabilidad formal.

#### 5.12.1 Alcance incluido

El modulo debe cubrir:

- ingresos por citas
- pagos verificados, pendientes, rechazados y en revision
- comprobantes y OCR
- arancel por cliente/servicio
- porcentaje del centro
- porcentaje o monto fijo del terapeuta
- liquidaciones por terapeuta
- reglas por servicio, terapeuta, modalidad o convenio
- facturas solicitadas por clientes
- marcas y referencias externas de factura
- caja/banco/metodo de pago como referencia informativa
- cierres por periodo
- ajustes manuales con motivo obligatorio
- audit log completo
- exportacion a Google Sheets, CSV y Excel

#### 5.12.2 Fuera de alcance inicial

No construir en el core:

- libro mayor contable completo
- plan de cuentas general
- conciliacion bancaria automatica avanzada
- manejo interno de bancos o caja como fuente de verdad
- depreciaciones
- payroll completo
- declaraciones fiscales oficiales
- facturacion electronica local por pais
- integracion directa con autoridad tributaria
- calculo oficial de IVA/impuestos dentro de la app
- inventario
- cuentas por pagar generales del negocio

Esas funciones pueden vivir como integraciones futuras, no como parte del primer modulo.

#### 5.12.3 Entidades sugeridas

Tablas sugeridas:

- `finance_transactions`
- `finance_payment_allocations`
- `therapist_commission_rules`
- `therapist_settlements`
- `therapist_settlement_items`
- `invoice_requests`
- `external_reconciliation_refs`
- `finance_adjustments`
- `finance_exports`
- `finance_period_closures`

`finance_transactions` representa movimientos operativos derivados de citas/pagos, no asientos contables generales.

Campos clave:

- `source_type` (`appointment`, `payment`, `adjustment`, `settlement`)
- `source_id`
- `client_id`
- `therapist_id`
- `service_id`
- `appointment_id`
- `payment_id`
- `amount`
- `currency`
- `transaction_kind`
- `status`
- `occurred_at`
- `verified_at`
- `created_by_user_id`
- `audit_snapshot_json`

#### 5.12.4 Reglas de liquidacion

Cada cierre debe poder explicar:

```txt
monto cobrado
- porcentaje o fee del centro
- ajustes manuales aprobados
= monto a pagar al terapeuta
```

Las reglas deben poder configurarse por:

- terapeuta
- servicio
- modalidad
- tipo de cliente/convenio
- moneda
- fecha de vigencia

Cada liquidacion debe guardar snapshot de la regla aplicada. Si el admin cambia la regla despues, no debe reescribir cierres historicos.

#### 5.12.5 Facturas, banco y caja como referencias externas

Super Agenda no debe manejar IVA oficial, bancos ni caja como contabilidad formal.

Debe registrar suficiente informacion para que el admin pueda conciliar fuera de la app:

- cliente pidio factura
- numero o referencia de factura si el admin la registra
- metodo de pago declarado
- referencia bancaria/caja si existe
- comprobante asociado
- usuario que verifico
- fecha de verificacion
- notas de conciliacion
- estado de conciliacion externa

Cuando un cliente pide factura:

1. la cita queda marcada como `invoice_requested`.
2. el admin puede registrar `invoice_reference` cuando la factura se emite fuera de Super Agenda.
3. el export incluye columnas para factura solicitada, factura emitida, referencia y notas.
4. el contador/admin cruza esa data con sistema fiscal, banco o caja fuera de la app.

Regla importante:

Super Agenda no calcula IVA oficial ni pretende validar impuestos por pais. Si un centro necesita reflejar descuentos o ajustes relacionados con factura, se registran como ajustes manuales o reglas de liquidacion interna, con motivo y audit log, no como motor tributario.

#### 5.12.6 UX del modulo

Principios UX:

- Finanzas es desktop-first por densidad natural.
- La primera pantalla debe mostrar salud financiera operativa, no contabilidad completa.
- Cada numero importante debe poder trazarse a sesiones, pagos, ajustes y cierres concretos.
- Todo cierre debe ser reproducible: filtros, periodo, usuario, fecha y reglas aplicadas.
- Exportar no es un extra; es parte central del modulo.
- Acciones delicadas deben requerir permisos y audit log.

Vistas principales:

- `finance_command`: resumen del periodo, KPIs, alertas y acciones
- `settlements`: liquidaciones por terapeuta
- `ledger`: movimientos operativos derivados de citas/pagos
- `invoices`: facturas solicitadas y referencias externas
- `exports`: salida a Google Sheets, CSV y Excel
- `adjustments`: ajustes manuales con motivo y aprobacion

Filtros obligatorios:

- periodo
- terapeuta
- servicio
- cliente
- sala si aplica
- estado de pago
- estado de factura
- estado de liquidacion
- moneda
- fuente de pago

Agrupaciones obligatorias:

- por terapeuta
- por servicio
- por cliente
- por fecha
- por estado de pago
- por estado de factura
- por cierre

#### 5.12.7 Exportaciones

Las exportaciones no son accesorias; son parte del producto.

Formatos:

- Google Sheets
- CSV
- Excel `.xlsx`

Cada export debe registrar:

- usuario
- fecha
- filtros aplicados
- columnas incluidas
- periodo
- formato
- hash o identificador del archivo
- estado (`pending`, `completed`, `failed`)

Excel recomendado:

- hoja `resumen`
- hoja `movimientos`
- hoja `liquidaciones`
- hoja `facturas_referencias`
- hoja `ajustes`

#### 5.12.8 Control de complejidad

Advertencia tecnica:

Si Finanzas intenta ser contabilidad completa, el proyecto sube mucho en deuda tecnica, responsabilidad legal, QA y soporte.

Version sana:

- calcular bien lo que nace de citas y pagos
- cerrar periodos de manera reproducible
- liquidar terapeutas con reglas claras
- registrar facturas, banco y caja como referencias externas
- exportar perfecto para contador

Version peligrosa:

- plan de cuentas completo
- asientos dobles
- conciliacion bancaria avanzada
- impuestos oficiales por pais
- payroll completo

La version peligrosa debe evitarse en el core.

---

### 5.13 Insights

Insights es una pagina visible del admin desde el inicio. No debe ser un sistema analitico paralelo ni una fuente de verdad nueva; debe ser una capa visual y de agregacion sobre datos que Super Agenda ya genera:

- citas
- pagos
- clientes
- no-shows
- ocupacion de salas
- terapeutas
- servicios
- cancelaciones y reagendamientos
- estados de recordatorios y comunicacion

Regla principal:

- **Control** responde "que hay que resolver ahora".
- **Insights** responde "que esta pasando en el negocio".

Ejemplos:

- No-show de una cita concreta hoy -> Control.
- Tasa mensual de no-show por terapeuta o servicio -> Insights.
- Pago pendiente de una cita que empieza en 30 minutos -> Control.
- Cobros por semana, mora promedio y servicios mas vendidos -> Insights.
- Conflicto de sala activo -> Control.
- Ocupacion de salas por franja horaria -> Insights.

Alcance inicial de `insights-basic`:

- KPIs livianos de citas: agendadas, completadas, canceladas, reagendadas y no-show.
- Ocupacion simple por terapeuta, servicio y sala.
- Tendencia semanal/mensual de sesiones y clientes.
- Pagos cobrados vs pendientes como lectura general, sin reemplazar Finanzas.
- Top servicios y terapeutas por volumen.

Alcance Pro de `insights-advanced`:

- comparativas entre periodos
- cohorts simples de retencion
- segmentos de clientes
- tendencias por terapeuta/servicio/sala
- motivos agregados de no-show, cancelacion y reasignacion
- snapshots periodicos para consultas rapidas
- exportaciones y vistas guardadas

Control de complejidad:

- no crear warehouse inicial
- no duplicar modelos fuente
- no recalcular datasets grandes en frontend
- no bloquear Booking ni Control con consultas pesadas
- usar queries agregadas, snapshots, jobs BullMQ y cache Redis cuando una metrica sea cara
- diferenciar siempre metricas historicas de alertas operativas

Insights puede ser liviano sin ser decorativo. Su valor comercial es alto porque ayuda al owner a entender el negocio sin aumentar mucho el peso tecnico si se mantiene como lectura agregada sobre datos existentes.

---

## 6. Flujo de Booking

Booking es la cara publica de Super Agenda. Es la experiencia tipo Calendly que ve el cliente final.

No es una pagina del admin. Vive en `web-booking`, debe ser mobile-first y debe estar skinneada con la marca del centro.

Booking debe cubrir:

- `screen1` como entrada publica inicial configurable por centro
- identificacion por WhatsApp
- registro minimo de cliente nuevo
- seleccion de servicio
- seleccion por enfoque/terapia cuando el centro lo necesite
- seleccion opcional de terapeuta si el centro lo permite
- calendario de dias disponibles
- slots realmente reservables
- lock temporal del slot
- confirmacion de cita
- instrucciones de pago
- reagendamiento implicito al detectar cita futura por WhatsApp
- reagendamiento por link/token
- cancelacion por link/token segun politica del centro
- mensajes claros cuando no hay disponibilidad
- estados de espera, error y exito

No es prioridad inmediata que el catalogo publico exponga descripcion, precio, modalidad o foto/perfil publico del terapeuta. El catalogo minimo actual es suficiente para Booking v1. Cuando se necesite enriquecer la experiencia, esos datos deben venir desde Equipo/Servicios y no hardcodearse en `web-booking`.

Booking comparte motor con Control:

```txt
availability-engine
+ terapeutas
+ salas
+ bloqueos internos (`resource_blocks`)
+ Redis locks
+ MySQL claims
+ citas existentes
= disponibilidad real
```

Pero Booking no ofrece controles internos: no muestra claims, locks, conflictos tecnicos, audit logs ni reasignaciones manuales de sala.

### 6.0 Screen1 - entrada publica del Booking

`screen1` es el nombre interno para la primera pantalla del cliente en `web-booking`.

No debe ser una landing page larga. Debe ser una pantalla de decision rapida:

```txt
quiero agendar algo nuevo
quiero gestionar una cita existente
```

`screen1` debe adaptarse al tipo de centro:

- **Agenda personal / un terapeuta:** puede empezar por calendario y slots, como agenda4.0.
- **Centro multi-servicio:** debe empezar por servicio o categoria antes de mostrar disponibilidad.
- **Centro con muchos enfoques y terapeutas:** debe ofrecer elegir por enfoque/terapia o por terapeuta.

Acciones persistentes de `screen1`:

- agendar nueva cita
- gestionar mi cita
- reagendar
- cancelar

Para centros multi-servicio, reagendar/cancelar no debe depender de haber elegido servicio o terapeuta. El cliente entra por "Gestionar mi cita", ingresa WhatsApp y el backend recupera el contexto desde la cita futura:

- cliente
- servicio
- terapeuta
- sala
- fecha/hora
- politica de cancelacion/reagendamiento
- estado de pago

Si existe una sola cita futura, se muestra directamente. Si existen varias, el cliente elige cual gestionar. Caso real esperado: un cliente puede tener una cita de Tarot y otra de Reiki; el sistema debe preguntar cual quiere modificar en vez de asumir la proxima por fecha.

#### 6.0.0.1 Variante Luna Mandala

Luna Mandala debe priorizar servicio porque la mayoria de agendamientos empiezan por la terapia buscada.

Flujo recomendado:

```txt
screen1
-> elegir servicio: Tarot, Reiki, Registros, Masaje, etc.
-> opcion secundaria: elegir terapeuta directamente
-> sistema sugiere terapeuta por disponibilidad real + fairness
-> cliente puede aceptar sugerencia o elegir terapeuta manualmente
-> calendario muestra dias/horas realmente reservables
-> WhatsApp
-> datos minimos si es nuevo
-> confirmar
```

Copy sugerido:

```txt
Que sesion buscas?
[Tarot] [Constelaciones] [Reiki] ...

Ya tienes una cita?
[Gestionar mi cita]
```

#### 6.0.0.2 Variante SerLibre

SerLibre tiene muchos terapeutas y muchos enfoques. `screen1` debe ayudar a elegir sin abrumar.

Flujo recomendado:

```txt
screen1
-> "Como quieres buscar?"
   [Por enfoque o terapia]
   [Por terapeuta]
   [No se, quiero orientacion]
```

**Por enfoque o terapia:**

- buscador con autocompletado
- chips/categorias de enfoques populares
- resultados con breve descripcion
- al elegir enfoque, se muestran terapeutas compatibles
- el sistema recomienda la opcion con mejor disponibilidad real
- calendario se calcula con terapeutas compatibles + salas

**Por terapeuta:**

- buscador por nombre
- filtros por enfoque, modalidad, idioma o disponibilidad
- perfil breve del terapeuta
- al elegir terapeuta, se muestran servicios/enfoques que ofrece
- calendario se calcula para ese terapeuta + servicio + sala

**No se, quiero orientacion:**

- preguntas muy cortas, no diagnosticas
- objetivo: reducir opciones, no hacer evaluacion clinica
- devuelve 2-3 enfoques/servicios sugeridos
- permite saltar a "hablar con el centro" si no hay claridad

Regla UX:

- no mostrar calendario hasta tener al menos servicio/enfoque o terapeuta+servicio.
- mantener siempre visible "Gestionar mi cita".
- no esconder la eleccion manual de terapeuta, pero tampoco hacerla obligatoria.
- si el sistema sugiere terapeuta, explicar con lenguaje simple: "Te ofrecemos trabajar con X porque tiene el horario mas cercano disponible para este servicio".

#### 6.0.1 Reagendamiento implicito

La experiencia publica debe conservar el buen patron de agenda4.0 cuando aplica, pero no debe forzarlo en centros multi-servicio.

```txt
cliente entra a Booking
-> elige o revisa un slot
-> ingresa WhatsApp
-> el sistema detecta que ya tiene cita futura
-> muestra aviso claro: "Ya tienes una cita agendada"
-> presenta la cita actual y la nueva propuesta
-> permite confirmar el cambio o mantener la cita actual
```

En una agenda personal o de un solo terapeuta, no hace falta que el cliente entre por un boton separado de "Reagendar": detectar la intencion por WhatsApp y cita futura reduce decisiones.

En centros multi-servicio como Luna Mandala o SerLibre, `screen1` debe mostrar accion explicita de **Gestionar mi cita** / **Reagendar o cancelar**, porque el flujo normal empieza por servicio/enfoque/terapeuta. En ese caso el cliente ingresa WhatsApp antes de elegir nuevo servicio u hora, y el backend recupera la cita futura.

Reglas:

- si el cliente tiene cita futura, Booking no debe crear otra cita por accidente sin avisar.
- debe mostrar la cita actual antes de confirmar cualquier cambio.
- debe usar token opaco/firmado de reagendamiento para autorizar la accion sin login.
- el token debe expirar y estar asociado a cliente, cita, telefono e instalacion.
- debe existir una accion visible para mantener la cita actual.
- si el cliente tiene multiples citas futuras, `identify` debe devolver una lista de citas gestionables y Booking debe pedir cual gestionar.
- en centros multi-servicio ya no se debe asumir que "la proxima cita" es la cita correcta a gestionar.

Adaptacion para Super Agenda:

agenda4.0 crea la nueva cita y luego elimina la vieja como patron de compensacion. En Super Agenda no conviene borrar la cita vieja sin rastro. El patron correcto es:

```txt
1. bloquear nuevo slot con Redis
2. validar terapeuta + sala + GCal
3. reservar claims nuevos dentro de transaccion
4. actualizar la cita existente o crear nueva version historica segun modelo final
5. liberar claims anteriores solo cuando el nuevo estado queda seguro
6. mover/recrear evento GCal
7. guardar appointment_status_history + audit log + timeline
```

El principio a conservar es: si el reagendamiento falla, el cliente conserva su cita original.

### 6.1 Entrada publica

El cliente entra a una URL publica de marca blanca:

```txt
/booking
/booking?service=...
/booking?therapist=...
```

Pasos:

1. `screen1` define intencion: agendar nueva cita o gestionar cita existente.
2. Si gestiona cita existente, ingresa WhatsApp y el backend recupera citas futuras.
3. Si agenda nueva cita, selecciona servicio/enfoque o terapeuta segun configuracion del centro.
4. Sistema sugiere terapeuta o permite elegir manualmente.
5. Sistema calcula slots con terapeuta + sala + GCal.
6. Cliente elige slot.
7. Cliente ingresa WhatsApp.
8. Si es nuevo, registra datos minimos.
9. Redis bloquea temporalmente terapeuta+sala+hora.
10. Cliente confirma.
11. MySQL crea cita.
12. Google Calendar crea evento en el calendario del terapeuta via worker.
13. Se libera lock cuando corresponde.
14. Se envia confirmacion y cobro.

### 6.2 Locking

Key sugerida:

```txt
slot_lock:{therapist_id}:{room_id}:{starts_at_utc}
```

Valor:

```json
{
  "lock_token": "...",
  "client_id": 123,
  "service_id": 4,
  "expires_at": "..."
}
```

TTL: 180 segundos.

El lock Redis evita doble seleccion simultanea. La transaccion MySQL y la revalidacion de claims/bloqueos internos evitan confirmaciones falsas.

Confirmacion robusta:

1. tomar lock Redis
2. revalidar claims y bloqueos internos
3. iniciar transaccion MySQL
4. crear cita como `confirmed`
5. insertar claims de terapeuta y sala
6. crear pago pendiente si aplica
7. commit
8. encolar sync de espejo externo opcional
9. actualizar `sync_status` (`pending`, `synced`, `failed`) sin revertir la cita
10. liberar lock
11. enviar confirmacion al cliente

Si Google Calendar falla, la cita queda reteniendo los claims para no liberar falsamente el horario. El worker `calendar-sync` repara y el admin ve estado de sync externo pendiente/fallido.

### 6.2.1 Concurrencia e invalidacion inmediata

La concurrencia es critica. Varios clientes pueden estar mirando y tomando horas al mismo tiempo.

Garantias:

- Redis guarda locks temporales de seleccion.
- MySQL guarda claims definitivos por recurso/minuto.
- el espejo externo no se usa para decidir disponibilidad antes de confirmar.
- Socket.IO actualiza admin/secretaria en tiempo real.
- La cache de disponibilidad se invalida inmediatamente al tomar, confirmar, cancelar o reasignar un slot.

Redis debe usarse para:

- cache de disponibilidad calculada por recurso/rango corto
- cache de disponibilidad calculada por servicio/dia
- locks atomicos `SET NX EX`
- pub/sub de invalidacion entre procesos
- rate limiting publico

Keys sugeridas:

```txt
resource_blocks:{resource_type}:{resource_id}:{date}
availability:{service_id}:{date}:{therapist_id_or_all}
room_availability:{room_id}:{date}
slot_lock:{therapist_id}:{room_id}:{starts_at_utc}
availability_version:{service_id}:{date}
```

TTL sugeridos:

- Resource blocks cache: 30-90 segundos
- Availability publica: 10-30 segundos
- Slot lock: 180 segundos

Eventos de invalidacion:

- `appointment.locked`
- `appointment.confirmed`
- `appointment.cancelled`
- `appointment.rescheduled`
- `room.reassigned`
- `therapist.schedule_updated`
- `room.schedule_updated`
- `calendar.sync_detected_change`

Al tomar una hora:

1. `POST /booking/lock` intenta `SET NX`.
2. Si falla, el slot ya no se ofrece a ese cliente.
3. Se incrementa `availability_version`.
4. Se publica evento `availability:changed`.
5. Los clientes/admin conectados reciben actualizacion por Socket.IO o re-fetch inmediato.

El objetivo operativo es que una sala tomada hace 1 segundo deje de aparecer como disponible en la siguiente lectura de disponibilidad. No se promete sincronizacion fisica perfecta con Google Calendar en 1 segundo, pero si se promete consistencia interna inmediata mediante Redis + MySQL.

### 6.3 Round robin

El round robin no debe ser solo "el siguiente terapeuta". Debe ser una asignacion ciclica inteligente sobre disponibilidad real de terapeuta y sala.

Debe ponderar:

- terapeutas que ofrecen el servicio
- proximo slot real
- carga mensual
- preferencias del centro
- terapeutas bloqueados/inactivos
- salas compatibles
- fairness configurable

Objetivo:

Para una terapia ofrecida por varios terapeutas, el sistema debe mostrar y asignar horarios donde exista simultaneamente:

- un terapeuta compatible disponible
- una sala compatible disponible
- un calendario Google libre para ese terapeuta
- ausencia de claims existentes
- ausencia de lock activo incompatible

La asignacion ciclica es transparente para el cliente. El cliente ve dias y horas disponibles; no necesita entender que terapeuta o sala fueron evaluados internamente.

### 6.3.1 Round robin inteligente de terapeutas

Para un servicio como Reiki ofrecido por tres terapeutas, el sistema no elige mecanicamente "el siguiente de la lista".

Reglas:

- La cuenta interna de round robin sirve como desempate y fairness, no como obligacion ciega.
- Si un terapeuta ya tuvo una cita a las 08:00 y sigue siendo la mejor opcion disponible para las 18:00, puede volver a ser asignado.
- El criterio principal es encontrar el slot real mas pronto y util para el cliente.
- El sistema debe evitar concentrar injustamente la carga cuando hay opciones equivalentes.

Score sugerido por candidato terapeuta-slot:

```txt
score =
  minutos_hasta_slot * peso_proximidad
  + carga_periodo * peso_fairness
  + penalizacion_si_fue_ultimo_asignado
  + prioridad_manual_del_admin
```

El menor score gana.

Empates:

1. menor hora disponible
2. menor carga del periodo
3. terapeuta que no fue ultimo asignado para ese servicio
4. menor id estable

### 6.3.2 Round robin de salas conjugado con terapeutas

La sala no se asigna despues como detalle decorativo. La sala participa en la disponibilidad desde el inicio.

Para cada candidato de terapeuta y hora:

1. obtener salas compatibles con el servicio
2. filtrar salas activas
3. filtrar horario de sala
4. filtrar excepciones/cierres
5. filtrar claims existentes
6. filtrar locks Redis
7. elegir sala por fairness de uso y estado interno de round robin

Score sugerido por candidato sala:

```txt
score =
  uso_sala_periodo * peso_fairness
  + penalizacion_si_fue_ultima_sala_para_servicio
  + prioridad_manual_sala
```

La combinacion final elegida es:

```txt
service_id + therapist_id + room_id + starts_at + ends_at
```

Si no hay sala compatible libre, el slot no existe aunque haya terapeuta libre.

Si no hay terapeuta compatible libre, el slot no existe aunque haya sala libre.

### 6.3.3 Algoritmo inicial

1. obtener terapeutas activos del servicio
2. cargar disponibilidad configurada de cada terapeuta
3. cargar bloqueos internos por terapeuta/sala (`resource_blocks`)
4. cruzar disponibilidad base con excepciones y bloqueos internos
6. generar candidatos terapeuta-slot dentro de la ventana configurada
7. para cada candidato, buscar salas compatibles disponibles
8. descartar candidatos sin sala
9. filtrar claims definitivos y locks temporales
10. calcular score de terapeuta
11. calcular score de sala
12. ordenar por fecha/hora y score total
13. devolver dias/horas disponibles al frontend
14. al confirmar, bloquear Redis con terapeuta+sala+hora
15. revalidar bloqueos internos, claims y locks
16. persistir cita y claims; luego encolar espejo externo opcional

### 6.3.3.1 Lectura batch de bloqueos internos

Para rapidez, el motor no debe consultar recurso por recurso en serie.

Debe cargar bloqueos internos por lote:

```txt
service_id -> terapeutas compatibles -> resource_blocks batch -> ranges ocupados por terapeuta/sala
```

Entrada:

- `service_id`
- rango de fechas
- terapeuta manual opcional

Proceso:

1. resolver terapeutas compatibles
2. consultar `resource_blocks` por set de terapeutas/salas
3. normalizar rangos ocupados por terapeuta y fecha
4. guardar resultado en Redis con TTL corto
5. cruzar con disponibilidad interna, claims y locks

Esto permite calcular disponibilidad de un servicio completo sin hacer N viajes lentos cuando hay muchos terapeutas.

### 6.3.4 Disponibilidad publica

El calendario publico solo muestra slots realmente reservables.

Reglas:

- Dia gris/desactivado si no existe ninguna combinacion valida terapeuta+sala para el servicio.
- Hora visible solo si existe una combinacion valida terapeuta+sala.
- El frontend no debe mostrar una hora "tentativa" que despues depende de conseguir sala.
- La asignacion round robin puede mantenerse oculta hasta la confirmacion, salvo que el centro decida mostrar terapeuta antes.
- Si el cliente elige manualmente terapeuta, el sistema filtra por ese terapeuta y sigue exigiendo sala compatible.
- Si el centro permite elegir sala manualmente solo para admins, el cliente nunca ve salas como decision.

Endpoints sugeridos:

```txt
GET /api/public/availability/days?service_id=...
GET /api/public/availability/slots?service_id=...&date=...
GET /api/public/availability/slots?service_id=...&therapist_id=...&date=...
POST /api/public/booking/lock
POST /api/public/booking/confirm
GET /api/public/booking/manage/:token
POST /api/public/booking/reschedule/:token/lock
POST /api/public/booking/reschedule/:token/confirm
POST /api/public/booking/cancel/:token
```

Respuesta de slots publica:

```json
{
  "date": "2026-05-14",
  "slots": [
    {
      "starts_at": "2026-05-14T18:00:00-04:00",
      "display_time": "18:00",
      "availability_token": "opaque-token",
      "therapist_public_preview": null
    }
  ]
}
```

`availability_token` debe ser opaco. El cliente no debe poder manipular `therapist_id` o `room_id` escondidos en el frontend. El backend revalida todo al bloquear y confirmar.

### 6.4 Gestion publica de cita

El cliente debe poder gestionar su cita sin crear cuenta.

Acceso:

- link seguro enviado por WhatsApp
- token opaco con expiracion o revocacion
- validacion adicional por WhatsApp si el centro lo exige

Pantalla publica de gestion:

- resumen de cita
- servicio
- fecha/hora
- terapeuta si el centro lo muestra
- estado de pago
- instrucciones de pago
- acciones permitidas por politica:
  - reagendar
  - cancelar
  - enviar comprobante o instrucciones para enviarlo por WhatsApp
  - volver a agendar otra sesion

Reglas:

- si la politica de cancelacion ya no permite cancelar, mostrar mensaje claro y opcion de contactar al centro
- si la politica de reagendamiento ya no permite mover, mostrar mensaje claro y opcion de contactar al centro
- el mensaje de politica no debe ser un warning pequeño al final de la tarjeta; debe ser un panel prominente, cercano a las acciones, con icono de advertencia y texto legible
- si el cliente acepta condiciones, el frontend habilita cancelar/reagendar y la API recibe `policyAcknowledged: true`
- aceptar condiciones no elimina la multa; solo deja trazado que el cliente entiende la politica antes de continuar
- si el cliente elige hablar con alguien, el frontend registra un evento interno y abre WhatsApp con mensaje prellenado
- al reagendar, se recalcula disponibilidad real completa
- al cancelar, se libera sala y terapeuta solo despues de actualizar cita, claims, worker y Google Calendar segun configuracion
- toda accion publica debe quedar en audit log y timeline del cliente

Politica configurable:

- las horas minimas de antelacion para cancelar/reagendar se configuran en Ajustes
- la penalidad por cambio tardio/no asistencia tambien se configura en Ajustes
- para el mock/default inicial usar 6 horas de antelacion y 50% de la sesion no atendida
- el backend calcula la politica contra `starts_at` de la cita y devuelve acciones permitidas o bloqueadas

Copy base cuando la politica se viola:

```txt
[nombre], tal como lo habiamos especificado en recordatorios, los cambios a las horas fijadas deben realizarse con un minimo de [horas] de antelacion. Caso contrario se cobrara [porcentaje]% de la sesion no atendida.
```

Acciones del panel de politica:

- **Aceptar condiciones:** activa Reagendar/Cancelar y envia `policyAcknowledged=true` al backend.
- **Hablar con alguien:** crea evento `booking_support_requested`, abre `wa.me` del centro con el texto "Necesito hablar sobre la cancelacion o reagendamiento de mi cita.", y debe generar toast + notificacion persistente para secretaria/admin cuando exista la superficie Admin. Ademas, el evento debe quedar registrado en un lugar consultable (ej. card/timeline del cliente y/o cola de Control).

### 6.4.1 Contrato publico de gestion

`POST /api/public/booking/identify` debe evolucionar para soportar varias citas futuras:

```json
{
  "status": "existing",
  "client": {
    "id": 123,
    "phone_e164": "+59170000000",
    "full_name": "Nombre Cliente"
  },
  "appointments": [
    {
      "management_token": "opaque-token",
      "service_name": "Tarot",
      "starts_at": "2026-05-14T18:00:00-04:00",
      "therapist_name": "Terapeuta A",
      "available_actions": [
        {
          "action": "reschedule",
          "allowed": true
        },
        {
          "action": "cancel",
          "allowed": false,
          "reason": "minimum_notice_violation",
          "minimum_notice_hours": 6,
          "penalty_percent": 50,
          "message_template_key": "booking.policy.minimum_notice_violation"
        }
      ]
    }
  ]
}
```

Reglas del contrato:

- `appointments` reemplaza a depender solo de `nextAppointment`; `nextAppointment` puede existir temporalmente por compatibilidad v0, pero no debe ser el contrato final.
- cada cita gestionable debe tener `management_token` opaco, firmado, expirable y revocable.
- cancelar/reagendar debe usar el token, no `appointmentId + phone`.
- `appointment_id`, `client_id`, `therapist_id` y `room_id` internos no deben ser necesarios para que el frontend gestione una cita publica.
- `available_actions` es la fuente de verdad para pintar botones, mensajes bloqueados y alternativas.
- el frontend puede ordenar o agrupar citas, pero no recalcula politica ni permisos.
- si una accion esta bloqueada por `minimum_notice_violation`, la accion publica solo puede proceder si el request trae `policyAcknowledged: true`.
- `POST /api/public/booking/support-request` registra solicitudes del cliente para hablar con el centro sobre cancelacion/reagendamiento; inicialmente puede encolar una notificacion interna aunque Admin todavia no este construido.

Endpoints admin para reasignaciones desde Control:

```txt
GET /api/admin/operations/rooms?date=...
GET /api/admin/operations/timeline?date=...
GET /api/admin/operations/reassignment-board?date=...
POST /api/admin/operations/appointments/:id/reassign-room
POST /api/admin/operations/appointments/:id/reassign-therapist
```

---

## 7. Google Calendar

### 7.1 Modelo operativo

Cada centro debe tener un Google Calendar oficial.

Dentro de ese entorno se crean o registran calendarios por terapeuta:

```txt
Centro Oficial
  - Agenda Dra. A
  - Agenda Dr. B
  - Agenda Terapia Grupal
```

Cada calendario tiene un `calendar_id`.

Super Agenda escribe eventos en el calendario del terapeuta usando ese `calendar_id`.

El terapeuta recibe acceso al calendario desde su correo Google y lo ve en su telefono. Esto reemplaza la necesidad de app iOS/Android.

### 7.2 Reglas de sync

Al crear cita:

- crear registro en MySQL
- crear evento en GCal
- guardar `event_id`
- guardar `calendar_id`
- guardar snapshot de terapeuta, servicio, sala y cliente

Al reagendar:

- verificar nuevo slot
- actualizar cita
- mover evento existente en GCal si existe
- si cambia terapeuta, borrar/archivar evento anterior y crear nuevo en nuevo calendario

Al cancelar:

- marcar cita como cancelada en MySQL
- cancelar o borrar evento GCal segun configuracion
- guardar historico

Al marcar no-show:

- no borrar evento GCal
- cambiar estado en MySQL
- opcionalmente actualizar titulo/color del evento
- crear alerta operativa para Control si la cita corresponde al dia operativo
- marcar sala como liberable o revisar segun politica del centro
- permitir accion rapida: liberar sala, mantener bloqueo, contactar cliente o reagendar
- registrar evento en timeline del cliente y metricas del terapeuta
- alimentar Insights solo como agregado historico, no como accion principal

### 7.3 Bloqueos internos

La ocupacion operativa del terapeuta y la sala se calcula con DB interna.

Los bloqueos manuales se guardan como `resource_blocks` y afectan slots publicos inmediatamente.

Regla:

Si existe un `resource_block` activo, Super Agenda no ofrece ese slot aunque no haya una cita confirmada.

El calculo final de slots ofrecibles:

```txt
slot ofrecible = horario_base - excepciones - resource_blocks - claims - locks
```

---

## 8. Workers y Eventos

### 8.1 Colas BullMQ

Colas iniciales:

- `calendar-sync`
- `reminders`
- `payments`
- `ocr`
- `notifications`
- `retention`
- `reports`
- `meta-health`
- `ops-heartbeat`

### 8.2 Domain events

Eventos internos:

- `appointment.created`
- `appointment.confirmed`
- `appointment.rescheduled`
- `appointment.cancelled`
- `appointment.completed`
- `appointment.no_show`
- `appointment.room_reassigned`
- `appointment.therapist_reassigned`
- `appointment.conflict_detected`
- `appointment.conflict_resolved`
- `appointment.reminder_sent`
- `payment.proof_received`
- `payment.verified`
- `payment.rejected`
- `calendar.sync_failed`
- `calendar.sync_recovered`
- `client.created`
- `client.metrics_recalculated`
- `client.segment_changed`
- `client.churn_risk_changed`
- `client.nurture_due`
- `client.nurture_sent`
- `client.therapist_relationship_changed`
- `session.note_created`
- `session.note_needs_review`
- `module.enabled`
- `module.disabled`
- `ops.health_degraded`
- `ops.health_recovered`
- `ops.incident_created`
- `internal_notification.created`
- `internal_notification.read`
- `internal_notification.dismissed`

Los modulos reaccionan a eventos, no a llamadas directas entre todos.

Ejemplo:

```txt
appointment.confirmed
  -> notifications crea aviso interno si corresponde
  -> notifications envia WhatsApp si corresponde
  -> calendar verifica sync
  -> finance crea entrada proyectada si modulo activo
  -> insights actualiza metricas si la pagina esta activa en la instalacion
  -> crm recalcula relacion y riesgo si modulo activo
```

### 8.3 Control total de comunicaciones

El admin debe controlar casi todo lo que el sistema comunica, dentro de lo que permitan WhatsApp, seguridad y reglas legales.

Esta seccion cubre comunicaciones externas y mensajes internos configurables. El centro de notificaciones interno se define en `5.9.1`: campanita, toasts, persistencia, dedupe y preferencias de usuario.

Configurable desde panel:

- texto de confirmacion de cita
- texto de recordatorio de cita
- texto de solicitud de pago
- texto de recordatorio de pago
- texto de pago verificado
- texto de comprobante rechazado
- texto de reagendamiento
- texto de cancelacion
- texto de no-show si se usa
- mensajes internos al equipo
- mensajes al terapeuta
- horarios de envio
- cuantas veces insistir
- canal de envio
- si se notifica o no al terapeuta
- si se notifica o no al admin

No configurable por seguridad:

- validacion de firma de webhooks
- permisos
- limites de rate limit
- datos obligatorios legales o de auditoria
- variables internas necesarias para trazabilidad

Cada comunicacion debe pasar por un `MessageRenderer`:

```txt
trigger + template_key + entity_id + variables -> rendered_message -> delivery
```

El codigo nunca debe decir directamente:

```txt
"Tu cita esta confirmada..."
```

Debe pedir:

```txt
renderTemplate("appointment.confirmed.client", variables)
```

Variables iniciales:

- `client.first_name`
- `client.full_name`
- `appointment.date`
- `appointment.time`
- `appointment.timezone`
- `appointment.service_name`
- `appointment.therapist_name`
- `appointment.room_name`
- `payment.amount`
- `payment.currency`
- `booking.link`
- `reschedule.link`
- `center.name`
- `center.whatsapp`
- `center.address`
- `center.cancellation_policy`

El admin debe poder hacer preview antes de activar un template.

### 8.4 Reporte central de salud

Cada instalacion debe reportar salud tecnica a Super Agenda Control mediante `ops-heartbeat`.

Estados sugeridos:

- `ok`
- `degraded`
- `warning`
- `critical`
- `offline`

Componentes iniciales:

- API
- worker
- MySQL
- Redis
- storage
- Google Calendar
- WhatsApp/Meta
- OCR
- reminders
- backups
- dominio/SSL

Reglas:

- el reporte debe ser redacted/anonymized por defecto
- los errores repetidos se agrupan por fingerprint
- una falla critica crea incidente central
- una falla recuperada cierra o marca el incidente como recuperado
- el admin del centro solo ve mensajes accionables, no diagnosticos tecnicos crudos
- la secretaria solo ve impacto operativo cuando debe actuar
- cualquier acceso de soporte a una instalacion debe quedar auditado

Ejemplo de degradacion:

```txt
Meta webhook failing
  -> ops-heartbeat reporta critical a Super Agenda Control
  -> owner/admin ve aviso simple en Ajustes/Control
  -> secretaria ve aviso operativo solo si afecta mensajes del dia
```

---

## 9. Seguridad y Auditoria

Obligatorio:

- passwords con Argon2id o bcrypt fuerte
- JWT corto + refresh token rotativo
- rate limit en endpoints publicos
- validacion HMAC de webhooks Meta
- RBAC en backend
- audit log para cambios sensibles
- backups automaticos MySQL
- backups de storage
- secrets fuera del repo
- permisos minimos para cuentas Google
- logs estructurados
- redaccion de datos sensibles antes de enviar health checks a Super Agenda Control
- audit log para acciones de soporte central

Audit log:

- quien cambio
- que cambio
- antes/despues cuando aplique
- modulo afectado
- IP/user agent cuando aplique

---

## 10. Tiers Comerciales Sugeridos

### Starter

- booking publico
- clientes
- pagina Equipo operativa
- terapeutas
- perfil publico del terapeuta
- disponibilidad por terapeuta
- aranceles/precios operativos por servicio
- servicios
- Google Calendar por terapeuta
- pagos basicos por QR/comprobante
- recordatorios WhatsApp configurables
- editor basico de mensajes
- Insights basico: metricas livianas de citas, no-show, ocupacion y clientes

### Standard

- todo Starter
- salas
- asignacion automatica de salas
- rol secretaria
- inbox WhatsApp
- pagos con OCR
- realtime basico
- reglas de comunicacion por trigger

### Pro

- todo Standard
- finanzas
- gastos
- liquidaciones
- Insights avanzados
- CRM avanzado
- retencion
- therapist-success: metas, reportes y seguimiento por WhatsApp para terapeutas
- exportaciones
- Meta Health resumido para owner/admin
- versionado avanzado de templates y auditoria de mensajes

### Enterprise

- todo Pro
- IA
- integraciones especiales
- reportes custom
- permisos avanzados
- personalizaciones por contrato

---

## 11. Plan de Build

### Fase 0 - Fundacion

- crear monorepo
- configurar TypeScript, lint, tests
- Docker Compose local
- Coolify-ready compose
- MySQL migrations
- Redis
- API health checks
- contrato de `ops-heartbeat`
- `support-agent` redacted por instalacion
- frontend base
- sistema de settings tipado
- brand settings

### Fase 1 - Core operativo

- usuarios, login, roles y permisos
- pagina Equipo
- terapeutas: perfil publico, enfoque, foto, contacto interno, activo/inactivo
- disponibilidad y excepciones por terapeuta
- aranceles/precios operativos por terapeuta-servicio cuando aplique
- servicios
- clientes
- CRM deluxe inicial: ficha 360, metricas basicas, fidelidad/churn, notas y timeline
- Google Calendar por terapeuta con `calendar_id`
- horarios y excepciones
- disponibilidad basica
- motor de salas como recurso central
- citas
- Control operativa MVP
- booking publico
- Control basica para admin/secretaria

### Fase 2 - Disponibilidad real y salas dentro de Control

- salas
- service_rooms
- room schedules/exceptions
- algoritmo slots terapeuta+sala
- Redis locks
- round robin terapeuta
- round robin sala
- Control con override manual de sala
- vista `room_grid`
- tablero tactico de salas con drag/drop, locks visibles, motivos y auditoria

### Fase 3 - Comunicacion y pagos

- WhatsApp Cloud API
- templates
- QR/cuenta bancaria configurable
- comprobantes
- OCR
- verificacion manual
- recordatorios con BullMQ
- centro de notificaciones interno
- toasts de eventos operativos
- inbox basico

### Fase 4 - Operacion interna

- rol secretaria
- Control diaria avanzada
- realtime con Socket.IO
- acciones de cita
- vista `therapist_grid`
- drawer de contexto de cita
- cola inicial de conflictos
- audit log completo
- backups
- Meta Health resumido
- Super Agenda Control inicial para Daniel

### Fase 5 - Modulos Pro

- finanzas
- gastos
- liquidaciones
- P&L
- CRM avanzado
- ficha 360 de cliente
- loyalty score
- churn risk score
- segmentos de relacion
- nurture configurable
- insights-advanced
- retencion
- exportaciones
- therapist-success

### Fase 6 - Inteligencia

- resumen automatico de conversaciones
- clasificacion de leads
- sugerencias de seguimiento
- deteccion de riesgo de no-show
- asistente interno para admin

---

## 12. Criterios de Calidad

Super Agenda esta lista para vender cuando:

- puede instalarse limpia para un centro nuevo
- cambia marca, skin y apariencia visual sin tocar codigo
- configura Equipo con terapeutas, disponibilidad, calendarios, servicios y aranceles
- crea citas con terapeuta + sala sin doble reserva
- escribe cada cita en el Google Calendar correcto
- permite que terapeutas vean su calendario desde el celular
- soporta roles administrativos
- envia confirmaciones y recordatorios configurables por admin
- procesa pagos manuales y OCR
- permite activar/desactivar modulos por tier
- declara que modulos son mobile-first, responsive, desktop-first o desktop-only
- tiene backups y logs suficientes para soporte real
- reporta salud tecnica a Super Agenda Control sin exponer datos sensibles

---

## 13. Logica Reusable de agenda4.0

La agenda personal existente no debe copiarse como base literal, pero contiene logica probada que conviene extraer y redisenar para Super Agenda.

### 13.1 Reutilizar como patron

- **Wrapper de Google Calendar:** separar `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`; en Super Agenda debe recibir siempre `calendar_id` por terapeuta, no una variable global.
- **Parsing de eventos ocupados:** conservar la idea de convertir eventos GCal, incluidos eventos de dia completo, a rangos ocupados por fecha.
- **Identificacion por telefono:** flujo `new / returning / has_appointment` es valido para booking publico.
- **Contexto de booking:** guardar timezone, pais, dispositivo y user agent ayuda a soporte, analitica y mensajes correctos.
- **Tokens publicos de reagendamiento:** utiles para permitir cambios sin login del cliente.
- **Claims de slots en DB:** adaptar `appointment_slot_claims` a `appointment_resource_claims` para bloquear terapeuta y sala.
- **Compensacion GCal/DB:** conservar la disciplina de no dejar eventos y citas desalineados.
- **Recordatorios con dedupe:** registrar intentos y evitar enviar dos veces por la misma cita.
- **Validacion con Zod:** mantener schemas por endpoint y normalizacion de telefono antes de tocar servicios.
- **Contexto de WhatsApp:** clasificar mensajes entrantes por contexto operativo antes de procesar imagenes o texto.
- **Runtime de schedulers visible:** exponer ultimo run, proximo run, estado y error de cada automatizacion.
- **Realtime admin liviano:** SSE funciono para una app simple; Super Agenda usara Socket.IO por salas, secretaria y multiples eventos.
- **Acciones rapidas admin:** buscar cliente, ver proxima cita, cancelar, reagendar y enviar link deben existir como comandos de primer nivel.

### 13.2 No copiar al core

- Recurrencia semanal automatica.
- Tenancy por centro dentro de la misma DB.
- Calendario unico global por env var.
- Zona horaria fija para todos los centros.
- Mensajes de recordatorio, pago o cancelacion hardcodeados en codigo.
- Config parcial de mensajes en columnas sueltas; Super Agenda necesita templates versionados y triggers administrables.
- Branding limitado a logo/color; Super Agenda necesita skins visuales versionados.
- Responsividad obligatoria para todos los modulos; algunas pantallas densas deben ser desktop-first por diseno.
- Migraciones escondidas en arranque con `ALTER TABLE ... catch`.
- Archivos grandes en BLOB MySQL como estrategia principal.
- BookingFlow monolitico con demasiada UI y reglas mezcladas.
- Supuestos hardcodeados de precios, ciudades, textos o nombres propios.

### 13.3 Adaptaciones necesarias

En agenda4.0 el recurso bloqueado era solo el terapeuta/calendario personal. En Super Agenda el recurso bloqueado es doble:

```txt
appointment_resource_claims
  therapist:{therapist_id}:minute
  room:{room_id}:minute
```

En agenda4.0 Google Calendar era un calendario unico. En Super Agenda:

```txt
therapist_id -> calendar_id del calendario del centro -> event_id por cita
```

En agenda4.0 la disponibilidad era:

```txt
horario configurado - GCal busy - buffer
```

En Super Agenda sera:

```txt
centro + terapeuta + sala + servicio + GCal busy + claims DB + locks Redis
```

En agenda4.0 el cliente podia entrar por flujo recurrente. En Super Agenda:

```txt
cada cita se reserva individualmente contra disponibilidad real
```
