"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface KeyboardProps {
  currentText: string;
  isTyping: boolean;
  showSendButton: boolean;
  onSendClick?: () => void;
  className?: string;
}

// Map characters to keyboard keys
const getKeyForChar = (char: string): string => {
  const upperChar = char.toUpperCase();
  if (/[A-Z]/.test(upperChar)) return upperChar;
  if (/[0-9]/.test(char)) return char;
  if (char === ' ') return 'SPACE';
  if (char === '.') return '.';
  if (char === ',') return ',';
  if (char === '!') return '!';
  if (char === '?') return '?';
  if (char === "'") return "'";
  if (char === '"') return '"';
  return upperChar;
};

export function Keyboard({
  currentText,
  isTyping,
  showSendButton,
  onSendClick,
  className,
}: KeyboardProps) {
  // Get the last character typed to highlight that key
  const lastChar = currentText.length > 0 ? currentText[currentText.length - 1] : null;
  const lastKey = lastChar ? getKeyForChar(lastChar) : null;

  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  return (
    <div className={cn("bg-[#C7CCD1]", className)}>
      {/* Keyboard Keys */}
      <div className="p-1.5 space-y-1.5">
        {/* First row: Q-P */}
        <div className="flex justify-center gap-1.5">
          {keyboardRows[0].map((key) => {
            const isActive = isTyping && lastKey === key;
            return (
              <div
                key={key}
                className={cn(
                  "h-[42px] rounded-[5px] bg-white flex items-center justify-center text-[22px] font-light text-gray-900 transition-all duration-75 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]",
                  isActive && "bg-[#007AFF] text-white scale-105 shadow-md"
                )}
                style={{
                  minWidth: '32px',
                  flex: '1 1 0',
                  maxWidth: '10%',
                }}
              >
                {key}
              </div>
            );
          })}
        </div>

        {/* Second row: A-L (slightly indented) */}
        <div className="flex justify-center gap-1.5" style={{ paddingLeft: '3%' }}>
          {keyboardRows[1].map((key) => {
            const isActive = isTyping && lastKey === key;
            return (
              <div
                key={key}
                className={cn(
                  "h-[42px] rounded-[5px] bg-white flex items-center justify-center text-[22px] font-light text-gray-900 transition-all duration-75 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]",
                  isActive && "bg-[#007AFF] text-white scale-105 shadow-md"
                )}
                style={{
                  minWidth: '32px',
                  flex: '1 1 0',
                  maxWidth: '10%',
                }}
              >
                {key}
              </div>
            );
          })}
        </div>

        {/* Third row: Shift, Z-M, Backspace */}
        <div className="flex justify-center gap-1.5 items-center">
          {/* Shift key - wider, gray with black arrow */}
          <div className="h-[42px] rounded-[5px] bg-[#ACB0B5] flex items-center justify-center shadow-[0_1px_0_0_rgba(0,0,0,0.1)]" style={{ minWidth: '48px', flex: '0 0 auto' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 3L3 10H7V17H13V10H17L10 3Z" fill="#000000" />
            </svg>
          </div>
          {/* Z-M keys */}
          {keyboardRows[2].map((key) => {
            const isActive = isTyping && lastKey === key;
            return (
              <div
                key={key}
                className={cn(
                  "h-[42px] rounded-[5px] bg-white flex items-center justify-center text-[22px] font-light text-gray-900 transition-all duration-75 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]",
                  isActive && "bg-[#007AFF] text-white scale-105 shadow-md"
                )}
                style={{
                  minWidth: '32px',
                  flex: '1 1 0',
                  maxWidth: '10%',
                }}
              >
                {key}
              </div>
            );
          })}
          {/* Backspace key - wider, gray with black icon */}
          <div className="h-[42px] rounded-[5px] bg-[#ACB0B5] flex items-center justify-center shadow-[0_1px_0_0_rgba(0,0,0,0.1)]" style={{ minWidth: '48px', flex: '0 0 auto' }}>
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <path
                d="M21 8L3 8M3 8L8 3M3 8L8 13"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M1 3L1 13"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        
        {/* Bottom row: 123, Emoji, Space, Return, Mic */}
        <div className="flex justify-center gap-1.5 items-center">
          {/* 123 key - wider, gray with black text */}
          <div className="h-[42px] rounded-[5px] bg-[#ACB0B5] flex items-center justify-center shadow-[0_1px_0_0_rgba(0,0,0,0.1)]" style={{ minWidth: '48px', flex: '0 0 auto' }}>
            <span className="text-[15px] font-normal text-gray-900">123</span>
          </div>
          
          {/* Emoji key - wider, gray with black icon */}
          <div className="h-[42px] rounded-[5px] bg-[#ACB0B5] flex items-center justify-center shadow-[0_1px_0_0_rgba(0,0,0,0.1)]" style={{ minWidth: '48px', flex: '0 0 auto' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="#000000" strokeWidth="1.5" fill="none" />
              <circle cx="7" cy="8" r="1" fill="#000000" />
              <circle cx="13" cy="8" r="1" fill="#000000" />
              <path
                d="M7 13C7 13 8.5 15 10 15C11.5 15 13 13 13 13"
                stroke="#000000"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          
          {/* Space bar - no text, just blank, long */}
          <div
            className={cn(
              "h-[42px] flex-1 rounded-[5px] bg-white transition-all duration-75 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]",
              isTyping && lastKey === 'SPACE' && "bg-[#007AFF] scale-105 shadow-md"
            )}
          />
          
          {/* Return key - wider, gray with black text "return" */}
          <div className="h-[42px] rounded-[5px] bg-[#ACB0B5] flex items-center justify-center shadow-[0_1px_0_0_rgba(0,0,0,0.1)]" style={{ minWidth: '48px', flex: '0 0 auto' }}>
            <span className="text-[15px] font-normal text-gray-900">return</span>
          </div>
          
          {/* Mic key - wider, gray with black icon */}
          <div className="h-[42px] rounded-[5px] bg-[#ACB0B5] flex items-center justify-center shadow-[0_1px_0_0_rgba(0,0,0,0.1)]" style={{ minWidth: '48px', flex: '0 0 auto' }}>
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
              <path
                d="M9 1V11M9 11C11.2091 11 13 9.20914 13 7V4C13 1.79086 11.2091 0 9 0C6.79086 0 5 1.79086 5 4V7C5 9.20914 6.79086 11 9 11Z"
                stroke="#000000"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 10V12C3 15.3137 5.68629 18 9 18C12.3137 18 15 15.3137 15 12V10"
                stroke="#000000"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line x1="9" y1="18" x2="9" y2="21" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          
          {/* Send button (replaces mic when ready to send) - circular blue with white upward arrow */}
          {showSendButton && (
            <button
              onClick={onSendClick}
              className={cn(
                "h-[42px] w-[42px] rounded-full bg-[#007AFF] text-white flex items-center justify-center transition-all duration-200 active:scale-95 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]",
                "ml-1.5"
              )}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 2L10 18M10 2L2 10M10 2L18 10" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

