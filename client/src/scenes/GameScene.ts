import Phaser, { Math as pMath, Scene } from "phaser";
import { HathoraClient } from "@hathora/client-sdk";
import { InterpolationBuffer } from "interpolation-buffer";
import { ClientMessageType, ServerMessageType } from "../../../common/messages";
import { Brick, Direction, GameState, Player } from "../../../common/types";
import { RoomConnection } from "../connection";

export class GameScene extends Scene {
  // A variable to represent our RoomConnection instance
  private connection!: RoomConnection;

  // The buffer which holds state snapshots
  private stateBuffer: InterpolationBuffer<GameState> | undefined;

  private player1Text: Phaser.GameObjects.Text | undefined;

  private player2Text: Phaser.GameObjects.Text | undefined;

  private existingBricks: Map<string, Phaser.GameObjects.Sprite> = new Map();

  // A map of player sprites currently connected
  // The Hathora user for the current client's connected player
  private currentUserID: string | undefined;
  // The current client's connected player's sprite object

  constructor() {
    super("scene-game");
  }

  init({ connection, token }: { connection: RoomConnection; token: string }) {
    // Receive connection and user data from BootScene
    this.connection = connection;

    const currentUser = HathoraClient.getUserFromToken(token);
    this.currentUserID = currentUser.id;
  }

  x(a: number): number {
    return 210 + a * 20;
  }

  y(b: number): number {
    return 110 + b * 20;
  }

  create() {
    const tileSize = 20;
    const top = 0;
    const left = 0;
    const bottom = 20 * tileSize;
    const right = 10 * 64;

    // Render grass
    // this.add.sprite(this.x(0), this.y(0), "grass");
    // this.add.sprite(this.x(1), this.y(1), "grass");

    // Set the main camera's background colour and bounding box
    this.cameras.main.setBounds(left, top, right - left, bottom - top);

    // Ping indicator
    const pingText = this.add.text(0, 0, "Ping:", { color: "white" }).setScrollFactor(0);
    const pings: number[] = [];

    this.connection.addListener((msg) => {
      if (msg.type === ServerMessageType.StateUpdate) {
        // Start enqueuing state updates
        if (this.stateBuffer === undefined) {
          this.stateBuffer = new InterpolationBuffer(msg.state, 50, lerp);
        } else {
          this.stateBuffer.enqueue(msg.state, [], msg.ts);
        }
      } else
        if (msg.type === ServerMessageType.PingResponse) {
          // Update ping text
          pings.push(Date.now() - msg.id);
          if (pings.length > 10) {
            pings.shift();
          }
          const sortedPings = [...pings].sort((a, b) => a - b);
          pingText.text = `Ping: ${sortedPings[Math.floor(pings.length / 2)]}`;
        }
    });

    // Send pings every 500ms
    setInterval(() => {
      this.connection.sendMessage({ type: ClientMessageType.Ping, id: Date.now() });
    }, 1000);

    // Handle keyboard input
    // const keys = this.input.keyboard.addKeys("W,S,A,D") as {
    //   W: Phaser.Input.Keyboard.Key;
    //   S: Phaser.Input.Keyboard.Key;
    //   A: Phaser.Input.Keyboard.Key;
    //   D: Phaser.Input.Keyboard.Key;
    // };
    // let prevDirection = Direction.None;

    // const handleKeyEvt = () => {
    //   let direction: Direction;
    //   if (keys.W.isDown) {
    //     direction = Direction.Up;
    //   } else if (keys.S.isDown) {
    //     direction = Direction.Down;
    //   } else if (keys.D.isDown) {
    //     direction = Direction.Right;
    //   } else if (keys.A.isDown) {
    //     direction = Direction.Left;
    //   } else {
    //     direction = Direction.None;
    //   }

    //   if (prevDirection !== direction) {
    //     // If connection is open and direction has changed, send updated direction
    //     prevDirection = direction;
    //     this.connection.sendMessage({ type: ClientMessageType.SetDirection, direction });
    //   }
    // };

    // this.input.keyboard.on("keydown", handleKeyEvt);
  }

  update() {
    // If the stateBuffer hasn't been defined, skip this update tick
    if (this.stateBuffer === undefined) {
      return;
    }

    const { state } = this.stateBuffer.getInterpolatedState(Date.now());

    console.log(state);

    if (state.player1 !== undefined && this.player1Text === undefined) {
      this.player1Text = this.add.text(450, 0, `${state.player1.id}`, { color: "white" }).setScrollFactor(0);
    }

    if (state.player2 !== undefined && this.player2Text === undefined) {
      this.player2Text = this.add.text(450, 580, `${state.player2.id}`, { color: "white" }).setScrollFactor(0);
    }

    // todo: clear sprites from cleared bricks

    state.bricks.forEach((brick) => {
      if (!this.existingBricks.has(brick.id)) {
        console.log("Drawing", brick);
        this.existingBricks.set(brick.id, this.add.sprite(this.x(brick.point.x), this.y(brick.point.y), "grass"));
      }
    });

    state.player1Falling?.bricks.forEach((brick) => {
      if (!this.existingBricks.has(brick.id)) {
        this.existingBricks.set(brick.id, this.add.sprite(this.x(brick.point.x), this.y(brick.point.y), "grass"));
      } else {
        const existingBrick = this.existingBricks.get(brick.id);
        existingBrick?.setX(this.x(brick.point.x));
        existingBrick?.setY(this.y(brick.point.y));
      }
    });

    // // Synchronize the players in our game's state with sprites to represent them graphically
    // this.syncSprites(
    //   this.players,
    //   new Map(
    //     state.players.map((player) => [
    //       player.id,
    //       new Phaser.GameObjects.Sprite(this, player.position.x, player.position.y, "player").setRotation(
    //         player.aimAngle
    //       ),
    //     ])
    //   )
    // );

    // // Do the same with bullets
    // this.syncSprites(
    //   this.bullets,
    //   new Map(
    //     state.bullets.map((bullet) => [
    //       bullet.id,
    //       new Phaser.GameObjects.Sprite(this, bullet.position.x, bullet.position.y, "bullet"),
    //     ])
    //   )
    // );

    // // If this.playerSprite has been defined (a ref to our own sprite), send our mouse position to the server
    // if (this.playerSprite) {
    //   this.sendMousePosition(mousePointer, this.playerSprite);
    // }
  }
}
function lerp(from: GameState, to: GameState, pctElapsed: number): GameState {
  return to;
}

function key(brick: Brick): string {
  return `(${brick.point.x}, ${brick.point.y}`;
}