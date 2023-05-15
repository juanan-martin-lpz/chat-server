import { Command } from "./Command.model";


export interface CommandLeaveRoom extends Command {
  room: string;
  user: string;
}

export type CommandRoomLeft = {
  success: boolean
}

export function isCommandLeaveRoom(command: CommandLeaveRoom | any): command is CommandLeaveRoom {
  return command.type === 'LEAVE_ROOM'
}
