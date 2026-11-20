export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface PrivacySettings {
  internetAccess: boolean;
  localServiceAccess: boolean;
  microphoneAccess: boolean;
  selectedFileAccess: boolean;
}
