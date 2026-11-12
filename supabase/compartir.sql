-- =====================================================================
-- ObraList — Listas compartidas en tiempo real
--
-- Cómo usarlo: en Supabase abre "SQL Editor" → "New query", pega TODO
-- este archivo y toca "Run". Sólo se hace una vez (después de esquema.sql).
--
-- Idea: el dueño de una lista invita a alguien por su correo. Esa persona
-- puede ver y editar SÓLO esa lista (nada más de la cuenta del dueño), y
-- los cambios llegan al instante a los dos (Realtime).
-- =====================================================================

create table if not exists public.compartidos (
  dueno          uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  dueno_email    text        not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  lista_id       text        not null,
  invitado_email text        not null,
  creado         timestamptz not null default now(),
  primary key (dueno, lista_id, invitado_email)
);
create index if not exists compartidos_por_invitado on public.compartidos (invitado_email);

-- El correo de quien está conectado, en minúsculas
create or replace function public.mi_correo()
returns text language sql stable
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

alter table public.compartidos enable row level security;

drop policy if exists "ver invitaciones" on public.compartidos;
create policy "ver invitaciones" on public.compartidos
  for select to authenticated
  using (dueno = (select auth.uid()) or invitado_email = (select public.mi_correo()));

drop policy if exists "invitar a mis listas" on public.compartidos;
create policy "invitar a mis listas" on public.compartidos
  for insert to authenticated
  with check (
    dueno = (select auth.uid())
    and invitado_email = lower(invitado_email)
    and invitado_email <> (select public.mi_correo())
    and exists (select 1 from public.registros r
                where r.usuario = (select auth.uid()) and r.coleccion = 'listas' and r.id = lista_id)
  );

drop policy if exists "quitar invitaciones" on public.compartidos;
create policy "quitar invitaciones" on public.compartidos
  for delete to authenticated
  using (dueno = (select auth.uid()) or invitado_email = (select public.mi_correo()));

-- El invitado puede VER y EDITAR la fila de esa lista (y sólo esa)
drop policy if exists "ver listas compartidas conmigo" on public.registros;
create policy "ver listas compartidas conmigo" on public.registros
  for select to authenticated
  using (coleccion = 'listas' and exists (
    select 1 from public.compartidos c
    where c.dueno = registros.usuario and c.lista_id = registros.id
      and c.invitado_email = (select public.mi_correo())));

drop policy if exists "editar listas compartidas conmigo" on public.registros;
create policy "editar listas compartidas conmigo" on public.registros
  for update to authenticated
  using (coleccion = 'listas' and exists (
    select 1 from public.compartidos c
    where c.dueno = registros.usuario and c.lista_id = registros.id
      and c.invitado_email = (select public.mi_correo())))
  with check (coleccion = 'listas' and exists (
    select 1 from public.compartidos c
    where c.dueno = registros.usuario and c.lista_id = registros.id
      and c.invitado_email = (select public.mi_correo())));

-- Tiempo real: avisar a la app cuando cambian estas tablas
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'registros') then
    alter publication supabase_realtime add table public.registros;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'compartidos') then
    alter publication supabase_realtime add table public.compartidos;
  end if;
end $$;
