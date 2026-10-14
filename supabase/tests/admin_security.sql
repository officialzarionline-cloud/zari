-- =========================================================
-- Zari — permission & workflow tests for migration 0004.
-- Runs against a local Postgres that has Supabase-like roles (anon,
-- authenticated, service_role), an auth.users table and auth.uid() reading
-- request.jwt.claims — see supabase/tests/README.md. Every block runs in a
-- transaction that is rolled back, so the fixtures below are the only state.
-- Fails loudly (exception) on the first broken expectation.
-- =========================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'pass: %', label;
end $$;

-- Expect a statement to be rejected (by RLS, a guard trigger or a function check).
create or replace function pg_temp.fails(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'pass: % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL (should have been rejected): %', label;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------- fixtures ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'owner@zari.test'),
  ('00000000-0000-0000-0000-00000000a002', 'catalog@zari.test'),
  ('00000000-0000-0000-0000-00000000a003', 'orders@zari.test'),
  ('00000000-0000-0000-0000-00000000a004', 'disabled@zari.test'),
  ('00000000-0000-0000-0000-00000000c001', 'priya@example.com'),
  ('00000000-0000-0000-0000-00000000c002', 'anu@example.com');

select public.bootstrap_super_admin('owner@zari.test', 'Owner');
select pg_temp.fails($$select public.bootstrap_super_admin('catalog@zari.test')$$, 'bootstrap refuses when a super admin exists');

insert into admins (id, role_id, email, is_active) values
  ('00000000-0000-0000-0000-00000000a002', (select id from admin_roles where key = 'catalog_manager'), 'catalog@zari.test', true),
  ('00000000-0000-0000-0000-00000000a003', (select id from admin_roles where key = 'order_manager'), 'orders@zari.test', true),
  ('00000000-0000-0000-0000-00000000a004', (select id from admin_roles where key = 'store_manager'), 'disabled@zari.test', false);

insert into customer_profiles (id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000c001', 'Priya', '9800000001'),
  ('00000000-0000-0000-0000-00000000c002', 'Anu', '9800000002');

update products set status = 'active', price = 2500 where sku in ('6842', '11789');
update products set status = 'active', price = 1800, sale_price = 1500 where sku = '2207';
update product_variants set stock = 5 where variant_sku in ('6842-A', '11789-A', '2207-A');

insert into orders (id, order_number, customer_id, status, payment_status, subtotal, total, shipping_address, contact_name, contact_phone)
values ('00000000-0000-0000-0000-0000000000e1', 'ZR10001', '00000000-0000-0000-0000-00000000c001', 'pending', 'paid', 2500, 2500, '{"city":"Kochi"}', 'Priya', '9800000001'),
       ('00000000-0000-0000-0000-0000000000e2', 'ZR10002', '00000000-0000-0000-0000-00000000c002', 'pending', 'pending', 1500, 1579, '{"city":"Thrissur"}', 'Anu', '9800000002');
insert into order_items (order_id, product_id, variant_id, name_snapshot, sku_snapshot, price_snapshot, qty)
select '00000000-0000-0000-0000-0000000000e1', p.id, v.id, p.name, p.sku, 2500, 1 from products p join product_variants v on v.product_id = p.id where p.sku = '6842';

insert into coupons (code, discount_type, discount_value, min_order_value, per_customer_limit) values ('welcome10', 'percent', 10, 1000, 1);
insert into coupons (code, discount_type, discount_value, expires_at) values ('OLD50', 'fixed', 50, now() - interval '1 day');

-- =========================================================
-- Anonymous visitor
-- =========================================================
begin;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.ok((select count(*) from products) = 3, 'anon sees only active products');
select pg_temp.ok((select count(*) from admins) = 0, 'anon cannot read admins');
select pg_temp.ok((select count(*) from admin_roles) = 0, 'anon cannot read roles');
select pg_temp.ok((select count(*) from orders) = 0, 'anon cannot read orders');
select pg_temp.ok((select count(*) from coupons) = 0, 'anon cannot list coupon codes');
select pg_temp.ok((select count(*) from admin_activity_log) = 0, 'anon cannot read activity log');
select pg_temp.fails($$select 1 from admin_products_view limit 1$$, 'anon cannot query admin views');
select pg_temp.ok((select count(*) from site_settings where key = 'store') = 1, 'anon reads public settings');
select pg_temp.ok((select count(*) from content_pages) >= 7, 'anon reads published pages');
select pg_temp.fails($$insert into admins (id, role_id) values ('00000000-0000-0000-0000-00000000c002', (select id from admin_roles limit 1))$$, 'anon cannot insert into admins');
select pg_temp.fails($$select public.admin_dashboard()$$, 'anon cannot call admin_dashboard');
select pg_temp.fails($$select public.admin_lookup_user_by_email('owner@zari.test')$$, 'anon cannot look up users by email');
select pg_temp.fails($$select public.bootstrap_super_admin('priya@example.com')$$, 'anon cannot call bootstrap');
update site_settings set value = '{"name":"x"}' where key = 'store';
select pg_temp.ok((public.quote_cart(jsonb_build_array(jsonb_build_object('product_id', (select id from products where sku = '2207'), 'qty', 2)), null) ->> 'subtotal')::numeric = 3000,
  'quote_cart uses server sale price (2 x 1500)');
rollback;

-- An update that matches zero rows under RLS is "allowed" by Postgres, so
-- check the row really did not change.
select pg_temp.ok((select value ->> 'name' from site_settings where key = 'store') = 'Zari', 'settings unchanged after anon attempt');

-- =========================================================
-- Signed-in customer (the two holes fixed by 0004)
-- =========================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}';
select pg_temp.fails($$insert into admins (id, role_id) values ('00000000-0000-0000-0000-00000000c001', (select id from admin_roles where key = 'super_admin'))$$,
  'customer cannot make themselves admin (was possible before 0004)');
update orders set payment_status = 'paid', total = 1, status = 'delivered' where id = '00000000-0000-0000-0000-0000000000e1';
rollback;
select pg_temp.ok((select total from orders where id = '00000000-0000-0000-0000-0000000000e1') = 2500, 'customer cannot edit own order total/status (was possible before 0004)');

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}';
select pg_temp.ok((select count(*) from orders) = 1, 'customer sees only own orders');
select pg_temp.fails($$update customer_profiles set account_status = 'suspended' where id = auth.uid()$$, 'customer cannot change own account status');
select pg_temp.ok(public.admin_me() is null, 'admin_me is null for a customer');
select pg_temp.fails($$select public.admin_save_product('{"name":"x","sku":"X1"}')$$, 'customer cannot save products');
select pg_temp.ok(((public.quote_cart(jsonb_build_array(jsonb_build_object('product_id', (select id from products where sku = '6842'), 'qty', 1)), 'welcome10')) -> 'coupon' ->> 'valid')::boolean,
  'customer can apply a valid coupon');
select pg_temp.ok(((public.quote_cart(jsonb_build_array(jsonb_build_object('product_id', (select id from products where sku = '6842'), 'qty', 1)), 'welcome10')) ->> 'discount')::numeric = 250,
  'coupon discount computed server-side (10% of 2500)');
select pg_temp.ok(not ((public.quote_cart(jsonb_build_array(jsonb_build_object('product_id', (select id from products where sku = '6842'), 'qty', 1)), 'OLD50')) -> 'coupon' ->> 'valid')::boolean,
  'expired coupon rejected');
rollback;
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}';
select public.hide_my_order('00000000-0000-0000-0000-0000000000e1');
select public.hide_my_order('00000000-0000-0000-0000-0000000000e2');
commit;
select pg_temp.ok((select customer_hidden_at is not null from orders where id = '00000000-0000-0000-0000-0000000000e1'), 'customer can hide own order');
select pg_temp.ok((select customer_hidden_at is null from orders where id = '00000000-0000-0000-0000-0000000000e2'), 'customer cannot hide someone else''s order');
update orders set customer_hidden_at = null;

-- =========================================================
-- Catalogue manager: products yes, orders/customers/settings/admins no
-- =========================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}';
select pg_temp.ok((public.admin_me() ->> 'role_key') = 'catalog_manager', 'admin_me reports role');
select pg_temp.fails($$insert into banners (title, image_url, cta_link) values ('x', 'https://a.b/c.jpg', 'javascript:alert(1)')$$, 'banner javascript: link rejected');
select pg_temp.ok((select count(*) from products) = 39, 'catalogue manager sees drafts too');
select pg_temp.ok((select count(*) from orders) = 0, 'catalogue manager cannot read orders');
select pg_temp.ok((select count(*) from customer_profiles) = 0, 'catalogue manager cannot read customers');
select pg_temp.fails($$select public.admin_customers()$$, 'catalogue manager cannot list customers');
select pg_temp.fails($$select public.admin_update_order('00000000-0000-0000-0000-0000000000e1', '{"status":"confirmed"}')$$, 'catalogue manager cannot update orders');
select pg_temp.fails($$select public.admin_list_admins()$$, 'catalogue manager cannot list admins');
select pg_temp.fails($$insert into admin_roles (key, name, permissions) values ('x', 'X', '{}')$$, 'catalogue manager cannot create roles');
select pg_temp.ok((public.admin_dashboard() ->> 'active_products')::int = 3, 'dashboard shows real active product count');
select pg_temp.ok((select count(*) from admin_products_view where stock_state = 'unpriced') = 36, 'product list view: stock state');
select pg_temp.ok((select count(*) from admin_orders_view) = 0, 'order view respects RLS (catalogue manager)');

-- Product save: create, validate, update in place
select pg_temp.fails($$select public.admin_save_product('{"name":"","sku":"A1"}')$$, 'empty name rejected');
select pg_temp.fails($$select public.admin_save_product('{"name":"X","sku":"bad sku!"}')$$, 'invalid SKU rejected');
select pg_temp.fails($$select public.admin_save_product('{"name":"X","sku":"X2","price":100,"sale_price":200}')$$, 'sale price above price rejected');
select pg_temp.fails($$select public.admin_save_product('{"name":"X","sku":"X3","price":100,"mrp":50}')$$, 'MRP below price rejected');
select set_config('test.pid', public.admin_save_product(jsonb_build_object(
  'name', 'Kasavu Set Mundu', 'sku', 'zr-500', 'price', 3200, 'mrp', 3600, 'status', 'active', 'featured', true,
  'seo_title', 'Kasavu Set Mundu | Zari', 'images', jsonb_build_array(jsonb_build_object('url', 'https://cdn.example.com/a.jpg'), jsonb_build_object('url', 'javascript:alert(1)')),
  'colors', jsonb_build_array(jsonb_build_object('name', 'Gold', 'hex', '#cba05f')),
  'variants', jsonb_build_array(jsonb_build_object('size', 'Free', 'stock', 4)),
  'category_ids', jsonb_build_array((select id from categories where slug = 'set-mundu'))))::text, true);
select pg_temp.ok((select sku from products where id = current_setting('test.pid')::uuid) = 'ZR-500', 'SKU normalised to upper case');
select pg_temp.ok((select count(*) from product_images where product_id = current_setting('test.pid')::uuid) = 1, 'non-http image URL dropped');
select pg_temp.ok((select count(*) from product_categories where product_id = current_setting('test.pid')::uuid) = 1, 'category assigned');
select set_config('test.vid', (select id::text from product_variants where product_id = current_setting('test.pid')::uuid), true);
select public.admin_save_product(jsonb_build_object('id', current_setting('test.pid'), 'name', 'Kasavu Set Mundu Gold', 'sku', 'ZR-500', 'price', 3000, 'status', 'active',
  'variants', jsonb_build_array(jsonb_build_object('id', current_setting('test.vid'), 'size', 'Free', 'stock', 9))));
select pg_temp.ok((select id::text from product_variants where product_id = current_setting('test.pid')::uuid) = current_setting('test.vid'), 'variant kept its id on edit (carts keep working)');
select pg_temp.ok((select stock from product_variants where id = current_setting('test.vid')::uuid) = 9, 'variant stock updated');
select pg_temp.ok((select count(*) from product_images where product_id = current_setting('test.pid')::uuid) = 1, 'images untouched when not sent');

select pg_temp.ok(public.admin_duplicate_product(current_setting('test.pid')::uuid) is not null, 'duplicate product');
select pg_temp.ok((select status from products where sku = 'ZR-500-COPY') = 'draft', 'duplicate starts as draft');

select pg_temp.ok(public.admin_bulk_update_products(array(select id from products where sku in ('6842','11789')), '{"price_change_percent":10,"featured":true}') = 2, 'bulk update');
select pg_temp.ok((select price from products where sku = '6842') = 2750, 'bulk price +10%');

select pg_temp.ok((select (r ->> 'ok')::boolean from jsonb_array_elements(public.admin_import_products('[{"sku":"6842","name":"Cotton Saree GTHA"}]')) r), 'import updates by SKU');
select pg_temp.ok((select price from products where sku = '6842') = 2750 and (select featured from products where sku = '6842'),
  'import keeps fields not in the CSV');
select pg_temp.ok((select not (r ->> 'ok')::boolean from jsonb_array_elements(public.admin_import_products('[{"sku":"NEW-1","name":"New","price":"-5"}]')) r), 'import reports invalid rows');
select pg_temp.ok((select count(*) from admin_activity_log) = 0, 'catalogue manager cannot read activity log');
rollback;

-- =========================================================
-- Order manager: order workflow
-- =========================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated"}';
update products set price = 1 where sku = '6842';
select pg_temp.ok((select price from products where sku = '6842') = 2500, 'order manager cannot edit products');
select pg_temp.ok((select count(*) from orders) = 2, 'order manager reads all orders');
select pg_temp.ok((select item_count from admin_orders_view where order_number = 'ZR10001') = 1, 'order view item count');
select public.admin_update_order('00000000-0000-0000-0000-0000000000e1', '{"status":"processing"}', 'Packing today');
select public.admin_update_order('00000000-0000-0000-0000-0000000000e1', '{"status":"shipped","courier":"Delhivery","tracking_number":"AWB123","tracking_url":"javascript:alert(1)"}');
select pg_temp.ok((select shipping_status from orders where id = '00000000-0000-0000-0000-0000000000e1') = 'in_transit', 'shipping status follows shipped');
select pg_temp.ok((select tracking_url is null from orders where id = '00000000-0000-0000-0000-0000000000e1'), 'non-http tracking URL ignored');
select pg_temp.fails($$select public.admin_update_order('00000000-0000-0000-0000-0000000000e1', '{"total":1}')$$, 'order total not editable');
select pg_temp.fails($$select public.admin_update_order('00000000-0000-0000-0000-0000000000e1', '{"payment_status":"paid"}')$$, 'payment status not settable by admin');
select pg_temp.fails($$select public.admin_update_order('00000000-0000-0000-0000-0000000000e1', '{"status":"returned"}')$$, 'cannot return an undelivered order');
select public.admin_update_order('00000000-0000-0000-0000-0000000000e1', '{"status":"delivered"}');
select pg_temp.fails($$select public.admin_cancel_order('00000000-0000-0000-0000-0000000000e1', 'x')$$, 'cannot cancel a delivered order');
select public.admin_cancel_order('00000000-0000-0000-0000-0000000000e2', 'Customer request');
select pg_temp.fails($$select public.admin_update_order('00000000-0000-0000-0000-0000000000e2', '{"status":"confirmed"}')$$, 'cancelled order is closed');
select pg_temp.ok((select count(*) from order_status_history where order_id = '00000000-0000-0000-0000-0000000000e1' and field = 'status') = 3, 'status history recorded');
select pg_temp.ok(public.admin_ensure_invoice_number('00000000-0000-0000-0000-0000000000e1') = public.admin_ensure_invoice_number('00000000-0000-0000-0000-0000000000e1'), 'invoice number stable');
select pg_temp.ok((public.admin_customers('priya') ->> 'total')::int = 1, 'customer search by name');
select public.admin_set_customer_status('00000000-0000-0000-0000-00000000c002', 'suspended');
delete from orders where id = '00000000-0000-0000-0000-0000000000e2';
select pg_temp.ok((select count(*) from orders) = 2, 'orders cannot be deleted');
rollback;

-- Suspended customer cannot review
update customer_profiles set account_status = 'suspended' where id = '00000000-0000-0000-0000-00000000c002';
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c002","role":"authenticated"}';
select pg_temp.ok(not public.is_customer_active(), 'suspension visible to the customer session');
rollback;
update customer_profiles set account_status = 'active';

-- =========================================================
-- Disabled admin has no access at all
-- =========================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a004","role":"authenticated"}';
select pg_temp.ok(public.admin_me() is null, 'disabled admin: admin_me null');
select pg_temp.ok((select count(*) from orders) = 0, 'disabled admin reads no orders');
select pg_temp.fails($$select public.admin_dashboard()$$, 'disabled admin cannot use dashboard');
rollback;

-- =========================================================
-- Super admin: admins, roles, settings, audit log
-- =========================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}';
select pg_temp.ok(jsonb_array_length(public.admin_list_admins()) = 4, 'super admin lists admins');
select pg_temp.fails($$update admins set is_active = false where id = auth.uid()$$, 'super admin cannot disable themselves');
update admin_roles set permissions = '{products}' where key = 'super_admin';
select pg_temp.ok((select permissions from admin_roles where key = 'super_admin') = '{*}', 'super admin role keeps full access');
select pg_temp.fails($$insert into admin_roles (key, name, permissions) values ('god', 'God', '{*}')$$, 'custom roles cannot get *');
select pg_temp.fails($$insert into admin_roles (key, name, permissions) values ('bad', 'Bad', '{hacking}')$$, 'unknown permissions rejected');
insert into admin_roles (key, name, permissions) values ('photo', 'Photographer', '{products}');
select pg_temp.fails($$delete from admin_roles where key = 'order_manager'$$, 'built-in roles cannot be deleted');
update admins set role_id = (select id from admin_roles where key = 'photo') where id = '00000000-0000-0000-0000-00000000a003';
update site_settings set value = value || '{"free_shipping_over":5000}' where key = 'shipping';
update site_settings set key = 'hacked', is_public = false where key = 'seo';
select pg_temp.ok((select count(*) from site_settings where key = 'seo' and is_public) = 1, 'setting key/visibility immutable');
update homepage_sections set is_visible = false where key = 'marquee';
select pg_temp.ok((select count(*) from admin_activity_log where entity = 'site_settings' and actor_email = 'owner@zari.test') >= 1, 'settings change audited');
select pg_temp.ok((select count(*) from admin_activity_log where entity = 'admins') = 1, 'role change audited');
delete from admin_activity_log;
update admin_activity_log set summary = 'x';
select pg_temp.ok((select count(*) from admin_activity_log) > 0 and not exists (select 1 from admin_activity_log where summary = 'x'), 'activity log cannot be deleted or edited');
select public.admin_log_event('login');
select pg_temp.fails($$select public.admin_log_event('drop_tables')$$, 'unknown log events rejected');
select pg_temp.ok((public.quote_cart(jsonb_build_array(jsonb_build_object('product_id', (select id from products where sku = '2207'), 'qty', 1)), null) ->> 'shipping_fee')::numeric = 79,
  'shipping fee comes from settings (1500 < 5000 threshold)');
rollback;

-- Last super admin cannot be removed even by the service role.
select pg_temp.fails($$update admins set is_active = false where id = '00000000-0000-0000-0000-00000000a001'$$, 'last super admin protected');

-- Coupon brute force is rate limited (30 / 15 min per user).
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c002","role":"authenticated"}';
do $$ begin for i in 1..30 loop perform public.quote_cart('[]', 'GUESS' || i); end loop; end $$;
select pg_temp.fails($$select public.quote_cart('[]', 'GUESS31')$$, 'coupon guessing rate limited');
rollback;

select 'ALL TESTS PASSED' as result;
