-- Widen phone columns to store E.164 values with optional leading '+' (VARCHAR(15) was too small).
-- Matches application validation USER_PHONE_MAX_LEN = 32.

BEGIN;

ALTER TABLE users
  ALTER COLUMN phone TYPE VARCHAR(32);

ALTER TABLE user_profiles
  ALTER COLUMN phone TYPE VARCHAR(32);

COMMIT;
