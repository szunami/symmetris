import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

import { UserId, RoomId, Application, startServer, verifyJwt } from "@hathora/server-sdk";
import dotenv from "dotenv";
import { GameState, Point, Tetronimo } from "../common/types";
import { ClientMessage, ClientMessageType, ServerMessage, ServerMessageType } from "../common/messages";

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
        bricks: [
          { point: { x: 0, y: 10 }, id: uuidv4() },
          { point: { x: 5, y: 10 }, id: uuidv4() }
        ],
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

        game.player1Falling = player1RandomPiece();
        game.player2Falling = player2RandomPiece();
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
            if (game.player1Falling?.pivot) {
              game.player1Falling.pivot.x++;
            }
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
            if (game.player1Falling?.pivot) {
              game.player1Falling.pivot.x = game.player1Falling.pivot.x - 1;
            }
          }
        }

        if (message.type === ClientMessageType.Rotate) {
          var rotateBlocked = false;

          game.player1Falling?.bricks.forEach(brick => {
            var pivot = game.player1Falling?.pivot!;
            var offsetX = brick.point.x - pivot.x;
            var offsetY = brick.point.y - pivot.y;
            var newX = pivot.x - offsetY;
            var newY = pivot.y + offsetX;
            if (occupiedPoints.has(key({ x: newX, y: newY }))
            ) {
              rotateBlocked = true;
            }
          });

          if (!rotateBlocked) {
            game.player1Falling?.bricks.forEach(brick => {
              var pivot = game.player1Falling?.pivot!;
              var offsetX = brick.point.x - pivot.x;
              var offsetY = brick.point.y - pivot.y;
              brick.point.x = pivot.x - offsetY;
              brick.point.y = pivot.y + offsetX;
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

      if (userId === game.player2?.id) {
        if (message.type === ClientMessageType.MoveRight) {
          // todo: check if blocked
          var rightBlocked = false;

          game.player2Falling?.bricks.forEach(brick => {
            if (occupiedPoints.has(key({ x: brick.point.x + 1, y: brick.point.y }))
              || brick.point.x + 1 == 10
            ) {
              rightBlocked = true;
            }
          });

          if (!rightBlocked) {
            game.player2Falling?.bricks.forEach(brick => {
              brick.point.x = brick.point.x + 1;
            });
            if (game.player2Falling?.pivot) {
              game.player2Falling.pivot.x++;
            }
          }
        }

        if (message.type === ClientMessageType.MoveLeft) {
          // todo: check if blocked
          var leftBlocked = false;

          game.player2Falling?.bricks.forEach(brick => {
            if (occupiedPoints.has(key({ x: brick.point.x - 1, y: brick.point.y }))
              || brick.point.x - 1 == -1) {
              leftBlocked = true;
            }
          });

          if (!leftBlocked) {
            game.player2Falling?.bricks.forEach(brick => {
              brick.point.x = brick.point.x - 1;
            });
            if (game.player2Falling?.pivot) {
              game.player2Falling.pivot.x = game.player2Falling.pivot.x - 1;
            }
          }
        }

        if (message.type === ClientMessageType.Rotate) {
          var rotateBlocked = false;

          game.player2Falling?.bricks.forEach(brick => {
            var pivot = game.player2Falling?.pivot!;
            var offsetX = brick.point.x - pivot.x;
            var offsetY = brick.point.y - pivot.y;
            var newX = pivot.x - offsetY;
            var newY = pivot.y + offsetX;
            if (occupiedPoints.has(key({ x: newX, y: newY }))
            ) {
              rotateBlocked = true;
            }
          });

          if (!rotateBlocked) {
            game.player2Falling?.bricks.forEach(brick => {
              var pivot = game.player2Falling?.pivot!;
              var offsetX = brick.point.x - pivot.x;
              var offsetY = brick.point.y - pivot.y;
              brick.point.x = pivot.x - offsetY;
              brick.point.y = pivot.y + offsetX;
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

  if (game.winner) {
    return;
  }

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
      game.player2Falling?.bricks.forEach((enemyBrick) => {
        if (brick.point.x === enemyBrick.point.x && brick.point.y === enemyBrick.point.y
          || brick.point.x === enemyBrick.point.x && brick.point.y === enemyBrick.point.y + 1
        ) {
          player1Blocked = true;
        }
      })
    });
    if (!player1Blocked) {
      game.player1Falling?.bricks.forEach((brick) => {
        brick.point.y = brick.point.y + 1;
      })
      if (game.player1Falling?.pivot) {
        game.player1Falling.pivot.y = game.player1Falling?.pivot.y + 1;
      }
    }
    if (player1Blocked) {
      game.player1Falling?.bricks.forEach((brick) => {
        game.bricks.push(brick);
      });
      game.player1Falling = player1RandomPiece();
    }


    var player2Blocked = false;
    game.player2Falling?.bricks.forEach((brick) => {
      if (occupiedPoints.has(key({ x: brick.point.x, y: brick.point.y - 1 }))) {
        player2Blocked = true;
      }
      game.player1Falling?.bricks.forEach((enemyBrick) => {
        if (brick.point.x === enemyBrick.point.x && brick.point.y === enemyBrick.point.y
          || brick.point.x === enemyBrick.point.x && brick.point.y === enemyBrick.point.y - 1
        ) {
          player2Blocked = true;
        }
      })
    });
    if (!player2Blocked) {
      game.player2Falling?.bricks.forEach((brick) => {
        brick.point.y = brick.point.y - 1;
      })
      if (game.player2Falling?.pivot) {
        game.player2Falling.pivot.y = game.player2Falling?.pivot.y - 1;
      }
    }
    if (player2Blocked) {
      game.player2Falling?.bricks.forEach((brick) => {
        game.bricks.push(brick);
      });
      game.player2Falling = player2RandomPiece();
    }

    // todo: check for clear
    occupiedPoints.clear();
    game.bricks.forEach(brick => {
      occupiedPoints.add(key(brick.point));
    })

    for (let b = 9; b >= 0; b--) {
      var rowClear = true;
      for (let a = 0; a < 10; a++) {
        if (!occupiedPoints.has(key({ x: a, y: b }))) {
          rowClear = false;
        }
      }

      if (rowClear) {
        console.log(`${b} is clear`);

        console.log(`bricks: ${game.bricks.length}`);
        game.bricks = game.bricks.filter(brick => brick.point.y != b);
        console.log(`bricks: ${game.bricks.length}`);

        game.bricks.forEach(brick => {
          console.log(`y: ${brick.point.y}`);
          if (brick.point.y < b) {
            brick.point.y += 1;
            console.log(brick.point.y);
            console.log(`new y: ${brick.point.y}`);
          }
        });
        occupiedPoints.clear();
        game.bricks.forEach(brick => {
          occupiedPoints.add(key(brick.point));
        })
      }
    }

    occupiedPoints.clear();
    game.bricks.forEach(brick => {
      occupiedPoints.add(key(brick.point));
    })

    for (let b = 10; b < 20; b++) {
      var rowClear = true;
      for (let a = 0; a < 10; a++) {
        if (!occupiedPoints.has(key({ x: a, y: b }))) {
          rowClear = false;
        }
      }

      if (rowClear) {
        console.log(`${b} is clear`);

        console.log(`bricks: ${game.bricks.length}`);
        game.bricks = game.bricks.filter(brick => brick.point.y != b);
        console.log(`bricks: ${game.bricks.length}`);

        game.bricks.forEach(brick => {
          console.log(`y: ${brick.point.y}`);
          if (brick.point.y > b) {
            brick.point.y -= 1;
            console.log(brick.point.y);
            console.log(`new y: ${brick.point.y}`);
          }
        });
        occupiedPoints.clear();
        game.bricks.forEach(brick => {
          occupiedPoints.add(key(brick.point));
        })
      }
    }

    // todo: check for player 1 falling in player 2 zone

    var player1lost = false;

    for (let a = 0; a < 10; a++) {
      if (occupiedPoints.has(key({ x: a, y: 0 }))) {
        player1lost = true;
      }
    }

    game.player2Falling?.bricks.forEach(brick => {
      if (brick.point.y == 0) {
        player1lost = true;
      }
    })

    var player2lost = false;

    for (let a = 0; a < 10; a++) {
      if (occupiedPoints.has(key({ x: a, y: 19 }))) {
        player2lost = true;
      }
    }

    game.player1Falling?.bricks.forEach(brick => {
      if (brick.point.y == 19) {
        player2lost = true;
      }
    })

    if (player1lost && player2lost) {
      game.winner = "tie"
    }
    else if (player1lost) {
      game.winner = game.player2;
    }
    else if (player2lost) {
      game.winner = game.player1;
    }
  }
}

function player1RandomPiece(): Tetronimo {
  const r = Math.floor(Math.random() * 7);
  if (r == 0) {
    return player1line();
  } else if (r == 1) {
    return player1j();
  } else if (r == 2) {
    return player1L();
  } else if (r == 3) {
    return player1Square();
  } else if (r == 4) {
    return player1S();
  } else if (r == 5) {
    return player1Z();
  }
  return player1T();
}

function player1line(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 0 }, id: uuidv4(), },
      { point: { x: 1, y: 0 }, id: uuidv4() },
      { point: { x: 2, y: 0 }, id: uuidv4() },
      { point: { x: 3, y: 0 }, id: uuidv4() }
    ],
    pivot: { x: 1.5, y: 0.5 }
  };
}

function player1j(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 0 }, id: uuidv4(), },
      { point: { x: 0, y: -1 }, id: uuidv4() },
      { point: { x: 1, y: 0 }, id: uuidv4() },
      { point: { x: 2, y: 0 }, id: uuidv4() }
    ],
    pivot: { x: 1, y: 0 }
  };
}

function player1L(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 0 }, id: uuidv4(), },
      { point: { x: 1, y: 0 }, id: uuidv4() },
      { point: { x: 2, y: 0 }, id: uuidv4() },
      { point: { x: 2, y: -1 }, id: uuidv4() }

    ],
    pivot: { x: 1, y: 0 }
  };
}

function player1Square(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 0 }, id: uuidv4(), },
      { point: { x: 1, y: 0 }, id: uuidv4() },
      { point: { x: 0, y: -1 }, id: uuidv4() },
      { point: { x: 1, y: -1 }, id: uuidv4() }

    ],
    pivot: { x: 0.5, y: -0.5 }
  };
}

function player1S(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 0 }, id: uuidv4(), },
      { point: { x: 1, y: 0 }, id: uuidv4() },
      { point: { x: 1, y: -1 }, id: uuidv4() },
      { point: { x: 2, y: -1 }, id: uuidv4() }
    ],
    pivot: { x: 1, y: 0 }
  };
}

function player1Z(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: -1 }, id: uuidv4(), },
      { point: { x: 1, y: -1 }, id: uuidv4() },
      { point: { x: 1, y: 0 }, id: uuidv4() },
      { point: { x: 2, y: 0 }, id: uuidv4() }
    ],
    pivot: { x: 1, y: 0 }
  };
}

function player1T(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 0 }, id: uuidv4(), },
      { point: { x: 1, y: 0 }, id: uuidv4() },
      { point: { x: 1, y: -1 }, id: uuidv4() },
      { point: { x: 2, y: 0 }, id: uuidv4() }
    ],
    pivot: { x: 1, y: 0 }
  };
}

function player2RandomPiece(): Tetronimo {
  const r = Math.floor(Math.random() * 7);
  if (r == 0) {
    return player2line();
  } else if (r == 1) {
    return player2j();
  } else if (r == 2) {
    return player2L();
  } else if (r == 3) {
    return player2Square();
  } else if (r == 4) {
    return player2S();
  } else if (r == 5) {
    return player2Z();
  }
  return player2T();
}

function player2line(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 19 }, id: uuidv4(), },
      { point: { x: 1, y: 19 }, id: uuidv4() },
      { point: { x: 2, y: 19 }, id: uuidv4() },
      { point: { x: 3, y: 19 }, id: uuidv4() }
    ],
    pivot: { x: 1.5, y: 19.5 }
  };
}

function player2j(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 19 }, id: uuidv4(), },
      { point: { x: 0, y: 20 }, id: uuidv4() },
      { point: { x: 1, y: 19 }, id: uuidv4() },
      { point: { x: 2, y: 19 }, id: uuidv4() }
    ],
    pivot: { x: 1, y: 19 }
  };
}

function player2L(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 19 }, id: uuidv4(), },
      { point: { x: 1, y: 19 }, id: uuidv4() },
      { point: { x: 2, y: 19 }, id: uuidv4() },
      { point: { x: 2, y: 20 }, id: uuidv4() }

    ],
    pivot: { x: 1, y: 19 }
  };
}

function player2Square(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 19 }, id: uuidv4(), },
      { point: { x: 1, y: 19 }, id: uuidv4() },
      { point: { x: 0, y: 20 }, id: uuidv4() },
      { point: { x: 1, y: 20 }, id: uuidv4() }

    ],
    pivot: { x: 0.5, y: 19.5 }
  };
}

function player2S(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 19 }, id: uuidv4(), },
      { point: { x: 1, y: 19 }, id: uuidv4() },
      { point: { x: 1, y: 20 }, id: uuidv4() },
      { point: { x: 2, y: 20 }, id: uuidv4() }
    ],
    pivot: { x: 1, y: 19 }
  };
}

function player2Z(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 20 }, id: uuidv4(), },
      { point: { x: 1, y: 20 }, id: uuidv4() },
      { point: { x: 1, y: 19 }, id: uuidv4() },
      { point: { x: 2, y: 19 }, id: uuidv4() }
    ],
    pivot: { x: 1, y: 19 }
  };
}

function player2T(): Tetronimo {
  return {
    bricks: [
      { point: { x: 0, y: 19 }, id: uuidv4(), },
      { point: { x: 1, y: 19 }, id: uuidv4() },
      { point: { x: 1, y: 20 }, id: uuidv4() },
      { point: { x: 2, y: 19 }, id: uuidv4() }
    ],
    pivot: { x: 1, y: 19 }
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




