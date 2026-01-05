-- User documents stored in S3 with verification status
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  url TEXT NOT NULL,
  document_type TEXT DEFAULT 'generic',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'verified', 'rejected')),
  file_name TEXT,
  content_type TEXT,
  size_bytes BIGINT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_documents_user_storage_key ON user_documents(user_id, storage_key);
CREATE INDEX IF NOT EXISTS idx_user_documents_status ON user_documents(status);
CREATE INDEX IF NOT EXISTS idx_user_documents_created_at ON user_documents(created_at);

DROP TRIGGER IF EXISTS trg_user_documents_timestamps ON user_documents;
CREATE TRIGGER trg_user_documents_timestamps
  BEFORE INSERT OR UPDATE ON user_documents
  FOR EACH ROW EXECUTE FUNCTION update_timestamps();

ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_documents_select_own" ON user_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_documents_insert_own" ON user_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_documents_update_own" ON user_documents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE user_documents IS 'User-uploaded documents stored in S3 with verification status';
COMMENT ON COLUMN user_documents.storage_key IS 'S3 object key for the uploaded file';
COMMENT ON COLUMN user_documents.url IS 'Public URL or CDN link to the document';
COMMENT ON COLUMN user_documents.status IS 'Verification status for the document';
