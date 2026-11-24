-- Gitmapsite Faz 2 — temel şema
-- Tablolar: profiles (kullanıcılar), orders (siparişler), events (talep radarı olayları)

-- ===== Profiller =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id = p.id
                where p.id = auth.uid() and p.role = 'admin' and u.email_confirmed_at is not null);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''),
          case when lower(new.email) = 'nahitcan@gmail.com' then 'admin' else 'customer' end)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profil: kendi veya yönetici okur" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profil: kendi günceller" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- ===== Siparişler =====
create table if not exists public.orders (
  id text primary key check (id ~ '^GM-[A-Z0-9]{4,20}$'),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'Yeni talep' check (status in ('Yeni talep','Teklif gönderildi','Ödeme alındı','Geliştiriliyor','Test','Web''de yayında','Mağazaya gönderildi','Mağazada','İptal')),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 200),
  brand text not null check (char_length(brand) between 1 and 120),
  slogan text check (char_length(slogan) <= 200),
  sector text check (char_length(sector) <= 120),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  idea text check (char_length(idea) <= 3000),
  note text check (char_length(note) <= 3000),
  tier text not null check (tier in ('site','is','platform')),
  mobile text not null default 'yok' check (mobile in ('yok','android','ikisi')),
  paid boolean not null default false,
  price numeric check (price >= 0 and price < 100000),
  domain text check (char_length(domain) <= 253),
  hosting text not null default 'biz' check (hosting in ('biz','kendi')),
  ai text[] not null default '{}',
  bakim boolean not null default true,
  repo jsonb,
  total numeric not null default 0,
  monthly numeric not null default 0,
  live_url text check (char_length(live_url) <= 500),
  admin_note text,
  constraint contact_required check (coalesce(phone,'') <> '' or coalesce(email,'') <> '')
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_user_idx on public.orders (user_id);
alter table public.orders enable row level security;

create policy "sipariş: herkes yeni talep oluşturur" on public.orders for insert to anon, authenticated
  with check (status = 'Yeni talep' and live_url is null and admin_note is null
              and (user_id is null or user_id = auth.uid()));
create policy "sipariş: sahibi veya yönetici okur" on public.orders for select
  using ((user_id is not null and user_id = auth.uid()) or public.is_admin());
create policy "sipariş: yönetici günceller" on public.orders for update
  using (public.is_admin()) with check (public.is_admin());
create policy "sipariş: yönetici siler" on public.orders for delete using (public.is_admin());

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- Hesabı olmayan müşterinin sipariş durumunu (sipariş no + telefon/e-posta ile) sorgulaması
create or replace function public.order_status(p_id text, p_contact text)
returns table (id text, brand text, status text, live_url text, created_at timestamptz, total numeric)
language sql stable security definer set search_path = public as $$
  select o.id, o.brand, o.status, o.live_url, o.created_at, o.total from public.orders o
  where o.id = p_id and p_contact <> '' and (
    regexp_replace(coalesce(o.phone,''),'\D','','g') = regexp_replace(p_contact,'\D','','g')
    or lower(coalesce(o.email,'')) = lower(p_contact));
$$;
revoke all on function public.order_status(text,text) from public;
grant execute on function public.order_status(text,text) to anon, authenticated;

-- ===== Talep radarı olayları =====
create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id text check (char_length(session_id) <= 64),
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('search','category_view','app_view','app_want','wizard_submit','radar_search')),
  query text check (char_length(query) <= 200),
  category text check (char_length(category) <= 60),
  repo text check (char_length(repo) <= 200),
  meta jsonb check (pg_column_size(meta) <= 4000)
);
create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_type_idx on public.events (type, created_at desc);
alter table public.events enable row level security;
create policy "olay: herkes kaydeder" on public.events for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy "olay: yönetici okur" on public.events for select using (public.is_admin());

-- Yönetici için talep radarı özeti
create or replace function public.demand_radar(p_days int default 7)
returns table (kind text, label text, hits bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'yetkisiz'; end if;
  return query
    select 'kategori'::text, e.category, count(*) from public.events e
      where e.type = 'category_view' and e.created_at > now() - make_interval(days => p_days) and e.category is not null
      group by e.category
    union all
    select 'arama', lower(trim(e.query)), count(*) from public.events e
      where e.type in ('search','radar_search') and e.created_at > now() - make_interval(days => p_days) and coalesce(trim(e.query),'') <> ''
      group by lower(trim(e.query))
    union all
    select 'uygulama', e.repo, count(*) from public.events e
      where e.type in ('app_view','app_want') and e.created_at > now() - make_interval(days => p_days) and e.repo is not null
      group by e.repo
    order by 3 desc limit 60;
end; $$;
revoke all on function public.demand_radar(int) from public;
grant execute on function public.demand_radar(int) to authenticated;
