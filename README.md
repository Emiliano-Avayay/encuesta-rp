# Encuestas RP Poleas

Sistema de encuestas de satisfacción de RP Poleas: encuesta pública por enlace y panel privado para consultar respuestas, analizar resultados y exportarlos.

## Características

- Encuesta pública en `/venta`.
- Panel administrador en `/staff-rp/login`.
- Consulta, análisis y exportación CSV de respuestas.
- Planes de acción privados, organizados por cuatro categorías (Contactos, Encuestas, Instructivos e Informe) y con un máximo de 5 documentos por categoría.
- Persistencia en PostgreSQL para producción.
- Endpoint de salud no autenticado: `/api/health`.

## Stack tecnológico

- Next.js 14, React y TypeScript.
- PostgreSQL 16 para producción.
- Docker Compose para el despliegue.

## Estructura del proyecto

```text
app/          Rutas y API de Next.js
components/   Interfaz de encuesta y administración
lib/          Autenticación, validación y persistencia
db/           Esquema de PostgreSQL
scripts/      Utilidades locales, incluido el hash de contraseña
```

## Requisitos

Para Docker: Docker Engine y el plugin Docker Compose.

Para desarrollo local: Node.js 20 o superior, npm y, opcionalmente, PostgreSQL. Sin una base configurada, desarrollo conserva el modo demo local para respuestas.

## Configuración

```bash
cp .env.example .env
```

Edite `.env` y defina valores seguros para `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` y las variables `POSTGRES_*`. Para generar el hash del administrador:

```bash
npm install
node scripts/hash-password.mjs "una-contraseña-segura"
```

Copie el resultado completo entre comillas simples en `ADMIN_PASSWORD_HASH` (para conservar sus caracteres `$`). No versionar `.env`.

## Ejecutar con Docker

Primera instalación:

```bash
cp .env.example .env
nano .env
docker compose up -d --build
```

La aplicación queda disponible en `http://127.0.0.1:3000` por defecto. Cambie `WEB_PORT` si ese puerto está ocupado. PostgreSQL no se publica al host: solo es accesible para el servicio `web` en la red interna de Compose.

Comandos de operación:

```bash
docker compose ps
docker compose logs -f
docker compose restart
git pull
docker compose up -d --build
docker compose down
```

No use `docker compose down -v` normalmente: elimina los volúmenes `postgres_data` y `action_plans_data`, junto con las respuestas y documentos persistidos.

## Desarrollo local

```bash
npm install
npm run dev
```

La encuesta se abre en `http://localhost:3000/venta` y el panel en `http://localhost:3000/staff-rp/login`. Para desarrollo con PostgreSQL externo, use `DATABASE_URL` y, si corresponde, `PG_SSL=true` en `.env.local`.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `AUTH_SECRET` | Clave aleatoria para firmar la sesión administrativa; obligatoria en producción. |
| `ADMIN_USERNAME` | Usuario del panel administrador. |
| `ADMIN_PASSWORD_HASH` | Hash PBKDF2 generado con el script incluido; obligatorio en producción. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Base, usuario y contraseña que Docker entrega a PostgreSQL. |
| `WEB_PORT` | Puerto local expuesto, por defecto `3000`. |
| `DATABASE_URL` | Opcional para desarrollo o PostgreSQL externo; Docker usa los parámetros internos de Compose. |
| `PG_SSL` | Habilita SSL solo para una conexión PostgreSQL externa. |
| `NOTIFICATION_EMAIL` | Destinatario(s) de cada respuesta, separados por comas. Dejar vacío para desactivar notificaciones. |
| `NOTIFICATION_FROM` | Dirección remitente verificada en el proveedor SMTP. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | Configuración SMTP. Para Gmail con STARTTLS use `smtp.gmail.com`, puerto `587` y `SMTP_SECURE=false`. |
| `APP_URL` | Opcional: URL pública sin barra final para enlazar el panel desde el correo. |
| `ACTION_PLANS_MAX_FILE_SIZE` | Tamaño máximo de cada documento del Plan de acción, en bytes. Por defecto `20971520` (20 MB). |

## Despliegue

La arquitectura de producción es:

```text
HTTPS público → Cloudflare / reverse proxy → 127.0.0.1:WEB_PORT → contenedor web
                                                       └─ red Docker interna → PostgreSQL
```

El servidor HTTP escucha en `0.0.0.0` dentro del contenedor, pero Compose lo enlaza a `127.0.0.1` en el servidor. Configure Cloudflare Tunnel o el reverse proxy hacia ese puerto local. No se requiere modificar la aplicación ni configurar un dominio en ella.

## Backup / persistencia

Las respuestas se guardan en PostgreSQL, en el volumen nombrado `postgres_data`; los documentos de Plan de acción se guardan fuera de PostgreSQL, en el volumen nombrado `action_plans_data`. Ambos sobreviven a `docker compose down` y a reconstrucciones de imágenes. Realice backups periódicos, por ejemplo:

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > encuestas-rp-backup.sql
```

Guarde el backup fuera del servidor o del volumen Docker. El esquema se inicializa automáticamente solo al crear un volumen PostgreSQL nuevo.

En instalaciones existentes, aplique el bloque `action_plans` de `db/schema.sql` (o, si la tabla ya existe, `db/migrations/2026-10-action-plans-categories.sql`, que aborta si hay documentos en categorías anteriores) una vez antes de desplegar esta versión; los scripts de inicialización de PostgreSQL solo se ejecutan al crear el volumen por primera vez. Incluya también `action_plans_data` en sus copias de seguridad de archivos.

## Seguridad

- Mantenga `.env` exclusivamente en el servidor y fuera de Git.
- Use secretos y contraseña de administrador robustos; producción no permite las credenciales demo.
- No exponga PostgreSQL al host ni a Internet.
- Para Gmail, use una contraseña de aplicación en `SMTP_PASSWORD`; no use ni versionar la contraseña principal.
- La CI no hace deploy y no contiene secretos. Si en el futuro una integración los necesita, configúrelos en `GitHub Repository → Settings → Secrets and variables → Actions`.

## CI

GitHub Actions ejecuta instalación limpia, lint y build en cada `push` y `pull_request`.

## Seguimiento de encuestas (`/staff-rp/seguimiento`)

Control de empresas, estado de respuesta y marcas de WhatsApp, persistido en PostgreSQL (`follow_up_companies`, `follow_up_audit`; migración en `db/migrations/2026-10-seguimiento.sql`).

Importación inicial desde la planilla (exportada como CSV; no destructiva e idempotente):

```bash
node scripts/import-seguimiento.mjs planilla.csv --report revision.csv   # dry-run
DATABASE_URL=... node scripts/import-seguimiento.mjs planilla.csv --apply
```

El modal **Editar empresa** permite eliminar una empresa existente, de cualquier segmento, con confirmación secundaria que muestra su nombre guardado. La eliminación requiere sesión administrativa y un UUID válido. Solo afecta a `follow_up_companies`: conserva `survey_responses`, las respuestas vinculadas, los análisis y los planes de acción. La interfaz recalcula el listado y sus indicadores sin recargar ni perder filtros.

`DELETE /api/seguimiento/[id]` devuelve 204 al eliminar, 400 para UUID inválido, 401 sin sesión y 404 si la empresa no existe. PostgreSQL bloquea la fila, registra la acción `delete` con `changes.before` (copia completa de la empresa, incluido nombre, segmento y vínculo), `actor` y `at`, y borra por ID dentro de la misma transacción. Cualquier error provoca rollback. La auditoría conserva el UUID sin una FK que elimine sus registros al borrar la empresa. En demo, empresa y auditoría de eliminación se mantienen en memoria durante la vida del proceso; producción requiere PostgreSQL.

Para habilitar la eliminación en una instalación existente, **aplicar manualmente** `db/migrations/2026-10-seguimiento-delete.sql` antes de desplegar el código. `db/schema.sql` ya incluye el esquema para instalaciones nuevas. No se ejecutan migraciones al iniciar la aplicación ni durante el build.

### CUIT de las empresas

Cada empresa puede tener un CUIT opcional (`follow_up_companies.cuit`, `text`, `NULL` permitido). Se guarda normalizado en 11 dígitos sin guiones, con una restricción `CHECK` de formato en la base, y se muestra como `XX-XXXXXXXX-X`. La normalización y la validación (longitud y dígito verificador módulo 11) viven en `lib/follow-up-core.ts` (`parseCuit`, `formatCuit`) y las usan por igual el formulario y el servidor. En ediciones parciales (cambio rápido de estado o WhatsApp) el CUIT solo se modifica si la solicitud incluye la clave `cuit`; una cadena vacía o `null` lo elimina. No hay restricción `UNIQUE`: el mismo CUIT puede repetirse hasta que el negocio defina lo contrario. El buscador del seguimiento también encuentra por CUIT, con o sin guiones (desde 3 dígitos); no hay columna adicional en la tabla.

En instalaciones existentes, **aplicar manualmente antes de desplegar el código** `db/migrations/2026-11-seguimiento-cuit.sql` (idempotente, no destructiva, aborta si no obtiene el bloqueo en 5 s). Las empresas actuales quedan con `cuit = NULL`:

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > encuestas-rp-antes-cuit.sql
docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/migrations/2026-11-seguimiento-cuit.sql
```

Procedimiento de producción (solo con autorización del responsable):

1. Validar esta versión y la migración en un entorno de pruebas con una copia de seguridad restaurada. Las verificaciones de borrado se hacen únicamente sobre datos de prueba.
2. Crear y verificar un backup. Conservar la imagen o versión anterior para una reversión de código:

   ```bash
   docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > encuestas-rp-antes-seguimiento-delete.sql
   ```

3. Aplicar únicamente la nueva migración, con la versión anterior de la aplicación aún en ejecución:

   ```bash
   docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < db/migrations/2026-10-seguimiento-delete.sql
   ```

   La migración conserva las acciones `create`, `update`, `import` y sus filas; agrega `delete`. Su transacción aborta sin cambios si el bloqueo demora más de cinco segundos. Si falla, revisar el error antes de reintentar. No ejecutar el esquema completo como sustituto de esta migración.

4. Verificar la restricción sin borrar datos:

   ```bash
   docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
   select pg_get_constraintdef(oid)
   from pg_constraint
   where conrelid = 'follow_up_audit'::regclass
     and conname = 'follow_up_audit_action_check';
   SQL
   ```

5. Desplegar con `docker compose up -d --build web`, comprobar `/api/health`, el acceso administrativo y el modal; cancelar la confirmación para verificarlo sin eliminar datos reales. Si se revierte el código, mantener la restricción ampliada: es compatible con la versión anterior y no debe eliminarse el historial `delete`.

Validación local:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Los tests incluyen interacción con el modal en JSDOM, autorización real de Next y fallos simulados de conexión/consultas/commit. Las pruebas de integración crean automáticamente un clúster PostgreSQL temporal (si están disponibles `postgres`, `initdb` y `pg_ctl`) o un contenedor efímero `postgres:16-alpine` con puerto aleatorio en localhost (si Docker está disponible). Comprueban migración, conservación de auditoría/respuestas/otras empresas/planes, concurrencia y rollback mediante errores reales de PostgreSQL; luego eliminan exclusivamente ese entorno temporal. Nunca utilizan `DATABASE_URL` ni la base configurada en `.env`. Si no hay servidor local ni Docker, esas pruebas de integración se informan como omitidas.
