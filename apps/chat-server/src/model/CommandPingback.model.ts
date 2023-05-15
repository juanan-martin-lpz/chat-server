import { Command } from "./Command.model";

export type CommandPingback =  Command

export function isCommandPingback(command: CommandPingback | any): command is CommandPingback {
  return command.type === 'PINGBACK'
}
