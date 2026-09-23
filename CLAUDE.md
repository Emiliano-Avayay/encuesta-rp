# Poleas RP - Guía del proyecto

Aplicación Next.js de encuestas de satisfacción para Poleas RP.

- Encuesta pública activa: `/encuesta/venta`.
- Panel privado único: `/staff-rp`.
- Las encuestas se definen centralmente en `lib/constants.ts`; el enlace determina el cuestionario, nunca el cliente.
- Las cinco encuestas previstas comparten el bloque de evaluación general. Solo Venta tiene preguntas específicas activas.
- La escala usa `undefined` para una pregunta sin responder, `1..5` para valoraciones y `null` para “No contestar”.
- `null` no entra en promedios, pero se conserva para análisis.
- Las respuestas RP se aíslan mediante `source = 'poleas-rp'`; no mezclar con históricos de FL.
- Persistencia: Postgres cuando existe `DATABASE_URL`; de lo contrario modo demo local.
- No hay adjuntos, no conformidades, almacenamiento de imágenes ni notificaciones SMTP.

Antes de entregar cambios, ejecutar:

```bash
npx tsc --noEmit
npm run lint
npm run build
```
