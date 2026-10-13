-- =========================================================
-- Zari — real catalogue from the supplier product list (39 unique SKUs).
-- Names, product codes (used as SKU), categories and HSN codes are verbatim
-- from the owner-supplied list. Price, stock and other specs are intentionally
-- UNSET (price 0, stock 0, status 'draft' = hidden on the public site) — no
-- invented prices/discounts/inventory. Set real values + photos in Admin, then
-- flip status to 'active'. Re-runnable: upserts by SKU, never deletes orders.
-- Requires migrations 0001..0003.
-- =========================================================

insert into categories (kind, name, slug) values
  ('saree_type', 'Saree', 'saree'),
  ('saree_type', 'Churidar Material', 'churidar-material'),
  ('saree_type', 'Set Mundu', 'set-mundu'),
  ('saree_type', 'Set Saree', 'set-saree')
on conflict (slug) do nothing;

do $$
declare v_product_id uuid; v_category_id uuid;
begin

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('6842', 'cotton-saree-gtha-6842', 'cotton saree gtha', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '6842-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('11789', 'kbu0200mulcotton-11789', 'KBU0200MULCOTTON', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '11789-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('2207', '9001-2207', '9001', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '2207-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('11659', 'print-cotton-c-material-11659', 'PRINT COTTON C MATERIAL', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Churidar Material', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'churidar-material';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '11659-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('9150', 'malmal-cotton-990-9150', 'MALMAL COTTON 990', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '9150-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('11786', 'ksy0040malcotton-11786', 'KSY0040MALCOTTON', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '11786-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('11698', 'cotton-check-shahid-rs-405-11698', 'COTTON CHECK SHAHID Rs 405', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '11698-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('11552', 'chiralasilksaree-11552', 'CHIRALASILKSAREE', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '11552-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('417616', 'sarees-rajkunwar-1-417616', 'SAREES RAJKUNWAR 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081110', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '417616-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('426602', 'sarees-natural-kalamkari-1-426602', 'SAREES NATURAL KALAMKARI 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52085910', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '426602-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('420051', 'sarees-madrasi-chex-1-420051', 'SAREES MADRASI CHEX 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54075420', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '420051-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('426312', 'sarees-onam-digital-1-426312', 'SAREES ONAM DIGITAL 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54075420', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '426312-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('425815', 'sarees-khadictn-pallu-zari-st-1-425815', 'SAREES KHADICTN PALLU ZARI ST 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54075210', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '425815-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('426671', 'sarees-mul-ctn-nw-matha-2-426671', 'SAREES MUL CTN NW MATHA 2', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '426671-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('426371', 'sarees-sampal-puri-silk-1-426371', 'SAREES SAMPAL PURI SILK 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54071019', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '426371-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('425479', 'sarees-mulctn-jkrd-1-425479', 'SAREES MULCTN JKRD 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '425479-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('425760', 'sarees-mul-matha-2-1-425760', 'SAREES MUL MATHA-2 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52084110', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '425760-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('426457', 'sarees-mul-blu-bdr-8-426457', 'SAREES MUL BLU BDR 8', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '426457-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('425367', 'sarees-sambslpuri-silk-1-425367', 'SAREES SAMBSLPURI SILK 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54071019', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '425367-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('426507', 'sarees-mul-1side-fwr-emb-2-426507', 'SAREES MUL 1SIDE FWR EMB 2', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '426507-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('366959', 'sarees-6213-k-set-1-366959', 'SAREES 6213 K SET 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081110', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '366959-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('416762', 'sarees-53420-set-wb-1-416762', 'SAREES 53420 SET WB 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '416762-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('426498', 'sarees-a-2851-set-2-1-426498', 'SAREES A-2851 SET 2. 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '426498-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('417452', 'sarees-83450-set-wb-2-417452', 'SAREES 83450 SET WB 2', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '417452-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('362300', 'sarees-10-1-2-kk-set-3-362300', 'SAREES 10 1/2 KK SET 3', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081110', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '362300-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('426497', 'sarees-a-1759-set-1-1-426497', 'SAREES A-1759 SET 1. 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '426497-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('418682', 'sarees-156-q-1-418682', 'SAREES 156-Q 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52084110', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '418682-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('417791', 'sarees-706k-4-417791', 'SAREES 706K 4', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '52101120', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '417791-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('341787', 'sarees-katti-batti-1-341787', 'SAREES KATTI BATTI 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54075420', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '341787-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('424404', 'sarees-kasavu-silk-1-424404', 'SAREES KASAVU SILK 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54075420', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '424404-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('414008', 'sarees-amrith-bharat-d1-414008', 'SAREES AMRITH BHARAT D1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54071019', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '414008-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('337540', 'sarees-crepe-1-337540', 'SAREES CREPE 1', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', '54075210', 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '337540-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('8483', 'setmundu-650-8483', 'SETMUNDU 650', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '8483-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('10547', 'keralasaree2026-10547', 'KERALASAREE2026', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '10547-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('9252', 'set-saree-650-9252', 'SET SAREE 650', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Set Saree', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '9252-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('8330', '2-3setmundu-8330', '2*3SETMUNDU', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '8330-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('9329', 'puliyila-set-mundu-rm-tex-495-9329', 'PULIYILA SET MUNDU RM TEX 495', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '9329-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('8740', 'set-mundu430-8740', 'set mundu430', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '8740-A', 0) on conflict (variant_sku) do nothing;
  end if;

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('8048', 'setmunduajkpy-8048', 'setmunduajkpy', 'Imported from the supplier product list — price, stock and photos pending admin entry.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do update set name = excluded.name, product_type = excluded.product_type, hsn_code = excluded.hsn_code
  returning id into v_product_id;
  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, '8048-A', 0) on conflict (variant_sku) do nothing;
  end if;
end $$;
