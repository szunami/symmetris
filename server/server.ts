import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

import { UserId, RoomId, Application, startServer, verifyJwt } from "@hathora/server-sdk";
import dotenv from "dotenv";
import { GameState, Point, Tetronimo } from "../common/types";
import { ClientMessage, ClientMessageType, ServerMessage, ServerMessageType } from "../common/messages";
import { V4MAPPED } from "dns";

// The millisecond tick rate
const TICK_INTERVAL_MS = 500;

// A map which the server uses to contain all room's InternalState instances
const rooms: Map<RoomId, GameState> = new Map();

// Create an object to represent our Store
const store: Application = {
  verifyToken(token: string): UserId | undefined {
    const userId = verifyJwt(token, process.env.HATHORA_APP_SECRET!);
    if (userId === undefined) {
      console.error("Failed to verify token", token);
    }
    return userId;
  },

  // subscribeUser is called when a new user enters a room, it's an ideal place to do any player-specific initialization steps
  subscribeUser(roomId: RoomId, userId: string): void {
    if (!rooms.has(roomId)) {
      console.log("newRoom", roomId, userId);
      // todo: interesting initial config
      rooms.set(roomId, {
        bricks: [{ point: { x: 0, y: 10 }, id: uuidv4() }],
        player1: {
          id: userId
        },
      });
    }
    console.log("subscribeUser", roomId, userId);
    const game = rooms.get(roomId)!;

    if (game.player2 === undefined) {
      if (game.player1?.id !== userId) {
        game.player2 = { id: userId };

        game.player1Falling = {
          bricks: [{ point: { x: 0, y: 0 }, id: uuidv4() }]
        };

        game.player2Falling = {
          bricks: [{ point: { x: 0, y: 20 }, id: uuidv4() }]
        };
      }
    }
  },

  // unsubscribeUser is called when a user disconnects from a room, and is the place where you'd want to do any player-cleanup
  unsubscribeUser(roomId: RoomId, userId: string): void {
    // Make sure the room exists
    if (!rooms.has(roomId)) {
      return;
    }
    console.log("unsubscribeUser", roomId, userId);
  },

  // onMessage is an integral part of your game's server. It is responsible for reading messages sent from the clients and handling them accordingly, this is where your game's event-based logic should live
  onMessage(roomId: RoomId, userId: string, data: ArrayBuffer): void {
    if (!rooms.has(roomId)) {
      return;
    }

    // Get the player, or return out of the function if they don't exist
    const game = rooms.get(roomId)!;

    // Parse out the data string being sent from the client
    const message: ClientMessage = JSON.parse(Buffer.from(data).toString("utf8"));

    if (message.type === ClientMessageType.Ping) {
      const msg: ServerMessage = {
        type: ServerMessageType.PingResponse,
        id: message.id,
      };
      server.sendMessage(roomId, userId, Buffer.from(JSON.stringify(msg), "utf8"));
    } else {

      const occupiedPoints = new Set<string>();
      game.bricks.forEach(brick => {
        occupiedPoints.add(key(brick.point));
      });

      if (userId === game.player1?.id) {
        // Handle the various message types, specific to this game
        if (message.type === ClientMessageType.MoveRight) {
          // todo: check if blocked
          var rightBlocked = false;

          game.player1Falling?.bricks.forEach(brick => {
            if (occupiedPoints.has(key({ x: brick.point.x + 1, y: brick.point.y }))
              || brick.point.x + 1 == 10
            ) {
              rightBlocked = true;
            }
          });

          if (!rightBlocked) {
            game.player1Falling?.bricks.forEach(brick => {
              brick.point.x = brick.point.x + 1;
            });
          }
        }

        if (message.type === ClientMessageType.MoveLeft) {
          // todo: check if blocked
          var leftBlocked = false;

          game.player1Falling?.bricks.forEach(brick => {
            if (occupiedPoints.has(key({ x: brick.point.x - 1, y: brick.point.y }))
              || brick.point.x - 1 == -1) {
              leftBlocked = true;
            }
          });

          if (!leftBlocked) {
            game.player1Falling?.bricks.forEach(brick => {
              brick.point.x = brick.point.x - 1;
            });
          }
        }

        // todo: remove player2s update here!
        const msg: ServerMessage = {
          type: ServerMessageType.StateUpdate,
          state: game,
          ts: Date.now(),
        }
        server.sendMessage(roomId, userId, Buffer.from(JSON.stringify(msg), "utf8"));
      }
    }
  },
};

// Load our environment variables into process.env
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });
if (process.env.HATHORA_APP_SECRET === undefined) {
  throw new Error("HATHORA_APP_SECRET not set");
}

// Start the server
const port = parseInt(process.env.PORT ?? "4000");
const server = await startServer(store, port);
console.log(`Server listening on port ${port}`);

// Start the game's update loop
setInterval(() => {
  rooms.forEach((game, roomId) => {
    // Tick each room's game
    tick(game, 0 - 6706 - 706 - 706 - 7 / 1000);

    // Send the state updates to each client connected to that room
    broadcastStateUpdate(roomId);
  });
}, TICK_INTERVAL_MS);


function key(point: Point): string {
  return `(${point.x}, ${point.y}`;
}

// The frame-by-frame logic of your game should live in it's server's tick function. This is often a place to check for collisions, compute score, and so forth
function tick(game: GameState, deltaMs: number) {

  const occupiedPoints = new Set<string>();
  game.bricks.forEach(brick => {
    occupiedPoints.add(key(brick.point));
  })

  if (game.player1 !== undefined && game.player2 !== undefined) {

    var player1Blocked = false;
    game.player1Falling?.bricks.forEach((brick) => {
      if (occupiedPoints.has(key({ x: brick.point.x, y: brick.point.y + 1 }))) {
        player1Blocked = true;
      }
    });
    if (!player1Blocked) {
      game.player1Falling?.bricks.forEach((brick) => {
        brick.point.y = brick.point.y + 1;
      })
    }
    if (player1Blocked) {
      game.player1Falling?.bricks.forEach((brick) => {
        game.bricks.push(brick);
      });
      game.player1Falling = player1line();
    }

    game.player2Falling?.bricks.forEach((brick) => {
      if (!occupiedPoints.has(key({ x: brick.point.x, y: brick.point.y - 1 }))) {
        brick.point.y = brick.point.y - 1;
      }
    });
  }
}

function player1line(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 0 }, id: uuidv4() },
      { point: { x: 1, y: 0 }, id: uuidv4() },
      { point: { x: 2, y: 0 }, id: uuidv4() },
      { point: { x: 3, y: 0 }, id: uuidv4() }
    ]
  };
}

function broadcastStateUpdate(roomId: RoomId) {
  const game = rooms.get(roomId)!;
  const now = Date.now();
  // Map properties in the game's state which the clients need to know about to render the game

  // Send the state update to each connected client
  const msg: ServerMessage = {
    type: ServerMessageType.StateUpdate,
    state: game,
    ts: now,
  };
  server.broadcastMessage(roomId, Buffer.from(JSON.stringify(msg), "utf8"));
}




