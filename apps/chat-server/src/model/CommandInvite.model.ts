import { Command } from "./Command.model";

export interface CommandInvite extends Command {
  // usernames
  from: string;
  to: string;
  room: string;
}

export function isCommandInvite(command: CommandInvite | any): command is CommandInvite {
  return command.type === 'INVITE'
}

export type Invitation = {
  from: string;
  room: string;
}
