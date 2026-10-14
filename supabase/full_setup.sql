-- Zari: full database setup for a NEW Supabase project (migrations 0001-0004 in order).
-- Paste into Supabase SQL Editor and Run once. Generated from supabase/migrations/.

-- ===== 0001_init.sql =====
-- =========================================================
-- Zari — initial schema.
-- Separate Supabase project from You & Me. No baby/kids fields, no shared data.
-- Every customer-facing table has RLS. Service-role (edge functions) bypasses RLS by design.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Admins (who can use the admin console)
-- ---------------------------------------------------------
create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where id = auth.uid());
$$;

-- ---------------------------------------------------------
-- Customer profile (1:1 with auth.users)
-- ---------------------------------------------------------
create table customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customer_profiles enable row level security;
create policy "customer reads own profile" on customer_profiles for select using (auth.uid() = id);
create policy "customer updates own profile" on customer_profiles for update using (auth.uid() = id);
create policy "customer inserts own profile" on customer_profiles for insert with check (auth.uid() = id);
create policy "admin full access to profiles" on customer_profiles for all using (is_admin());

-- ---------------------------------------------------------
-- Taxonomy: categories (saree type), collections, occasions
-- ---------------------------------------------------------
create type taxonomy_kind as enum ('saree_type', 'fabric', 'occasion', 'style');

create table categories (
  id uuid primary key default gen_random_uuid(),
  kind taxonomy_kind not null,
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  banner_image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table collections enable row level security;
create policy "public reads categories" on categories for select using (true);
create policy "admin writes categories" on categories for all using (is_admin());
create policy "public reads collections" on collections for select using (true);
create policy "admin writes collections" on collections for all using (is_admin());

-- ---------------------------------------------------------
-- Products
-- ---------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  description text,

  -- saree-specific structured attributes (nullable — only shown on the product page when set)
  fabric text,
  saree_length_m numeric(4,2),
  blouse_included boolean not null default false,
  blouse_length_m numeric(4,2),
  blouse_colour text,
  work_type text,
  weave text,
  pattern text,
  border_type text,
  occasion text,
  wash_care text,
  ready_to_wear boolean not null default false,
  country_of_origin text,

  price numeric(10,2) not null,
  sale_price numeric(10,2),

  status text not null default 'draft' check (status in ('draft','active','archived')),
  featured boolean not null default false,
  new_arrival boolean not null default false,

  seo_title text,
  seo_description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_status_idx on products(status);
create index products_slug_idx on products(slug);

create table product_categories (
  product_id uuid not null references products(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create table product_collections (
  product_id uuid not null references products(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  image_url text not null,
  image_type text not null default 'gallery' check (image_type in ('gallery','front','drape','closeup','border','blouse','lifestyle','video')),
  sort_order int not null default 0
);

create table product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  hex text,
  sort_order int not null default 0
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_sku text not null unique,
  color text,
  size text, -- only populated for ready-to-wear / blouse-piece products
  stock int not null default 0 check (stock >= 0)
);

create table complete_the_look (
  product_id uuid not null references products(id) on delete cascade,
  related_product_id uuid not null references products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, related_product_id),
  check (product_id <> related_product_id)
);

alter table products enable row level security;
alter table product_categories enable row level security;
alter table product_collections enable row level security;
alter table product_images enable row level security;
alter table product_colors enable row level security;
alter table product_variants enable row level security;
alter table complete_the_look enable row level security;

create policy "public reads active products" on products for select using (status = 'active' or is_admin());
create policy "admin writes products" on products for all using (is_admin());
create policy "public reads product_categories" on product_categories for select using (true);
create policy "admin writes product_categories" on product_categories for all using (is_admin());
create policy "public reads product_collections" on product_collections for select using (true);
create policy "admin writes product_collections" on product_collections for all using (is_admin());
create policy "public reads product_images" on product_images for select using (true);
create policy "admin writes product_images" on product_images for all using (is_admin());
create policy "public reads product_colors" on product_colors for select using (true);
create policy "admin writes product_colors" on product_colors for all using (is_admin());
create policy "public reads product_variants" on product_variants for select using (true);
create policy "admin writes product_variants" on product_variants for all using (is_admin());
create policy "public reads complete_the_look" on complete_the_look for select using (true);
create policy "admin writes complete_the_look" on complete_the_look for all using (is_admin());

-- ---------------------------------------------------------
-- Addresses
-- ---------------------------------------------------------
create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  house text not null,
  street text not null,
  landmark text,
  city text not null,
  district text,
  state text not null,
  pincode text not null,
  secondary_phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table addresses enable row level security;
create policy "customer manages own addresses" on addresses for all using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
create policy "admin reads addresses" on addresses for select using (is_admin());

-- ---------------------------------------------------------
-- Wishlist
-- ---------------------------------------------------------
create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

alter table wishlist_items enable row level security;
create policy "customer manages own wishlist" on wishlist_items for all using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

-- ---------------------------------------------------------
-- Orders / payments / shipments
-- ---------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','confirmed','shipped','out_for_delivery','delivered','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','cancelled')),
  subtotal numeric(10,2) not null,
  shipping_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  shipping_address jsonb not null,
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  customer_hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  name_snapshot text not null,
  sku_snapshot text not null,
  color_snapshot text,
  size_snapshot text,
  price_snapshot numeric(10,2) not null,
  qty int not null check (qty > 0)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null default 'cashfree',
  provider_order_id text,
  provider_payment_id text,
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled')),
  amount numeric(10,2) not null,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);
create unique index payments_provider_order_idx on payments(provider, provider_order_id) where provider_order_id is not null;

create table shipping_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- delhivery | shiprocket | fship | custom
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb, -- credentials, service-role/edge-function access ONLY
  created_at timestamptz not null default now()
);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null,
  awb text,
  status text not null default 'created',
  tracking_url text,
  secondary_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  status text not null,
  description text,
  customer_visible boolean not null default true,
  occurred_at timestamptz not null default now()
);

alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table shipping_providers enable row level security;
alter table shipments enable row level security;
alter table shipment_events enable row level security;

create policy "customer reads own orders" on orders for select using (auth.uid() = customer_id and customer_hidden_at is null);
create policy "admin full access orders" on orders for all using (is_admin());
create policy "customer hides own order" on orders for update using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

create policy "customer reads own order_items" on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid())
);
create policy "admin full access order_items" on order_items for all using (is_admin());

create policy "admin full access payments" on payments for all using (is_admin());
create policy "admin full access shipping_providers" on shipping_providers for all using (is_admin());

create policy "customer reads own shipments" on shipments for select using (
  exists (select 1 from orders o where o.id = shipments.order_id and o.customer_id = auth.uid())
);
create policy "admin full access shipments" on shipments for all using (is_admin());

create policy "customer reads own customer-visible shipment_events" on shipment_events for select using (
  customer_visible = true and exists (
    select 1 from shipments s join orders o on o.id = s.order_id
    where s.id = shipment_events.shipment_id and o.customer_id = auth.uid()
  )
);
create policy "admin full access shipment_events" on shipment_events for all using (is_admin());

-- ---------------------------------------------------------
-- Reviews (verified purchase only)
-- ---------------------------------------------------------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  review_text text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (customer_id, order_item_id)
);

alter table reviews enable row level security;
create policy "public reads approved reviews" on reviews for select using (status = 'approved' or is_admin() or customer_id = auth.uid());
create policy "customer creates own review" on reviews for insert with check (
  auth.uid() = customer_id
  and exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_id and oi.product_id = reviews.product_id
      and o.customer_id = auth.uid() and o.payment_status = 'paid'
  )
);
create policy "admin moderates reviews" on reviews for update using (is_admin());

-- ---------------------------------------------------------
-- Notify me (back in stock)
-- ---------------------------------------------------------
create table notify_me (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (product_id, variant_id, email)
);

alter table notify_me enable row level security;
create policy "anyone inserts notify_me" on notify_me for insert with check (true);
create policy "admin reads notify_me" on notify_me for select using (is_admin());

-- ---------------------------------------------------------
-- Newsletter
-- ---------------------------------------------------------
create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid()
);

alter table newsletter_subscribers enable row level security;
create policy "anyone subscribes" on newsletter_subscribers for insert with check (true);
create policy "admin reads subscribers" on newsletter_subscribers for select using (is_admin());

-- ---------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','live','expired','disabled')),
  discount_type text check (discount_type in ('percent','flat')),
  discount_value numeric(10,2),
  starts_at timestamptz,
  ends_at timestamptz,
  banner_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table campaign_products (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (campaign_id, product_id)
);

create table campaign_categories (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (campaign_id, category_id)
);

alter table campaigns enable row level security;
alter table campaign_products enable row level security;
alter table campaign_categories enable row level security;
create policy "public reads live campaigns" on campaigns for select using (status = 'live' or is_admin());
create policy "admin writes campaigns" on campaigns for all using (is_admin());
create policy "public reads campaign_products" on campaign_products for select using (true);
create policy "admin writes campaign_products" on campaign_products for all using (is_admin());
create policy "public reads campaign_categories" on campaign_categories for select using (true);
create policy "admin writes campaign_categories" on campaign_categories for all using (is_admin());

-- ===== 0002_banners_and_product_flags.sql =====
-- =========================================================
-- Zari — homepage banner management + a couple of product flags
-- needed for the "Offer Products" homepage section.
-- =========================================================

create table banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  offer_text text,          -- small eyebrow/badge line, e.g. "Flat 30% Off"
  cta_text text,
  cta_link text,            -- internal hash route (e.g. "/sarees?occasion=wedding") or full URL
  image_url text not null,
  occasion text,            -- free text tag: onam / vishu / wedding / festive-sale / new-arrivals / flash-sale / diwali / eid / christmas / new-year / general
  is_enabled boolean not null default true,
  priority int not null default 0,   -- higher shows first when multiple are active at once
  starts_at timestamptz,             -- null = no start restriction
  ends_at timestamptz,               -- null = no end restriction
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table banners enable row level security;

-- Public can only ever see banners that are enabled AND currently within their
-- scheduled window — admins see everything (so they can prep a banner ahead of time).
create policy "public reads live banners" on banners for select using (
  is_admin() or (
    is_enabled = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  )
);
create policy "admin writes banners" on banners for all using (is_admin());

create index banners_active_idx on banners (is_enabled, priority desc);

-- Explicit "on sale" flag, independent of whether sale_price happens to be set —
-- lets admin flag/unflag a product for the homepage Offer Products rail without
-- having to touch pricing at the same time.
alter table products add column on_sale boolean not null default false;
create index products_on_sale_idx on products(on_sale) where on_sale = true;

-- ===== 0003_product_type_hsn_bestseller.sql =====
-- =========================================================
-- Zari — product_type + hsn_code + a manual best_seller flag.
--
-- Why product_type separate from categories: the supplier list distinguishes
-- SAREE / SET MUNDU / SET SAREE / CHURIDAR as a "type" alongside free-form
-- category tags. Keeping it as its own column (rather than only a category row)
-- makes the type filter and the product-card "type" line trivial and cheap.
--
-- best_seller: an explicit admin toggle. The homepage Best Sellers rail already
-- ranks by real paid-order quantity when order history exists; this flag lets the
-- admin hand-pick best sellers too (e.g. before there is any order history). The
-- frontend shows manual best_seller = true products, falling back to the computed
-- ranking. No fake sales data is invented either way.
-- =========================================================

alter table products add column if not exists product_type text;
alter table products add column if not exists hsn_code text;
alter table products add column if not exists best_seller boolean not null default false;

create index if not exists products_product_type_idx on products(product_type);
create index if not exists products_best_seller_idx on products(best_seller) where best_seller = true;

-- ===== 0004_admin_system.sql =====
-- =========================================================
-- Zari — admin management system.
--
-- Adds: admin roles + per-module permissions, permission-based RLS on every
-- admin-managed table, an immutable admin activity log (trigger-written),
-- website settings / content pages / FAQ / homepage sections, coupons with a
-- server-side cart quote, an order workflow (statuses, shipping, tracking,
-- refunds, history, invoice numbers), category tree + visibility, product
-- MRP / low-stock threshold, storage bucket policies, and the RPCs the admin
-- panel and checkout call.
--
-- Security fixes for issues present in 0001:
--   * `admins` had no RLS — any signed-in user could insert their own id and
--     become an admin through the REST API. RLS is now enabled; only a super
--     admin (or the service role) can write it.
--   * "customer hides own order" let a customer UPDATE any column of their own
--     order (status, payment_status, total…). Replaced by hide_my_order().
--
-- Re-runnable: guarded with IF [NOT] EXISTS / ON CONFLICT throughout. Never
-- deletes products, customers, orders or payments.
-- =========================================================

create extension if not exists "pgcrypto";
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------
-- 1. Roles, permissions, admins
-- ---------------------------------------------------------
-- Permission keys (modules): dashboard, products, categories, homepage,
-- marketing (banners, campaigns, coupons, announcement), orders, customers,
-- reviews, content, settings, activity. '*' = everything (super admin).
-- Managing admin accounts/roles is super-admin only, not a grantable module.
create table if not exists admin_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (length(name) between 1 and 80),
  description text,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into admin_roles (key, name, description, permissions, is_system) values
  ('super_admin', 'Super Admin', 'Full access, including admin accounts, roles and settings.', '{*}', true),
  ('store_manager', 'Store Manager', 'Runs the store day to day. No access to admin accounts or website settings.',
     '{dashboard,products,categories,homepage,marketing,orders,customers,reviews,content,activity}', true),
  ('catalog_manager', 'Catalogue Manager', 'Products, categories, homepage and promotions.',
     '{dashboard,products,categories,homepage,marketing}', true),
  ('order_manager', 'Order Manager', 'Orders, customers and reviews.',
     '{dashboard,orders,customers,reviews}', true),
  ('content_editor', 'Content Editor', 'Pages, homepage content and banners.',
     '{dashboard,homepage,marketing,content}', true)
on conflict (key) do nothing;

alter table admins add column if not exists role_id uuid references admin_roles(id);
alter table admins add column if not exists full_name text;
alter table admins add column if not exists email text;
alter table admins add column if not exists is_active boolean not null default true;
alter table admins add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table admins add column if not exists last_sign_in_at timestamptz;
alter table admins add column if not exists updated_at timestamptz not null default now();

-- Anyone who was already an admin before roles existed keeps full access.
update admins set role_id = (select id from admin_roles where key = 'super_admin') where role_id is null;
update admins a set email = u.email from auth.users u where u.id = a.id and a.email is null;
alter table admins alter column role_id set not null;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid() and is_active);
$$;

create or replace function public.admin_has_perm(p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a join public.admin_roles r on r.id = a.role_id
    where a.id = auth.uid() and a.is_active
      and ('*' = any(r.permissions) or p_perm = any(r.permissions))
  );
$$;

create or replace function public.admin_has_any_perm(p_perms text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a join public.admin_roles r on r.id = a.role_id
    where a.id = auth.uid() and a.is_active
      and ('*' = any(r.permissions) or r.permissions && p_perms)
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a join public.admin_roles r on r.id = a.role_id
    where a.id = auth.uid() and a.is_active and r.key = 'super_admin'
  );
$$;

-- What the admin UI needs to know about the signed-in admin (null for non-admins).
create or replace function public.admin_me()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'email', a.email, 'full_name', a.full_name,
    'role_key', r.key, 'role_name', r.name,
    'permissions', case when '*' = any(r.permissions)
      then to_jsonb(array['dashboard','products','categories','homepage','marketing','orders','customers','reviews','content','settings','activity','admins'])
      else to_jsonb(r.permissions) end,
    'is_super_admin', r.key = 'super_admin',
    'last_sign_in_at', a.last_sign_in_at
  )
  from public.admins a join public.admin_roles r on r.id = a.role_id
  where a.id = auth.uid() and a.is_active;
$$;

alter table admins enable row level security;
alter table admin_roles enable row level security;

drop policy if exists "admin reads own admin row" on admins;
drop policy if exists "super admin reads admins" on admins;
drop policy if exists "super admin writes admins" on admins;
create policy "admin reads own admin row" on admins for select using (id = auth.uid());
create policy "super admin reads admins" on admins for select using (public.is_super_admin() or public.admin_has_perm('activity'));
create policy "super admin writes admins" on admins for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "admins read roles" on admin_roles;
drop policy if exists "super admin writes roles" on admin_roles;
create policy "admins read roles" on admin_roles for select using (public.is_admin());
create policy "super admin writes roles" on admin_roles for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Guard rails: keep at least one active super admin; nobody can lock
-- themselves out; system roles keep their key; permissions are validated.
create or replace function private.guard_admins()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_super uuid := (select id from public.admin_roles where key = 'super_admin');
begin
  if tg_op in ('UPDATE', 'DELETE') and old.role_id = v_super and old.is_active then
    if tg_op = 'DELETE' or new.role_id <> v_super or not new.is_active then
      if (select count(*) from public.admins where role_id = v_super and is_active and id <> old.id) = 0 then
        raise exception 'At least one active Super Admin is required.' using errcode = 'P0001';
      end if;
    end if;
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null and old.id = auth.uid()
     and (new.role_id <> old.role_id or new.is_active <> old.is_active) then
    raise exception 'You cannot change your own role or disable your own account.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' and auth.uid() is not null and old.id = auth.uid() then
    raise exception 'You cannot remove your own admin access.' using errcode = 'P0001';
  end if;
  if tg_op <> 'DELETE' then new.updated_at := now(); return new; end if;
  return old;
end $$;
drop trigger if exists guard_admins on admins;
create trigger guard_admins before update or delete on admins for each row execute function private.guard_admins();

create or replace function private.guard_admin_roles()
returns trigger language plpgsql as $$
declare v_allowed text[] := array['*','dashboard','products','categories','homepage','marketing','orders','customers','reviews','content','settings','activity'];
begin
  if tg_op = 'DELETE' then
    if old.is_system then raise exception 'Built-in roles cannot be deleted.' using errcode = 'P0001'; end if;
    if exists (select 1 from public.admins where role_id = old.id) then
      raise exception 'This role is still assigned to admins.' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if not (new.permissions <@ v_allowed) then raise exception 'Unknown permission in role.' using errcode = 'P0001'; end if;
  if tg_op = 'UPDATE' and old.is_system then
    new.key := old.key; new.is_system := true;
    if old.key = 'super_admin' then new.permissions := '{*}'; end if;
  end if;
  if tg_op = 'INSERT' then new.is_system := false; end if;
  if new.key <> 'super_admin' and '*' = any(new.permissions) then
    raise exception 'Only the Super Admin role has full access.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_admin_roles on admin_roles;
create trigger guard_admin_roles before insert or update or delete on admin_roles for each row execute function private.guard_admin_roles();

-- First super admin. Run ONCE from the Supabase SQL editor after creating the
-- user in Authentication → Users (no credentials are stored anywhere here):
--   select public.bootstrap_super_admin('you@example.com', 'Your Name');
-- Not callable through the API (execute revoked from anon/authenticated).
create or replace function public.bootstrap_super_admin(p_email text, p_full_name text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_role uuid := (select id from admin_roles where key = 'super_admin');
begin
  if exists (select 1 from admins where role_id = v_role and is_active) then
    raise exception 'A Super Admin already exists. Add further admins from the admin panel.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No auth user with that email. Create it first in Authentication → Users.';
  end if;
  insert into admins (id, role_id, email, full_name, is_active)
  values (v_user, v_role, lower(trim(p_email)), p_full_name, true)
  on conflict (id) do update set role_id = excluded.role_id, is_active = true, email = excluded.email,
    full_name = coalesce(excluded.full_name, admins.full_name);
  return 'Super Admin created for ' || lower(trim(p_email));
end $$;
revoke execute on function public.bootstrap_super_admin(text, text) from public, anon, authenticated;

-- Used by the admin-api Edge Function (service role only) to keep admin
-- logins separate from existing customer accounts.
create or replace function public.admin_lookup_user_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke execute on function public.admin_lookup_user_by_email(text) from public, anon, authenticated;
grant execute on function public.admin_lookup_user_by_email(text) to service_role;

-- Admin edits their own display name (role/active state stay super-admin only).
create or replace function public.update_my_admin_profile(p_full_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  update admins set full_name = nullif(left(trim(p_full_name), 120), '') where id = auth.uid();
end $$;

-- ---------------------------------------------------------
-- 2. Rate limiting (internal; not exposed through the API)
-- ---------------------------------------------------------
create table if not exists private.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

create or replace function private.hit_rate_limit(p_key text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = private, public as $$
declare v_row private.rate_limits;
begin
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning * into v_row;
  return v_row.hits <= p_max;
end $$;

-- ---------------------------------------------------------
-- 3. Activity log (immutable, written only by triggers / admin_log_event)
-- ---------------------------------------------------------
create table if not exists admin_activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  summary text,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_activity_log_created_idx on admin_activity_log (created_at desc);
create index if not exists admin_activity_log_entity_idx on admin_activity_log (entity, entity_id);
alter table admin_activity_log enable row level security;
drop policy if exists "admins with activity read log" on admin_activity_log;
create policy "admins with activity read log" on admin_activity_log for select using (public.admin_has_perm('activity'));
-- No insert/update/delete policies: rows can only be written by the
-- SECURITY DEFINER functions below, and never changed afterwards.

create or replace function private.log_admin_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb;
  v_label text;
begin
  -- Only admin actions are audited here; customer and service-role writes are not.
  if v_actor is null then return null; end if;
  select email into v_email from admins where id = v_actor;
  if not found then return null; end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k)) into v_changes
    from jsonb_object_keys(v_new) k
    where k not in ('updated_at') and (v_old -> k) is distinct from (v_new -> k);
    if v_changes is null then return null; end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new - 'raw_payload';
  else
    v_changes := v_old - 'raw_payload';
  end if;

  v_label := coalesce(v_row ->> 'name', v_row ->> 'title', v_row ->> 'order_number', v_row ->> 'code',
                      v_row ->> 'question', v_row ->> 'label', v_row ->> 'email', v_row ->> 'key', v_row ->> 'variant_sku');

  insert into admin_activity_log (actor_id, actor_email, action, entity, entity_id, summary, changes)
  values (v_actor, v_email, lower(tg_op), tg_table_name,
          coalesce(v_row ->> 'product_id', v_row ->> 'order_id', v_row ->> 'coupon_id', v_row ->> 'id', v_row ->> 'key', v_row ->> 'slug'),
          left(v_label, 200), v_changes);
  return null;
end $$;

create or replace function public.admin_log_event(p_action text, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if p_action not in ('login', 'logout', 'password_changed', 'sessions_revoked', 'invoice_downloaded',
                      'orders_exported', 'customers_exported', 'products_exported', 'products_imported') then
    raise exception 'Unknown event' using errcode = '22023';
  end if;
  select email into v_email from admins where id = auth.uid() and is_active;
  if not found then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_action = 'login' then update admins set last_sign_in_at = now() where id = auth.uid(); end if;
  insert into admin_activity_log (actor_id, actor_email, action, entity, entity_id, summary, changes)
  values (auth.uid(), v_email, p_action, 'session', null, p_action,
          case when length(coalesce(p_detail, '{}'::jsonb)::text) <= 2000 then coalesce(p_detail, '{}'::jsonb) else '{"truncated":true}'::jsonb end);
end $$;

-- ---------------------------------------------------------
-- 4. Catalogue additions
-- ---------------------------------------------------------
alter table categories add column if not exists parent_id uuid references categories(id) on delete set null;
alter table categories add column if not exists description text;
alter table categories add column if not exists image_url text;
alter table categories add column if not exists is_visible boolean not null default true;
alter table categories add column if not exists updated_at timestamptz not null default now();
create index if not exists categories_parent_idx on categories(parent_id);

create or replace function private.guard_category_parent()
returns trigger language plpgsql as $$
declare v_cursor uuid := new.parent_id; v_depth int := 0;
begin
  while v_cursor is not null loop
    if v_cursor = new.id then raise exception 'A category cannot be inside itself.' using errcode = 'P0001'; end if;
    v_depth := v_depth + 1;
    if v_depth > 5 then raise exception 'Categories can be nested at most 5 levels.' using errcode = 'P0001'; end if;
    select parent_id into v_cursor from public.categories where id = v_cursor;
  end loop;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_category_parent on categories;
create trigger guard_category_parent before insert or update on categories for each row execute function private.guard_category_parent();

drop policy if exists "public reads categories" on categories;
create policy "public reads categories" on categories for select using (is_visible or public.is_admin());

alter table products add column if not exists mrp numeric(10,2) check (mrp is null or mrp >= 0);
alter table products add column if not exists low_stock_threshold int not null default 3 check (low_stock_threshold >= 0);
alter table product_images add column if not exists storage_path text;
alter table product_images add column if not exists alt_text text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_price_nonneg') then
    alter table products add constraint products_price_nonneg check (price >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_sale_le_price') then
    alter table products add constraint products_sale_le_price check (sale_price is null or (sale_price >= 0 and sale_price <= price)) not valid;
  end if;
end $$;

create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch_products on products;
create trigger touch_products before update on products for each row execute function private.touch_updated_at();

-- Banners: hero carousel vs mid-page promotional blocks.
alter table banners add column if not exists placement text not null default 'hero';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'banners_placement_check') then
    alter table banners add constraint banners_placement_check check (placement in ('hero', 'promo'));
  end if;
end $$;
-- Only store pages (#/…) or http(s) links — never javascript: or data: URLs.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'banners_cta_link_safe') then
    alter table banners add constraint banners_cta_link_safe check (cta_link is null or cta_link ~* '^(#/|https?://)') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'banners_image_url_safe') then
    alter table banners add constraint banners_image_url_safe check (image_url ~* '^https?://') not valid;
  end if;
end $$;
drop trigger if exists touch_banners on banners;
create trigger touch_banners before update on banners for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------
-- 5. Customers
-- ---------------------------------------------------------
alter table customer_profiles add column if not exists account_status text not null default 'active';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'customer_profiles_status_check') then
    alter table customer_profiles add constraint customer_profiles_status_check check (account_status in ('active', 'suspended'));
  end if;
end $$;

-- Customers can edit their name/phone but never their own account status.
create or replace function private.guard_customer_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and not public.admin_has_perm('customers') then new.account_status := 'active'; end if;
  if tg_op = 'UPDATE' and new.account_status is distinct from old.account_status and not public.admin_has_perm('customers')
     and auth.uid() is not null then
    raise exception 'Not allowed to change account status.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_customer_profile on customer_profiles;
create trigger guard_customer_profile before insert or update on customer_profiles for each row execute function private.guard_customer_profile();

create or replace function public.is_customer_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select account_status = 'active' from public.customer_profiles where id = auth.uid()), true);
$$;

drop policy if exists "customer creates own review" on reviews;
create policy "customer creates own review" on reviews for insert with check (
  auth.uid() = customer_id
  and public.is_customer_active()
  and exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_id and oi.product_id = reviews.product_id
      and o.customer_id = auth.uid() and o.payment_status = 'paid'
  )
);

-- ---------------------------------------------------------
-- 6. Orders workflow
-- ---------------------------------------------------------
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in
  ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'));
alter table orders drop constraint if exists orders_payment_status_check;
alter table orders add constraint orders_payment_status_check check (payment_status in
  ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'));

alter table orders add column if not exists shipping_status text not null default 'not_shipped';
alter table orders add column if not exists courier text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists tracking_url text;
alter table orders add column if not exists refund_status text not null default 'none';
alter table orders add column if not exists refund_amount numeric(10,2);
alter table orders add column if not exists cancel_reason text;
alter table orders add column if not exists admin_notes text;
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists tax_amount numeric(10,2) not null default 0;
alter table orders add column if not exists invoice_number text unique;
alter table orders add column if not exists shipped_at timestamptz;
alter table orders add column if not exists delivered_at timestamptz;
alter table orders add column if not exists cancelled_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_shipping_status_check') then
    alter table orders add constraint orders_shipping_status_check check (shipping_status in
      ('not_shipped', 'packed', 'in_transit', 'out_for_delivery', 'delivered', 'returned_to_origin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_refund_status_check') then
    alter table orders add constraint orders_refund_status_check check (refund_status in
      ('none', 'requested', 'processing', 'refunded', 'rejected'));
  end if;
end $$;
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_created_idx on orders(created_at desc);
create index if not exists orders_customer_idx on orders(customer_id);

create table if not exists order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  field text not null,
  from_value text,
  to_value text,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on order_status_history(order_id, created_at);
alter table order_status_history enable row level security;
drop policy if exists "customer reads own order history" on order_status_history;
drop policy if exists "admin reads order history" on order_status_history;
create policy "customer reads own order history" on order_status_history for select using (
  field in ('status', 'shipping_status') and exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid())
);
create policy "admin reads order history" on order_status_history for select using (public.admin_has_any_perm(array['orders', 'customers']));
drop policy if exists "admin adds order notes" on order_status_history;
create policy "admin adds order notes" on order_status_history for insert with check (public.admin_has_perm('orders') and changed_by = auth.uid());

create or replace function private.order_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if old.status in ('cancelled', 'returned') then
      raise exception 'This order is % and can no longer change status.', old.status using errcode = 'P0001';
    end if;
    if new.status = 'returned' and old.status <> 'delivered' then
      raise exception 'Only delivered orders can be marked returned.' using errcode = 'P0001';
    end if;
    if new.status = 'cancelled' and old.status = 'delivered' then
      raise exception 'Delivered orders should be marked returned, not cancelled.' using errcode = 'P0001';
    end if;
    if new.status = 'shipped' and new.shipped_at is null then new.shipped_at := now(); end if;
    if new.status = 'delivered' then new.delivered_at := coalesce(new.delivered_at, now()); new.shipping_status := 'delivered'; end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
    if new.status in ('shipped') and new.shipping_status = 'not_shipped' then new.shipping_status := 'in_transit'; end if;
    if new.status = 'out_for_delivery' then new.shipping_status := 'out_for_delivery'; end if;
  end if;
  if new.refund_amount is not null and (new.refund_amount < 0 or new.refund_amount > new.total) then
    raise exception 'Refund amount must be between 0 and the order total.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists order_workflow on orders;
create trigger order_workflow before update on orders for each row execute function private.order_workflow();

create or replace function private.order_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into order_status_history (order_id, field, from_value, to_value, changed_by) values (new.id, 'status', old.status, new.status, auth.uid());
  end if;
  if new.shipping_status is distinct from old.shipping_status then
    insert into order_status_history (order_id, field, from_value, to_value, changed_by) values (new.id, 'shipping_status', old.shipping_status, new.shipping_status, auth.uid());
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into order_status_history (order_id, field, from_value, to_value, changed_by) values (new.id, 'payment_status', old.payment_status, new.payment_status, auth.uid());
  end if;
  if new.refund_status is distinct from old.refund_status then
    insert into order_status_history (order_id, field, from_value, to_value, changed_by) values (new.id, 'refund_status', old.refund_status, new.refund_status, auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists order_history on orders;
create trigger order_history after update on orders for each row execute function private.order_history();

-- Fix: customers may only hide their own order, nothing else.
drop policy if exists "customer hides own order" on orders;
create or replace function public.hide_my_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set customer_hidden_at = now() where id = p_order_id and customer_id = auth.uid();
end $$;

create sequence if not exists private.invoice_seq;
create or replace function public.admin_ensure_invoice_number(p_order_id uuid)
returns text language plpgsql security definer set search_path = public, private as $$
declare v_no text;
begin
  if not public.admin_has_perm('orders') then raise exception 'Not authorised' using errcode = '42501'; end if;
  select invoice_number into v_no from orders where id = p_order_id;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_no is null then
    v_no := 'ZRI-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('private.invoice_seq')::text, 5, '0');
    update orders set invoice_number = v_no where id = p_order_id;
  end if;
  return v_no;
end $$;

-- Order changes from the admin panel go through here (validated, history-tracked).
create or replace function public.admin_update_order(p_order_id uuid, p_patch jsonb, p_note text default null)
returns orders language plpgsql security invoker set search_path = public as $$
declare v_row orders; v_key text;
  v_allowed text[] := array['status','shipping_status','courier','tracking_number','tracking_url','refund_status','refund_amount','admin_notes','payment_status'];
begin
  if not public.admin_has_perm('orders') then raise exception 'Not authorised' using errcode = '42501'; end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(v_allowed)) then raise exception 'Field % cannot be edited', v_key using errcode = '22023'; end if;
  end loop;
  -- Payment status is owned by the payment webhook; admins may only record refunds.
  if p_patch ? 'payment_status' and (p_patch ->> 'payment_status') not in ('refunded', 'partially_refunded') then
    raise exception 'Payment status is set by the payment gateway; only refunds can be recorded here.' using errcode = '22023';
  end if;
  update orders set
    status = coalesce(p_patch ->> 'status', status),
    shipping_status = coalesce(p_patch ->> 'shipping_status', shipping_status),
    courier = case when p_patch ? 'courier' then nullif(left(trim(p_patch ->> 'courier'), 80), '') else courier end,
    tracking_number = case when p_patch ? 'tracking_number' then nullif(left(trim(p_patch ->> 'tracking_number'), 80), '') else tracking_number end,
    tracking_url = case when p_patch ? 'tracking_url' then
      case when coalesce(p_patch ->> 'tracking_url', '') ~* '^https?://' then left(p_patch ->> 'tracking_url', 500)
           when coalesce(p_patch ->> 'tracking_url', '') = '' then null
           else tracking_url end
      else tracking_url end,
    refund_status = coalesce(p_patch ->> 'refund_status', refund_status),
    refund_amount = case when p_patch ? 'refund_amount' then nullif(p_patch ->> 'refund_amount', '')::numeric else refund_amount end,
    payment_status = coalesce(p_patch ->> 'payment_status', payment_status),
    admin_notes = case when p_patch ? 'admin_notes' then left(p_patch ->> 'admin_notes', 4000) else admin_notes end
  where id = p_order_id
  returning * into v_row;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if p_note is not null and length(trim(p_note)) > 0 then
    insert into order_status_history (order_id, field, from_value, to_value, note, changed_by)
    values (p_order_id, 'note', null, null, left(p_note, 1000), auth.uid());
  end if;
  return v_row;
end $$;

-- Cancel; optionally put stock back if it was already taken (paid orders).
create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text, p_restock boolean default true)
returns orders language plpgsql security invoker set search_path = public as $$
declare v_row orders;
begin
  if not public.admin_has_perm('orders') then raise exception 'Not authorised' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A cancellation reason is required.' using errcode = '22023'; end if;
  select * into v_row from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  update orders set status = 'cancelled', cancel_reason = left(p_reason, 500),
    refund_status = case when payment_status = 'paid' and refund_status = 'none' then 'requested' else refund_status end
  where id = p_order_id returning * into v_row;
  if p_restock and v_row.payment_status in ('paid', 'refunded', 'partially_refunded') then
    update product_variants pv set stock = pv.stock + oi.qty
    from order_items oi where oi.order_id = p_order_id and oi.variant_id = pv.id;
  end if;
  insert into order_status_history (order_id, field, note, changed_by) values (p_order_id, 'note', 'Cancelled: ' || left(p_reason, 500), auth.uid());
  return v_row;
end $$;

-- ---------------------------------------------------------
-- 7. Coupons
-- ---------------------------------------------------------
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  max_discount numeric(10,2) check (max_discount is null or max_discount > 0),
  min_order_value numeric(10,2) not null default 0 check (min_order_value >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  used_count int not null default 0,
  applies_to text not null default 'all' check (applies_to in ('all', 'products', 'categories')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);
create table if not exists coupon_products (
  coupon_id uuid not null references coupons(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (coupon_id, product_id)
);
create table if not exists coupon_categories (
  coupon_id uuid not null references coupons(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (coupon_id, category_id)
);
create table if not exists coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  customer_id uuid references auth.users(id) on delete set null,
  discount_amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_customer_idx on coupon_redemptions(coupon_id, customer_id);
alter table coupons enable row level security;
alter table coupon_products enable row level security;
alter table coupon_categories enable row level security;
alter table coupon_redemptions enable row level security;
-- No public read: codes must not be enumerable. Customers validate via quote_cart().
drop trigger if exists touch_coupons on coupons;
create trigger touch_coupons before update on coupons for each row execute function private.touch_updated_at();

create or replace function private.normalise_coupon_code()
returns trigger language plpgsql as $$ begin new.code := upper(trim(new.code)); return new; end $$;
drop trigger if exists normalise_coupon_code on coupons;
create trigger normalise_coupon_code before insert or update on coupons for each row execute function private.normalise_coupon_code();

-- ---------------------------------------------------------
-- 8. Website settings, content, homepage
-- ---------------------------------------------------------
create table if not exists site_settings (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  perm text not null default 'settings',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table site_settings enable row level security;
drop policy if exists "public reads public settings" on site_settings;
drop policy if exists "admin writes settings" on site_settings;
create policy "public reads public settings" on site_settings for select using (is_public or public.admin_has_perm(perm));
create policy "admin writes settings" on site_settings for update using (public.admin_has_perm(perm)) with check (public.admin_has_perm(perm));

create or replace function private.guard_site_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Keys, visibility and owning module are fixed by migrations, not editable via the API.
  new.key := old.key; new.is_public := old.is_public; new.perm := old.perm;
  if jsonb_typeof(new.value) <> 'object' then raise exception 'Settings value must be an object.' using errcode = '22023'; end if;
  if length(new.value::text) > 20000 then raise exception 'Settings value too large.' using errcode = '22023'; end if;
  new.updated_at := now(); new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists guard_site_settings on site_settings;
create trigger guard_site_settings before update on site_settings for each row execute function private.guard_site_settings();

-- Defaults reflect what the storefront already shows today; nothing invented.
-- Payment credentials are NOT stored here — they live in Edge Function secrets.
insert into site_settings (key, value, is_public, perm) values
  ('store', '{"name":"Zari","tagline":"Sarees for Every Story","logo_url":"","favicon_url":"","currency":"INR","currency_symbol":"₹"}', true, 'settings'),
  ('contact', '{"email":"","phone":"","whatsapp":"","address":"","hours":""}', true, 'settings'),
  ('social', '{"instagram":"","facebook":"","youtube":"","pinterest":"","whatsapp":""}', true, 'settings'),
  ('shipping', '{"free_shipping_over":2999,"flat_fee":79,"dispatch_days":"2–4 business days","cod_enabled":false}', true, 'settings'),
  ('tax', '{"enabled":true,"rate_percent":5,"prices_include_tax":true,"gstin":"","hsn_default":""}', true, 'settings'),
  ('payment', '{"provider":"cashfree","mode":"sandbox","online_enabled":false}', true, 'settings'),
  ('seo', '{"meta_title":"Zari | Sarees for Every Story","meta_description":"Zari — handpicked silk, cotton and designer sarees for everyday wear, festive occasions and weddings.","og_image":""}', true, 'settings'),
  ('announcement', '{"enabled":true,"text":"Complimentary shipping on orders above ₹2,999","link":""}', true, 'marketing'),
  ('footer', '{"tagline":"Handpicked sarees for the everyday and the unforgettable.","bottom_note":"Made with care in India"}', true, 'content')
on conflict (key) do nothing;

create table if not exists content_pages (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null check (length(title) between 1 and 150),
  body text not null default '',
  is_published boolean not null default true,
  seo_title text,
  seo_description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table content_pages enable row level security;
drop policy if exists "public reads published pages" on content_pages;
create policy "public reads published pages" on content_pages for select using (is_published or public.admin_has_perm('content'));

-- Seeded with the text the storefront currently shows, so nothing changes on day one.
insert into content_pages (slug, title, body) values
  ('about', 'About Zari', 'Zari is a home for sarees that carry craft, colour and story in every fold. We work with weavers and mills to bring silk, cotton and handloom drapes to your everyday and your biggest occasions.'),
  ('contact', 'Contact Us', 'Have a question about an order or a saree? Write to us and we’ll get back within 24 hours.'),
  ('privacy', 'Privacy Policy', 'This Privacy Policy explains how Zari collects, uses and protects your personal information when you shop with us. (Add your finalized policy text here before launch.)'),
  ('terms', 'Terms of Service', 'By using the Zari website you agree to these terms. (Add your finalized terms text here before launch.)'),
  ('shipping-info', 'Shipping Information', 'We currently check delivery serviceability by PIN code at checkout. Shipping partners and timelines will be listed here once finalized.'),
  ('returns', 'Return & Refund Policy', 'Returns and exchanges are handled on a case-by-case basis for damaged or wrong items. Please contact support within 48 hours of delivery with your order number and photos. (Final return policy to be confirmed by Zari.)'),
  ('faq', 'Frequently Asked Questions', 'Answers to common questions about sizing, fabric care, shipping and returns will appear here.')
on conflict (slug) do nothing;

create table if not exists faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(question) between 1 and 300),
  answer text not null check (length(answer) between 1 and 4000),
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table faq_items enable row level security;
drop policy if exists "public reads visible faq" on faq_items;
create policy "public reads visible faq" on faq_items for select using (is_visible or public.admin_has_perm('content'));

create table if not exists homepage_sections (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  label text not null,
  is_visible boolean not null default true,
  sort_order int not null default 0,
  eyebrow text,
  title text,
  subtitle text,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table homepage_sections enable row level security;
drop policy if exists "public reads homepage sections" on homepage_sections;
create policy "public reads homepage sections" on homepage_sections for select using (true);

-- Seeded from the current homepage copy. `title` may contain one *emphasised*
-- phrase (rendered as the italic accent the design uses).
insert into homepage_sections (key, label, sort_order, eyebrow, title, subtitle, config) values
  ('hero', 'Hero (used when no hero banner is live)', 10, 'The Zari Edit', 'Sarees woven for *every story*',
     'Silk. Cotton. Handloom. Discover pieces made for the everyday and the unforgettable.',
     '{"cta_text":"Shop Sarees","cta_link":"#/sarees","secondary_text":"New Arrivals","secondary_link":"#/new-arrivals"}'),
  ('marquee', 'Scrolling strip', 20, null, null, null,
     '{"items":["Handpicked drapes","PIN-checked delivery","Quality checked","Secure payments","Customer support"]}'),
  ('new_arrivals', 'New Arrivals', 30, 'Just In', 'New *Arrivals*', null, '{"limit":8}'),
  ('shop_by_type', 'Shop by Category', 40, 'Curated by Weave', 'Shop by *saree type*', 'Every region weaves its own language. Start with the one that speaks to you.', '{}'),
  ('featured', 'Featured Sarees', 50, 'Handpicked', 'Featured *Sarees*', null, '{}'),
  ('promo', 'Promotional banners', 55, null, null, null, '{}'),
  ('shop_by', 'Shop by Fabric & Occasion', 60, null, null, null, '{}'),
  ('story', 'Our Story band', 70, 'Our Story', '“A saree is never just fabric — it’s six yards of memory in the making.”',
     'Every piece we curate is chosen for its craft, its fall, and the way it makes you feel wearing it.', '{"link_text":"Read our story","link":"#/about"}'),
  ('best_sellers', 'Best Sellers', 80, 'Loved by Customers', 'Best *Sellers*', null, '{"limit":8}'),
  ('offers', 'Special Offers', 90, 'Limited Time', 'Special *Offers*', null, '{"limit":8}'),
  ('campaign', 'Live campaign', 100, null, null, null, '{}'),
  ('more_styles', 'Recommended for You', 110, 'Just for You', 'Recommended *for You*', null, '{"limit":8}'),
  ('reviews', 'Verified Reviews', 120, 'In Their Words', 'Verified *Reviews*', null, '{}'),
  ('newsletter', 'Newsletter', 130, 'The Zari Circle', 'First look at *every drop*', 'New arrivals, festive edits and members-only previews.', '{}')
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 9. Permission-based RLS for admin writes on existing tables
--    (replaces the old blanket is_admin() "admin …" policies)
-- ---------------------------------------------------------
do $$
declare
  r record;
  pol record;
  -- table, write permission (null = admins never write), read permissions ('any' = any active admin)
  v_map jsonb := '[
    ["products","products",["any"]], ["product_categories","products",["any"]], ["product_collections","products",["any"]],
    ["product_images","products",["any"]], ["product_colors","products",["any"]], ["product_variants","products",["any"]],
    ["complete_the_look","products",["any"]],
    ["categories","categories",["any"]], ["collections","categories",["any"]],
    ["banners","marketing",["any"]], ["campaigns","marketing",["any"]], ["campaign_products","marketing",["any"]],
    ["campaign_categories","marketing",["any"]],
    ["coupons","marketing",["marketing"]], ["coupon_products","marketing",["marketing"]],
    ["coupon_categories","marketing",["marketing"]], ["coupon_redemptions",null,["marketing","orders"]],
    ["orders","orders",["orders","customers"]], ["order_items","orders",["orders","customers"]],
    ["payments",null,["orders"]], ["shipments","orders",["orders"]], ["shipment_events","orders",["orders"]],
    ["shipping_providers","settings",["settings"]],
    ["customer_profiles","customers",["customers","orders"]], ["addresses",null,["customers","orders"]],
    ["wishlist_items",null,["customers"]],
    ["reviews","reviews",["reviews"]],
    ["notify_me","customers",["customers","products"]], ["newsletter_subscribers","marketing",["marketing","customers"]],
    ["content_pages","content",["content"]], ["faq_items","content",["content"]],
    ["homepage_sections","homepage",["any"]]
  ]';
  v_read text;
begin
  for r in select e ->> 0 as tbl, e ->> 1 as perm, e -> 2 as reads from jsonb_array_elements(v_map) e loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = r.tbl and policyname ilike 'admin %' loop
      execute format('drop policy %I on public.%I', pol.policyname, r.tbl);
    end loop;
    if r.reads ? 'any' then
      v_read := 'public.is_admin()';
    else
      v_read := format('public.admin_has_any_perm(%L::text[])', (select array_agg(x) from jsonb_array_elements_text(r.reads) x));
    end if;
    execute format('create policy %I on public.%I for select using (%s)', 'admin read ' || r.tbl, r.tbl, v_read);
    if r.perm is not null then
      execute format('create policy %I on public.%I for insert with check (public.admin_has_perm(%L))', 'admin insert ' || r.tbl, r.tbl, r.perm);
      execute format('create policy %I on public.%I for update using (public.admin_has_perm(%L)) with check (public.admin_has_perm(%L))', 'admin update ' || r.tbl, r.tbl, r.perm, r.perm);
      execute format('create policy %I on public.%I for delete using (public.admin_has_perm(%L))', 'admin delete ' || r.tbl, r.tbl, r.perm);
    end if;
  end loop;
end $$;

-- Homepage section keys are fixed (the storefront maps them to page blocks).
drop policy if exists "admin insert homepage_sections" on homepage_sections;
drop policy if exists "admin delete homepage_sections" on homepage_sections;

-- Orders are never deleted from the admin panel (cancel instead), so business
-- records are preserved.
drop policy if exists "admin delete orders" on orders;
drop policy if exists "admin delete order_items" on order_items;
drop policy if exists "admin insert orders" on orders;
drop policy if exists "admin insert order_items" on order_items;

-- ---------------------------------------------------------
-- 10. Audit triggers
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products','product_categories','product_images','product_colors','product_variants',
    'categories','collections','banners','campaigns','coupons','coupon_products','coupon_categories',
    'orders','customer_profiles','reviews','content_pages','faq_items','homepage_sections','site_settings',
    'admins','admin_roles','shipping_providers'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function private.log_admin_activity()', t);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 11. Storage: buckets + admin-only uploads
-- ---------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('products', 'products', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
      ('banners', 'banners', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
      ('site', 'site', true, 2097152, array['image/jpeg','image/png','image/webp','image/x-icon','image/vnd.microsoft.icon'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "zari admin uploads" on storage.objects';
    execute 'drop policy if exists "zari admin updates uploads" on storage.objects';
    execute 'drop policy if exists "zari admin deletes uploads" on storage.objects';
    execute $p$create policy "zari admin uploads" on storage.objects for insert to authenticated with check (
      (bucket_id = 'products' and public.admin_has_any_perm(array['products','categories']))
      or (bucket_id = 'banners' and public.admin_has_any_perm(array['marketing','homepage']))
      or (bucket_id = 'site' and public.admin_has_any_perm(array['settings','categories','content'])))$p$;
    execute $p$create policy "zari admin updates uploads" on storage.objects for update to authenticated using (
      (bucket_id = 'products' and public.admin_has_any_perm(array['products','categories']))
      or (bucket_id = 'banners' and public.admin_has_any_perm(array['marketing','homepage']))
      or (bucket_id = 'site' and public.admin_has_any_perm(array['settings','categories','content'])))$p$;
    execute $p$create policy "zari admin deletes uploads" on storage.objects for delete to authenticated using (
      (bucket_id = 'products' and public.admin_has_any_perm(array['products','categories']))
      or (bucket_id = 'banners' and public.admin_has_any_perm(array['marketing','homepage']))
      or (bucket_id = 'site' and public.admin_has_any_perm(array['settings','categories','content'])))$p$;
  end if;
end $$;

-- ---------------------------------------------------------
-- 12. Product RPCs (validated, transactional)
-- ---------------------------------------------------------
create or replace function public.slugify_text(p text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Create or update a product with its images, colours, variants and categories
-- in one transaction. Variants are updated in place by id (so carts and order
-- history keep pointing at them); only variants removed in the form are deleted.
-- p: { id?, name, sku, slug?, description, price, sale_price, mrp, status, featured, new_arrival,
--      best_seller, on_sale, product_type, hsn_code, fabric, …, seo_title, seo_description,
--      low_stock_threshold, images:[{url, storage_path?, alt_text?}], colors:[{name,hex}],
--      variants:[{id?, color, size, stock, variant_sku?}], category_ids:[uuid] }
create or replace function public.admin_save_product(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := trim(coalesce(p ->> 'name', ''));
  v_sku text := upper(trim(coalesce(p ->> 'sku', '')));
  v_slug text := public.slugify_text(coalesce(nullif(trim(p ->> 'slug'), ''), p ->> 'name'));
  v_price numeric := coalesce(nullif(p ->> 'price', '')::numeric, 0);
  v_sale numeric := nullif(p ->> 'sale_price', '')::numeric;
  v_mrp numeric := nullif(p ->> 'mrp', '')::numeric;
  v_status text := coalesce(nullif(p ->> 'status', ''), 'draft');
  v_keep uuid[];
  v_var jsonb; v_i int := 0; v_vid uuid;
  v_base_slug text; v_n int := 1;
begin
  if not public.admin_has_perm('products') then raise exception 'Not authorised' using errcode = '42501'; end if;
  if v_name = '' or length(v_name) > 200 then raise exception 'Product name is required (max 200 characters).' using errcode = '22023'; end if;
  if v_sku !~ '^[A-Z0-9][A-Z0-9._/-]{0,59}$' then raise exception 'SKU may use letters, numbers, . _ / - (max 60).' using errcode = '22023'; end if;
  if v_price < 0 then raise exception 'Price cannot be negative.' using errcode = '22023'; end if;
  if v_sale is not null and (v_sale < 0 or v_sale > v_price) then raise exception 'Discount price must be between 0 and the selling price.' using errcode = '22023'; end if;
  if v_mrp is not null and v_mrp < v_price then raise exception 'Original price (MRP) cannot be lower than the selling price.' using errcode = '22023'; end if;
  if v_status not in ('draft', 'active', 'archived') then raise exception 'Invalid status.' using errcode = '22023'; end if;
  if v_status = 'active' and v_price = 0 and coalesce((p ->> 'allow_price_on_request')::boolean, true) = false then
    raise exception 'Set a price before activating.' using errcode = '22023';
  end if;
  if v_slug = '' then v_slug := lower(v_sku); end if;
  v_base_slug := v_slug;
  while exists (select 1 from products where slug = v_slug and id is distinct from v_id) loop
    v_n := v_n + 1; v_slug := v_base_slug || '-' || v_n;
  end loop;

  if v_id is null then
    insert into products (name, sku, slug, price) values (v_name, v_sku, v_slug, v_price) returning id into v_id;
  elsif not exists (select 1 from products where id = v_id) then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  update products set
    name = v_name, sku = v_sku, slug = v_slug, price = v_price, sale_price = v_sale, mrp = v_mrp, status = v_status,
    description = nullif(left(p ->> 'description', 10000), ''),
    featured = coalesce((p ->> 'featured')::boolean, false),
    new_arrival = coalesce((p ->> 'new_arrival')::boolean, false),
    best_seller = coalesce((p ->> 'best_seller')::boolean, false),
    on_sale = coalesce((p ->> 'on_sale')::boolean, false),
    product_type = nullif(left(trim(p ->> 'product_type'), 80), ''),
    hsn_code = nullif(left(trim(p ->> 'hsn_code'), 20), ''),
    fabric = nullif(left(trim(p ->> 'fabric'), 80), ''),
    occasion = nullif(left(trim(p ->> 'occasion'), 80), ''),
    weave = nullif(left(trim(p ->> 'weave'), 80), ''),
    work_type = nullif(left(trim(p ->> 'work_type'), 80), ''),
    border_type = nullif(left(trim(p ->> 'border_type'), 80), ''),
    pattern = nullif(left(trim(p ->> 'pattern'), 80), ''),
    blouse_colour = nullif(left(trim(p ->> 'blouse_colour'), 80), ''),
    country_of_origin = nullif(left(trim(p ->> 'country_of_origin'), 80), ''),
    wash_care = nullif(left(trim(p ->> 'wash_care'), 500), ''),
    saree_length_m = nullif(p ->> 'saree_length_m', '')::numeric,
    blouse_length_m = nullif(p ->> 'blouse_length_m', '')::numeric,
    blouse_included = coalesce((p ->> 'blouse_included')::boolean, false),
    ready_to_wear = coalesce((p ->> 'ready_to_wear')::boolean, false),
    seo_title = nullif(left(trim(p ->> 'seo_title'), 70), ''),
    seo_description = nullif(left(trim(p ->> 'seo_description'), 170), ''),
    low_stock_threshold = coalesce(nullif(p ->> 'low_stock_threshold', '')::int, 3)
  where id = v_id;

  -- Images and colours are replaced only when they actually changed (keeps the audit log meaningful).
  if p ? 'images' and (
    select coalesce(jsonb_agg(image_url order by sort_order), '[]'::jsonb) from product_images where product_id = v_id
  ) is distinct from (
    select coalesce(jsonb_agg(left(e ->> 'url', 1000) order by ord), '[]'::jsonb)
    from jsonb_array_elements(p -> 'images') with ordinality as t(e, ord) where coalesce(e ->> 'url', '') ~* '^https?://'
  ) then
    delete from product_images where product_id = v_id;
    insert into product_images (product_id, image_url, storage_path, alt_text, sort_order)
    select v_id, left(e ->> 'url', 1000), nullif(e ->> 'storage_path', ''), nullif(left(e ->> 'alt_text', 200), ''), (ord - 1)::int
    from jsonb_array_elements(p -> 'images') with ordinality as t(e, ord)
    where coalesce(e ->> 'url', '') ~* '^https?://';
  end if;

  if p ? 'colors' and (
    select coalesce(jsonb_agg(jsonb_build_array(name, hex) order by sort_order), '[]'::jsonb) from product_colors where product_id = v_id
  ) is distinct from (
    select coalesce(jsonb_agg(jsonb_build_array(left(trim(e ->> 'name'), 60), case when e ->> 'hex' ~ '^#[0-9a-fA-F]{6}$' then e ->> 'hex' end) order by ord), '[]'::jsonb)
    from jsonb_array_elements(p -> 'colors') with ordinality as t(e, ord) where coalesce(trim(e ->> 'name'), '') <> ''
  ) then
    delete from product_colors where product_id = v_id;
    insert into product_colors (product_id, name, hex, sort_order)
    select v_id, left(trim(e ->> 'name'), 60), case when e ->> 'hex' ~ '^#[0-9a-fA-F]{6}$' then e ->> 'hex' end, (ord - 1)::int
    from jsonb_array_elements(p -> 'colors') with ordinality as t(e, ord)
    where coalesce(trim(e ->> 'name'), '') <> '';
  end if;

  if p ? 'variants' then
    v_keep := '{}';
    for v_var in select * from jsonb_array_elements(p -> 'variants') loop
      v_i := v_i + 1;
      if coalesce((v_var ->> 'stock')::int, 0) < 0 then raise exception 'Stock cannot be negative.' using errcode = '22023'; end if;
      v_vid := nullif(v_var ->> 'id', '')::uuid;
      if v_vid is not null and exists (select 1 from product_variants where id = v_vid and product_id = v_id) then
        update product_variants set color = nullif(left(trim(v_var ->> 'color'), 60), ''), size = nullif(left(trim(v_var ->> 'size'), 30), ''),
          stock = coalesce((v_var ->> 'stock')::int, 0),
          variant_sku = coalesce(nullif(upper(trim(v_var ->> 'variant_sku')), ''), variant_sku)
        where id = v_vid;
      else
        insert into product_variants (product_id, variant_sku, color, size, stock)
        values (v_id, coalesce(nullif(upper(trim(v_var ->> 'variant_sku')), ''), v_sku || '-' || upper(substr(md5(random()::text), 1, 6))),
                nullif(left(trim(v_var ->> 'color'), 60), ''), nullif(left(trim(v_var ->> 'size'), 30), ''), coalesce((v_var ->> 'stock')::int, 0))
        returning id into v_vid;
      end if;
      v_keep := v_keep || v_vid;
    end loop;
    delete from product_variants where product_id = v_id and not (id = any(v_keep));
  end if;

  if p ? 'category_ids' then
    delete from product_categories where product_id = v_id
      and category_id not in (select (x)::uuid from jsonb_array_elements_text(p -> 'category_ids') x);
    insert into product_categories (product_id, category_id)
    select v_id, c.id from categories c where c.id in (select (x)::uuid from jsonb_array_elements_text(p -> 'category_ids') x)
    on conflict do nothing;
  end if;

  return v_id;
end $$;

create or replace function public.admin_duplicate_product(p_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_src products; v_new uuid; v_sku text; v_n int := 1;
begin
  if not public.admin_has_perm('products') then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into v_src from products where id = p_id;
  if not found then raise exception 'Product not found.' using errcode = 'P0002'; end if;
  v_sku := left(v_src.sku, 52) || '-COPY';
  while exists (select 1 from products where sku = v_sku) loop v_n := v_n + 1; v_sku := left(v_src.sku, 50) || '-COPY' || v_n; end loop;
  insert into products (sku, slug, name, description, fabric, saree_length_m, blouse_included, blouse_length_m, blouse_colour,
    work_type, weave, pattern, border_type, occasion, wash_care, ready_to_wear, country_of_origin, price, sale_price, mrp,
    status, featured, new_arrival, best_seller, on_sale, product_type, hsn_code, seo_title, seo_description, low_stock_threshold)
  values (v_sku, public.slugify_text(v_sku || '-' || v_src.name), v_src.name || ' (Copy)', v_src.description, v_src.fabric, v_src.saree_length_m,
    v_src.blouse_included, v_src.blouse_length_m, v_src.blouse_colour, v_src.work_type, v_src.weave, v_src.pattern, v_src.border_type,
    v_src.occasion, v_src.wash_care, v_src.ready_to_wear, v_src.country_of_origin, v_src.price, v_src.sale_price, v_src.mrp,
    'draft', false, false, false, false, v_src.product_type, v_src.hsn_code, v_src.seo_title, v_src.seo_description, v_src.low_stock_threshold)
  returning id into v_new;
  insert into product_images (product_id, image_url, storage_path, alt_text, image_type, sort_order)
    select v_new, image_url, null, alt_text, image_type, sort_order from product_images where product_id = p_id;
  insert into product_colors (product_id, name, hex, sort_order) select v_new, name, hex, sort_order from product_colors where product_id = p_id;
  insert into product_variants (product_id, variant_sku, color, size, stock)
    select v_new, v_sku || '-' || upper(substr(md5(random()::text || id::text), 1, 6)), color, size, 0 from product_variants where product_id = p_id;
  insert into product_categories (product_id, category_id) select v_new, category_id from product_categories where product_id = p_id;
  return v_new;
end $$;

-- Bulk edit: status / flags / price change by % / add or remove one category.
create or replace function public.admin_bulk_update_products(p_ids uuid[], p_patch jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare v_count int; v_pct numeric := nullif(p_patch ->> 'price_change_percent', '')::numeric;
begin
  if not public.admin_has_perm('products') then raise exception 'Not authorised' using errcode = '42501'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 500 then raise exception 'Select between 1 and 500 products.' using errcode = '22023'; end if;
  if p_patch ? 'status' and p_patch ->> 'status' not in ('draft', 'active', 'archived') then raise exception 'Invalid status.' using errcode = '22023'; end if;
  if v_pct is not null and (v_pct <= -90 or v_pct > 500) then raise exception 'Price change must be between -90%% and +500%%.' using errcode = '22023'; end if;
  update products set
    status = coalesce(p_patch ->> 'status', status),
    featured = coalesce((p_patch ->> 'featured')::boolean, featured),
    new_arrival = coalesce((p_patch ->> 'new_arrival')::boolean, new_arrival),
    best_seller = coalesce((p_patch ->> 'best_seller')::boolean, best_seller),
    on_sale = coalesce((p_patch ->> 'on_sale')::boolean, on_sale),
    price = case when v_pct is null then price else round(price * (1 + v_pct / 100), 0) end,
    sale_price = case when v_pct is null or sale_price is null then sale_price else round(sale_price * (1 + v_pct / 100), 0) end,
    mrp = case when v_pct is null or mrp is null then mrp else greatest(mrp, round(price * (1 + v_pct / 100), 0)) end
  where id = any(p_ids);
  get diagnostics v_count = row_count;
  if p_patch ? 'add_category_id' then
    insert into product_categories (product_id, category_id)
    select unnest(p_ids), (p_patch ->> 'add_category_id')::uuid on conflict do nothing;
  end if;
  if p_patch ? 'remove_category_id' then
    delete from product_categories where product_id = any(p_ids) and category_id = (p_patch ->> 'remove_category_id')::uuid;
  end if;
  if p_patch ? 'stock' then
    if (p_patch ->> 'stock')::int < 0 then raise exception 'Stock cannot be negative.' using errcode = '22023'; end if;
    update product_variants set stock = (p_patch ->> 'stock')::int where product_id = any(p_ids);
  end if;
  return v_count;
end $$;

-- Bulk import (CSV parsed in the browser). Upserts by SKU; each row is validated
-- independently and errors are reported per row instead of aborting the batch.
create or replace function public.admin_import_products(p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_row jsonb; v_out jsonb := '[]'::jsonb; v_idx int := 0; v_existing uuid; v_cat_ids jsonb; v_id uuid; v_base jsonb;
begin
  if not public.admin_has_perm('products') then raise exception 'Not authorised' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then raise exception 'Import up to 1000 rows at a time.' using errcode = '22023'; end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    begin
      -- Blank cells mean "leave unchanged" for existing products.
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_row from jsonb_each(v_row) where value not in ('""'::jsonb, 'null'::jsonb);
      v_existing := null;
      select id into v_existing from products where sku = upper(trim(v_row ->> 'sku'));
      v_base := coalesce((select to_jsonb(p) from products p where p.id = v_existing), '{}'::jsonb);
      -- Category names (comma separated) → ids; unknown names are reported, not created.
      select coalesce(jsonb_agg(c.id), '[]'::jsonb) into v_cat_ids
      from categories c
      where lower(c.name) in (select lower(trim(x)) from unnest(string_to_array(coalesce(v_row ->> 'categories', ''), ',')) x where trim(x) <> '');
      v_id := public.admin_save_product(
        v_base || (v_row - 'categories' - 'stock' - 'id')
        || jsonb_build_object('id', v_existing)
        || case when coalesce(v_row ->> 'categories', '') <> '' then jsonb_build_object('category_ids', v_cat_ids) else '{}'::jsonb end
        || case when v_existing is null
             then jsonb_build_object('variants', jsonb_build_array(jsonb_build_object('stock', coalesce(nullif(v_row ->> 'stock', '')::int, 0))))
             else '{}'::jsonb end
      );
      -- Existing products: a stock column only updates single-variant products
      -- (multi-variant stock is edited per variant in the product form).
      if v_existing is not null and v_row ? 'stock' then
        if (select count(*) from product_variants where product_id = v_existing) = 1 then
          if (v_row ->> 'stock')::int < 0 then raise exception 'Stock cannot be negative.'; end if;
          update product_variants set stock = (v_row ->> 'stock')::int where product_id = v_existing;
        elsif (select count(*) from product_variants where product_id = v_existing) = 0 then
          insert into product_variants (product_id, variant_sku, stock)
          values (v_existing, upper(trim(v_row ->> 'sku')) || '-A', greatest((v_row ->> 'stock')::int, 0));
        else
          raise exception 'Product has several variants — update their stock in the product form.';
        end if;
      end if;
      v_out := v_out || jsonb_build_object('row', v_idx, 'sku', v_row ->> 'sku', 'ok', true, 'action', case when v_existing is null then 'created' else 'updated' end);
    exception when others then
      v_out := v_out || jsonb_build_object('row', v_idx, 'sku', v_row ->> 'sku', 'ok', false, 'error', sqlerrm);
    end;
  end loop;
  return v_out;
end $$;

-- ---------------------------------------------------------
-- 13. Dashboard + customers (aggregates over tables admins may not read row by row)
-- ---------------------------------------------------------
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.admin_has_perm('dashboard') then raise exception 'Not authorised' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total_products', (select count(*) from products),
    'active_products', (select count(*) from products where status = 'active'),
    'draft_products', (select count(*) from products where status = 'draft'),
    'out_of_stock_products', (select count(*) from products p where p.status = 'active' and p.price > 0
        and coalesce((select sum(stock) from product_variants v where v.product_id = p.id), 0) = 0),
    'total_orders', (select count(*) from orders),
    'pending_orders', (select count(*) from orders where status = 'pending'),
    'open_orders', (select count(*) from orders where status in ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery')),
    'completed_orders', (select count(*) from orders where status = 'delivered'),
    'total_customers', (select count(*) from customer_profiles),
    'total_revenue', (select coalesce(sum(total - coalesce(refund_amount, 0)), 0) from orders where payment_status in ('paid', 'partially_refunded')),
    'revenue_30d', (select coalesce(sum(total - coalesce(refund_amount, 0)), 0) from orders where payment_status in ('paid', 'partially_refunded') and created_at >= now() - interval '30 days'),
    'recent_orders', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select id, order_number, contact_name, status, payment_status, total, created_at from orders order by created_at desc limit 8) x),
    'low_stock', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.id as product_id, p.name, p.sku, v.variant_sku, v.color, v.size, v.stock, p.low_stock_threshold
        from product_variants v join products p on p.id = v.product_id
        where p.status = 'active' and p.price > 0 and v.stock <= p.low_stock_threshold
        order by v.stock asc, p.name limit 12) x),
    'sales', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
        select d::date as day,
          coalesce((select sum(total) from orders o where o.payment_status in ('paid', 'partially_refunded') and o.created_at >= d and o.created_at < d + interval '1 day'), 0) as revenue,
          (select count(*) from orders o where o.created_at >= d and o.created_at < d + interval '1 day') as orders
        from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d) x),
    'recent_activity', case when public.admin_has_perm('activity') then (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select actor_email, action, entity, summary, created_at from admin_activity_log order by created_at desc limit 10) x) else '[]'::jsonb end
  ) into v;
  return v;
end $$;

create or replace function public.admin_customers(p_search text default null, p_status text default null, p_limit int default 25, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb; v_total int; v_q text := nullif(trim(p_search), '');
begin
  if not public.admin_has_perm('customers') then raise exception 'Not authorised' using errcode = '42501'; end if;
  with base as (
    select cp.id, cp.full_name, cp.phone, cp.account_status, cp.created_at, u.email, u.last_sign_in_at,
      (select count(*) from orders o where o.customer_id = cp.id) as order_count,
      (select coalesce(sum(o.total), 0) from orders o where o.customer_id = cp.id and o.payment_status = 'paid') as total_spent,
      (select max(o.created_at) from orders o where o.customer_id = cp.id) as last_order_at
    from customer_profiles cp left join auth.users u on u.id = cp.id
    where (v_q is null or cp.full_name ilike '%' || v_q || '%' or u.email ilike '%' || v_q || '%' or cp.phone ilike '%' || v_q || '%')
      and (p_status is null or cp.account_status = p_status)
      and not exists (select 1 from admins a where a.id = cp.id)
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(b) from (select * from base order by created_at desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) b), '[]'::jsonb)
  into v_total, v_rows;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

create or replace function public.admin_customer_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_has_perm('customers') then raise exception 'Not authorised' using errcode = '42501'; end if;
  return jsonb_build_object(
    'profile', (select to_jsonb(cp) || jsonb_build_object('email', u.email, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed_at', u.email_confirmed_at)
                from customer_profiles cp left join auth.users u on u.id = cp.id where cp.id = p_id),
    'addresses', (select coalesce(jsonb_agg(a order by a.is_default desc, a.created_at desc), '[]'::jsonb) from addresses a where a.customer_id = p_id),
    'orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select id, order_number, status, payment_status, total, created_at from orders where customer_id = p_id) x),
    'wishlist_count', (select count(*) from wishlist_items where customer_id = p_id),
    'reviews', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select r.rating, r.status, r.created_at, p.name as product from reviews r join products p on p.id = r.product_id where r.customer_id = p_id) x)
  );
end $$;

create or replace function public.admin_set_customer_status(p_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.admin_has_perm('customers') then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'Invalid status.' using errcode = '22023'; end if;
  update customer_profiles set account_status = p_status where id = p_id;
  if not found then raise exception 'Customer not found.' using errcode = 'P0002'; end if;
end $$;

-- Admin list for the Admin Users page (emails come from auth.users).
create or replace function public.admin_list_admins()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at), '[]'::jsonb) from (
    select a.id, coalesce(a.email, u.email) as email, a.full_name, a.is_active, a.created_at, a.last_sign_in_at,
      r.id as role_id, r.key as role_key, r.name as role_name, u.banned_until
    from admins a join admin_roles r on r.id = a.role_id left join auth.users u on u.id = a.id) x);
end $$;

-- ---------------------------------------------------------
-- 14. Storefront RPCs (public)
-- ---------------------------------------------------------
-- Best sellers by real paid order quantity (order_items are private, so the
-- storefront cannot compute this itself).
create or replace function public.public_best_seller_ids(p_limit int default 8)
returns setof uuid language sql stable security definer set search_path = public as $$
  select oi.product_id from order_items oi join orders o on o.id = oi.order_id join products p on p.id = oi.product_id
  where o.payment_status = 'paid' and p.status = 'active'
  group by oi.product_id order by sum(oi.qty) desc limit least(greatest(p_limit, 1), 24);
$$;

-- Server-side cart pricing: uses database prices (never prices sent by the
-- browser), shipping from settings, and validates a coupon if given.
-- p_items: [{product_id, qty}]
create or replace function public.quote_cart(p_items jsonb, p_coupon text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, private as $$
declare
  v_item jsonb; v_qty int; v_prod record; v_lines jsonb := '[]'::jsonb; v_subtotal numeric := 0;
  v_ship jsonb := coalesce((select value from site_settings where key = 'shipping'), '{}'::jsonb);
  v_tax jsonb := coalesce((select value from site_settings where key = 'tax'), '{}'::jsonb);
  v_free numeric := coalesce((v_ship ->> 'free_shipping_over')::numeric, 0);
  v_flat numeric := coalesce((v_ship ->> 'flat_fee')::numeric, 0);
  v_c coupons; v_code text := upper(trim(coalesce(p_coupon, '')));
  v_eligible numeric := 0; v_discount numeric := 0; v_coupon_msg text; v_coupon_ok boolean := null;
  v_fee numeric; v_total numeric; v_tax_amt numeric := 0; v_rate numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid cart.' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_item ->> 'product_id', '') !~ '^[0-9a-f-]{36}$' then continue; end if;
    v_qty := least(greatest(coalesce(nullif(v_item ->> 'qty', '')::int, 0), 0), 20);
    if v_qty = 0 then continue; end if;
    select p.id, p.name, coalesce(p.sale_price, p.price) as unit_price into v_prod
    from products p where p.id = (v_item ->> 'product_id')::uuid and p.status = 'active' and p.price > 0;
    if not found then continue; end if;
    v_subtotal := v_subtotal + v_prod.unit_price * v_qty;
    v_lines := v_lines || jsonb_build_object('product_id', v_prod.id, 'qty', v_qty, 'unit_price', v_prod.unit_price, 'line_total', v_prod.unit_price * v_qty);
  end loop;

  if v_code <> '' then
    if not private.hit_rate_limit('coupon:' || coalesce(auth.uid()::text, 'anon'), 30, interval '15 minutes') then
      raise exception 'Too many coupon attempts. Please wait a few minutes.' using errcode = 'P0001';
    end if;
    select * into v_c from coupons where code = v_code;
    v_coupon_ok := false;
    if not found or not v_c.is_active then v_coupon_msg := 'This coupon code is not valid.';
    elsif v_c.starts_at is not null and v_c.starts_at > now() then v_coupon_msg := 'This coupon is not active yet.';
    elsif v_c.expires_at is not null and v_c.expires_at < now() then v_coupon_msg := 'This coupon has expired.';
    elsif v_c.usage_limit is not null and v_c.used_count >= v_c.usage_limit then v_coupon_msg := 'This coupon has reached its usage limit.';
    elsif v_c.per_customer_limit is not null and auth.uid() is null then v_coupon_msg := 'Log in to use this coupon.';
    elsif v_c.per_customer_limit is not null and (select count(*) from coupon_redemptions where coupon_id = v_c.id and customer_id = auth.uid()) >= v_c.per_customer_limit then
      v_coupon_msg := 'You have already used this coupon.';
    elsif v_subtotal < v_c.min_order_value then v_coupon_msg := 'Add items worth ' || (v_c.min_order_value - v_subtotal) || ' more to use this coupon.';
    else
      select coalesce(sum((l ->> 'line_total')::numeric), 0) into v_eligible
      from jsonb_array_elements(v_lines) l
      where v_c.applies_to = 'all'
        or (v_c.applies_to = 'products' and exists (select 1 from coupon_products cp where cp.coupon_id = v_c.id and cp.product_id = (l ->> 'product_id')::uuid))
        or (v_c.applies_to = 'categories' and exists (
              select 1 from coupon_categories cc join product_categories pc on true join categories c on c.id = pc.category_id
              where cc.coupon_id = v_c.id and pc.product_id = (l ->> 'product_id')::uuid
                and (c.id = cc.category_id or c.parent_id = cc.category_id)));
      if v_eligible = 0 then v_coupon_msg := 'This coupon does not apply to the items in your bag.';
      else
        v_discount := case when v_c.discount_type = 'percent' then round(v_eligible * v_c.discount_value / 100, 2) else least(v_c.discount_value, v_eligible) end;
        if v_c.max_discount is not null then v_discount := least(v_discount, v_c.max_discount); end if;
        v_coupon_ok := true; v_coupon_msg := 'Coupon applied.';
      end if;
    end if;
  end if;

  v_fee := case when v_subtotal = 0 then 0 when v_free > 0 and v_subtotal - v_discount >= v_free then 0 else v_flat end;
  v_total := greatest(v_subtotal - v_discount, 0) + v_fee;
  if coalesce((v_tax ->> 'enabled')::boolean, false) then
    v_rate := coalesce((v_tax ->> 'rate_percent')::numeric, 0);
    v_tax_amt := case when coalesce((v_tax ->> 'prices_include_tax')::boolean, true)
                      then round((v_total - v_fee) * v_rate / (100 + v_rate), 2)
                      else round((v_total - v_fee) * v_rate / 100, 2) end;
    if not coalesce((v_tax ->> 'prices_include_tax')::boolean, true) then v_total := v_total + v_tax_amt; end if;
  end if;

  return jsonb_build_object(
    'lines', v_lines, 'subtotal', v_subtotal, 'discount', v_discount, 'shipping_fee', v_fee,
    'tax', v_tax_amt, 'total', v_total,
    'coupon', case when v_code = '' then null else jsonb_build_object('code', v_code, 'valid', v_coupon_ok, 'message', v_coupon_msg) end
  );
end $$;

-- ---------------------------------------------------------
-- 15. Admin list views (security_invoker: the caller's RLS applies)
-- ---------------------------------------------------------
create or replace view public.admin_products_view with (security_invoker = true) as
select p.*,
  coalesce((select sum(v.stock) from product_variants v where v.product_id = p.id), 0)::int as total_stock,
  (select count(*) from product_variants v where v.product_id = p.id)::int as variant_count,
  (select i.image_url from product_images i where i.product_id = p.id order by i.sort_order limit 1) as main_image,
  coalesce((select array_agg(pc.category_id) from product_categories pc where pc.product_id = p.id), '{}'::uuid[]) as category_ids,
  coalesce((select string_agg(c.name, ', ' order by c.name) from product_categories pc join categories c on c.id = pc.category_id where pc.product_id = p.id), '') as category_names,
  case
    when p.price = 0 then 'unpriced'
    when coalesce((select sum(v.stock) from product_variants v where v.product_id = p.id), 0) = 0 then 'out'
    when coalesce((select sum(v.stock) from product_variants v where v.product_id = p.id), 0) <= p.low_stock_threshold then 'low'
    else 'in'
  end as stock_state
from products p;

create or replace view public.admin_orders_view with (security_invoker = true) as
select o.*,
  (select coalesce(sum(oi.qty), 0) from order_items oi where oi.order_id = o.id)::int as item_count
from orders o;

revoke all on public.admin_products_view, public.admin_orders_view from anon;
grant select on public.admin_products_view, public.admin_orders_view to authenticated;

-- ---------------------------------------------------------
-- 16. Function privileges
-- ---------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
grant execute on function public.quote_cart(jsonb, text) to anon, authenticated;
grant execute on function public.public_best_seller_ids(int) to anon, authenticated;
revoke execute on function public.admin_dashboard() from anon;
revoke execute on function public.admin_customers(text, text, int, int) from anon;
revoke execute on function public.admin_customer_detail(uuid) from anon;
revoke execute on function public.admin_list_admins() from anon;
revoke execute on function public.admin_save_product(jsonb) from anon;
revoke execute on function public.admin_duplicate_product(uuid) from anon;
revoke execute on function public.admin_bulk_update_products(uuid[], jsonb) from anon;
revoke execute on function public.admin_import_products(jsonb) from anon;
revoke execute on function public.admin_update_order(uuid, jsonb, text) from anon;
revoke execute on function public.admin_cancel_order(uuid, text, boolean) from anon;
revoke execute on function public.admin_ensure_invoice_number(uuid) from anon;
revoke execute on function public.admin_set_customer_status(uuid, text) from anon;
revoke execute on function public.admin_log_event(text, jsonb) from anon;
revoke execute on function public.update_my_admin_profile(text) from anon;
revoke execute on function public.hide_my_order(uuid) from anon;
