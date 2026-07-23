insert into public.outlets (id, name, timezone)
values ('00000000-0000-0000-0000-000000000001', 'Outlet Utama', 'Asia/Jakarta')
on conflict (id) do nothing;

insert into public.business_settings (
  outlet_id, business_name, tagline, primary_color, sidebar_color
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Sabana',
  'Operation Hub',
  '#a80f16',
  '#211d1a'
)
on conflict (outlet_id) do nothing;

insert into public.menu_categories (outlet_id, name, sort_order) values
('00000000-0000-0000-0000-000000000001','Paket',1),
('00000000-0000-0000-0000-000000000001','Ayam',2),
('00000000-0000-0000-0000-000000000001','Rice bowl',3),
('00000000-0000-0000-0000-000000000001','Tambahan',4),
('00000000-0000-0000-0000-000000000001','Minuman',5)
on conflict (outlet_id, name) do nothing;
