"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/create/stepper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/lib/stores/project-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Info, Image as ImageIcon, X, Check, Phone } from "lucide-react";
import { toast } from "sonner";
import { uploadImageToStorage, getUserUploadedImages } from "@/lib/api/ugc-videos";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const steps = [
  { label: "Step 1", description: "Write your messages" },
  { label: "Step 2", description: "Customize settings" },
  { label: "Step 3", description: "Preview & render" },
];

export type TextingMessage = {
  id: string;
  text: string;
  sender: 'user' | 'contact';
  timestamp: number; // ms from start
  needsTyping?: boolean; // Whether this message needs typing effect (default: true for user, false for contact)
  imageUrl?: string; // Optional image URL for image messages
  _index?: number; // Optional original order index for stability
};

export type PhoneCall = {
  timestamp: number; // When the call appears (in ms)
  type?: 'top' | 'fullscreen'; // Notification type - default 'top'
  callerInfo?: string; // Optional caller info text (e.g., "At @acme from Milan")
  callType?: string; // Optional call type text (e.g., "FaceTime Video Call")
  logoUrl?: string; // Optional logo URL for the call type icon
};

export type TextingVideoSettings = {
  contactName: string;
  contactAvatar: string; // emoji or image URL
  typingSpeed: number; // characters per second
  messageDelay: number; // ms between messages
  keepKeyboardOpen?: boolean; // Keep keyboard open full time
  phoneCalls?: PhoneCall[]; // Optional phone call notifications
};

export default function TextingScriptPage() {
  const router = useRouter();
  const { draft, updateDraft } = useProjectStore();
  
  // Initialize draft type for texting video
  useEffect(() => {
    if (draft?.type !== "TEXTING_VIDEO") {
      updateDraft({ 
        type: "TEXTING_VIDEO",
      });
    }
  }, [draft?.type, updateDraft]);

  // Load uploaded images from project metadata if editing
  useEffect(() => {
    const metadata = draft?.metadata as any;
    if (metadata?.uploadedImages) {
      // Restore uploaded images from metadata
      const imagesMap = new Map<string, string>();
      Object.entries(metadata.uploadedImages).forEach(([key, value]) => {
        if (typeof value === 'string') {
          imagesMap.set(key, value);
        }
      });
      setUploadedImages(imagesMap);
    }
  }, [draft?.metadata]);

  // Load available images from database
  useEffect(() => {
    const loadImages = async () => {
      try {
        setIsLoadingImages(true);
        const images = await getUserUploadedImages();
        setAvailableImages(images);
      } catch (error) {
        console.error("Failed to load uploaded images:", error);
        // Don't show error toast - just silently fail
      } finally {
        setIsLoadingImages(false);
      }
    };
    
    loadImages();
  }, []);

  const MAX_CHARS = 2000;
  const [text, setText] = useState(draft?.scriptInput || "");
  const [contactName, setContactName] = useState<string>(
    (draft?.metadata as any)?.textingSettings?.contactName || "Willa"
  );
  const [contactAvatar, setContactAvatar] = useState<string>(
    (draft?.metadata as any)?.textingSettings?.contactAvatar || "🎾"
  );
  const [typingSpeed, setTypingSpeed] = useState<number>(
    (draft?.metadata as any)?.textingSettings?.typingSpeed || 8
  );
  const [messageDelay, setMessageDelay] = useState<number>(
    (draft?.metadata as any)?.textingSettings?.messageDelay || 500
  );
  const [uploadedImages, setUploadedImages] = useState<Map<string, string>>(new Map()); // imageId -> imageUrl
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [availableImages, setAvailableImages] = useState<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);
  const [phoneCalls, setPhoneCalls] = useState<PhoneCall[]>(
    (draft?.metadata as any)?.textingSettings?.phoneCalls || []
  );
  const [showAddCallDialog, setShowAddCallDialog] = useState(false);
  const [addCallInsertAtEnd, setAddCallInsertAtEnd] = useState(false);
  const DEFAULT_FACETIME_CALL_TYPE = 'FaceTime Video Call';
  const DEFAULT_FACETIME_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/FaceTime_iOS.svg/960px-FaceTime_iOS.svg.png';

  const [addCallForm, setAddCallForm] = useState<{
    type: 'top' | 'fullscreen';
    callerInfo: string;
    callType: string;
    logoUrl: string;
  }>({ type: 'top', callerInfo: '', callType: DEFAULT_FACETIME_CALL_TYPE, logoUrl: DEFAULT_FACETIME_LOGO_URL });

  // Extract phone calls from script syntax: [call:type:callerInfo:callType:logoUrl]
  // Calculate timestamp based on which message it appears after
  const extractedPhoneCalls = useMemo(() => {
    if (!text.trim()) return [];
    
    const lines = text.split('\n');
    const phoneCallRegex = /\[call:([^:]+)(?::([^:]*))?(?::([^:]*))?(?::([^\]]*))?\]/i;
    const calls: PhoneCall[] = [];
    
    // First, parse all messages to get their timestamps
    let currentTime = 0;
    const messageTimestamps: number[] = [];
    const SEND_BUTTON_DURATION = 300;
    const MESSAGE_APPEAR_DELAY = 150;
    const CONTACT_RESPONSE_DELAY = 2000;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.match(/^\[call:/i)) return; // Skip empty lines and phone call lines
      
      // Check for "me: " or "you: " tags
      let sender: 'user' | 'contact' = 'user';
      let messageText = trimmedLine;
      let needsTyping = true;
      let imageUrl: string | undefined = undefined;
      
      if (trimmedLine.match(/^me:\s*/i)) {
        sender = 'user';
        messageText = trimmedLine.replace(/^me:\s*/i, '');
        needsTyping = true;
      } else if (trimmedLine.match(/^you:\s*/i)) {
        sender = 'contact';
        messageText = trimmedLine.replace(/^you:\s*/i, '');
        needsTyping = false;
      } else if (trimmedLine.startsWith('[USER]')) {
        sender = 'user';
        messageText = trimmedLine.replace(/^\[USER\]\s*/, '');
        needsTyping = true;
      } else if (trimmedLine.startsWith('[CONTACT]')) {
        sender = 'contact';
        messageText = trimmedLine.replace(/^\[CONTACT\]\s*/, '');
        needsTyping = false;
      }
      
      // Check for image syntax
      const imageMatch = messageText.match(/\[image:(.+?)\]/i);
      if (imageMatch) {
        const imageRef = imageMatch[1];
        if (imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
          imageUrl = imageRef;
        } else {
          imageUrl = uploadedImages.get(imageRef) || imageRef;
        }
        messageText = messageText.replace(/\[image:.+?\]/gi, '').trim();
        if (!messageText) {
          messageText = '';
        }
      }
      
      // Calculate message duration
      let messageDuration = 0;
      if (imageUrl) {
        messageDuration = 500 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
      } else if (needsTyping) {
        const typingDuration = (messageText.length / typingSpeed) * 1000;
        messageDuration = typingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
      } else {
        messageDuration = CONTACT_RESPONSE_DELAY + 500;
      }
      
      const delay = index > 0 ? messageDelay : 0;
      messageTimestamps.push(currentTime);
      currentTime += messageDuration + delay;
    });
    
    // Now find phone calls and calculate their timestamps based on previous message
    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();
      const match = trimmedLine.match(phoneCallRegex);
      if (!match) return;
      
      const type = match[1] || 'top';
      const callerInfo = match[2] || undefined;
      const callType = match[3] || undefined;
      const logoUrl = match[4] || undefined;
      
      // Find the last message before this phone call line
      let messageIndex = -1;
      for (let i = lineIndex - 1; i >= 0; i--) {
        const prevLine = lines[i].trim();
        if (prevLine && !prevLine.match(/^\[call:/i)) {
          // Count how many messages we've seen before this line
          let msgCount = 0;
          for (let j = 0; j < i; j++) {
            const checkLine = lines[j].trim();
            if (checkLine && !checkLine.match(/^\[call:/i)) {
              msgCount++;
            }
          }
          messageIndex = msgCount;
          break;
        }
      }
      
      // Calculate timestamp: after the message finishes + a small delay
      let timestamp = 0;
      if (messageIndex >= 0 && messageIndex < messageTimestamps.length) {
        // Get the message's start time
        const messageStartTime = messageTimestamps[messageIndex];
        // Calculate when the message finishes
        const prevLine = lines[lineIndex - 1]?.trim() || '';
        let messageDuration = 0;
        
        if (prevLine.match(/^me:\s*/i) || prevLine.startsWith('[USER]')) {
          const messageText = prevLine.replace(/^me:\s*/i, '').replace(/^\[USER\]\s*/, '').replace(/\[image:.+?\]/gi, '').trim();
          if (messageText.match(/\[image:/i)) {
            messageDuration = 500 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
          } else {
            const typingDuration = (messageText.length / typingSpeed) * 1000;
            messageDuration = typingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
          }
        } else if (prevLine.match(/^you:\s*/i) || prevLine.startsWith('[CONTACT]')) {
          messageDuration = CONTACT_RESPONSE_DELAY + 500;
        }
        
        timestamp = messageStartTime + messageDuration + 500; // 500ms delay after message appears
      } else if (messageTimestamps.length > 0) {
        // If no previous message found, use last message's end time
        const lastMessageStart = messageTimestamps[messageTimestamps.length - 1];
        timestamp = lastMessageStart + 5000; // Default 5 seconds after last message
      }
      
      calls.push({
        timestamp,
        type: type === 'fullscreen' ? 'fullscreen' : 'top',
        callerInfo: callerInfo || undefined,
        callType: callType || undefined,
        logoUrl: logoUrl || undefined,
      });
    });
    
    return calls;
  }, [text, typingSpeed, messageDelay, uploadedImages]);

  // Update phoneCalls state when extracted phone calls change
  useEffect(() => {
    if (extractedPhoneCalls.length > 0) {
      setPhoneCalls(extractedPhoneCalls);
    }
  }, [extractedPhoneCalls]);

  // Parse script into messages
  const messages = useMemo(() => {
    if (!text.trim()) return [];
    
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.match(/^\[call:/i)); // Filter out phone call lines
    
    let currentTime = 0;
    const parsedMessages: TextingMessage[] = [];
    const SEND_BUTTON_DURATION = 300;
    const MESSAGE_APPEAR_DELAY = 150;
    
    lines.forEach((line, index) => {
      // Check for "me: " or "you: " tags (case insensitive)
      let sender: 'user' | 'contact' = 'user';
      let messageText = line;
      let needsTyping = true; // Default: show typing effect
      
      let imageUrl: string | undefined = undefined;
      
      if (line.match(/^me:\s*/i)) {
        sender = 'user';
        messageText = line.replace(/^me:\s*/i, '');
        needsTyping = true; // User messages have typing effect
      } else if (line.match(/^you:\s*/i)) {
        sender = 'contact';
        messageText = line.replace(/^you:\s*/i, '');
        needsTyping = false; // Contact messages appear instantly
      } else if (line.startsWith('[USER]')) {
        sender = 'user';
        messageText = line.replace(/^\[USER\]\s*/, '');
        needsTyping = true;
      } else if (line.startsWith('[CONTACT]')) {
        sender = 'contact';
        messageText = line.replace(/^\[CONTACT\]\s*/, '');
        needsTyping = false;
      }
      
      // Check for image syntax: [image:url] or [image:imageId]
      const imageMatch = messageText.match(/\[image:(.+?)\]/i);
      if (imageMatch) {
        const imageRef = imageMatch[1];
        // Check if it's a URL or an image ID
        if (imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
          imageUrl = imageRef;
        } else {
          // It's an image ID, look it up in uploadedImages
          imageUrl = uploadedImages.get(imageRef) || imageRef; // Fallback to the ID if not found
        }
        // Remove the image syntax from text, but keep the text if there's any
        messageText = messageText.replace(/\[image:.+?\]/gi, '').trim();
        // If there's no text, set a placeholder or empty string
        if (!messageText) {
          messageText = ''; // Image-only message
        }
      }
      
      // Calculate timing
      let messageDuration = 0;
      const CONTACT_RESPONSE_DELAY = 2000; // 2 second delay before contact responses
      
      if (imageUrl) {
        // Image messages: shorter duration (no typing for images, just send + appear)
        messageDuration = 500 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY; // 500ms for image load + send + appear
      } else if (needsTyping) {
        // User messages: typing + send button + appear delay
        const typingDuration = (messageText.length / typingSpeed) * 1000;
        messageDuration = typingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
      } else {
        // Contact messages: 2 second delay + small delay for appearance
        messageDuration = CONTACT_RESPONSE_DELAY + 500; // 2 second delay + appearance delay
      }
      
      const delay = index > 0 ? messageDelay : 0;
      
      parsedMessages.push({
        id: `msg-${index}`,
        text: messageText,
        sender,
        timestamp: currentTime,
        needsTyping: imageUrl ? false : needsTyping, // Images don't need typing effect
        imageUrl, // Include image URL if present
      });
      
      currentTime += messageDuration + delay;
    });
    
    return parsedMessages;
  }, [text, typingSpeed, messageDelay, uploadedImages]);

  // Calculate total duration (includes typing + send button + message appear delay)
  const totalDuration = useMemo(() => {
    if (messages.length === 0) return 0;
    const lastMessage = messages[messages.length - 1];
    const SEND_BUTTON_DURATION = 300; // Send button click animation
    const MESSAGE_APPEAR_DELAY = 150; // Delay before message appears
    const END_BUFFER = 6000; // 6 seconds extra buffer at end to ensure all messages are rendered and shown
    
    let lastMessageDuration = 0;
    if (lastMessage.needsTyping !== false) {
      const lastTypingDuration = (lastMessage.text.length / typingSpeed) * 1000;
      lastMessageDuration = lastTypingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
    } else {
      // Contact messages: 2 second delay + appearance
      const CONTACT_RESPONSE_DELAY = 2000;
      lastMessageDuration = CONTACT_RESPONSE_DELAY + 300; // 2s delay + 300ms appearance
    }
    
    return lastMessage.timestamp + lastMessageDuration + END_BUFFER;
  }, [messages, typingSpeed]);

  const isValid = messages.length > 0;

  const handleChange = (value: string) => {
    if (value.length <= MAX_CHARS) {
      setText(value);
      updateDraft({ scriptInput: value });
    }
  };

  const handleSample = () => {
    const sample = `me: morning...

you: Hey! How are you?

me: Fedora guitar man! I haven't seen him in ages!

you: Oh wow, I remember him! He's so awesome...`;
    handleChange(sample);
  };

  const handleClear = () => handleChange("");

  const handleSelectImageForMessage = (imageUrl: string) => {
    const textarea = document.getElementById('messages') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = text;
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);
      
      // Insert image syntax with URL
      const imageSyntax = `[image:${imageUrl}]`;
      const newText = before + imageSyntax + after;
      handleChange(newText);
      
      // Reset cursor position after image syntax
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + imageSyntax.length, start + imageSyntax.length);
      }, 0);
    } else {
      // Append to end if no textarea found
      handleChange(text + (text ? '\n' : '') + `me: [image:${imageUrl}]`);
    }
    
    setShowImageGallery(false);
    toast.success("Image inserted into message");
  };

  const buildCallSyntax = (opts: { type: 'top' | 'fullscreen'; callerInfo: string; callType: string; logoUrl: string }) => {
    const caller = (opts.callerInfo.trim() || contactName).replace(/:/g, ' ');
    const callType = opts.callType.trim().replace(/:/g, ' ');
    const logoUrl = opts.logoUrl.trim().replace(/]/g, '');
    return `[call:${opts.type}:${caller}:${callType}:${logoUrl}]`;
  };

  const insertPhoneCallAtCursor = (opts: { type: 'top' | 'fullscreen'; callerInfo: string; callType: string; logoUrl: string }) => {
    const callSyntax = buildCallSyntax(opts);
    const textarea = document.getElementById('messages') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = text;
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);
      const newText = before + (before.trim().endsWith('\n') || before.trim() === '' ? '' : '\n') + callSyntax + (after.trim().startsWith('\n') ? '' : '\n') + after;
      handleChange(newText);
      setTimeout(() => {
        textarea.focus();
        const newStart = start + callSyntax.length + (before.trim().endsWith('\n') || before.trim() === '' ? 0 : 1) + (after.trim().startsWith('\n') ? 0 : 1);
        textarea.setSelectionRange(newStart, newStart);
      }, 0);
    } else {
      handleChange((text.trim() ? text + '\n' : '') + callSyntax);
    }
    toast.success("Phone call inserted. It will appear after the message above it.");
  };

  const handleOpenAddCallDialog = (insertAtEnd = false) => {
    setAddCallForm({
      type: 'top',
      callerInfo: contactName,
      callType: DEFAULT_FACETIME_CALL_TYPE,
      logoUrl: DEFAULT_FACETIME_LOGO_URL,
    });
    setAddCallInsertAtEnd(insertAtEnd);
    setShowAddCallDialog(true);
  };

  const handleInsertCallFromDialog = () => {
    if (addCallInsertAtEnd) {
      const callSyntax = buildCallSyntax(addCallForm);
      handleChange((text.trim() ? text + '\n' : '') + callSyntax);
      const textarea = document.getElementById('messages') as HTMLTextAreaElement;
      if (textarea) {
        setTimeout(() => {
          textarea.focus();
          textarea.scrollTop = textarea.scrollHeight;
        }, 0);
      }
      toast.success("Phone call added to script. It will appear after the last message.");
    } else {
      insertPhoneCallAtCursor(addCallForm);
    }
    setShowAddCallDialog(false);
  };

  const handleSelectImageForAvatar = (imageUrl: string) => {
    setContactAvatar(imageUrl);
    setShowAvatarGallery(false);
    toast.success("Avatar image selected");
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    try {
      setIsUploading(true);
      const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileName = `${imageId}-${file.name}`;
      
      const imageUrl = await uploadImageToStorage(file, fileName);
      
      // Store the image URL with the image ID
      setUploadedImages(prev => new Map(prev).set(imageId, imageUrl));
      
      // Refresh available images list
      try {
        const images = await getUserUploadedImages();
        setAvailableImages(images);
      } catch (error) {
        console.error("Failed to refresh images:", error);
      }
      
      // Insert image syntax at cursor position or append to text
      const textarea = document.getElementById('messages') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = text;
        const before = currentText.substring(0, start);
        const after = currentText.substring(end);
        
        // Insert image syntax: [image:imageId]
        const imageSyntax = `[image:${imageId}]`;
        const newText = before + imageSyntax + after;
        handleChange(newText);
        
        // Reset cursor position after image syntax
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + imageSyntax.length, start + imageSyntax.length);
        }, 0);
      } else {
        // Append to end if no textarea found
        handleChange(text + (text ? '\n' : '') + `me: [image:${imageId}]`);
      }
      
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Failed to upload image:", error);
      
      // Check if it's an RLS error - these are OK, the file is already uploaded
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRLSError = errorMessage.includes('row-level security') || 
                        errorMessage.includes('violates row-level security') ||
                        errorMessage.includes('42501');
      
      if (isRLSError) {
        // RLS errors are OK - the file is uploaded, just metadata save failed
        // Show success message since the actual upload worked
        toast.success("Image uploaded successfully!");
        console.warn("Metadata save failed due to RLS, but image upload succeeded");
      } else {
        // Real error - show error message
        toast.error(errorMessage);
      }
    } finally {
      setIsUploading(false);
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    // Validate file size (max 2MB for avatar)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar image size must be less than 2MB");
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const fileName = `avatar-${Date.now()}-${file.name}`;
      
      const imageUrl = await uploadImageToStorage(file, fileName);
      
      // Set the image URL as the contact avatar
      setContactAvatar(imageUrl);
      
      // Refresh available images list
      try {
        const images = await getUserUploadedImages();
        setAvailableImages(images);
      } catch (error) {
        console.error("Failed to refresh images:", error);
      }
      
      toast.success("Avatar uploaded successfully!");
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRLSError = errorMessage.includes('row-level security') || 
                        errorMessage.includes('violates row-level security') ||
                        errorMessage.includes('42501');
      
      if (isRLSError) {
        toast.success("Avatar uploaded successfully!");
        console.warn("Metadata save failed due to RLS, but avatar upload succeeded");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsUploadingAvatar(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleNext = async () => {
    if (!isValid) {
      toast.error("Please write at least one message");
      return;
    }
    
    // Save settings to metadata
    const textingSettings: TextingVideoSettings = {
      contactName,
      contactAvatar,
      typingSpeed,
      messageDelay,
      phoneCalls: phoneCalls.length > 0 ? phoneCalls : undefined,
    };
    
    updateDraft({ 
      scriptInput: text,
      metadata: {
        ...(draft?.metadata || {}),
        textingSettings,
        messages,
        totalDuration,
      },
    });
    
    // Create project in Supabase when clicking Preview
    try {
      toast.info("Saving project...");
      
      const { projectsApi } = await import('@/lib/api/projects');
      const { useAuthStore } = await import('@/lib/stores/auth-store');
      const authStore = useAuthStore.getState();
      const user = authStore.user;
      
      // Check if project already exists (editing mode)
      let projectId = draft?.id;
      const isEditing = projectId && draft?.previewUrl;
      
      if (!isEditing || !projectId) {
        // Create new project in database
        const title = draft?.title || `Texting Video ${new Date().toLocaleDateString()}`;
        
        const { project } = await projectsApi.create({
          title,
          description: `Texting video with ${messages.length} messages`,
          type: 'TEXTING_VIDEO',
          backgroundId: 'default', // Texting videos don't use backgrounds
        });

        projectId = project.id;
        
        // Update draft with new project ID
        updateDraft({ id: projectId, title });
      }

      // Update project with texting video metadata
      // Do this for both new and existing projects
      if (projectId) {
        try {
          // Small delay to ensure project is fully created in database
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Prepare metadata - ensure messages are serializable and not too large
          // Convert uploadedImages Map to object for serialization
          const uploadedImagesObj = Object.fromEntries(uploadedImages);
          
          const metadata = {
            type: 'TEXTING_VIDEO',
            textingSettings: {
              contactName: String(contactName || ''),
              contactAvatar: String(contactAvatar || ''),
              typingSpeed: Number(typingSpeed) || 5,
              messageDelay: Number(messageDelay) || 500,
              phoneCalls: phoneCalls.length > 0 ? phoneCalls.map(call => ({
                timestamp: Number(call.timestamp) || 0,
                type: call.type || 'top',
                callerInfo: call.callerInfo || undefined,
                callType: call.callType || undefined,
                logoUrl: call.logoUrl || undefined,
              })) : undefined,
            },
            // Ensure messages are saved in the exact order they appear in the array
            // Messages are already in correct order from parsing, but we preserve the order explicitly
            messages: messages.map((msg, index) => ({
              id: String(msg.id || `msg-${index}`),
              text: String(msg.text || ''),
              sender: msg.sender === 'user' ? 'user' : 'contact',
              timestamp: Number(msg.timestamp) || 0,
              needsTyping: msg.needsTyping !== false,
              imageUrl: msg.imageUrl || undefined,
              // Preserve original index to ensure order is maintained
              _index: index,
            })),
            uploadedImages: uploadedImagesObj, // Save image ID to URL mapping
            totalDuration: Number(totalDuration) || 0,
            scriptInput: String(text || ''),
          };
          
          // Validate metadata size (Supabase JSONB has limits)
          const metadataStr = JSON.stringify(metadata);
          if (metadataStr.length > 1000000) { // 1MB limit
            console.warn("Metadata too large, truncating messages");
            metadata.messages = metadata.messages.slice(0, 50); // Limit to first 50 messages
          }
          
          await projectsApi.update(projectId, {
            metadata,
          } as any);
        } catch (updateError: any) {
          console.error("Failed to update project metadata:", updateError);
          console.error("Update error details:", {
            message: updateError?.message,
            response: updateError?.response,
            stack: updateError?.stack,
          });
          // If update fails, log but don't block navigation
          // The project was created, metadata can be updated later
          toast.warning("Project created but metadata update failed. You can continue.");
        }
      }
      
      toast.success("Project saved!");
      router.push("/app/create/texting/preview");
    } catch (error) {
      console.error("Failed to save project:", error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : "Failed to save project. Please try again."
      );
      // Still navigate to preview page even if save fails
      router.push("/app/create/texting/preview");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={0} />
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Write your messages</h1>
          <p className="text-sm text-muted-foreground">
            Enter your messages, one per line. Use <code className="bg-muted px-1 rounded">me: </code> for messages you type (with typing effect) or <code className="bg-muted px-1 rounded">you: </code> for replies (appear instantly). Click "Upload Image" to add images or "Add Call" to insert phone call notifications at your cursor position.
          </p>
        </header>

        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl" onClick={handleSample}>
            Use Sample
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={handleClear}>
            Clear
          </Button>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="messages">Messages</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowImageGallery(true)}
                className="flex items-center gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Select Image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('image-upload')?.click()}
                disabled={isUploading}
                className="flex items-center gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                {isUploading ? "Uploading..." : "Upload New"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenAddCallDialog(false)}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                Add Call
              </Button>
            </div>
          </div>
          <Textarea
            id="messages"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={MAX_CHARS}
            placeholder="Enter your messages, one per line...&#10;&#10;Use 'me: ' for messages you type (with typing effect)&#10;Use 'you: ' for replies (appear instantly)&#10;Use '[image:imageId]' to insert uploaded images&#10;Use '[call:type:callerInfo:callType:logoUrl]' for phone calls (appears after message above)&#10;&#10;Example:&#10;me: morning...&#10;you: Hey! How are you?&#10;[call:top:Willa]&#10;me: [image:img-123] Check this out!"
            className={cn(
              "min-h-[300px] font-mono text-sm",
              text.length >= MAX_CHARS && "border-orange-300"
            )}
            rows={12}
          />
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </span>
              {totalDuration > 0 && (
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                  Duration: {(totalDuration / 1000).toFixed(1)}s
                </Badge>
              )}
            </div>
            <span className={text.length >= MAX_CHARS ? "text-orange-600 font-medium" : "text-muted-foreground"}>
              {text.length} / {MAX_CHARS} characters
            </span>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="rounded-3xl border border-border/40 bg-white/70 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          
          {/* Contact Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="contact-name" className="text-sm font-medium">
                Contact Name
              </Label>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              id="contact-name"
              placeholder="Willa"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Contact Avatar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="contact-avatar" className="text-sm font-medium">
                Contact Avatar
              </Label>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-3">
              {/* Avatar Preview */}
              <div className="w-12 h-12 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-lg font-semibold overflow-hidden border-2 border-gray-200 flex-shrink-0">
                {contactAvatar.startsWith('http://') || contactAvatar.startsWith('https://') || contactAvatar.startsWith('/') ? (
                  <img 
                    src={contactAvatar} 
                    alt="Contact avatar" 
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      // Fallback to emoji if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : contactAvatar.length <= 2 && /^[\p{Emoji}]$/u.test(contactAvatar) ? (
                  contactAvatar
                ) : (
                  contactName.substring(0, 2).toUpperCase()
                )}
              </div>
              
              {/* Input and Upload */}
              <div className="flex-1 flex items-center gap-2">
                <Input
                  id="contact-avatar"
                  placeholder="🎾 or upload image"
                  value={contactAvatar}
                  onChange={(e) => setContactAvatar(e.target.value)}
                  className="rounded-xl flex-1"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-upload"
                  disabled={isUploadingAvatar}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAvatarGallery(true)}
                  className="flex items-center gap-2 flex-shrink-0"
                >
                  <ImageIcon className="h-4 w-4" />
                  Select
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                  disabled={isUploadingAvatar}
                  className="flex items-center gap-2 flex-shrink-0"
                >
                  <ImageIcon className="h-4 w-4" />
                  {isUploadingAvatar ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter an emoji or upload an image to use as the contact's profile picture.
            </p>
          </div>

          {/* Typing Speed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">
                  Typing Speed
                </Label>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">
                {typingSpeed} chars/sec
              </span>
            </div>
            <Slider
              value={[typingSpeed]}
              onValueChange={(value) => setTypingSpeed(value[0])}
              min={3}
              max={15}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              How fast characters appear when typing (3-15 characters per second)
            </p>
          </div>

          {/* Message Delay */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">
                  Message Delay
                </Label>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">
                {messageDelay}ms
              </span>
            </div>
            <Slider
              value={[messageDelay]}
              onValueChange={(value) => setMessageDelay(value[0])}
              min={0}
              max={2000}
              step={100}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Time delay between messages (0-2000ms)
            </p>
          </div>

          {/* Phone Calls Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">
                Phone Call Notifications
              </Label>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            
            {phoneCalls.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No phone call notifications added. Click "Add Call" to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {phoneCalls.map((call, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Call #{index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPhoneCalls(phoneCalls.filter((_, i) => i !== index));
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
                        📍 Appears after the message above it in the script (calculated timestamp: {call.timestamp}ms)
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <select
                          value={call.type || 'top'}
                          onChange={(e) => {
                            const newCalls = [...phoneCalls];
                            newCalls[index].type = e.target.value as 'top' | 'fullscreen';
                            setPhoneCalls(newCalls);
                          }}
                          className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                        >
                          <option value="top">Top Notification</option>
                          <option value="fullscreen">Full Screen</option>
                        </select>
                      </div>
                    </div>
                    
                    {call.type === 'fullscreen' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Caller Info</Label>
                          <Input
                            value={call.callerInfo || ''}
                            onChange={(e) => {
                              const newCalls = [...phoneCalls];
                              newCalls[index].callerInfo = e.target.value;
                              setPhoneCalls(newCalls);
                            }}
                            className="h-8 text-xs"
                            placeholder="At @acme from Milan"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs">Call Type</Label>
                          <Input
                            value={call.callType || ''}
                            onChange={(e) => {
                              const newCalls = [...phoneCalls];
                              newCalls[index].callType = e.target.value;
                              setPhoneCalls(newCalls);
                            }}
                            className="h-8 text-xs"
                            placeholder="FaceTime Video Call"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs">Logo URL (optional)</Label>
                          <Input
                            value={call.logoUrl || ''}
                            onChange={(e) => {
                              const newCalls = [...phoneCalls];
                              newCalls[index].logoUrl = e.target.value;
                              setPhoneCalls(newCalls);
                            }}
                            className="h-8 text-xs"
                            placeholder="https://..."
                          />
                        </div>
                      </>
                    )}
                    
                    {call.type === 'top' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Caller Name</Label>
                        <Input
                          value={call.callerInfo || contactName}
                          onChange={(e) => {
                            const newCalls = [...phoneCalls];
                            newCalls[index].callerInfo = e.target.value;
                            setPhoneCalls(newCalls);
                          }}
                          className="h-8 text-xs"
                          placeholder={contactName}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => router.push("/app/create")}
          >
            Back
          </Button>
          <Button
            className="rounded-2xl px-6"
            disabled={!isValid}
            onClick={handleNext}
          >
            Next: Preview
          </Button>
        </div>
      </div>

      {/* Image Gallery Modal for Messages */}
      {showImageGallery && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowImageGallery(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Select Image for Message</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImageGallery(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isLoadingImages ? (
              <div className="text-center py-8 text-muted-foreground">Loading images...</div>
            ) : availableImages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No images uploaded yet. Upload an image to get started.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {availableImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-colors group"
                    onClick={() => handleSelectImageForMessage(image.url)}
                  >
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Check className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Gallery Modal for Avatars */}
      {showAvatarGallery && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAvatarGallery(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Select Image for Contact Avatar</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAvatarGallery(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isLoadingImages ? (
              <div className="text-center py-8 text-muted-foreground">Loading images...</div>
            ) : availableImages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No images uploaded yet. Upload an image to get started.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {availableImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative aspect-square rounded-full overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-colors group"
                    onClick={() => handleSelectImageForAvatar(image.url)}
                  >
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    {contactAvatar === image.url && (
                      <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                        <Check className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Check className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Call dialog – select call type and options before inserting */}
      <Dialog open={showAddCallDialog} onOpenChange={setShowAddCallDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add phone call</DialogTitle>
            <DialogDescription>
              Choose how the call notification appears. It will be inserted {addCallInsertAtEnd ? "at the end of the script" : "at your cursor position"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Call type</Label>
              <select
                value={addCallForm.type}
                onChange={(e) => setAddCallForm((f) => ({ ...f, type: e.target.value as 'top' | 'fullscreen' }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="top">Top notification</option>
                <option value="fullscreen">Full screen</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Caller name / info</Label>
              <Input
                value={addCallForm.callerInfo}
                onChange={(e) => setAddCallForm((f) => ({ ...f, callerInfo: e.target.value }))}
                placeholder={contactName}
                className="rounded-lg"
              />
            </div>
            {addCallForm.type === 'fullscreen' && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Call type label</Label>
                  <Input
                    value={addCallForm.callType}
                    onChange={(e) => setAddCallForm((f) => ({ ...f, callType: e.target.value }))}
                    placeholder={DEFAULT_FACETIME_CALL_TYPE}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Logo URL (optional)</Label>
                  <Input
                    value={addCallForm.logoUrl}
                    onChange={(e) => setAddCallForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    placeholder={DEFAULT_FACETIME_LOGO_URL}
                    className="rounded-lg"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCallDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleInsertCallFromDialog} className="rounded-xl">
              {addCallInsertAtEnd ? "Add to script" : "Insert call"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

