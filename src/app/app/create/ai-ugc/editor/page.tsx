"use client";

import { AIUGCVideoEditor } from "@/components/create/ai-ugc-video-editor";
import { useSearchParams } from "next/navigation";

export default function AIUGCEditorPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  
  return <AIUGCVideoEditor projectId={projectId || undefined} />;
}

