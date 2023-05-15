import { CommandType } from "./CommandType.model";

export interface Command {
  type: CommandType;
}

export type UserType = 'user' | 'profesional' | 'admin';
