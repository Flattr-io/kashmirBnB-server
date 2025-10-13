-- Purpose: Fix signup failure by ensuring trigger inserts satisfy RLS
-- Context: "Database error saving new user" during auth.signUp caused by RLS on public.users/user_profiles
-- Approach: In trigger function, set request.jwt.claim.sub = NEW.id so auth.uid() matches, and keep SECURITY DEFINER

BEGIN;

create or replace function create_user_profile()
returns trigger as $$
begin
  -- Make RLS policies that use auth.uid() see the new user's id
  perform set_config('request.jwt.claim.sub', NEW.id::text, true);

  -- Ensure a row exists in public.users
  insert into users (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;

  -- Insert profile if not exists with sensible default name
  insert into user_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'User'))
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Recreate trigger to ensure it binds to the updated function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_user_profile();

COMMIT;


