// src/types/video.ts

export interface CaptionMessage {
  topic: "caption";
  type: "sign" | "speech";
  text: string;
  isFinal: boolean;
  identity: string;   // participant identity (Supabase user id)
}