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

  private winnerText: Phaser.GameObjects.Text | undefined;

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
    const keys = this.input.keyboard.addKeys("W,S,A,D") as {
      W: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    const handleKeyEvt = () => {
      if (keys.W.isDown) {
        this.connection.sendMessage({ type: ClientMessageType.Rotate });

      } else if (keys.S.isDown) {
      } else if (keys.D.isDown) {
        this.connection.sendMessage({ type: ClientMessageType.MoveRight });
      } else if (keys.A.isDown) {
        this.connection.sendMessage({ type: ClientMessageType.MoveLeft });
      } else {
      }
    };

    this.input.keyboard.on("keydown", handleKeyEvt);
  }

  update() {

    // If the stateBuffer hasn't been defined, skip this update tick
    if (this.stateBuffer === undefined) {
      return;
    }

    const { state } = this.stateBuffer.getInterpolatedState(Date.now());

    if (state.winner !== undefined && this.winnerText === undefined) {
      const style = {backgroundColor: 'gray', depth: 10};
      if (state.winner == "tie") {
        this.winnerText = this.add.text(250, 300, `you both lost`, style);
      } else if (state.winner.id == this.currentUserID) {
        this.winnerText = this.add.text(250, 300, `they lost`, style);
      } else {
        this.winnerText = this.add.text(250, 300, `you lost`, style);
      }
      this.winnerText?.setDepth(10);
    }

    if (state.player1 !== undefined && this.player1Text === undefined) {
      if (state.player1.id === this.currentUserID) {
        this.player1Text = this.add.text(450, 0, `you`, { color: "white" }).setScrollFactor(0);
      } else {
        this.player1Text = this.add.text(450, 0, `them`, { color: "white" }).setScrollFactor(0);
      }
    }

    if (state.player2 !== undefined && this.player2Text === undefined) {
      if (state.player2.id === this.currentUserID) {
        this.player1Text = this.add.text(450, 580, `you`, { color: "white" }).setScrollFactor(0);
      } else {
        this.player1Text = this.add.text(450, 580, `them`, { color: "white" }).setScrollFactor(0);
      }    }

    // todo: clear sprites from cleared bricks
    state.bricks.forEach((brick) => {
      if (!this.existingBricks.has(brick.id)) {
        this.existingBricks.set(brick.id, this.add.sprite(this.x(brick.point.x), this.y(brick.point.y), "grass"));
      } else {
        const sprite = this.existingBricks.get(brick.id);
        sprite?.setX(this.x(brick.point.x));
        sprite?.setY(this.y(brick.point.y));
      }
    });

    this.existingBricks.forEach((v, k) => {
      var stillAround = false;
      state.bricks.forEach(brick => {
        if (brick.id === k) {
          stillAround = true;
        }
      });
      if (!stillAround) {
        v.destroy();
        this.existingBricks.delete(k);
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

    state.player2Falling?.bricks.forEach((brick) => {
      if (!this.existingBricks.has(brick.id)) {
        this.existingBricks.set(brick.id, this.add.sprite(this.x(brick.point.x), this.y(brick.point.y), "grass"));
      } else {
        const existingBrick = this.existingBricks.get(brick.id);
        existingBrick?.setX(this.x(brick.point.x));
        existingBrick?.setY(this.y(brick.point.y));
      }
    });
  }
}
function lerp(from: GameState, to: GameState, pctElapsed: number): GameState {
  return to;
}