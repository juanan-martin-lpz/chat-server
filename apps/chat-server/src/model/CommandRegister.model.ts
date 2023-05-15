import { Command } from "./Command.model";

export type APIKeyType = 'codigo_organizacion' | 'key';

export type APIKey = {
  type: APIKeyType,
  key: string
}

export interface CommandRegister extends Command {
  user: string;
  client_id?: unknown;
  apikey?: APIKey;
  token: string;
}

export interface CommandProRegister extends Command {
  user: string;
  profesional_id?: unknown;
  apikey?: APIKey;
  token: string;
}

export type RegistrationInfo = {
  user: string;
}

export function isCommandRegister(command: CommandRegister | any): command is CommandRegister {
  return command.type === 'USER_REGISTER'
}

export function isCommandProRegister(command: CommandProRegister | any): command is CommandProRegister {
  return command.type === 'PRO_REGISTER'
}
