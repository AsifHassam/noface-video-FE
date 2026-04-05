import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "noface.video — create faceless viral videos";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4c1d95 0%, #be185d 50%, #ea580c 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            noface.video
          </p>
          <p
            style={{
              marginTop: 24,
              fontSize: 28,
              fontWeight: 600,
              color: "rgba(255,255,255,0.92)",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Create faceless videos that go viral — TikTok, Shorts & Instagram
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
