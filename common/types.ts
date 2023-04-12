export enum Direction {
  None,
  Up,
  Down,
  Left,
  Right,
}

export type Player = {
  id: string;
  ready: boolean;
};

export type Point = {
  x: number,
  y: number,
};

export type Brick = {
  point: Point,
  id: string,
  // todo: add color!
}

export type Tetronimo = {
  bricks: Brick[];
  pivot: Point,
}

export type GameState = {
  player1?: Player;
  player2?: Player;
  player1Falling?: Tetronimo;
  player2Falling?: Tetronimo;

  winner?: Player | "tie";

  bricks: Brick[];
};
