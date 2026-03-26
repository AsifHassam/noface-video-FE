import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const remotionRequestHeaders = (automationSecret: string): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${automationSecret}`,
  // Required for ngrok free domains to bypass the browser warning/interstitial page.
  "ngrok-skip-browser-warning": "true",
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const xCron = req.headers.get("x-cron-secret") || "";

  if (!cronSecret || (bearer !== cronSecret && xCron !== cronSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const remotionUrl = (Deno.env.get("REMOTION_SERVER_URL") || "").replace(/\/$/, "");
  const automationSecret = Deno.env.get("AUTOMATION_API_SECRET") || "";

  if (!remotionUrl || !automationSecret) {
    return new Response(
      JSON.stringify({
        error: "Missing REMOTION_SERVER_URL or AUTOMATION_API_SECRET",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: createQueue, error: createErr } = await supabase.rpc(
    "claim_due_script_queue_creates",
    { batch_size: 8 }
  );
  if (createErr) {
    console.error("claim_due_script_queue_creates", createErr);
    return new Response(JSON.stringify({ error: createErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: postQueue, error: postErr } = await supabase.rpc(
    "claim_due_script_queue_posts",
    { batch_size: 8 }
  );
  if (postErr) {
    console.error("claim_due_script_queue_posts", postErr);
    return new Response(JSON.stringify({ error: postErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const creates = (createQueue || []) as { id: string }[];
  const posts = (postQueue || []) as { id: string }[];
  const results: { task: string; id: string; ok: boolean; detail?: string }[] = [];

  for (const item of creates) {
    try {
      const res = await fetch(`${remotionUrl}/api/automations/script-queue/process-create`, {
        method: "POST",
        headers: remotionRequestHeaders(automationSecret),
        body: JSON.stringify({ queueItemId: item.id }),
      });
      const body = await res.text();
      results.push({
        task: "script-queue-create",
        id: item.id,
        ok: res.ok,
        detail: body.slice(0, 500),
      });
    } catch (e) {
      results.push({
        task: "script-queue-create",
        id: item.id,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  for (const item of posts) {
    try {
      const res = await fetch(`${remotionUrl}/api/automations/script-queue/process-post`, {
        method: "POST",
        headers: remotionRequestHeaders(automationSecret),
        body: JSON.stringify({ queueItemId: item.id }),
      });
      const body = await res.text();
      results.push({
        task: "script-queue-post",
        id: item.id,
        ok: res.ok,
        detail: body.slice(0, 500),
      });
    } catch (e) {
      results.push({
        task: "script-queue-post",
        id: item.id,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return new Response(
    JSON.stringify({
      processedCreates: creates.length,
      processedPosts: posts.length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
