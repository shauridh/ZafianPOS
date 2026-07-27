-- Before this migration the UI used is_active=false for "Hapus".
-- No separate deactivate action existed, so all currently inactive master
-- records are legacy deletions. Rename them to preserve references/history
-- while releasing their business names for clean recreation.

update public.inventory_items
set
  name = 'deleted-' || id::text || '-' || extract(epoch from now())::bigint::text,
  sku = null
where is_active = false
  and name not like 'deleted-%';

update public.products
set name = 'deleted-' || id::text || '-' || extract(epoch from now())::bigint::text
where is_active = false
  and name not like 'deleted-%';

update public.menu_categories
set name = 'deleted-' || id::text || '-' || extract(epoch from now())::bigint::text
where is_active = false
  and name not like 'deleted-%';

update public.production_recipes
set name = 'deleted-' || id::text || '-' || extract(epoch from now())::bigint::text
where is_active = false
  and name not like 'deleted-%';
