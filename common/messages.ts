import { Direction, GameState } from "./types";

export enum ClientMessageType {
  MoveRight,
  MoveLeft,
  Rotate,
  Ping,
}

export enum ServerMessageType {
  StateUpdate,
  PingResponse,
}

export type ClientMessage = MoveRightMessage | MoveLeftMessage | RotateMessage | PingMessage;

export type MoveRightMessage = {
  type: ClientMessageType.MoveRight;
};

export type MoveLeftMessage = {
  type: ClientMessageType.MoveLeft;
};

export type RotateMessage = {
  type: ClientMessageType.Rotate;
};

export type PingMessage = {
  type: ClientMessageType.Ping;
  id: number;
};

export type ServerMessage = StateUpdateMessage | PingResponseMessage;

export type StateUpdateMessage = {
  type: ServerMessageType.StateUpdate;
  state: GameState;
  ts: number;
};

export type PingResponseMessage = {
  type: ServerMessageType.PingResponse;
  id: number;
};
