import { Scene } from "phaser";
import { HathoraClient } from "@hathora/client-sdk";
import { RoomConnection } from "../connection";
import InputText from "phaser3-rex-plugins/plugins/inputtext";

// Instantiate an object which represents our client
const connectionDetails = import.meta.env.DEV
  ? { host: "localhost", port: 4000, transportType: "tcp" as const }
  : undefined;

const client = new HathoraClient(process.env.APP_ID!, connectionDetails);

// Here we extend from Phaser's Scene class to create a game scene compatible with Phaser
export class BootScene extends Scene {

  private logoSprite: Phaser.GameObjects.Sprite | undefined;

  constructor() {
    // This string is used to identify this scene when it's running
    super("scene-boot");
  }

  // Called immediately after the constructor, this function is used to preload assets
  preload() {
    // Load our assets from before
    this.load.image("grass", "grass.png");
    this.load.image("logo", "logo.svg");
  }

  // Called before the update loop begins, create is used to intialize what the scene needs
  create() {
    this.cameras.main.setBackgroundColor("#172038");

    const { width, height } = this.scale;

    this.logoSprite = this.add.sprite(300, 200, "logo").setScale(0.1, 0.1);

    // Make a call to our getToken function, defined below
    getToken().then(async (token) => {
      const createButton = this.add
        .text(width / 4, 3 * height / 4, "Create New Game", {
          fontSize: "20px",
          fontFamily: "futura",
          backgroundColor: "#3c5e8b"
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setPadding(10)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => createButton.setStyle({ fill: "#f39c12" }))
        .on("pointerout", () => createButton.setStyle({ fill: "#FFF" }))
        .on("pointerdown", async () => {
          const roomId = await client.createPrivateLobby(token);
          const connection = new RoomConnection(client, token, roomId);
          await connection.connect();
          // After we have a connection and token, start the game scene, passing in both
          this.scene.start("scene-game", { connection, token });
        });

      const joinButton = this.add
        .text(3 * width / 4, (height * 3) / 4, "Join Existing Game", {
          fontSize: "20px",
          fontFamily: "futura",
          backgroundColor: "#3c5e8b"
        })
        .setInteractive({ useHandCursor: true })
        .setOrigin(0.5)
        .setPadding(10)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => joinButton.setStyle({ fill: "#f39c12" }))
        .on("pointerout", () => joinButton.setStyle({ fill: "#FFF" }))
        .on("pointerdown", async () => {
          const roomId = inputText.text?.trim();
          if (roomId === undefined || roomId === "") {
            alert("Please enter an existing room code or create a new game!");
            return;
          }
          const connection = new RoomConnection(client, token, roomId);
          await connection.connect();
          this.scene.start("scene-game", { connection, token });
        });

      const inputTextConfig: InputText.IConfig = {
        border: 10,
        borderColor: "black",
        backgroundColor: "#ebede9",
        placeholder: "Room Code",
        color: "black",
        fontFamily: "futura",
        fontSize: "16px",
      };
      const inputText = new InputText(this, joinButton.x, joinButton.y - 40, 100, 30, inputTextConfig);
      this.add.existing(inputText);
    });
  }

  update(time: number, deltaTime: number) {
    this.logoSprite?.setAngle(
      this.logoSprite.angle + deltaTime * 0.1
    )
  }
}

// The getToken function first checks sessionStorage to see if there is an existing token, and if there is returns it. If not, it logs the user into a new session and updates the sessionStorage key.
async function getToken(): Promise<string> {
  return await client.loginAnonymous();
}
