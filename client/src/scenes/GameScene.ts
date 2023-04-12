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

  private centerText: Phaser.GameObjects.Text | undefined;

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

    this.centerText = this.add.text(250, 300, "").setDepth(10);
  }

  x(a: number): number {
    return 210 + a * 20;
  }

  y(b: number, isPlayer2: boolean): number {
    if (!isPlayer2) {
      return 110 + b * 20;
    }
    return 600 - 110 - b * 20;
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
    this.cameras.main.setBackgroundColor("#172038");

    const graphics = this.add.graphics();
    graphics.fillStyle(0x819796);
    graphics.fillRect(200, 0, 200, 600)


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
    const keys = this.input.keyboard.addKeys("SPACE,W,S,A,D,UP,LEFT,RIGHT,DOWN") as {
      SPACE: Phaser.Input.Keyboard.Key;
      W: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
      UP: Phaser.Input.Keyboard.Key;
      LEFT: Phaser.Input.Keyboard.Key;
      RIGHT: Phaser.Input.Keyboard.Key;
      DOWN: Phaser.Input.Keyboard.Key;
    };

    const handleKeyEvt = () => {
      if (keys.SPACE.isDown) {
        this.connection.sendMessage({ type: ClientMessageType.Ready });
      } else if (keys.W.isDown || keys.UP.isDown) {
        this.connection.sendMessage({ type: ClientMessageType.Rotate });
      } else if (keys.S.isDown || keys.DOWN.isDown) {
      } else if (keys.D.isDown || keys.RIGHT.isDown) {
        this.connection.sendMessage({ type: ClientMessageType.MoveRight });
      } else if (keys.A.isDown || keys.LEFT.isDown) {
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

    console.log(state);

    const youArePlayer1 = this.currentUserID == state.player1?.id;
    const youArePlayer2 = this.currentUserID == state.player2?.id;
    const youAreReady = (youArePlayer1 && state.player1?.ready) || (youArePlayer2 && state.player2?.ready);
    const theyAreReady = (youArePlayer1 && state.player2?.ready) || (youArePlayer2 && state.player1?.ready);

    if (state.player1 !== undefined && state.player2 === undefined) {
      this.centerText?.setText(`waiting for them to join`);
    } else if (state.winner !== undefined) {
      if (state.winner == "tie") {
        if (youAreReady && !theyAreReady) {
          this.centerText?.setText(`you both lost\nwaiting on them`);
        } else {
          this.centerText?.setText(`you both lost\nplace space when you're ready`);
        }
      } else if (state.winner.id == this.currentUserID) {
        if (youAreReady && !theyAreReady) {
          this.centerText?.setText(`they lost\nwaiting on them`);
        } else {
          this.centerText?.setText(`they lost\npress space when you're ready`);
        }
      } else {
        if (youAreReady && !theyAreReady) {
          this.centerText?.setText(`you lost\nwaiting on them`);
        } else {
          this.centerText?.setText(`you lost\npress space when you're ready`);
        }
      }
    }
    else if (youAreReady && !theyAreReady) {
      this.centerText?.setText(`waiting for them`);
    } else if (!youAreReady) {
      this.centerText?.setText(`press space when you're ready`);
    }


    if (state.player1?.ready && state.player2?.ready) {
      this.centerText?.setText("");
    }

    // todo: clear sprites from cleared bricks
    state.bricks.forEach((brick) => {
      if (!this.existingBricks.has(brick.id)) {
        this.existingBricks.set(brick.id, this.add.sprite(this.x(brick.point.x), this.y(brick.point.y, youArePlayer2), "grass").setTint(0x888888));
      } else {
        const sprite = this.existingBricks.get(brick.id);
        sprite?.setX(this.x(brick.point.x));
        sprite?.setY(this.y(brick.point.y, youArePlayer2));
        sprite?.setTint(0x888888);
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
        this.existingBricks.set(brick.id, this.add.sprite(this.x(brick.point.x), this.y(brick.point.y, youArePlayer2), "grass"));
      } else {
        const existingBrick = this.existingBricks.get(brick.id);
        existingBrick?.setX(this.x(brick.point.x));
        existingBrick?.setY(this.y(brick.point.y, youArePlayer2));
      }
    });

    state.player2Falling?.bricks.forEach((brick) => {
      if (!this.existingBricks.has(brick.id)) {
        this.existingBricks.set(brick.id, this.add.sprite(this.x(brick.point.x), this.y(brick.point.y, youArePlayer2), "grass"));
      } else {
        const existingBrick = this.existingBricks.get(brick.id);
        existingBrick?.setX(this.x(brick.point.x));
        existingBrick?.setY(this.y(brick.point.y, youArePlayer2));
      }
    });
  }
}
function lerp(from: GameState, to: GameState, pctElapsed: number): GameState {
  return to;
}