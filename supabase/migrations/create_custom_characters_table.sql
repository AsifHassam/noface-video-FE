-- Create Custom Characters table
CREATE TABLE IF NOT EXISTS custom_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT NOT NULL,
  voice_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_characters_user_id ON custom_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_characters_created_at ON custom_characters(created_at DESC);

-- Enable Row Level Security
ALTER TABLE custom_characters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_characters
CREATE POLICY "Users can view their own custom characters"
  ON custom_characters
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom characters"
  ON custom_characters
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom characters"
  ON custom_characters
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom characters"
  ON custom_characters
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_custom_characters_updated_at
  BEFORE UPDATE ON custom_characters
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();

