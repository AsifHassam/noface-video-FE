-- Global UGC voices: admin adds Eleven Labs voice IDs; app shows this list in Generate Speech
CREATE TABLE IF NOT EXISTS ugc_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'professional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ugc_voices_voice_id ON ugc_voices(voice_id);
CREATE INDEX IF NOT EXISTS idx_ugc_voices_name ON ugc_voices(name);

ALTER TABLE ugc_voices ENABLE ROW LEVEL SECURITY;

-- Allow read for all (remotion server and app use this list)
CREATE POLICY "Allow read ugc_voices"
  ON ugc_voices
  FOR SELECT
  USING (true);

-- Insert/update/delete: no policy = only service role (backend) can write

CREATE TRIGGER update_ugc_voices_updated_at
  BEFORE UPDATE ON ugc_voices
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();
