-- =============================================================================
-- ELC Motor MES — начальная схема базы данных
-- Цех ремонта электродвигателей
--
-- Как применить: вставьте весь файл в SQL Editor проекта Supabase и нажмите Run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Справочники (типы)
-- -----------------------------------------------------------------------------

create type public.user_role as enum (
  'admin',        -- руководитель / полный доступ
  'dispatcher',   -- приёмка, заявки, назначение работ
  'master',       -- мастер цеха, выполняет операции
  'otk'           -- ОТК / испытания
);

create type public.work_order_status as enum (
  'received',       -- принят в цех
  'diagnosis',      -- диагностика / дефектовка
  'in_progress',    -- в работе
  'waiting_parts',  -- ожидание запчастей
  'assembly',       -- сборка
  'testing',        -- испытания
  'ready',          -- готов к выдаче
  'delivered',      -- выдан заказчику
  'cancelled'       -- отменён
);

create type public.work_order_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

create type public.node_type as enum (
  'stator',          -- статор
  'rotor',           -- ротор
  'housing',         -- корпус
  'end_shield',      -- подшипниковый щит
  'bearing',         -- подшипник
  'fan',             -- вентилятор
  'terminal_box',    -- клеммная коробка
  'shaft',           -- вал
  'other'            -- прочее
);

create type public.node_status as enum (
  'pending',
  'in_progress',
  'done',
  'scrapped'
);

create type public.operation_type as enum (
  'diagnosis',       -- диагностика
  'disassembly',     -- разборка
  'washing',         -- мойка
  'defect_inspection', -- дефектовка
  'rewind',          -- перемотка
  'impregnation',    -- пропитка
  'drying',          -- сушка
  'turning',         -- проточка
  'bearing_replace', -- замена подшипников
  'assembly',        -- сборка
  'testing',         -- испытания
  'painting',        -- покраска
  'other'
);

create type public.operation_status as enum (
  'pending',
  'in_progress',
  'done',
  'blocked'
);

-- -----------------------------------------------------------------------------
-- 2. Служебная функция: автоматически обновлять updated_at
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Пользователи с ролями
--    id совпадает с id из Authentication (auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'master',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

comment on table public.profiles is 'Сотрудники цеха: профиль и роль поверх аккаунта Supabase Auth';

-- При регистрации нового пользователя сразу создаём строку в profiles.
-- Роль по умолчанию — master. Первого сотрудника потом руками сделайте admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Сотрудник'),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'master')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Заявки (ремонтные наряды)
-- -----------------------------------------------------------------------------

create sequence public.work_order_number_seq;

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status public.work_order_status not null default 'received',
  priority public.work_order_priority not null default 'normal',

  customer_name text not null,
  customer_phone text,
  customer_company text,

  motor_type text,              -- тип / серия, например АИР132M4
  serial_number text,
  manufacturer text,
  power_kw numeric(8, 2),
  voltage_v integer,
  rpm integer,
  motor_passport text,          -- свободное описание паспорта

  received_at timestamptz not null default now(),
  due_at date,
  delivered_at timestamptz,

  created_by uuid references public.profiles (id),
  assigned_master_id uuid references public.profiles (id),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger work_orders_set_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

create index work_orders_status_idx on public.work_orders (status);
create index work_orders_received_at_idx on public.work_orders (received_at desc);
create index work_orders_assigned_master_idx on public.work_orders (assigned_master_id);

comment on table public.work_orders is 'Заявки на ремонт электродвигателей';

-- Автономер: ЗН-2026-0001
create or replace function public.set_work_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number :=
      'ЗН-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.work_order_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger work_orders_set_number
before insert on public.work_orders
for each row execute function public.set_work_order_number();

-- -----------------------------------------------------------------------------
-- 5. Узлы двигателя в рамках заявки
-- -----------------------------------------------------------------------------

create table public.motor_nodes (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  node_type public.node_type not null,
  name text not null,
  status public.node_status not null default 'pending',
  condition_notes text,         -- что обнаружено при дефектовке
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger motor_nodes_set_updated_at
before update on public.motor_nodes
for each row execute function public.set_updated_at();

create index motor_nodes_work_order_idx on public.motor_nodes (work_order_id);

comment on table public.motor_nodes is 'Узлы конкретного двигателя по заявке (статор, ротор, щиты и т.д.)';

-- -----------------------------------------------------------------------------
-- 6. Операции (технологические работы)
-- -----------------------------------------------------------------------------

create table public.operations (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  node_id uuid references public.motor_nodes (id) on delete set null,
  operation_type public.operation_type not null,
  title text not null,
  status public.operation_status not null default 'pending',
  assigned_to uuid references public.profiles (id),
  sequence_no integer not null default 1,
  planned_minutes integer,
  notes text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operations_finished_after_start
    check (finished_at is null or started_at is null or finished_at >= started_at)
);

create trigger operations_set_updated_at
before update on public.operations
for each row execute function public.set_updated_at();

create index operations_work_order_idx on public.operations (work_order_id);
create index operations_assigned_to_idx on public.operations (assigned_to);
create index operations_status_idx on public.operations (status);

comment on table public.operations is 'Операции ремонта: перемотка, пропитка, сборка, испытания и др.';

-- -----------------------------------------------------------------------------
-- 7. Логи времени
-- -----------------------------------------------------------------------------

create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint time_logs_ended_after_start
    check (ended_at is null or ended_at >= started_at)
);

create index time_logs_operation_idx on public.time_logs (operation_id);
create index time_logs_user_idx on public.time_logs (user_id);
create index time_logs_started_at_idx on public.time_logs (started_at desc);

-- Один незакрытый интервал на сотрудника (нельзя забыть «выключиться»)
create unique index time_logs_one_open_per_user
  on public.time_logs (user_id)
  where ended_at is null;

comment on table public.time_logs is 'Факт времени, затраченного сотрудником на операцию';

-- Удобное представление: длительность в минутах
-- security_invoker = true: действуют те же права, что и у таблицы time_logs
create or replace view public.time_logs_with_duration
with (security_invoker = true) as
select
  tl.*,
  round(extract(epoch from (coalesce(tl.ended_at, now()) - tl.started_at)) / 60.0, 1)
    as duration_minutes
from public.time_logs tl;

-- -----------------------------------------------------------------------------
-- 8. Права и Row Level Security
-- -----------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true;
$$;

alter table public.profiles enable row level security;
alter table public.work_orders enable row level security;
alter table public.motor_nodes enable row level security;
alter table public.operations enable row level security;
alter table public.time_logs enable row level security;

-- Профили: сотрудники видят коллег; менять себя; роли меняет только admin
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy profiles_admin_update
  on public.profiles for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Заявки: все авторизованные читают; создают/правят диспетчер и admin
create policy work_orders_select_authenticated
  on public.work_orders for select
  to authenticated
  using (true);

create policy work_orders_write_office
  on public.work_orders for all
  to authenticated
  using (public.current_user_role() in ('admin', 'dispatcher'))
  with check (public.current_user_role() in ('admin', 'dispatcher'));

-- Узлы: чтение всем; запись диспетчер/admin, плюс мастер может менять статус/заметки
create policy motor_nodes_select_authenticated
  on public.motor_nodes for select
  to authenticated
  using (true);

create policy motor_nodes_write_office
  on public.motor_nodes for all
  to authenticated
  using (public.current_user_role() in ('admin', 'dispatcher'))
  with check (public.current_user_role() in ('admin', 'dispatcher'));

create policy motor_nodes_update_master
  on public.motor_nodes for update
  to authenticated
  using (public.current_user_role() = 'master')
  with check (public.current_user_role() = 'master');

-- Операции
create policy operations_select_authenticated
  on public.operations for select
  to authenticated
  using (true);

create policy operations_write_office
  on public.operations for all
  to authenticated
  using (public.current_user_role() in ('admin', 'dispatcher'))
  with check (public.current_user_role() in ('admin', 'dispatcher'));

create policy operations_update_assignee
  on public.operations for update
  to authenticated
  using (
    public.current_user_role() in ('master', 'otk')
    and assigned_to = auth.uid()
  )
  with check (assigned_to = auth.uid());

-- Логи времени: все читают; сотрудник пишет только свои
create policy time_logs_select_authenticated
  on public.time_logs for select
  to authenticated
  using (true);

create policy time_logs_insert_own
  on public.time_logs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy time_logs_update_own
  on public.time_logs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy time_logs_admin_all
  on public.time_logs for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
