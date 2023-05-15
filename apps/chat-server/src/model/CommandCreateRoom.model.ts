import { Command } from "./Command.model";


export interface CommandCreateRoom extends Command {
  user: string
}

export type CommandRoomCreated = {
  id: string;
  room: string;
  timestamp: Date;
}

export function isCommandCreateRoom(command: CommandCreateRoom | any): command is CommandCreateRoom {
  return command.type === 'CREATE_ROOM'
}
