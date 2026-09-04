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
