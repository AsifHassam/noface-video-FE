-- Idempotency for Instagram publish: one claim per queue row per attempt.
-- Stale posting rows (lock held too long) can be reclaimed by cron.

ALTER TABLE public.automation_script_queue
  ADD COLUMN IF NOT EXISTS publish_attempt_id UUID,
  ADD COLUMN IF NOT EXISTS publish_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.automation_script_queue.publish_attempt_id IS
  'UUID set when we atomically claim posting; prevents concurrent double-post.';
COMMENT ON COLUMN public.automation_script_queue.publish_started_at IS
  'When publish was claimed; used for stale lock recovery.';

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
  WHERE q.post_at <= now()
    AND (
      q.status IN ('rendering', 'ready_to_post')
      OR (
        q.status = 'posting'
        AND q.publish_started_at IS NOT NULL
        AND q.publish_started_at < (now() - interval '35 minutes')
        AND (q.instagram_media_id IS NULL OR btrim(q.instagram_media_id) = '')
      )
    )
  ORDER BY q.post_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$;
