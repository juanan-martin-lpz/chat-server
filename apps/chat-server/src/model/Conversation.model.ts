import { Content } from "./CommandChatMessage.model";

export interface ChatMessage  {
  id: string;
  from_id: string;
  content: Content
}

export interface Conversation {
  id: string;
  client_id: unknown;
  profesional_id: unknown;

  messages: ChatMessage[];
}
