-- View exposing destinations with geometry serialized as GeoJSON
create or replace view vw_destinations_public as
select
  d.id,
  d.name,
  d.slug,
  d.metadata,
  d.created_by,
  d.created_at,
  d.updated_at,
  d.center_lat,
  d.center_lng,
  ST_AsGeoJSON(d.area)  as area_geojson,
  ST_AsGeoJSON(d.center) as center_geojson
from destinations d;

grant select on vw_destinations_public to anon, authenticated;

