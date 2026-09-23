# Poleas RP - Encuestas de satisfacción

Aplicación Next.js para encuestas independientes por enlace, con administración centralizada.

## Desarrollo

```bash
npm install
npm run dev
```

Encuesta activa: `http://localhost:3000/encuesta/venta`.

Panel privado: `http://localhost:3000/staff-rp/login`. En modo demo: `admin` / `admin`.

## Configuración

Copiar `.env.example` a `.env.local` y definir `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` y `DATABASE_URL` antes de producción. Sin `DATABASE_URL`, las respuestas se guardan solo en modo demo.

## Base de datos

Ejecutar `db/schema.sql` en una base Postgres nueva. Las respuestas de RP usan `source = 'poleas-rp'`, por lo que no se mezclan con datos históricos de Fundición Lehmann.
