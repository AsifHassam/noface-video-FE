-- Create UGC Video Projects table
CREATE TABLE IF NOT EXISTS ugc_video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_id VARCHAR(100),
  avatar_url TEXT,
  status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATING_SPEECH', 'GENERATING_LIPSYNC', 'READY', 'ERROR')),
  final_video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create UGC Voice Generations table
CREATE TABLE IF NOT EXISTS ugc_voice_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES ugc_video_projects(id) ON DELETE CASCADE NOT NULL,
  voice_id VARCHAR(255) NOT NULL,
  voice_name VARCHAR(255),
  voice_provider VARCHAR(50) DEFAULT 'elevenlabs',
  script_text TEXT NOT NULL,
  audio_url TEXT,
  audio_storage_path TEXT,
  duration_seconds NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create UGC Generated Videos table
CREATE TABLE IF NOT EXISTS ugc_generated_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES ugc_video_projects(id) ON DELETE CASCADE NOT NULL,
  voice_generation_id UUID REFERENCES ugc_voice_generations(id) ON DELETE SET NULL,
  video_url TEXT NOT NULL,
  video_storage_path TEXT,
  thumbnail_url TEXT,
  duration_seconds NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ugc_video_projects_user_id ON ugc_video_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_ugc_video_projects_status ON ugc_video_projects(status);
CREATE INDEX IF NOT EXISTS idx_ugc_video_projects_created_at ON ugc_video_projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ugc_voice_generations_project_id ON ugc_voice_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_ugc_voice_generations_created_at ON ugc_voice_generations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ugc_generated_videos_project_id ON ugc_generated_videos(project_id);
CREATE INDEX IF NOT EXISTS idx_ugc_generated_videos_voice_generation_id ON ugc_generated_videos(voice_generation_id);
CREATE INDEX IF NOT EXISTS idx_ugc_generated_videos_created_at ON ugc_generated_videos(created_at DESC);

-- Enable Row Level Security
ALTER TABLE ugc_video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ugc_voice_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ugc_generated_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ugc_video_projects
CREATE POLICY "Users can view their own UGC projects"
  ON ugc_video_projects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own UGC projects"
  ON ugc_video_projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own UGC projects"
  ON ugc_video_projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own UGC projects"
  ON ugc_video_projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for ugc_voice_generations
CREATE POLICY "Users can view voice generations for their projects"
  ON ugc_voice_generations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_voice_generations.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert voice generations for their projects"
  ON ugc_voice_generations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_voice_generations.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update voice generations for their projects"
  ON ugc_voice_generations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_voice_generations.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_voice_generations.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete voice generations for their projects"
  ON ugc_voice_generations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_voice_generations.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  );

-- RLS Policies for ugc_generated_videos
CREATE POLICY "Users can view generated videos for their projects"
  ON ugc_generated_videos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_generated_videos.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert generated videos for their projects"
  ON ugc_generated_videos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_generated_videos.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update generated videos for their projects"
  ON ugc_generated_videos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_generated_videos.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_generated_videos.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete generated videos for their projects"
  ON ugc_generated_videos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ugc_video_projects
      WHERE ugc_video_projects.id = ugc_generated_videos.project_id
      AND ugc_video_projects.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ugc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_ugc_video_projects_updated_at
  BEFORE UPDATE ON ugc_video_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();

CREATE TRIGGER update_ugc_voice_generations_updated_at
  BEFORE UPDATE ON ugc_voice_generations
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();

CREATE TRIGGER update_ugc_generated_videos_updated_at
  BEFORE UPDATE ON ugc_generated_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_ugc_updated_at();

