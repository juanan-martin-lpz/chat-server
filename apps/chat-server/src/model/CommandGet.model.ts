import { Command } from "./Command.model";

export type CommandGetUsers = Command

export function isCommandGetUsers(command: CommandGetUsers | any): command is CommandGetUsers {
  return command.type === 'GET_USERS'
}

export type CommandGetProfesionals = Command

export function isCommandGetProfesionals(command: CommandGetProfesionals | any): command is CommandGetProfesionals {
  return command.type === 'GET_PROFESIONALS'
}
