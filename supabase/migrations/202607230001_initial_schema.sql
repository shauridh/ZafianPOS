create extension if not exists pgcrypto;

create type public.item_kind as enum ('raw_material','production_output','sales_supply','direct_sale');
create type public.movement_kind as enum ('purchase','production_input','production_output','sale','conversion_in','conversion_out','waste','opname','refund','adjustment');

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Jakarta',
  phone text,
  address text,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now()
);

create table public.business_settings (
  outlet_id uuid primary key references public.outlets(id) on delete cascade,
  business_name text not null,
  tagline text,
  primary_color text not null default '#a80f16',
  sidebar_color text not null default '#211d1a',
  auto_print_receipt boolean not null default true,
  print_kitchen_ticket boolean not null default false,
  receipt_width smallint not null default 58 check (receipt_width in (58,80)),
  cashout_pin_threshold numeric(14,2) not null default 50000,
  negative_stock_default boolean not null default false,
  stock_alert_default boolean not null default true,
  batch_usage_method text not null default 'fifo' check (batch_usage_method in ('fifo','manual')),
  updated_at timestamptz not null default now()
);

create table public.operators (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  initials varchar(3),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.owner_security (
  outlet_id uuid primary key references public.outlets(id) on delete cascade,
  pin_hash text not null,
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  sku text,
  name text not null,
  kind public.item_kind not null,
  image_path text,
  supplier_name text,
  purchase_price numeric(14,2),
  purchase_unit text not null,
  usage_unit text not null,
  units_per_purchase numeric(18,6) not null default 1 check (units_per_purchase > 0),
  stock_quantity numeric(18,6) not null default 0,
  minimum_stock numeric(18,6) not null default 0,
  shelf_life_days integer,
  storage_location text,
  stock_alert_enabled boolean not null default true,
  allow_negative_stock boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, sku),
  unique(outlet_id, name)
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  name text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  unique(outlet_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  image_path text,
  sale_price numeric(14,2) not null check (sale_price >= 0),
  allows_chicken_cut_choice boolean not null default false,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, name)
);

create table public.product_components (
  product_id uuid not null references public.products(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  quantity numeric(18,6) not null check (quantity > 0),
  is_cut_choice boolean not null default false,
  primary key(product_id, inventory_item_id)
);

create table public.production_recipes (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  name text not null,
  default_batch_size numeric(18,3) not null default 2,
  batch_unit text not null default 'pak',
  is_active boolean not null default true,
  unique(outlet_id, name)
);

create table public.production_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.production_recipes(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  direction text not null check (direction in ('input','output')),
  quantity numeric(18,6) not null check (quantity > 0),
  unique(recipe_id, inventory_item_id, direction)
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  kind public.movement_kind not null,
  quantity_delta numeric(18,6) not null,
  balance_after numeric(18,6) not null,
  reference_type text,
  reference_id uuid,
  note text,
  operator_id uuid references public.operators(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  operator_id uuid references public.operators(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.archive_runs (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  storage_path text not null,
  cutoff_at timestamptz not null,
  row_counts jsonb not null default '{}',
  checksum text,
  status text not null default 'uploaded' check (status in ('uploaded','verified','pruned','failed')),
  created_at timestamptz not null default now()
);

create index inventory_items_outlet_active_idx on public.inventory_items(outlet_id, is_active);
create index products_outlet_active_idx on public.products(outlet_id, is_active, sort_order);
create index categories_outlet_sort_idx on public.menu_categories(outlet_id, sort_order);
create index stock_movements_item_time_idx on public.stock_movements(inventory_item_id, created_at desc);
create index stock_movements_outlet_time_idx on public.stock_movements(outlet_id, created_at desc);
create index activity_logs_outlet_time_idx on public.activity_logs(outlet_id, created_at desc);

create or replace function public.current_outlet_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'outlet_id','')::uuid
$$;

alter table public.outlets enable row level security;
alter table public.business_settings enable row level security;
alter table public.operators enable row level security;
alter table public.owner_security enable row level security;
alter table public.inventory_items enable row level security;
alter table public.menu_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_components enable row level security;
alter table public.production_recipes enable row level security;
alter table public.production_recipe_lines enable row level security;
alter table public.stock_movements enable row level security;
alter table public.activity_logs enable row level security;
alter table public.archive_runs enable row level security;

create policy "outlet read" on public.outlets for select using (id = public.current_outlet_id());
create policy "outlet settings" on public.business_settings for all using (outlet_id = public.current_outlet_id()) with check (outlet_id = public.current_outlet_id());
create policy "outlet operators" on public.operators for all using (outlet_id = public.current_outlet_id()) with check (outlet_id = public.current_outlet_id());
create policy "outlet security read" on public.owner_security for select using (false);
create policy "outlet inventory" on public.inventory_items for all using (outlet_id = public.current_outlet_id()) with check (outlet_id = public.current_outlet_id());
create policy "outlet categories" on public.menu_categories for all using (outlet_id = public.current_outlet_id()) with check (outlet_id = public.current_outlet_id());
create policy "outlet products" on public.products for all using (outlet_id = public.current_outlet_id()) with check (outlet_id = public.current_outlet_id());
create policy "outlet components" on public.product_components for all
  using (exists(select 1 from public.products p where p.id=product_id and p.outlet_id=public.current_outlet_id()))
  with check (exists(select 1 from public.products p where p.id=product_id and p.outlet_id=public.current_outlet_id()));
create policy "outlet recipes" on public.production_recipes for all using (outlet_id=public.current_outlet_id()) with check (outlet_id=public.current_outlet_id());
create policy "outlet recipe lines" on public.production_recipe_lines for all
  using (exists(select 1 from public.production_recipes r where r.id=recipe_id and r.outlet_id=public.current_outlet_id()))
  with check (exists(select 1 from public.production_recipes r where r.id=recipe_id and r.outlet_id=public.current_outlet_id()));
create policy "outlet movements" on public.stock_movements for select using (outlet_id=public.current_outlet_id());
create policy "outlet activity" on public.activity_logs for select using (outlet_id=public.current_outlet_id());
create policy "outlet archives" on public.archive_runs for select using (outlet_id=public.current_outlet_id());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end
$$;
create trigger business_settings_updated before update on public.business_settings for each row execute function public.set_updated_at();
create trigger inventory_items_updated before update on public.inventory_items for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

create or replace function public.verify_owner_pin(candidate text)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare sec public.owner_security%rowtype;
begin
  select * into sec from public.owner_security where outlet_id=public.current_outlet_id() for update;
  if sec.locked_until is not null and sec.locked_until > now() then return false; end if;
  if sec.pin_hash = crypt(candidate, sec.pin_hash) then
    update public.owner_security set failed_attempts=0, locked_until=null where outlet_id=sec.outlet_id;
    return true;
  end if;
  update public.owner_security
    set failed_attempts=failed_attempts+1,
        locked_until=case when failed_attempts+1 >= 5 then now()+interval '5 minutes' else null end
    where outlet_id=sec.outlet_id;
  return false;
end
$$;
revoke all on function public.verify_owner_pin(text) from public;
grant execute on function public.verify_owner_pin(text) to authenticated;
