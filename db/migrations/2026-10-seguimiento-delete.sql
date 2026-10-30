-- Aplicar manualmente antes de desplegar la funcionalidad Eliminar empresa.
-- Conserva las acciones anteriores y todos los registros. No modifica empresas ni respuestas.
begin;
-- Aborta sin cambios si no puede adquirir el bloqueo en un plazo breve.
set local lock_timeout = '5s';
alter table follow_up_audit drop constraint follow_up_audit_action_check;
alter table follow_up_audit add constraint follow_up_audit_action_check
  check (action in ('create', 'update', 'import', 'delete'));
-- company_id se conserva como UUID sin FK a follow_up_companies: la auditoría
-- debe sobrevivir al borrado. changes.before guarda la empresa completa,
-- incluido nombre, segmento y linkedResponseId; actor y at identifican al responsable y la fecha.
commit;
