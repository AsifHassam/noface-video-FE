-- Create Avatar Characters table (Create Avatar flow saved characters)
CREATE TABLE IF NOT EXISTS avatar_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('selfie', 'studio')),
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'random')),
  uploaded_image_url TEXT,
  generated_avatar_url TEXT,
  selected_avatar_url TEXT NOT NULL,
  animation_video_url TEXT,
  motion_style TEXT DEFAULT 'calm' CHECK (motion_style IN ('calm', 'expressive')),
  voice_type TEXT NOT NULL CHECK (voice_type IN ('upload', 'preset')),
  voice_reference_url TEXT,
  preset_voice_name TEXT,
  character_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avatar_characters_user_id ON avatar_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_characters_created_at ON avatar_characters(created_at DESC);

ALTER TABLE avatar_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own avatar characters"
  ON avatar_characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own avatar characters"
  ON avatar_characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own avatar characters"
  ON avatar_characters FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own avatar characters"
  ON avatar_characters FOR DELETE
  USING (auth.uid() = user_id);
