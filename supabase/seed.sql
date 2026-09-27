-- Optional test data. Run after the foodlist migration. Delete rows from the app whenever you like.

insert into public.restaurants (name, category, area, maps_url, inspo_url, notes, interested) values
  ('Hokuto Sukiyaki', 'Shabu', 'Ginza', 'https://maps.google.com/?q=Hokuto+Ginza', null, 'Test entry — sukiyaki set lunch', '{micro_bua,fair_bee}'),
  ('I''m Donut?', 'Dessert', 'Multiple branches', null, 'https://www.tiktok.com/', 'Test entry — go early, queues', '{micro_bua,fair_bee}'),
  ('Kizuna Sushi', 'Sushi', 'Shinjuku', null, 'https://www.youtube.com/', 'Test entry — all you can eat ¥5000', '{fair_bee}'),
  ('Harbs', 'Dessert', 'Multiple branches', null, null, 'Test entry — mille crêpe', '{micro_bua}'),
  ('Ichiran', 'Ramen', 'Shibuya', 'https://maps.google.com/?q=Ichiran+Shibuya', null, null, '{}');

insert into public.plan_entries (restaurant_id, day, slot, time, going)
select id, '2026-12-23', 'dinner', '19:00', '{micro_bua,fair_bee}' from public.restaurants where name = 'Hokuto Sukiyaki';
insert into public.plan_entries (restaurant_id, day, slot, time, going)
select id, '2026-12-24', 'lunch', null, '{fair_bee}' from public.restaurants where name = 'Kizuna Sushi';
insert into public.plan_entries (restaurant_id, day, slot, time, going)
select id, '2026-12-24', 'lunch', null, '{micro_bua}' from public.restaurants where name = 'Harbs';
