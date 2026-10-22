-- Cole tudo isto no Supabase → SQL Editor → New query → Run.

-- Pedidos (cada compra)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  message text not null default '',
  color smallint not null,
  qty int not null,
  amount numeric(10,2) not null,
  status text not null default 'pending', -- pending | paid
  mp_payment_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz
);

-- Quadradinhos (só existem linhas para os pintados ou reservados)
create table if not exists pixels (
  x int not null,
  y int not null,
  color smallint not null,
  order_id uuid not null references orders(id) on delete cascade,
  status text not null default 'reserved', -- reserved | paid
  expires_at timestamptz,
  primary key (x, y)
);

create index if not exists pixels_status_idx on pixels (status, expires_at);
create index if not exists pixels_order_idx on pixels (order_id);
create index if not exists orders_status_idx on orders (status);

-- Segurança: o público só consegue LER quadradinhos pagos.
-- Todo o resto passa pelo servidor do site.
alter table orders enable row level security;
alter table pixels enable row level security;

drop policy if exists "ver quadradinhos pagos" on pixels;
create policy "ver quadradinhos pagos" on pixels
  for select using (status = 'paid');

-- Atualização em tempo real do mural
do $$
begin
  alter publication supabase_realtime add table pixels;
exception when duplicate_object then null;
end $$;

-- Busca compacta dos quadradinhos pagos de uma região
create or replace function get_pixels(x0 int, y0 int, x1 int, y1 int)
returns text
language sql
stable
as $$
  select coalesce(string_agg(x || ',' || y || ',' || color, ';'), '')
  from pixels
  where status = 'paid'
    and x between x0 and x1
    and y between y0 and y1;
$$;

-- Ranking dos maiores pintores
create or replace view ranking as
select
  nickname,
  (array_agg(message order by paid_at desc))[1] as message,
  (array_agg(color order by qty desc))[1] as color,
  sum(qty)::int as total
from orders
where status = 'paid'
group by nickname
order by total desc
limit 20;

revoke all on ranking from anon, authenticated;
revoke execute on function get_pixels(int, int, int, int) from anon, authenticated;
