-- Allow source_type 'own' for "Use my image" (no credits) avatar path
ALTER TABLE avatar_characters DROP CONSTRAINT IF EXISTS avatar_characters_source_type_check;
ALTER TABLE avatar_characters ADD CONSTRAINT avatar_characters_source_type_check
  CHECK (source_type IN ('upload', 'random', 'own'));
