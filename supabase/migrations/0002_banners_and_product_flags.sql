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
