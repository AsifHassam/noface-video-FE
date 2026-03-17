-- User's saved voices (name + Eleven Labs voice ID) for the Generate Speech voice dropdown
CREATE TABLE IF NOT EXISTS user_saved_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  eleven_labs_voice_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_voices_user_id ON user_saved_voices(user_id);

ALTER TABLE user_saved_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved voices"
  ON user_saved_voices
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved voices"
  ON user_saved_voices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved voices"
  ON user_saved_voices
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved voices"
  ON user_saved_voices
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_saved_voices_updated_at
  BEFORE UPDATE ON user_saved_voices
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();
