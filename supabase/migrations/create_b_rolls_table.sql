-- Create B-rolls table to store user-uploaded B-roll videos
CREATE TABLE IF NOT EXISTS b_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  file_size BIGINT, -- Size in bytes
  duration_seconds NUMERIC(10, 2), -- Video duration in seconds
  thumbnail_url TEXT, -- Thumbnail/preview image URL
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (resolution, codec, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_b_rolls_user_id ON b_rolls(user_id);
CREATE INDEX IF NOT EXISTS idx_b_rolls_created_at ON b_rolls(created_at DESC);

-- Enable Row Level Security
ALTER TABLE b_rolls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for b_rolls
CREATE POLICY "Users can view their own b_rolls"
  ON b_rolls
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own b_rolls"
  ON b_rolls
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own b_rolls"
  ON b_rolls
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own b_rolls"
  ON b_rolls
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_b_rolls_updated_at
  BEFORE UPDATE ON b_rolls
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();

