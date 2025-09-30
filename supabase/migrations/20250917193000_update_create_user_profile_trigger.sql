-- purpose: update create_user_profile trigger to avoid fk violations by upserting into public.users first
-- affects: function create_user_profile(), trigger on_auth_user_created on auth.users
-- notes: keeps existing repo sql style and rls setup; idempotent via create or replace and trigger recreation

create or replace function create_user_profile()
returns trigger as $$
begin
  -- ensure a row exists in public.users (fk target for user_profiles)
  insert into users (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;

  -- insert profile if not exists
  insert into user_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'User'))
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- recreate trigger to ensure it uses the updated function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_user_profile();


