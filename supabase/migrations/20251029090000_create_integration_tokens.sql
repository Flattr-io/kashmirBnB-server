-- Store OAuth tokens for third-party integrations (e.g., Amadeus)

BEGIN;

CREATE TABLE IF NOT EXISTS integration_tokens (
  provider TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION trg_update_integration_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS integration_tokens_updated_at ON integration_tokens;
CREATE TRIGGER integration_tokens_updated_at
BEFORE UPDATE ON integration_tokens
FOR EACH ROW EXECUTE FUNCTION trg_update_integration_tokens_updated_at();

COMMIT;


