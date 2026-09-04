<p align="center">
  <img src="public/openfire-mark.svg" width="88" alt="Marca de OpenFireDetection" />
</p>

<h1 align="center">OpenFireDetection</h1>

<p align="center">
  <em>“Open source, open heart, open mind.”</em><br />
  <sub>— <a href="https://ossacc.com/">Peer Richelsen</a></sub>
</p>

<p align="center">
  <strong>Detección temprana, verificación humana y coordinación operativa en un solo mapa.</strong>
</p>

<p align="center">
  Community Edition autohospedada para monitorear incendios dentro de una jurisdicción configurable.
</p>

<p align="center">
  <a href="https://github.com/0xventure-s/OpenFireDetection/actions/workflows/ci.yml"><img src="https://github.com/0xventure-s/OpenFireDetection/actions/workflows/ci.yml/badge.svg" alt="Estado de integración continua" /></a>
  <a href="https://github.com/0xventure-s/OpenFireDetection/stargazers"><img src="https://img.shields.io/github/stars/0xventure-s/OpenFireDetection?style=flat&logo=github&label=estrellas&color=f97316" alt="Estrellas de OpenFireDetection en GitHub" /></a>
  <a href="https://github.com/0xventure-s/OpenFireDetection/forks"><img src="https://img.shields.io/github/forks/0xventure-s/OpenFireDetection?style=flat&logo=github&label=forks&color=334155" alt="Forks de OpenFireDetection en GitHub" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licencia-PolyForm%20Noncommercial%201.0.0-7c3aed" alt="Licencia PolyForm Noncommercial 1.0.0" /></a>
  <img src="https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20.9 o superior" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 15 o superior" />
  <img src="https://img.shields.io/badge/edición-Community-f97316" alt="Community Edition" />
</p>

<p align="center">
  <a href="#capacidades">Capacidades</a> ·
  <a href="#cómo-funciona">Cómo funciona</a> ·
  <a href="#puesta-en-marcha">Puesta en marcha</a> ·
  <a href="#credenciales-y-api">Credenciales y API</a> ·
  <a href="docs/configuracion.md">Configuración</a> ·
  <a href="SECURITY.md">Seguridad</a> ·
  <a href="#licencia">Licencia</a>
</p>

![Visual conceptual de monitoreo satelital y detección de incendios](docs/assets/openfire-hero.jpg)

OpenFireDetection reúne señales satelitales, reportes manuales y contexto ambiental en un entorno operativo común. Los equipos pueden detectar, revisar, priorizar y documentar incidentes, coordinar recursos y conservar un historial auditable en infraestructura propia.

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

### Alcance de Community Edition

- Una organización por instalación.
- Autenticación y roles operativos.
- Datos aislados por `organizationId`.
- Jurisdicción, zona horaria y mapa configurables.
- Despliegue y operación en infraestructura propia.

El identificador interno de organización protege la separación y consistencia de los datos.

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
- Una clave gratuita de NASA FIRMS.
- Credenciales de Google Earth Engine solo si se habilita el acceso directo a esa fuente.

### 2. Credenciales y API

No hace falta buscar cada alta por separado. Estos son los accesos oficiales y la variable que recibe cada dato:

| Necesidad | Variable | Dónde se obtiene |
| --- | --- | --- |
| Base PostgreSQL + PostGIS | `DATABASE_URL` | Servidor propio o un proveedor compatible. En [Neon](https://neon.com/docs/connect/connect-from-any-app), crea un proyecto y copia la cadena desde **Connect**. |
| Secreto de sesiones | `BETTER_AUTH_SECRET` | Se genera localmente con el comando incluido debajo. No se solicita a un proveedor. |
| Detecciones NASA FIRMS | `FIRMS_MAP_KEY` | [Solicitud oficial de MAP_KEY de NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/map_key/). Es gratuita y llega por correo. |
| GOES-19 por Earth Engine | `EARTH_ENGINE_PROJECT_ID` y `EARTH_ENGINE_SERVICE_ACCOUNT_JSON_BASE64` | [Alta del proyecto en Earth Engine](https://developers.google.com/earth-engine/cloud/earthengine_cloud_project_setup) y [cuenta de servicio con clave JSON](https://developers.google.com/earth-engine/guides/service_account). |
| Productos Sentinel-3 | `EUMETSAT_CONSUMER_KEY` y `EUMETSAT_CONSUMER_SECRET` | [EUMETSAT Data Store](https://data.eumetsat.int/), desde las credenciales API del perfil. |

Genera `BETTER_AUTH_SECRET` en cualquier sistema con Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

GOES-19 también usa el respaldo público de NOAA Open Data, habilitado con `GOES_NOAA_S3_FALLBACK="true"` y sin API key. Open-Meteo, USGS, NASA GIBS y el catálogo NASA CMR/HLS tampoco requieren claves.

> [!NOTE]
> Las credenciales de EUMETSAT habilitan el descubrimiento de productos. Para obtener puntos de calor Sentinel-3, configura además `SENTINEL3_FRP_GEOJSON_URL` con un feed GeoJSON procesado por tu propia canalización.

La guía [docs/configuracion.md](docs/configuracion.md) incluye todas las variables, los pasos para convertir la clave JSON de Earth Engine a Base64 y las fuentes que funcionan sin credenciales.

### 3. Descargar e instalar

```bash
git clone https://github.com/0xventure-s/OpenFireDetection.git
cd OpenFireDetection
npm ci
```

### 4. Crear la configuración local

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

> [!IMPORTANT]
> Conserva exactamente `APP_EDITION="community"`.

Los límites incluidos en `.env.example` son únicamente demostrativos. Deben reemplazarse y validarse antes de cualquier uso operativo.

### 5. Preparar la base y el acceso inicial

```bash
npm run prisma:generate
npx prisma migrate deploy
node --env-file=.env --import tsx scripts/bootstrap-community-auth.ts
```

La contraseña inicial no se imprime. La cuenta creada deberá cambiarla en el primer ingreso.

### 6. Iniciar la aplicación

```bash
npm run dev
```

Abre `http://localhost:3000` e ingresa con la cuenta configurada.

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

## Licencia

OpenFireDetection se publica bajo la [PolyForm Noncommercial License 1.0.0](LICENSE).

- Se permite usar, estudiar, modificar y redistribuir el software únicamente con fines no comerciales y conservando la licencia y los avisos requeridos.
- No se permite venderlo, cobrar por su acceso, incorporarlo a un servicio comercial ni usarlo con una finalidad comercial sin autorización previa y escrita del titular.
- Organizaciones de seguridad pública, salud, protección ambiental, educación, investigación pública, gobierno y entidades benéficas pueden utilizarlo según los términos específicos de la licencia.
- El software se entrega sin garantías. La validación operativa, la seguridad, los respaldos y el cumplimiento normativo son responsabilidad de cada instalación.

Esta es una licencia de código fuente disponible con restricción no comercial; no es una licencia Open Source aprobada por la OSI.

---

<p align="center">
  <strong>OpenFireDetection Community Edition</strong><br />
  Señales verificables. Decisiones humanas. Historial auditable.
</p>
