-- Add a trade-initiated Addition without changing existing quote amounts.
alter type public.change_request_type add value if not exists 'addition';

alter table public.change_requests
  add column if not exists related_scope_item_id uuid
  references public.scope_items(id) on delete set null;

alter table public.change_requests
  add column if not exists related_quote_line_item_id uuid
  references public.quote_line_items(id) on delete set null;

create or replace function public.validate_variation_scope_link()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.related_scope_item_id is not null and new.related_quote_line_item_id is not null then
    raise exception 'Choose only one related quote item';
  end if;
  if new.related_scope_item_id is not null and not exists (
    select 1 from public.scope_items s
    where s.id = new.related_scope_item_id and s.project_id = new.project_id
  ) then
    raise exception 'Related quote item must belong to the same project';
  end if;
  if new.related_quote_line_item_id is not null and not exists (
    select 1 from public.quote_line_items i
    join public.quotes q on q.id = i.quote_id
    where i.id = new.related_quote_line_item_id and q.project_id = new.project_id
  ) then
    raise exception 'Related quote item must belong to the same project';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_variation_scope_link on public.change_requests;
create trigger validate_variation_scope_link
before insert or update on public.change_requests
for each row execute function public.validate_variation_scope_link();

notify pgrst, 'reload schema';
