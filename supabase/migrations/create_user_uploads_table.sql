-- Create User Uploads table to track all user-uploaded media files
CREATE TABLE IF NOT EXISTS user_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'video', 'audio')),
  storage_path TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  file_size BIGINT, -- Size in bytes
  mime_type VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_uploads_user_id ON user_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_uploads_file_type ON user_uploads(file_type);
CREATE INDEX IF NOT EXISTS idx_user_uploads_created_at ON user_uploads(created_at DESC);

-- Enable Row Level Security
ALTER TABLE user_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_uploads
CREATE POLICY "Users can view their own uploads"
  ON user_uploads
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own uploads"
  ON user_uploads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
  ON user_uploads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads"
  ON user_uploads
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_uploads_updated_at
  BEFORE UPDATE ON user_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();

