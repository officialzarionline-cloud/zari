-- =========================================================
-- Zari — real inventory rows from ZARI_Product_Details_Extracted.docx.
-- NOT sample data: actual supplier SKUs (product code, description, type,
-- HSN, quantity). Price and images were absent in that document, so every
-- row lands status='draft' price=0 (hidden on the site) until the admin sets
-- a real price, uploads photos, tidies the name, and flips status to 'active'.
-- Requires migration 0003 (product_type, hsn_code, best_seller).
-- =========================================================

insert into categories (kind, name, slug) values
  ('saree_type', 'Saree', 'saree'),
  ('saree_type', 'Set Saree', 'set-saree'),
  ('saree_type', 'Set Mundu', 'set-mundu'),
  ('saree_type', 'Churidar', 'churidar')
on conflict (slug) do nothing;

do $$
declare
  v_product_id uuid;
  v_category_id uuid;
begin

  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-6842', 'cotton-saree-gtha-6842', 'Cotton Saree Gtha', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-6842-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-11789', 'kbu0200mulcotton-11789', 'Kbu0200mulcotton', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-11789-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-2207', '9001-2207', '9001', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-2207-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-11659', 'print-cotton-c-material-11659', 'Print Cotton C Material', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Churidar', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'churidar';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-11659-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-9150', 'malmal-cotton-990-9150', 'Malmal Cotton 990', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-9150-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-11786', 'ksy0040malcotton-11786', 'Ksy0040malcotton', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-11786-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-11698', 'cotton-check-shahid-rs-405-11698', 'Cotton Check Shahid Rs 405', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-11698-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-11552', 'chiralasilksaree-11552', 'Chiralasilksaree', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-11552-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-417616', 'sarees-rajkunwar-1-417616', 'Sarees Rajkunwar 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081110', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-417616-DEFAULT', 4) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-426602', 'sarees-natural-kalamkari-1-426602', 'Sarees Natural Kalamkari 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52085910', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-426602-DEFAULT', 4) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-420051', 'sarees-madrasi-chex-1-420051', 'Sarees Madrasi CHEX 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54075420', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-420051-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-426312', 'sarees-onam-digital-1-426312', 'Sarees ONAM Digital 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54075420', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-426312-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-425815', 'sarees-khadictn-pallu-zari-st-1-425815', 'Sarees Khadictn Pallu ZARI ST 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54075210', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-425815-DEFAULT', 3) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-426671', 'sarees-mul-ctn-nw-matha-2-426671', 'Sarees MUL CTN NW Matha 2', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-426671-DEFAULT', 3) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-426371', 'sarees-sampal-puri-silk-1-426371', 'Sarees Sampal PURI SILK 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54071019', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-426371-DEFAULT', 2) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-425479', 'sarees-mulctn-jkrd-1-425479', 'Sarees Mulctn JKRD 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-425479-DEFAULT', 2) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-425760', 'sarees-mul-matha-2-1-425760', 'Sarees MUL Matha-2 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52084110', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-425760-DEFAULT', 2) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-426457', 'sarees-mul-blu-bdr-8-426457', 'Sarees MUL BLU BDR 8', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-426457-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-425367', 'sarees-sambslpuri-silk-1-425367', 'Sarees Sambslpuri SILK 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54071019', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-425367-DEFAULT', 2) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-426507', 'sarees-mul-1side-fwr-emb-2-426507', 'Sarees MUL 1side FWR EMB 2', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-426507-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-366959', 'sarees-6213-k-set-1-366959', 'Sarees 6213 K SET 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081110', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-366959-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-416762', 'sarees-53420-set-wb-1-416762', 'Sarees 53420 SET WB 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-416762-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-426498', 'sarees-a-2851-set-2-1-426498', 'Sarees A-2851 SET 2. 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-426498-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-417452', 'sarees-83450-set-wb-2-417452', 'Sarees 83450 SET WB 2', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-417452-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-362300', 'sarees-10-1-2-kk-set-3-362300', 'Sarees 10 1/2 KK SET 3', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081110', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-362300-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-426497', 'sarees-a-1759-set-1-1-426497', 'Sarees A-1759 SET 1. 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52081120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-426497-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-418682', 'sarees-156-q-1-418682', 'Sarees 156-q 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52084110', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-418682-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-417791', 'sarees-706k-4-417791', 'Sarees 706K 4', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '52101120', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-417791-DEFAULT', 1) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-341787', 'sarees-katti-batti-1-341787', 'Sarees Katti Batti 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54075420', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-341787-DEFAULT', 4) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-424404', 'sarees-kasavu-silk-1-424404', 'Sarees Kasavu SILK 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54075420', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-424404-DEFAULT', 4) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-414008', 'sarees-amrith-bharat-d-1-414008', 'Sarees Amrith Bharat D 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54071019', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-414008-DEFAULT', 4) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-337540', 'sarees-crepe-1-337540', 'Sarees Crepe 1', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', '54075210', 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-337540-DEFAULT', 7) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-8483', 'setmundu-650-8483', 'Setmundu 650', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-8483-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-10547', 'keralasaree2026-10547', 'Keralasaree2026', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-10547-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-9252', 'set-saree-650-9252', 'SET Saree 650', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Set Saree', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-saree';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-9252-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-8330', '2-3setmundu-8330', '2*3setmundu', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-8330-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-9329', 'puliyila-set-mundu-rm-tex-495-9329', 'Puliyila SET Mundu RM TEX 495', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-9329-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-8740', 'set-mundu430-8740', 'Set Mundu430', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-8740-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;


  insert into products (sku, slug, name, description, status, price, product_type, hsn_code, country_of_origin)
  values ('ZARI-8048', 'setmunduajkpy-8048', 'Setmunduajkpy', 'Imported from supplier inventory list — description, price and images pending admin review.', 'draft', 0, 'Set Mundu', null, 'India')
  on conflict (sku) do nothing
  returning id into v_product_id;

  if v_product_id is not null then
    select id into v_category_id from categories where slug = 'set-mundu';
    if v_category_id is not null then
      insert into product_categories (product_id, category_id) values (v_product_id, v_category_id) on conflict do nothing;
    end if;
    insert into product_variants (product_id, variant_sku, stock) values (v_product_id, 'ZARI-8048-DEFAULT', 0) on conflict (variant_sku) do nothing;
  end if;

end $$;