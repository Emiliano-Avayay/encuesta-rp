-- Aplicar manualmente antes de desplegar la funcionalidad CUIT de empresas.
-- No destructiva e idempotente: solo agrega una columna opcional. Las empresas existentes
-- quedan con cuit = NULL; no se modifican identificadores, respuestas ni auditoría.
-- Sin UNIQUE a propósito: el modelo de negocio todavía no exige un CUIT exclusivo por registro.
begin;
-- Aborta sin cambios si no puede adquirir el bloqueo en un plazo breve.
set local lock_timeout = '5s';
-- Si la columna ya existe, toda la cláusula (incluida la restricción) se omite.
alter table follow_up_companies
  add column if not exists cuit text
  constraint follow_up_companies_cuit_check check (cuit is null or cuit ~ '^[0-9]{11}$');
commit;
