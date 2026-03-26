-- Optional JSON: { includes: {...}, snapshots: {...} } for selective template apply
ALTER TABLE public.video_templates
  ADD COLUMN IF NOT EXISTS template_extras JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.video_templates.template_extras IS 'includes flags + snapshots for fields not in row columns (image overlays, slide-in, etc.)';
