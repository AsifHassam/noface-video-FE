-- Create User API Keys table
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'elevenlabs' CHECK (provider IN ('elevenlabs')),
  encrypted_key BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one API key per user per provider
  UNIQUE(user_id, provider)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON user_api_keys(user_id, provider);

-- Enable Row Level Security
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_api_keys
CREATE POLICY "Users can view their own API keys"
  ON user_api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON user_api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON user_api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON user_api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_api_keys_updated_at
  BEFORE UPDATE ON user_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();

-- Note: Encryption/decryption will be handled in the application layer
-- using pgcrypto functions with a secret key stored in environment variables
-- Example usage in application:
-- Encrypt: pgp_sym_encrypt('api_key', current_setting('app.encryption_key'))
-- Decrypt: pgp_sym_decrypt(encrypted_key, current_setting('app.encryption_key'))

