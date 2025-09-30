-- Ensure destinations.center geometry is always populated from lat/lng
create or replace function set_destination_geometry()
returns trigger as $$
begin
  if NEW.center is null and NEW.center_lat is not null and NEW.center_lng is not null then
    NEW.center := ST_SetSRID(ST_MakePoint(NEW.center_lng, NEW.center_lat), 4326);
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_destinations_geometry on destinations;
create trigger trg_destinations_geometry
  before insert or update on destinations
  for each row execute function set_destination_geometry();

