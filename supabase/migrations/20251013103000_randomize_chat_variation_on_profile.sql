-- Purpose: Assign a random chat_variation_id (1..max_variations, default 5) to new profiles
-- This updates create_user_profile() to set chat_variation_id deterministically at creation time

BEGIN;

create or replace function create_user_profile()
returns trigger as $$
declare
  v_max smallint;
  v_var smallint;
  v_phone text;
  v_full_name text;
begin
  -- Ensure RLS policies using auth.uid() see the new user's id
  perform set_config('request.jwt.claim.sub', NEW.id::text, true);

  -- Resolve defaulted fields from auth.users
  v_phone := coalesce(new.phone, new.raw_user_meta_data->>'phone');
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', 'User');

  -- Read chat max variations (fallback to 5)
  select max_variations into v_max from chat_config where id = 1;
  if v_max is null or v_max < 1 then
    v_max := 5;
  end if;
  v_var := 1 + floor(random() * v_max)::smallint;

  -- Upsert public.users with phone/email
  insert into users (id, phone, email)
  values (new.id, v_phone, new.email)
  on conflict (id) do update set
    phone = excluded.phone,
    email = excluded.email;

  -- Upsert user_profiles with defaults and randomized chat_variation_id
  insert into user_profiles (id, full_name, phone, email, chat_variation_id)
  values (new.id, v_full_name, v_phone, new.email, v_var)
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, user_profiles.full_name),
    phone = excluded.phone,
    email = excluded.email,
    chat_variation_id = coalesce(user_profiles.chat_variation_id, excluded.chat_variation_id);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Recreate trigger to bind latest function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_user_profile();

COMMIT;


