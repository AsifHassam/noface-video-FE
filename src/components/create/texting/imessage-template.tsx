"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { MessageBubble } from "./message-bubble";
import { Keyboard } from "./keyboard";
import type { TextingMessage } from "@/app/app/create/texting/script/page";

interface IMessageTemplateProps {
  messages: TextingMessage[];
  contactName: string;
  contactAvatar: string;
  currentTime: number; // Current time in ms
  typingSpeed: number; // characters per second
  messageDelay?: number; // ms between messages
  keepKeyboardOpen?: boolean; // Keep keyboard open full time
  className?: string;
}

export function IMessageTemplate({
  messages,
  contactName,
  contactAvatar,
  currentTime,
  typingSpeed,
  messageDelay = 500,
  keepKeyboardOpen = false,
  className,
}: IMessageTemplateProps) {
  // Calculate which message is currently being typed and how many characters are shown
  const getCurrentMessageState = () => {
    // Helper function to ensure keyboard is shown when keepKeyboardOpen is true
    const getShowKeyboard = (shouldShow: boolean) => {
      return keepKeyboardOpen ? true : shouldShow;
    };
    
    if (messages.length === 0) {
      return {
        messageIndex: -1,
        charsShown: 0,
        isTyping: false,
        showKeyboard: getShowKeyboard(false),
        showSendButton: false,
        messageSent: false,
        showImageAttachment: false,
      };
    }
    
    // If currentTime is 0 or very small, check first message type
    if (currentTime <= 0) {
      const firstMessage = messages[0];
      const needsTyping = firstMessage?.needsTyping !== false;
      return {
        messageIndex: 0,
        charsShown: 0,
        isTyping: needsTyping,
        showTypingIndicator: false,
        showKeyboard: getShowKeyboard(needsTyping), // Only show keyboard if message needs typing (unless keepKeyboardOpen is true)
        showSendButton: false,
        messageSent: false,
        showImageAttachment: false,
      };
    }
    
    let accumulatedTime = 0;
    const SEND_BUTTON_DURATION = 300; // 300ms for send button click animation
    const MESSAGE_APPEAR_DELAY = 150; // 150ms delay before message appears after send
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const needsTyping = message.needsTyping !== false; // Default to true if not specified
      
      if (message.imageUrl) {
        // Image message: show as attachment first, then send, then appear in chat
        const ATTACHMENT_SHOW_TIME = 1000; // Show attachment for 1 second
        const SEND_BUTTON_SHOW_TIME = 500; // Show send button for 500ms before clicking
        const imageDuration = ATTACHMENT_SHOW_TIME + SEND_BUTTON_SHOW_TIME + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
        const messageStartTime = accumulatedTime;
        const attachmentShowTime = messageStartTime + ATTACHMENT_SHOW_TIME;
        const sendButtonShowTime = attachmentShowTime;
        const sendButtonClickTime = sendButtonShowTime + SEND_BUTTON_SHOW_TIME;
        const messageAppearTime = sendButtonClickTime + SEND_BUTTON_DURATION;
        const messageVisibleTime = messageAppearTime + MESSAGE_APPEAR_DELAY;
        
        if (currentTime >= messageStartTime && currentTime < attachmentShowTime) {
          // Show image as attachment (already uploaded)
          return {
            messageIndex: i,
            charsShown: 0,
            isTyping: false,
            showTypingIndicator: false,
            showKeyboard: getShowKeyboard(true),
            showSendButton: false,
            messageSent: false,
            showImageAttachment: true, // Show attachment preview
          };
        }
        
        if (currentTime >= sendButtonShowTime && currentTime < sendButtonClickTime) {
          // Show send button (attachment still visible)
          return {
            messageIndex: i,
            charsShown: 0,
            isTyping: false,
            showTypingIndicator: false,
            showKeyboard: getShowKeyboard(true), // Keep keyboard visible to show send button
            showSendButton: true,
            messageSent: false,
            showImageAttachment: true, // Still show attachment
          };
        }
        
        if (currentTime >= sendButtonClickTime && currentTime < messageVisibleTime) {
          // Send button clicked, message appearing (attachment hidden)
          return {
            messageIndex: i,
            charsShown: 0,
            isTyping: false,
            showTypingIndicator: false,
            showKeyboard: getShowKeyboard(false), // Hide keyboard while message is appearing (unless keepKeyboardOpen is true)
            showSendButton: false,
            messageSent: false,
            showImageAttachment: false, // Hide attachment, message is sending
          };
        }
        
        if (currentTime >= messageVisibleTime) {
          // Message is visible in chat
          accumulatedTime += imageDuration;
          if (i < messages.length - 1) {
            accumulatedTime += messageDelay;
          }
          continue;
        }
      } else if (needsTyping) {
        // User message: typing + send button + appear
        const typingDuration = (message.text.length / typingSpeed) * 1000;
        const messageStartTime = accumulatedTime;
        const typingEndTime = messageStartTime + typingDuration;
        const sendButtonShowTime = typingEndTime;
        const sendButtonClickTime = sendButtonShowTime + 100; // Show button for 100ms before click
        const messageAppearTime = sendButtonClickTime + SEND_BUTTON_DURATION;
        const messageVisibleTime = messageAppearTime + MESSAGE_APPEAR_DELAY;
        
        if (currentTime >= messageStartTime && currentTime < typingEndTime) {
          // Currently typing this message on keyboard
          const elapsed = currentTime - messageStartTime;
          const charsShown = Math.max(0, Math.floor((elapsed / 1000) * typingSpeed));
          return {
            messageIndex: i,
            charsShown: Math.min(charsShown, message.text.length),
            isTyping: true,
            showTypingIndicator: false,
            showKeyboard: getShowKeyboard(true),
            showSendButton: false,
            messageSent: false,
            showImageAttachment: false,
          };
        }
        
        if (currentTime >= typingEndTime && currentTime < sendButtonClickTime) {
          // Show send button (before click)
          return {
            messageIndex: i,
            charsShown: message.text.length,
            isTyping: false,
            showTypingIndicator: false,
            showKeyboard: getShowKeyboard(true), // Keep keyboard visible to show send button
            showSendButton: true,
            messageSent: false,
            showImageAttachment: false,
          };
        }
        
        if (currentTime >= sendButtonClickTime && currentTime < messageAppearTime) {
          // Send button being clicked - hide keyboard while message is appearing
          return {
            messageIndex: i,
            charsShown: message.text.length,
            isTyping: false,
            showTypingIndicator: false,
            showKeyboard: getShowKeyboard(false), // Hide keyboard while message is appearing (unless keepKeyboardOpen is true)
            showSendButton: false,
            messageSent: false,
            showImageAttachment: false,
          };
        }
        
        if (currentTime >= messageVisibleTime) {
          // Message is now visible in bubble
          const delay = i > 0 ? messageDelay : 0;
          const nextMessageStart = messageVisibleTime + delay;
          
          // If this is the last message, show it and hide keyboard
          if (i === messages.length - 1) {
            return {
              messageIndex: i,
              charsShown: message.text.length,
              isTyping: false,
              showTypingIndicator: false,
              showKeyboard: getShowKeyboard(false),
              showSendButton: false,
              messageSent: true,
              showImageAttachment: false,
            };
          }
          
          // Wait for message to be fully displayed before showing keyboard for next message
          // Add a small buffer to ensure message is completely visible
          const MESSAGE_DISPLAY_BUFFER = 300; // Wait 300ms after message appears before showing keyboard
          const keyboardShowTime = messageVisibleTime + MESSAGE_DISPLAY_BUFFER;
          
          if (currentTime < keyboardShowTime) {
            // Message is visible but wait a bit before showing keyboard
            return {
              messageIndex: i,
              charsShown: message.text.length,
              isTyping: false,
              showTypingIndicator: false,
              showKeyboard: getShowKeyboard(false), // Don't show keyboard yet - wait for message to be fully displayed
              showSendButton: false,
              messageSent: true,
              showImageAttachment: false,
            };
          }
          
          if (currentTime < nextMessageStart && i + 1 < messages.length) {
            // Check if next message needs typing
            const nextMessage = messages[i + 1];
            const nextNeedsTyping = nextMessage.needsTyping !== false;
            
            return {
              messageIndex: i,
              charsShown: message.text.length,
              isTyping: false,
              showTypingIndicator: false,
              showKeyboard: getShowKeyboard(nextNeedsTyping), // Show keyboard only if next message needs typing (unless keepKeyboardOpen is true)
              showSendButton: false,
              messageSent: true,
              showImageAttachment: false,
            };
          }
          
          // Move to next message
          accumulatedTime = nextMessageStart;
        } else if (currentTime >= messageAppearTime) {
          // Message is being sent, keyboard still visible but message not yet shown
          return {
            messageIndex: i,
            charsShown: message.text.length,
            isTyping: false,
            showTypingIndicator: false,
            showKeyboard: getShowKeyboard(false), // Hide keyboard while message is appearing (unless keepKeyboardOpen is true)
            showSendButton: false,
            messageSent: false,
            showImageAttachment: false,
          };
        }
      } else {
        // Contact message: 2 second delay before appearing
        const CONTACT_RESPONSE_DELAY = 2000; // 2 second delay before contact responses
        const messageAppearTime = accumulatedTime + CONTACT_RESPONSE_DELAY;
        const messageVisibleTime = messageAppearTime + 300; // Small fade-in animation
        
        if (currentTime < messageAppearTime) {
          // Waiting for 2 second delay - show typing indicator if previous message was sent
          if (i > 0) {
            return {
              messageIndex: i - 1,
              charsShown: messages[i - 1]?.text.length || 0,
              isTyping: false,
              showTypingIndicator: true, // Show typing indicator during delay
              showKeyboard: getShowKeyboard(false),
              showSendButton: false,
              messageSent: true,
              showImageAttachment: false,
            };
          }
          // First message is contact - just wait
          return {
            messageIndex: -1,
            charsShown: 0,
            isTyping: false,
            showTypingIndicator: false,
            showKeyboard: false,
            showSendButton: false,
            messageSent: false,
            showImageAttachment: false,
          };
        }
        
        if (currentTime >= messageVisibleTime) {
          // Message is visible
          const delay = i > 0 ? messageDelay : 0;
          const nextMessageStart = messageVisibleTime + delay;
          
          // If this is the last message, show it and hide keyboard
          if (i === messages.length - 1) {
            return {
              messageIndex: i,
              charsShown: message.text.length,
              isTyping: false,
              showTypingIndicator: false,
              showKeyboard: getShowKeyboard(false),
              showSendButton: false,
              messageSent: true,
              showImageAttachment: false,
            };
          }
          
          if (currentTime < nextMessageStart && i + 1 < messages.length) {
            // Check if next message needs typing
            const nextMessage = messages[i + 1];
            const nextNeedsTyping = nextMessage.needsTyping !== false;
            
            return {
              messageIndex: i,
              charsShown: message.text.length,
              isTyping: false,
              showTypingIndicator: false,
              showKeyboard: getShowKeyboard(nextNeedsTyping), // Show keyboard only if next message needs typing (unless keepKeyboardOpen is true)
              showSendButton: false,
              messageSent: true,
              showImageAttachment: false,
            };
          }
          
          // Move to next message - account for the 2 second delay + appearance time
          accumulatedTime = messageVisibleTime + delay;
        } else {
          // Message is appearing (during fade-in)
          return {
            messageIndex: i,
            charsShown: message.text.length,
            isTyping: false,
            showTypingIndicator: false,
            showKeyboard: false,
            showSendButton: false,
            messageSent: false,
            showImageAttachment: false,
          };
        }
      }
    }
    
    // All messages complete - show last message fully, hide keyboard (unless keepKeyboardOpen is true)
    if (messages.length > 0) {
      return {
        messageIndex: messages.length - 1,
        charsShown: messages[messages.length - 1]?.text.length || 0,
        isTyping: false,
        showKeyboard: getShowKeyboard(false),
        showSendButton: false,
        messageSent: true,
        showImageAttachment: false,
      };
    }
    
    return {
      messageIndex: -1,
      charsShown: 0,
      isTyping: false,
      showKeyboard: getShowKeyboard(false),
      showSendButton: false,
      messageSent: false,
      showImageAttachment: false,
    };
  };

  const state = getCurrentMessageState();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Show messages that have been sent or are contact messages appearing instantly
  const visibleMessages = messages.filter((message, index) => {
    if (state.messageIndex < 0) return false;
    if (index < state.messageIndex) return true; // Previous messages are always visible
    
    // If this is the last message and we've reached it, always show it
    if (index === messages.length - 1 && state.messageIndex >= messages.length - 1 && state.messageSent) {
      return true;
    }
    
    if (index === state.messageIndex) {
      // Current message: show if sent OR if it's a contact message (appears instantly)
      const needsTyping = message.needsTyping !== false;
      if (!needsTyping) {
        // Contact messages: check if 2 second delay + appearance time has passed
        // Calculate the actual appear time based on accumulated time from previous messages
        let accumulatedTime = 0;
        for (let i = 0; i < index; i++) {
          const prevMsg = messages[i];
          const prevNeedsTyping = prevMsg.needsTyping !== false;
          if (prevNeedsTyping) {
            const typingDuration = (prevMsg.text.length / typingSpeed) * 1000;
            const SEND_BUTTON_DURATION = 300;
            const MESSAGE_APPEAR_DELAY = 150;
            accumulatedTime += typingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
            if (i > 0) accumulatedTime += messageDelay || 0;
          } else {
            const CONTACT_RESPONSE_DELAY = 2000;
            accumulatedTime += CONTACT_RESPONSE_DELAY + 300;
            if (i > 0) accumulatedTime += messageDelay || 0;
          }
        }
        const CONTACT_RESPONSE_DELAY = 2000;
        const messageAppearTime = accumulatedTime + CONTACT_RESPONSE_DELAY;
        return currentTime >= messageAppearTime + 300; // 2s delay + 300ms appearance
      }
      return state.messageSent; // User messages only if sent
    }
    return false;
  });
  
  const currentMessage = state.messageIndex >= 0 ? messages[state.messageIndex] : null;
  const currentTypingText = currentMessage && state.isTyping && !state.messageSent && (currentMessage.needsTyping !== false)
    ? currentMessage.text.slice(0, state.charsShown)
    : "";

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // When new message appears, scroll to bottom
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        // Use scrollTop to ensure we're at the bottom
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    };
    
    // Use requestAnimationFrame for immediate scroll
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
    
    // Also scroll after delays to ensure it happens
    const timeout1 = setTimeout(scrollToBottom, 10);
    const timeout2 = setTimeout(scrollToBottom, 50);
    const timeout3 = setTimeout(scrollToBottom, 100);
    const timeout4 = setTimeout(scrollToBottom, 200); // Extra delay for contact messages
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      clearTimeout(timeout4);
    };
  }, [visibleMessages.length, state.messageSent, currentTime]);
  
  // Special scroll for contact messages - scroll when they become visible
  useEffect(() => {
    // Check if the latest visible message is a contact message
    if (visibleMessages.length > 0) {
      const latestMessage = visibleMessages[visibleMessages.length - 1];
      if (latestMessage.sender === 'contact') {
        const scrollToBottom = () => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        };
        
        // Scroll immediately when contact message appears
        requestAnimationFrame(() => {
          scrollToBottom();
          requestAnimationFrame(scrollToBottom);
        });
        
        // Also scroll after delays to ensure it's visible
        const timeout1 = setTimeout(scrollToBottom, 10);
        const timeout2 = setTimeout(scrollToBottom, 50);
        const timeout3 = setTimeout(scrollToBottom, 100);
        const timeout4 = setTimeout(scrollToBottom, 250); // After contact message animation
        
        return () => {
          clearTimeout(timeout1);
          clearTimeout(timeout2);
          clearTimeout(timeout3);
          clearTimeout(timeout4);
        };
      }
    }
  }, [visibleMessages, currentTime]);
  
  // Scroll when keyboard opens/closes - ensure latest message is visible
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    
    // Scroll immediately when keyboard state changes (both open and close)
    const scrollToBottom = () => {
      const container = messagesContainerRef.current;
      if (container) {
        // Force scroll to bottom
        container.scrollTop = container.scrollHeight;
      }
    };
    
    // Use requestAnimationFrame for immediate scroll on next paint
    requestAnimationFrame(() => {
      scrollToBottom();
      // Also scroll again after a frame to ensure it sticks
      requestAnimationFrame(scrollToBottom);
    });
    
    // Also scroll after delays to account for layout recalculation
    // Multiple timeouts to catch different stages of the animation
    const timeout1 = setTimeout(scrollToBottom, 10);
    const timeout2 = setTimeout(scrollToBottom, 50);
    const timeout3 = setTimeout(scrollToBottom, 100);
    const timeout4 = setTimeout(scrollToBottom, 200); // For keyboard animation completion
    const timeout5 = setTimeout(scrollToBottom, 300); // Extra safety net
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      clearTimeout(timeout4);
      clearTimeout(timeout5);
    };
  }, [state.showKeyboard]);

  // Get current time for status bar
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const statusBarTime = `${hours > 12 ? hours - 12 : hours}:${minutes.toString().padStart(2, "0")}`;
  const timeString = `${hours > 12 ? hours - 12 : hours}:${minutes.toString().padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;

  // Calculate read timestamp for user messages (1 second after message appears)
  const getReadTimestamp = (message: TextingMessage, messageIndex: number): string | undefined => {
    if (message.sender !== 'user') return undefined;
    
    // Calculate when message was read (1 second after it appears)
    const SEND_BUTTON_DURATION = 300;
    const MESSAGE_APPEAR_DELAY = 150;
    const READ_DELAY = 1000; // 1 second after message appears
    
    let messageAppearTime = message.timestamp;
    if (message.needsTyping !== false) {
      const typingDuration = (message.text.length / typingSpeed) * 1000;
      messageAppearTime += typingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
    }
    
    const readTime = messageAppearTime + READ_DELAY;
    
    // Only show read timestamp if current time has passed the read time
    if (currentTime >= readTime) {
      // Use the current time to calculate the read timestamp
      // Add the read time offset to the base time
      const readDate = new Date(now.getTime() + (readTime - currentTime));
      const readHours = readDate.getHours();
      const readMinutes = readDate.getMinutes();
      const readTimeString = `${readHours > 12 ? readHours - 12 : readHours}:${readMinutes.toString().padStart(2, "0")} ${readHours >= 12 ? "PM" : "AM"}`;
      return `Read: ${readTimeString}`;
    }
    
    return undefined;
  };

  return (
    <div
      className={cn(
        "relative w-full bg-white overflow-hidden",
        "aspect-[9/16] max-w-md mx-auto",
        className
      )}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      {/* Status Bar */}
      <div className="absolute top-0 left-0 right-0 h-[44px] bg-white flex items-center justify-between px-4 z-50">
        {/* Time on left */}
        <div className="flex items-center">
          <span className="text-black font-semibold text-[17px] leading-none">{statusBarTime}</span>
        </div>
        
        {/* Connectivity icons on right */}
        <div className="flex items-center gap-[4px]">
          {/* Signal bars - three vertical bars of increasing height */}
          <div className="flex gap-[2px] items-end h-[11px]">
            <div className="w-[3px] h-[3px] bg-black rounded-[1px]" />
            <div className="w-[3px] h-[5px] bg-black rounded-[1px]" />
            <div className="w-[3px] h-[7px] bg-black rounded-[1px]" />
          </div>
          {/* Wi-Fi icon */}
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
            <path d="M1.5 7.5L7.5 1.5L13.5 7.5" stroke="black" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.5 5.5L7.5 2.5L10.5 5.5" stroke="black" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* Battery icon */}
          <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
            <rect x="0.5" y="2.5" width="19" height="7" rx="1" stroke="black" strokeWidth="1" fill="none" />
            <rect x="20.5" y="4.5" width="1.5" height="3" rx="0.5" fill="black" />
            <rect x="2.5" y="4.5" width="15" height="3" fill="black" />
          </svg>
        </div>
      </div>

      {/* Contact Header */}
      <div className="absolute top-[44px] left-0 right-0 min-h-[60px] bg-white border-b border-gray-200 flex items-center justify-center px-4 py-2 z-40">
        {/* Back button */}
        <button className="absolute left-4 text-[#007AFF] top-1/2 transform -translate-y-1/2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M18 14L10 7L18 0"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        
        {/* Contact info - centered */}
        <div className="flex flex-col items-center gap-[2px] pb-2">
          <div className="w-[36px] h-[36px] rounded-full bg-[#007AFF] flex items-center justify-center text-white text-[15px] font-semibold overflow-hidden relative">
            {contactAvatar.startsWith('http') || contactAvatar.startsWith('/') ? (
              <img 
                src={contactAvatar} 
                alt={contactName}
                className="w-full h-full object-cover rounded-full"
              />
            ) : contactAvatar.length <= 2 && /^[\p{Emoji}]$/u.test(contactAvatar) ? (
              contactAvatar
            ) : (
              contactName.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex items-center gap-[4px]">
            <h2 className="text-[13px] font-semibold text-gray-900 leading-none">{contactName}</h2>
            <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="text-[#007AFF]">
              <path d="M2 2L6 6L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        
        {/* Video call icon */}
        <button className="absolute right-4 text-[#007AFF] w-8 h-8 flex items-center justify-center top-1/2 transform -translate-y-1/2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M17 7L21 5V15L17 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className={cn(
          "absolute top-[104px] left-0 right-0 bg-white overflow-y-auto",
          state.showKeyboard ? "bottom-[216px]" : "bottom-[50px]",
          "[&::-webkit-scrollbar]:hidden" // Hide scrollbar in WebKit browsers (Chrome, Safari)
        )}
        style={{
          scrollBehavior: 'auto', // Use 'auto' for instant scroll, smoother UX
          transition: 'bottom 0.2s ease-out', // Smooth transition when keyboard opens/closes
          // Hide scrollbar but keep scroll functionality
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE and Edge
        }}
      >
        {/* Service label and timestamp */}
        <div className="text-center pt-4 pb-2">
          <div className="text-[13px] text-gray-400 font-normal">iMessage</div>
          <div className="text-[13px] text-gray-400 font-normal mt-0.5">Today {timeString}</div>
        </div>
        
        <div className="px-4 py-2 space-y-1 pb-4">
          {visibleMessages.map((message, index) => {
            const messageIndex = messages.findIndex(m => m.id === message.id);
            return (
              <MessageBubble
                key={message.id}
                text={message.text}
                sender={message.sender}
                isTyping={false}
                showTypingIndicator={false}
                imageUrl={message.imageUrl}
                readTimestamp={getReadTimestamp(message, messageIndex)}
              />
            );
          })}
          {/* Invisible element at the bottom to scroll to - with extra padding */}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Message Input Area - only show when keyboard is hidden */}
      {!state.showKeyboard && (
        <div className="absolute bottom-0 left-0 right-0 h-[50px] bg-white border-t border-gray-200 flex items-center px-2 gap-2">
          {/* Input field */}
          <div className="flex-1 bg-white rounded-[10px] px-4 py-2.5 min-h-[36px] flex items-center border border-gray-200">
            <span className="text-[17px] text-gray-900 leading-tight">
              Message
              <span className="inline-block w-[2px] h-4 bg-[#007AFF] ml-1 animate-pulse" />
            </span>
          </div>
          {/* Send button - circular blue with white upward arrow */}
          <button className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L10 18M10 2L2 10M10 2L18 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Keyboard - show when typing */}
      {state.showKeyboard && (
        <div className="absolute bottom-0 left-0 right-0 bg-white">
          {/* Image Attachment Preview */}
          {state.showImageAttachment && currentMessage?.imageUrl && (
            <div className="bg-white border-t border-gray-200 px-2 pt-2 pb-1">
              <div className="relative inline-block">
                {/* Image with rounded corners - positioned in upper left */}
                <div className="relative w-[140px] h-[140px] rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={currentMessage.imageUrl}
                    alt="Attachment"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {/* X button in upper right corner - white circle with black X */}
                  <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-md">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Input field showing current text */}
          <div className="bg-white border-t border-gray-200 px-2 py-1.5">
            <div className="flex items-center gap-2">
              {/* Input field with text */}
              <div className="flex-1 bg-white rounded-[10px] px-4 py-2.5 min-h-[36px] flex items-center border border-gray-200">
                <span className={cn(
                  "text-[17px] leading-tight",
                  state.showImageAttachment && currentMessage?.imageUrl
                    ? "text-gray-500"
                    : "text-gray-900"
                )}>
                  {state.showImageAttachment && currentMessage?.imageUrl 
                    ? "Add comment or Send"
                    : currentTypingText || "Message"}
                  {state.isTyping && !state.showImageAttachment && (
                    <span className="inline-block w-[2px] h-4 bg-[#007AFF] ml-0.5 animate-pulse" />
                  )}
                </span>
              </div>
              {/* Send button - green when image attached, blue otherwise */}
              <button
                onClick={() => {
                  // Handle send
                }}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  state.showImageAttachment && currentMessage?.imageUrl
                    ? "bg-green-500"
                    : "bg-[#007AFF]"
                )}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L10 18M10 2L2 10M10 2L18 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <Keyboard
            currentText={currentTypingText}
            isTyping={state.isTyping}
            showSendButton={state.showSendButton}
          />
        </div>
      )}
    </div>
  );
}

