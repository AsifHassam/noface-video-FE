-- Manual automation script queue:
-- user writes scripts, schedules creation time and post time.

CREATE TABLE IF NOT EXISTS public.automation_script_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.video_templates (id) ON DELETE CASCADE,
  project_type TEXT,
  script TEXT NOT NULL,
  instagram_caption TEXT,
  create_at TIMESTAMPTZ NOT NULL,
  post_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued_create'
    CHECK (status IN (
      'queued_create', 'creating', 'rendering', 'ready_to_post', 'posting', 'posted', 'failed'
    )),
  project_id UUID,
  render_job_id UUID,
  video_url TEXT,
  instagram_media_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_queue_user_created
  ON public.automation_script_queue (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_script_queue_create_due
  ON public.automation_script_queue (status, create_at);

CREATE INDEX IF NOT EXISTS idx_script_queue_post_due
  ON public.automation_script_queue (status, post_at);

DROP TRIGGER IF EXISTS tr_script_queue_updated ON public.automation_script_queue;
CREATE TRIGGER tr_script_queue_updated
  BEFORE UPDATE ON public.automation_script_queue
  FOR EACH ROW EXECUTE FUNCTION public.automation_touch_updated_at();

CREATE OR REPLACE FUNCTION public.claim_due_script_queue_creates(batch_size int DEFAULT 5)
RETURNS SETOF public.automation_script_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT q.*
  FROM public.automation_script_queue q
  WHERE q.status = 'queued_create'
    AND q.create_at <= now()
  ORDER BY q.create_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_script_queue_creates(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_script_queue_creates(int) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_script_queue_posts(batch_size int DEFAULT 5)
RETURNS SETOF public.automation_script_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT q.*
  FROM public.automation_script_queue q
  WHERE q.status IN ('rendering', 'ready_to_post')
    AND q.post_at <= now()
  ORDER BY q.post_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_script_queue_posts(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_script_queue_posts(int) TO service_role;

ALTER TABLE public.automation_script_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own script queue" ON public.automation_script_queue;
CREATE POLICY "Users manage own script queue"
  ON public.automation_script_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.automation_script_queue IS
  'Manual queue of scripts with separate creation and posting times.';
