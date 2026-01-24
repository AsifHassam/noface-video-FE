"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  text: string;
  sender: "user" | "contact";
  isTyping?: boolean;
  showTypingIndicator?: boolean;
  readTimestamp?: string; // "Read: 3:00 PM" format
  imageUrl?: string; // Optional image URL for image messages
  className?: string;
}

export function MessageBubble({
  text,
  sender,
  isTyping = false,
  showTypingIndicator = false,
  readTimestamp,
  imageUrl,
  className,
}: MessageBubbleProps) {
  const isUser = sender === "user";

  if (showTypingIndicator) {
    return (
      <div
        className={cn(
          "flex items-end gap-2",
          isUser ? "justify-end" : "justify-start",
          className
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2 max-w-[75%]",
            isUser
              ? "bg-[#007AFF] text-white rounded-br-sm"
              : "bg-[#E9E9EB] text-black rounded-bl-sm"
          )}
        >
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-current animate-bounce opacity-60" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 rounded-full bg-current animate-bounce opacity-60" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 rounded-full bg-current animate-bounce opacity-60" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        isUser ? "items-end" : "items-start",
        className
      )}
    >
      <div
        className={cn(
          "px-[12px] py-[6px] max-w-[75%] break-words",
          isUser
            ? "bg-[#007AFF] text-white rounded-[17.5px] rounded-br-[4px]"
            : "bg-[#E9E9EB] text-black rounded-[17.5px] rounded-bl-[4px]",
          isTyping && "opacity-50",
          imageUrl && "p-0 overflow-hidden" // Remove padding for images
        )}
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        {imageUrl && (
          <div className="relative">
            <img
              src={imageUrl}
              alt="Message image"
              className="max-w-full h-auto rounded-t-[17.5px]"
              style={{
                maxWidth: '250px',
                maxHeight: '300px',
                objectFit: 'contain',
              }}
              onError={(e) => {
                // Fallback if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            {text && (
              <div className={cn(
                "px-[12px] py-[6px]",
                isUser ? "text-white" : "text-black"
              )}>
                <p className="text-[17px] leading-[1.38] whitespace-pre-wrap" style={{ wordBreak: 'break-word' }}>{text}</p>
              </div>
            )}
          </div>
        )}
        {!imageUrl && text && (
          <p className="text-[17px] leading-[1.38] whitespace-pre-wrap" style={{ wordBreak: 'break-word' }}>{text}</p>
        )}
      </div>
      {isUser && readTimestamp && (
        <div className="text-[11px] text-gray-400 mt-0.5 mr-1">
          {readTimestamp}
        </div>
      )}
    </div>
  );
}

