"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type RedditPostOverlayProps = {
  title: string;
  username?: string;
  show: boolean;
  startMs: number;
  endMs: number;
  currentMs: number;
};

export const RedditPostOverlay = ({
  title,
  username = "The Reddit Story Teller Guy",
  show,
  startMs,
  endMs,
  currentMs,
}: RedditPostOverlayProps) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!show || currentMs < startMs || currentMs > endMs) {
      setOpacity(0);
      return;
    }

    // Calculate fade in/out
    const totalDuration = endMs - startMs;
    const elapsed = currentMs - startMs;
    const fadeInDuration = 300; // 300ms fade in
    const fadeOutDuration = 500; // 500ms fade out before end
    const fadeOutStart = totalDuration - fadeOutDuration;

    if (elapsed < fadeInDuration) {
      // Fade in
      setOpacity(elapsed / fadeInDuration);
    } else if (elapsed > fadeOutStart) {
      // Fade out
      const fadeOutProgress = (elapsed - fadeOutStart) / fadeOutDuration;
      setOpacity(1 - fadeOutProgress);
    } else {
      // Fully visible
      setOpacity(1);
    }
  }, [show, startMs, endMs, currentMs]);

  if (!show || opacity === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
      style={{
        opacity,
        transition: "opacity 0.1s ease-out",
      }}
    >
      {/* Reddit Post Card */}
      <div className="w-[90%] max-w-[500px] bg-white rounded-2xl shadow-2xl p-4 mx-4">
        {/* Profile Header */}
        <div className="flex items-center gap-3 mb-3">
          {/* Profile Picture */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm">
            {username.charAt(0).toUpperCase()}
          </div>
          
          {/* Username and Verified Badge */}
          <div className="flex items-center gap-2 flex-1">
            <span className="font-semibold text-sm text-gray-900">{username}</span>
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs text-gray-500">r/stories</span>
          </div>
        </div>

        {/* Engagement Icons Row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
            <span className="text-xs">💚</span>
          </div>
          <div className="w-5 h-5 rounded bg-yellow-500/20 flex items-center justify-center">
            <span className="text-xs">⭐</span>
          </div>
          <div className="w-5 h-5 rounded bg-yellow-500/20 flex items-center justify-center">
            <span className="text-xs">💎</span>
          </div>
          <div className="w-5 h-5 rounded bg-yellow-500/20 flex items-center justify-center">
            <span className="text-xs">🪙</span>
          </div>
          <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center">
            <span className="text-xs">🎁</span>
          </div>
        </div>

        {/* Title Text */}
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900 leading-tight">
            {title}
          </h2>
        </div>

        {/* Engagement Metrics */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span>❤️</span>
            <span>99+</span>
          </div>
          <div className="flex items-center gap-1">
            <span>💬</span>
            <span>99+</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🔗</span>
            <span>Share</span>
          </div>
        </div>
      </div>
    </div>
  );
};

