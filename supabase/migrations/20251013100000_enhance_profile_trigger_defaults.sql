-- Purpose: Ensure profile/users get phone/email defaults from auth.users at creation
-- Also keep RLS compatibility by setting request.jwt.claim.sub = NEW.id

BEGIN;

create or replace function create_user_profile()
returns trigger as $$
begin
  perform set_config('request.jwt.claim.sub', NEW.id::text, true);

  -- Upsert public.users with phone/email using fallbacks
  insert into users (id, phone, email)
  values (new.id, coalesce(new.phone, new.raw_user_meta_data->>'phone'), new.email)
  on conflict (id) do update set
    phone = excluded.phone,
    email = excluded.email;

  -- Upsert profile with defaults for full_name, phone, email
  insert into user_profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    new.email
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, user_profiles.full_name),
    phone = excluded.phone,
    email = excluded.email;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_user_profile();

COMMIT;


