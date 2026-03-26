-- Automation rules, runs, Instagram connections + RLS
-- Idempotent helpers

-- ---------------------------------------------------------------------------
-- automation_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.video_templates (id) ON DELETE SET NULL,
  name TEXT,
  niche_prompt TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  schedule JSONB NOT NULL DEFAULT '{"time":"18:00","days":[1,2,3,4,5]}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  project_type TEXT,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON public.automation_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_next_run
  ON public.automation_rules (enabled, next_run_at)
  WHERE enabled = true;

-- ---------------------------------------------------------------------------
-- automation_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'script_ready', 'rendering', 'ready', 'posting', 'posted', 'failed'
    )),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id UUID,
  render_job_id UUID,
  video_url TEXT,
  instagram_media_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON public.automation_runs (rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status_scheduled
  ON public.automation_runs (status, scheduled_for);

-- One run per rule per UTC day (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_rule_day_utc
  ON public.automation_runs (rule_id, ((scheduled_for AT TIME ZONE 'UTC')::date));

-- ---------------------------------------------------------------------------
-- user_instagram_connections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_instagram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  ig_user_id TEXT,
  page_id TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_ig_connections_user ON public.user_instagram_connections (user_id);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.automation_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_automation_rules_updated ON public.automation_rules;
CREATE TRIGGER tr_automation_rules_updated
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.automation_touch_updated_at();

DROP TRIGGER IF EXISTS tr_automation_runs_updated ON public.automation_runs;
CREATE TRIGGER tr_automation_runs_updated
  BEFORE UPDATE ON public.automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.automation_touch_updated_at();

DROP TRIGGER IF EXISTS tr_user_ig_updated ON public.user_instagram_connections;
CREATE TRIGGER tr_user_ig_updated
  BEFORE UPDATE ON public.user_instagram_connections
  FOR EACH ROW EXECUTE FUNCTION public.automation_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPC: claim due rules with SKIP LOCKED (service role / definer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_due_automation_rules(batch_size int DEFAULT 5)
RETURNS SETOF public.automation_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ar.*
  FROM public.automation_rules ar
  WHERE ar.enabled = true
    AND ar.next_run_at IS NOT NULL
    AND ar.next_run_at <= now()
  ORDER BY ar.next_run_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_automation_rules(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_automation_rules(int) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_instagram_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own automation_rules" ON public.automation_rules;
CREATE POLICY "Users manage own automation_rules"
  ON public.automation_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own automation_runs" ON public.automation_runs;
CREATE POLICY "Users read own automation_runs"
  ON public.automation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_rules r
      WHERE r.id = automation_runs.rule_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own instagram connection" ON public.user_instagram_connections;
CREATE POLICY "Users manage own instagram connection"
  ON public.user_instagram_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.automation_rules IS 'Scheduled video automation (template + niche + schedule)';
COMMENT ON TABLE public.automation_runs IS 'Per-run status for automation pipeline';
COMMENT ON TABLE public.user_instagram_connections IS 'Meta/Instagram long-lived tokens (server-side only in app)';
