-- When create_at / post_at tie, process in order rows were added (FIFO).

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
  ORDER BY q.create_at ASC, q.created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$;

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
  ORDER BY q.post_at ASC, q.created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$;
