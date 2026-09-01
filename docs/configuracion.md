# Configuración operativa

## Identidad

`BETTER_AUTH_SECRET` debe ser aleatorio, privado y tener al menos 32 caracteres. `BETTER_AUTH_URL` y `AUTH_TRUSTED_ORIGINS` deben usar los dominios HTTPS definitivos.

Cada persona usa una cuenta individual. El encabezado `x-operator-id` no concede acceso y no existe un operador anónimo por defecto.

## Organización única

Community Edition mantiene una organización interna fija. Todas las tablas operativas incluyen `organization_id`, pero no hay herramientas para crear, seleccionar ni administrar tenants.

## Fuentes

FIRMS requiere `FIRMS_MAP_KEY`. GOES-19 requiere una cuenta de servicio de Earth Engine habilitada para el proyecto configurado. Las fuentes opcionales permanecen desactivadas cuando faltan sus credenciales.

## Activación

1. Configurar la jurisdicción y los orígenes permitidos.
2. Crear un respaldo recuperable de PostgreSQL.
3. Ejecutar las migraciones.
4. Crear la cuenta inicial.
5. Cambiar la contraseña en el primer ingreso.
6. Verificar mapa, escaneo, incidentes, recursos, auditoría y exportaciones.

No se incorporan datos de demostración salvo que se habiliten de forma explícita.
