-- Optional slide-in animation for image overlays (editor + final render metadata)
ALTER TABLE public.image_overlays
  ADD COLUMN IF NOT EXISTS slide_in_from text;

ALTER TABLE public.image_overlays
  ADD COLUMN IF NOT EXISTS slide_in_duration_ms integer;

COMMENT ON COLUMN public.image_overlays.slide_in_from IS 'left | right — slide into frame when overlay starts';
COMMENT ON COLUMN public.image_overlays.slide_in_duration_ms IS 'Slide duration in ms (default 400 in app)';
