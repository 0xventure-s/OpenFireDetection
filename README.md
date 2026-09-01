# OpenFireDetection

Monitoreo operativo de focos de incendio con señales satelitales, reportes manuales, mapa, historial, recursos y mantenimiento.

Este árbol corresponde a Community Edition y funciona con una sola organización. No incluye selector de tenants, superadministración, facturación ni control plane. El identificador interno de organización se conserva como límite de seguridad y consistencia de datos.

## Alcance

- sesiones con correo y contraseña;
- cambio obligatorio de la contraseña inicial;
- roles de operación, jefatura, consulta y auditoría;
- detecciones GOES-19, FIRMS y Sentinel-3;
- registro, revisión y cierre de incidentes;
- unidades, activos, asignaciones y mantenimiento;
- auditoría operativa y exportaciones;
- jurisdicción configurable mediante variables de entorno.

Las señales satelitales son indicios. La confirmación operativa requiere revisión humana y fuentes oficiales locales.

## Requisitos

- Node.js 20 o superior;
- PostgreSQL 15 o superior;
- una clave de NASA FIRMS para esa fuente;
- credenciales de Google Earth Engine sólo si se habilita GOES-19.

## Instalación

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

Copiar `.env.example` a `.env.local`, reemplazar todos los valores de ejemplo y definir una jurisdicción antes del uso operativo.

La cuenta inicial se crea con:

```bash
npm run auth:bootstrap
```

La contraseña se toma de `COMMUNITY_BOOTSTRAP_PASSWORD`, no se imprime y debe cambiarse en el primer ingreso.

## Jurisdicción

La detección y el mapa usan un rectángulo geográfico configurable:

```env
NEXT_PUBLIC_JURISDICTION_NAME="Nombre local"
NEXT_PUBLIC_JURISDICTION_TIMEZONE="America/Argentina/Buenos_Aires"
NEXT_PUBLIC_BBOX_WEST="-67"
NEXT_PUBLIC_BBOX_SOUTH="-32"
NEXT_PUBLIC_BBOX_EAST="-63"
NEXT_PUBLIC_BBOX_NORTH="-28"
NEXT_PUBLIC_MAP_CENTER_LAT="-30"
NEXT_PUBLIC_MAP_CENTER_LON="-65"
NEXT_PUBLIC_MAP_ZOOM="7"
```

Los valores incluidos son sólo una zona de demostración. No representan una jurisdicción oficial.

## Validación

```bash
npm run lint
npm test -- --run
npm audit --omit=dev
```

## Datos y activos

El repositorio no contiene credenciales, bases reales, hidrantes estimados, originales de marca ni historial del producto privado. Cada instalación debe revisar las condiciones de uso de mapas, imágenes y proveedores externos.

## Publicación

El código fuente es público, pero todavía no tiene una licencia de software asignada. Una distribución formal como software abierto requiere definir licencia, titularidad, uso de marca y un canal privado para reportes de seguridad.
