export enum Direction {
  None,
  Up,
  Down,
  Left,
  Right,
}

export type Player = {
  id: string;
};

export type Point = {
  x: number,
  y: number,
};

export type Brick = {
  point: Point,
  id: string
  // todo: add color!
}

export type Tetronimo = {
  bricks: Brick[];
  // todo: pivot?
}

export type GameState = {
  player1?: Player;
  player2?: Player;
  player1Falling?: Tetronimo;
  player2Falling?: Tetronimo;

  bricks: Brick[];
};
