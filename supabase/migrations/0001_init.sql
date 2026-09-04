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
