import { Command } from "./Command.model";

export type Content = string;

export interface CommandChatMessage extends Command {
  room: string;
  from: string;
  client_id: number;
  content: Content
}

export interface CommandInternalChatMessage extends CommandChatMessage {
  conversation_id: string;
  id: string;
}

export function isCommandChatMessage(command: CommandChatMessage | any): command is CommandChatMessage {
  return command.type === 'CHAT_MESSAGE'
}


export function isCommandInternalChatMessage(command: CommandInternalChatMessage | any): command is CommandInternalChatMessage {
  return command.conversation_id !== undefined;
}
