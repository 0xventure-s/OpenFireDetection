<p align="center">
  <img src="public/openfire-mark.svg" width="88" alt="Marca de OpenFireDetection" />
</p>

<h1 align="center">OpenFireDetection</h1>

<p align="center">
  <strong>Detección temprana, verificación humana y coordinación operativa en un solo mapa.</strong>
</p>

<p align="center">
  Community Edition autohospedada para monitorear incendios dentro de una jurisdicción configurable.
</p>

<p align="center">
  <a href="https://github.com/0xventure-s/OpenFireDetection/actions/workflows/ci.yml"><img src="https://github.com/0xventure-s/OpenFireDetection/actions/workflows/ci.yml/badge.svg" alt="Estado de integración continua" /></a>
  <img src="https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20.9 o superior" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 15 o superior" />
  <img src="https://img.shields.io/badge/edición-Community-f97316" alt="Community Edition" />
</p>

<p align="center">
  <a href="#capacidades">Capacidades</a> ·
  <a href="#cómo-funciona">Cómo funciona</a> ·
  <a href="#puesta-en-marcha">Puesta en marcha</a> ·
  <a href="docs/configuracion.md">Configuración</a> ·
  <a href="SECURITY.md">Seguridad</a>
</p>

![Visual conceptual de monitoreo satelital y detección de incendios](docs/assets/openfire-hero.jpg)

OpenFireDetection reúne señales satelitales, reportes manuales y contexto ambiental en un entorno operativo común. Los equipos pueden detectar, revisar, priorizar y documentar incidentes, coordinar recursos y conservar un historial auditable sin depender de un servicio multitenant.

> [!IMPORTANT]
> Las señales satelitales y ambientales son indicios. La confirmación operativa requiere revisión humana y contraste con fuentes oficiales locales.

## Capacidades

| Operación | Cobertura |
| --- | --- |
| **Detección multifuente** | GOES-19, NASA FIRMS y Sentinel-3 dentro de la jurisdicción configurada. |
| **Mapa de situación** | Incidentes activos, capas térmicas, clima, precipitación, rayos, sismos y contexto HLS. |
| **Gestión de incidentes** | Alta manual, revisión, confirmación, descarte, despacho, notas, cierre e historial. |
| **Centro de comando** | Prioridades, estado de fuentes, actividad reciente, métricas y exportaciones CSV. |
| **Recursos operativos** | Cuarteles, unidades, activos, asignaciones y mantenimiento. |
| **Acceso y trazabilidad** | Sesiones con correo y contraseña, roles por capacidad y auditoría de acciones. |
| **Jurisdicción propia** | Nombre, zona horaria, límites, centro y zoom definidos por variables de entorno. |

### Community Edition

| Incluye | No incluye |
| --- | --- |
| Una organización por instalación | Selector de organizaciones |
| Autenticación y roles operativos | Superadministración de plataforma |
| Datos aislados por `organizationId` | Facturación y planes |
| Configuración geográfica propia | Control plane multitenant |
| Despliegue en infraestructura propia | SLA o monitoreo administrado |

El identificador interno de organización se conserva incluso en Community Edition como límite de seguridad y consistencia de datos.

## Cómo funciona

```mermaid
flowchart LR
    A[GOES-19 · FIRMS · Sentinel-3] --> B[Ingesta y normalización]
    C[Reporte manual] --> B
    D[Clima · lluvia · rayos · sismos · HLS] --> E[Contexto ambiental]
    B --> F[(PostgreSQL + PostGIS)]
    E --> G[Mapa operativo]
    F --> G
    G --> H{Revisión humana}
    H --> I[Confirmar o descartar]
    H --> J[Asignar recursos]
    H --> K[Documentar y cerrar]
    I --> L[Auditoría e historial]
    J --> L
    K --> L
```

1. Las fuentes habilitadas se consultan dentro del rectángulo de la jurisdicción.
2. Las detecciones cercanas se correlacionan por ubicación, tiempo, confianza y potencia radiativa.
3. El mapa y la cola operativa presentan los incidentes que requieren atención.
4. Una persona revisa la evidencia antes de confirmar, descartar o despachar recursos.
5. Cada cambio relevante queda asociado a la organización y registrado en el historial.

### Criterio de las fuentes

| Fuente | Uso principal | Alcance |
| --- | --- | --- |
| **GOES-19 FDCF** | Señal térmica temprana y frecuente | No confirma por sí sola. |
| **NASA FIRMS** | Detecciones polares con confianza y FRP | Puede reforzar o elevar la evidencia según los criterios configurados. |
| **Sentinel-3 SLSTR** | Anomalías térmicas y FRP | Complementa la evaluación del incidente. |
| **HLS** | Contexto visual, vegetación y cicatriz | No es una alerta inmediata. |
| **GLM, precipitación, viento y sismos** | Contexto de riesgo y condiciones del entorno | No confirman incendios. |
| **Reporte manual** | Observación de campo | Requiere identidad y queda auditado. |

## Puesta en marcha

### 1. Requisitos

- Node.js 20.9 o superior.
- PostgreSQL 15 o superior con PostGIS.
- Una clave de NASA FIRMS para habilitar esa fuente.
- Credenciales de Google Earth Engine si se habilita GOES-19 directo.

### 2. Descargar e instalar

```bash
git clone https://github.com/0xventure-s/OpenFireDetection.git
cd OpenFireDetection
npm ci
```

### 3. Crear la configuración local

Linux y macOS:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Reemplaza todos los valores de ejemplo. Como mínimo, define la base de datos, la identidad, la cuenta inicial y la jurisdicción:

```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

BETTER_AUTH_SECRET="una_clave_aleatoria_de_32_caracteres_o_más"
BETTER_AUTH_URL="http://localhost:3000"
AUTH_TRUSTED_ORIGINS="http://localhost:3000"
APP_EDITION="community"

COMMUNITY_BOOTSTRAP_EMAIL="operator@example.org"
COMMUNITY_BOOTSTRAP_NAME="Operador principal"
COMMUNITY_BOOTSTRAP_PASSWORD="una_frase_privada_de_12_o_más_caracteres"

NEXT_PUBLIC_JURISDICTION_NAME="Nombre de la jurisdicción"
NEXT_PUBLIC_JURISDICTION_TIMEZONE="America/Argentina/Buenos_Aires"
NEXT_PUBLIC_BBOX_WEST="-67"
NEXT_PUBLIC_BBOX_SOUTH="-32"
NEXT_PUBLIC_BBOX_EAST="-63"
NEXT_PUBLIC_BBOX_NORTH="-28"
NEXT_PUBLIC_MAP_CENTER_LAT="-30"
NEXT_PUBLIC_MAP_CENTER_LON="-65"
NEXT_PUBLIC_MAP_ZOOM="7"
```

Los límites incluidos en `.env.example` son únicamente demostrativos. Deben reemplazarse y validarse antes de cualquier uso operativo.

### 4. Preparar la base y el acceso inicial

```bash
npm run prisma:generate
npx prisma migrate deploy
node --env-file=.env --import tsx scripts/bootstrap-community-auth.ts
```

La contraseña inicial no se imprime. La cuenta creada deberá cambiarla en el primer ingreso.

### 5. Iniciar la aplicación

```bash
npm run dev
```

Abre `http://localhost:3000` e ingresa con la cuenta configurada.

La referencia completa de variables, fuentes y activación está en [docs/configuracion.md](docs/configuracion.md).

## Despliegue

Antes de exponer una instalación:

- utiliza PostgreSQL con PostGIS y respaldos recuperables;
- configura `BETTER_AUTH_URL` y `AUTH_TRUSTED_ORIGINS` con los dominios HTTPS definitivos;
- usa secretos únicos y mantenlos fuera del repositorio;
- valida los límites de la jurisdicción y las condiciones de uso de cada proveedor;
- prueba el flujo completo de ingreso, escaneo, revisión, recursos, auditoría y exportación.

Comandos de producción:

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run build
npm run start
```

> [!NOTE]
> El escaneo periódico actual se ejecuta cada diez minutos mientras una pestaña autenticada permanece visible y en línea. No reemplaza un scheduler externo ni constituye monitoreo autónomo 24/7.

## Verificación

La integración continua ejecuta la instalación reproducible, lint, build y pruebas en cada cambio de `main` y en cada pull request.

```bash
npm run lint
npm test -- --run
npm run build
```

## Estructura del proyecto

```text
app/          Interfaz, autenticación y rutas API
components/   Mapa, comando, incidentes y componentes visuales
hooks/        Consultas, mutaciones y automatizaciones del cliente
lib/          Detección, fuentes, permisos, análisis y reglas de dominio
prisma/       Esquema y migraciones de PostgreSQL/PostGIS
scripts/      Inicialización de acceso y utilidades operativas
docs/         Configuración y documentación complementaria
```

## Contribuir

1. Crea una rama enfocada en un único cambio.
2. Incluye pruebas para las reglas operativas o de seguridad modificadas.
3. Ejecuta lint, pruebas y build antes de abrir el pull request.
4. Explica el impacto sobre fuentes, jurisdicción, permisos y datos persistidos.

Los reportes sensibles no deben publicarse en issues. Consulta [SECURITY.md](SECURITY.md) antes de compartir credenciales, ubicaciones o datos operativos.

## Estado de la licencia

> [!WARNING]
> El código es público, pero todavía no tiene una licencia de software asignada. Hasta que se publique una licencia, no se otorgan permisos de uso, modificación ni redistribución. La licencia, la titularidad, el uso de marca y el canal privado de seguridad deben resolverse antes de una distribución formal como software open source.

---

<p align="center">
  <strong>OpenFireDetection Community Edition</strong><br />
  Señales verificables. Decisiones humanas. Historial auditable.
</p>
