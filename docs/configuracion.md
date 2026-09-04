# Configuración operativa

## Identidad

`BETTER_AUTH_SECRET` debe ser aleatorio, privado y tener al menos 32 caracteres. `BETTER_AUTH_URL` y `AUTH_TRUSTED_ORIGINS` deben usar los dominios HTTPS definitivos.

Cada persona usa una cuenta individual. El encabezado `x-operator-id` no concede acceso y no existe un operador anónimo por defecto.

## Organización única

Community Edition mantiene una organización interna fija. Todas las tablas operativas incluyen `organization_id`, pero no hay herramientas para crear, seleccionar ni administrar tenants.

`APP_EDITION` debe conservar exactamente este valor:

```env
APP_EDITION="community"
```

## Fuentes

### Credenciales obligatorias

| Variable | Dónde obtenerla |
| --- | --- |
| `DATABASE_URL` | Cualquier PostgreSQL 15 o superior con PostGIS. En [Neon](https://neon.com/docs/connect/connect-from-any-app), se copia desde **Connect** en el panel del proyecto. |
| `BETTER_AUTH_SECRET` | Se genera localmente. Ejecuta `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` y guarda el resultado únicamente en el entorno. |
| `FIRMS_MAP_KEY` | Solicita una clave gratuita en el [formulario oficial de NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/map_key/). NASA la envía al correo indicado. |

### Integraciones opcionales

| Fuente | Variables | Alta oficial |
| --- | --- | --- |
| Google Earth Engine para GOES-19 directo | `EARTH_ENGINE_PROJECT_ID`, `EARTH_ENGINE_SERVICE_ACCOUNT_JSON_BASE64` | [Registrar el proyecto y habilitar Earth Engine](https://developers.google.com/earth-engine/cloud/earthengine_cloud_project_setup), luego [crear la cuenta de servicio y su clave JSON](https://developers.google.com/earth-engine/guides/service_account). |
| NOAA Open Data para GOES-19 | `GOES_NOAA_S3_FALLBACK="true"` | No requiere cuenta ni API key. Es el respaldo habilitado por defecto. |
| EUMETSAT para descubrir productos Sentinel-3 | `EUMETSAT_CONSUMER_KEY`, `EUMETSAT_CONSUMER_SECRET` | Crear una cuenta en el [Data Store de EUMETSAT](https://data.eumetsat.int/) y generar las credenciales de API del perfil. |
| Feed procesado Sentinel-3 FRP | `SENTINEL3_FRP_GEOJSON_URL` | URL HTTPS propia con puntos FRP en GeoJSON. Las credenciales de EUMETSAT por sí solas no extraen los hotspots del producto NetCDF. |

Open-Meteo, el catálogo sísmico de USGS, NASA GIBS, NASA CMR/HLS y el respaldo público de NOAA se consultan sin claves desde la aplicación. Revisa sus condiciones de uso y límites antes de una operación sostenida.

Para codificar la clave JSON de Earth Engine sin modificarla:

Linux:

```bash
base64 -w 0 service-account.json
```

macOS:

```bash
base64 < service-account.json | tr -d '\n'
```

Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

Nunca confirmes `.env`, claves JSON, contraseñas ni cadenas de conexión en Git.

## Activación

1. Configurar la jurisdicción y los orígenes permitidos.
2. Crear un respaldo recuperable de PostgreSQL.
3. Ejecutar las migraciones.
4. Crear la cuenta inicial.
5. Cambiar la contraseña en el primer ingreso.
6. Verificar mapa, escaneo, incidentes, recursos, auditoría y exportaciones.

No se incorporan datos de demostración salvo que se habiliten de forma explícita.
