# Encuestas RP Poleas

Sistema de encuestas de satisfacción de RP Poleas: encuesta pública por enlace y panel privado para consultar respuestas, analizar resultados y exportarlos.

## Características

- Encuesta pública en `/encuesta/venta`.
- Panel administrador en `/staff-rp/login`.
- Consulta, análisis y exportación CSV de respuestas.
- Planes de acción privados, organizados por las cinco categorías y con un máximo de 5 documentos por categoría.
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

La encuesta se abre en `http://localhost:3000/encuesta/venta` y el panel en `http://localhost:3000/staff-rp/login`. Para desarrollo con PostgreSQL externo, use `DATABASE_URL` y, si corresponde, `PG_SSL=true` en `.env.local`.

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

En instalaciones existentes, aplique el bloque `action_plans` de `db/schema.sql` una vez antes de desplegar esta versión; los scripts de inicialización de PostgreSQL solo se ejecutan al crear el volumen por primera vez. Incluya también `action_plans_data` en sus copias de seguridad de archivos.

## Seguridad

- Mantenga `.env` exclusivamente en el servidor y fuera de Git.
- Use secretos y contraseña de administrador robustos; producción no permite las credenciales demo.
- No exponga PostgreSQL al host ni a Internet.
- Para Gmail, use una contraseña de aplicación en `SMTP_PASSWORD`; no use ni versionar la contraseña principal.
- La CI no hace deploy y no contiene secretos. Si en el futuro una integración los necesita, configúrelos en `GitHub Repository → Settings → Secrets and variables → Actions`.

## CI

GitHub Actions ejecuta instalación limpia, lint y build en cada `push` y `pull_request`.
