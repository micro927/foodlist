-- Some Google Maps links lead only to a place's name, with no coordinates. The server saves that name here,
-- and the Eats map finds it with Google Places search in the browser (with the map's own key).
alter table public.item_locations add column query text;
