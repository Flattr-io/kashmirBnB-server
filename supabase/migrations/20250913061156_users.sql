-- Prereqs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Shared timestamp trigger
CREATE OR REPLACE FUNCTION update_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, NOW());
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = TG_TABLE_NAME
        AND column_name = 'updated_at'
    ) THEN
      NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    END IF;
  ELSE
    -- Preserve created_at and bump updated_at
    NEW.created_at := OLD.created_at;
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = TG_TABLE_NAME
        AND column_name = 'updated_at'
    ) THEN
      NEW.updated_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(15) UNIQUE,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  location VARCHAR(255),
  phone VARCHAR(15),
  email VARCHAR(255),
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (
    gender IN ('male', 'female', 'other', 'prefer_not_to_say')
  ),
  nationality VARCHAR(50),
  emergency_contact JSONB DEFAULT '{}'::jsonb,
  preferences JSONB DEFAULT '{}'::jsonb,
  verification_status VARCHAR(20) DEFAULT 'unverified'
    CHECK (
      verification_status IN ('unverified', 'pending', 'verified', 'rejected')
    ),
  verification_documents JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  online_status VARCHAR(20) DEFAULT 'offline'
    CHECK (online_status IN ('online', 'offline', 'away', 'busy')),
  last_seen TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Prefer GIN trigram on full_name for fuzzy search
CREATE INDEX IF NOT EXISTS idx_user_profiles_verification_status
  ON user_profiles(verification_status);

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active
  ON user_profiles(last_active_at);

CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name_trgm
  ON user_profiles USING GIN (full_name gin_trgm_ops);

-- Triggers (reuse shared function)
DROP TRIGGER IF EXISTS trg_users_timestamps ON users;
CREATE TRIGGER trg_users_timestamps
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_timestamps();

DROP TRIGGER IF EXISTS trg_user_profiles_timestamps ON user_profiles;
CREATE TRIGGER trg_user_profiles_timestamps
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_timestamps();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_public_read" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Profile auto-create on auth.users
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Access
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;

COMMENT ON TABLE users IS 'Core users table extending Supabase auth.users';
COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON COLUMN user_profiles.verification_status IS
  'User verification status for document verification';
COMMENT ON COLUMN user_profiles.verification_documents IS
  'Array of verification document URLs and metadata';
COMMENT ON COLUMN user_profiles.preferences IS
  'User preferences and settings as JSON';
