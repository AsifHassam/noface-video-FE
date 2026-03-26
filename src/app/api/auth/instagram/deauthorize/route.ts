import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SignedPayload = {
  user_id?: string;
};

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
}

function parseAndVerifySignedRequest(
  signedRequest: string,
  appSecret?: string
): { valid: boolean; payload: SignedPayload | null } {
  const [encodedSig, encodedPayload] = signedRequest.split(".", 2);
  if (!encodedSig || !encodedPayload) {
    return { valid: false, payload: null };
  }

  let payload: SignedPayload | null = null;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as SignedPayload;
  } catch {
    return { valid: false, payload: null };
  }

  if (!appSecret) {
    return { valid: true, payload };
  }

  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();
  const provided = decodeBase64Url(encodedSig);
  const valid = provided.length === expected.length && Buffer.compare(provided, expected) === 0;

  return { valid, payload: valid ? payload : null };
}

async function extractSignedRequest(req: NextRequest): Promise<string | null> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    return (form.get("signed_request") as string) || null;
  }
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as { signed_request?: string };
    return body.signed_request || null;
  }
  return req.nextUrl.searchParams.get("signed_request");
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "instagram-deauthorize" });
}

export async function POST(req: NextRequest) {
  try {
    const signedRequest = await extractSignedRequest(req);
    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    const appSecret = process.env.META_APP_SECRET;
    const { valid, payload } = parseAndVerifySignedRequest(signedRequest, appSecret);
    if (!valid || !payload?.user_id) {
      return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Best effort cleanup of stored IG connection for this user id.
    if (serviceKey && supabaseUrl) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      await supabaseAdmin
        .from("user_instagram_connections")
        .delete()
        .eq("ig_user_id", String(payload.user_id));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[instagram/deauthorize]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "deauthorize failed" },
      { status: 500 }
    );
  }
}
