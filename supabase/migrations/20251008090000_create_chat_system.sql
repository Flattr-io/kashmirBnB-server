-- =========================================================================
-- Migration: Create global chat system (messages, profile fields, config)
-- Date: 2025-10-08
-- =========================================================================

BEGIN;

-- 1) Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL CHECK (length(text) >= 1 AND length(text) <= 500),
  author_username VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for rigged messages
  is_rigged BOOLEAN NOT NULL DEFAULT false,
  variation_id SMALLINT, -- for rigged grouping
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_variation
  ON chat_messages(variation_id) WHERE is_rigged = true;
CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON chat_messages(user_id) WHERE user_id IS NOT NULL;

-- Reuse shared timestamp trigger function update_timestamps()
DROP TRIGGER IF EXISTS trg_chat_messages_timestamps ON chat_messages;
CREATE TRIGGER trg_chat_messages_timestamps
  BEFORE INSERT OR UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_timestamps();

-- Enable RLS and policies
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Public read of messages (global chat visible to all)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'chat_messages_public_read'
  ) THEN
    CREATE POLICY chat_messages_public_read ON chat_messages
      FOR SELECT USING (true);
  END IF;
END $$;

-- Only authenticated users can insert their own messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'chat_messages_auth_insert'
  ) THEN
    CREATE POLICY chat_messages_auth_insert ON chat_messages
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;
END $$;

-- Authors can update/delete their own messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'chat_messages_update_own'
  ) THEN
    CREATE POLICY chat_messages_update_own ON chat_messages
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'chat_messages_delete_own'
  ) THEN
    CREATE POLICY chat_messages_delete_own ON chat_messages
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 2) Extend user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS chat_username VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS chat_variation_id SMALLINT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_user_profiles_chat_username
  ON user_profiles(chat_username) WHERE chat_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_kyc_status
  ON user_profiles(kyc_status);

-- 3) Chat configuration (single row)
CREATE TABLE IF NOT EXISTS chat_config (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  unauthenticated_message_limit SMALLINT DEFAULT 10,
  phone_verified_message_limit SMALLINT DEFAULT 50,
  max_variations SMALLINT DEFAULT 5,
  message_retention_days SMALLINT DEFAULT 30,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT single_config CHECK (id = 1)
);

INSERT INTO chat_config DEFAULT VALUES ON CONFLICT (id) DO NOTHING;

COMMIT;


