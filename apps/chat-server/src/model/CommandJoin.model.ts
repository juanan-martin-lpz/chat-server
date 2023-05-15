import { Command } from "./Command.model";

export interface CommandJoinRoom extends Command {
  user: string;
  room: string;
}

export function isCommandJoinRoom(command: CommandJoinRoom | any): command is CommandJoinRoom {
  return command.type === 'JOIN_ROOM'
}

export type CommandJoinSuccess = {
  success: boolean;
}

export type CommandUserJoinedSuccess = {
  room: string;
  user: string;
  username: string;
}
