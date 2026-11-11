-- =====================================================================
-- ObraList — Base de datos en Supabase (PostgreSQL)
--
-- Cómo usarlo: en tu proyecto de Supabase abre "SQL Editor" → "New query",
-- pega TODO este archivo y toca "Run". Sólo se hace una vez.
--
-- Diseño: una sola tabla "registros". Cada fila es una cosa de la app
-- (una lista, un producto, una compra, un registro de bitácora…):
--   usuario     → de quién es (el id de su cuenta)
--   coleccion   → qué tipo de cosa es: 'listas', 'productos', 'compras'…
--   id          → el mismo id que usa la app en el celular
--   datos       → el contenido completo, en formato JSON
--   borrado     → true si se borró (así los otros dispositivos se enteran)
--   actualizado → cuándo cambió por última vez (lo pone el servidor)
-- =====================================================================

create table if not exists public.registros (
  usuario     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  coleccion   text        not null,
  id          text        not null,
  datos       jsonb,
  borrado     boolean     not null default false,
  actualizado timestamptz not null default now(),
  primary key (usuario, coleccion, id)
);

-- Para traer rápido "lo que cambió desde la última vez"
create index if not exists registros_por_fecha on public.registros (usuario, actualizado);

-- La hora de cada cambio la pone el servidor (no el reloj del celular)
create or replace function public.marcar_actualizado()
returns trigger
language plpgsql
as $$
begin
  new.actualizado := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists registros_actualizado on public.registros;
create trigger registros_actualizado
  before insert or update on public.registros
  for each row execute function public.marcar_actualizado();

-- ---------------------------------------------------------------------
-- Seguridad (Row Level Security): cada persona SÓLO puede ver y cambiar
-- sus propias filas. Sin esto, cualquiera con la clave pública vería todo.
-- ---------------------------------------------------------------------
alter table public.registros enable row level security;

drop policy if exists "ver mis datos" on public.registros;
create policy "ver mis datos" on public.registros
  for select to authenticated using ((select auth.uid()) = usuario);

drop policy if exists "crear mis datos" on public.registros;
create policy "crear mis datos" on public.registros
  for insert to authenticated with check ((select auth.uid()) = usuario);

drop policy if exists "editar mis datos" on public.registros;
create policy "editar mis datos" on public.registros
  for update to authenticated using ((select auth.uid()) = usuario) with check ((select auth.uid()) = usuario);

drop policy if exists "borrar mis datos" on public.registros;
create policy "borrar mis datos" on public.registros
  for delete to authenticated using ((select auth.uid()) = usuario);
