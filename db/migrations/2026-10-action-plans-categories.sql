-- Cambia las categorías de action_plans a: contactos, encuestas, instructivos, informe.
-- NO destructiva: aborta si existen documentos en las categorías anteriores.
-- Antes de ejecutarla: select category, count(*) from action_plans group by 1;
begin;
do $$ begin
  if exists (select 1 from action_plans where category not in ('contactos','encuestas','instructivos','informe')) then
    raise exception 'Hay documentos en categorías anteriores; decidir su destino antes de migrar.';
  end if;
end $$;
alter table action_plans drop constraint if exists action_plans_category_check;
alter table action_plans add constraint action_plans_category_check check (category in ('contactos','encuestas','instructivos','informe'));
commit;
