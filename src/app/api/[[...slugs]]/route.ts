// import { redis } from "@/lib/redis";
// import { Elysia, t } from "elysia";
// import { nanoid } from "nanoid";
// import { authMiddleware } from "./auth";
// import { z } from "zod";
// import { Message, realtime } from "@/lib/realtime";

// const ROOM_TTL_SECONDS = 60 * 10;

// const rooms = new Elysia({ prefix: "/room" })
//   .post("/create", async () => {
//     const roomId = nanoid();

//     await redis.hset(`meta:${roomId}`, {
//       connected: [],
//       createdAt: Date.now(),
//     });

//     await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS);

//     return { roomId };
//   })
//   .use(authMiddleware)
//   .get(
//     "/ttl",
//     async ({ auth }) => {
//       const ttl = await redis.ttl(`meta:${auth.roomId}`);
//       return { ttl: ttl > 0 ? ttl : 0 };
//     },
//     { query: z.object({ roomId: z.string() }) }
//   )
//   .delete(
//     "/",
//     async ({ auth }) => {
//       await realtime
//         .channel(auth.roomId)
//         .emit("chat.destroy", { isDestroyed: true });

//       await Promise.all([
//         redis.del(auth.roomId),
//         redis.del(`meta:${auth.roomId}`),
//         redis.del(`messages:${auth.roomId}`),
//       ]);
//     },
//     { query: z.object({ roomId: z.string() }) }
//   );

// const messages = new Elysia({ prefix: "/messages" })
//   .use(authMiddleware)
//   .post(
//     "/",
//     async ({ body, auth }) => {
//       const { sender, text } = body;
//       const { roomId } = auth;

//       const roomExists = await redis.exists(`meta:${roomId}`);

//       if (!roomExists) {
//         throw new Error("Room does not exist");
//       }

//       const message: Message = {
//         id: nanoid(),
//         sender,
//         text,
//         timestamp: Date.now(),
//         roomId,
//       };

//       // add message to history
//       await redis.rpush(`messages:${roomId}`, {
//         ...message,
//         token: auth.token,
//       });
//       await realtime.channel(roomId).emit("chat.message", message);

//       // housekeeping
//       const remaining = await redis.ttl(`meta:${roomId}`);

//       await redis.expire(`messages:${roomId}`, remaining);
//       await redis.expire(`history:${roomId}`, remaining);
//       await redis.expire(roomId, remaining);
//     },
//     {
//       query: z.object({ roomId: z.string() }),
//       body: z.object({
//         sender: z.string().max(100),
//         text: z.string().max(1000),
//       }),
//     }
//   )
//   .get(
//     "/",
//     async ({ auth }) => {
//       const messages = await redis.lrange<Message>(
//         `messages:${auth.roomId}`,
//         0,
//         -1
//       );

//       return {
//         messages: messages.map((m) => ({
//           ...m,
//           token: m.token === auth.token ? auth.token : undefined,
//         })),
//       };
//     },
//     { query: z.object({ roomId: z.string() }) }
//   );

// const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages);

// export const GET = app.fetch;
// export const POST = app.fetch;
// export const DELETE = app.fetch;

// export type App = typeof app;
import { redis } from "@/lib/redis";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { authMiddleware } from "./auth";
import { z } from "zod";
import { Message, realtime } from "@/lib/realtime";

// 10 minutes
const ROOM_TTL_SECONDS = 60 * 10;

/* --------------------------
   ROOM ROUTES
--------------------------- */
const rooms = new Elysia({ prefix: "/room" })
  .post("/create", async () => {
    const roomId = nanoid();

    await redis.hset(`meta:${roomId}`, {
      connected: [],
      createdAt: Date.now(),
    });

    await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS);

    return { roomId };
  })
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`);
      return { ttl: ttl > 0 ? ttl : 0 };
    },
    { query: z.object({ roomId: z.string() }) }
  )
  .delete(
    "/",
    async ({ auth }) => {
      await realtime
        .channel(auth.roomId)
        .emit("chat.destroy", { isDestroyed: true });

      await Promise.all([
        redis.del(auth.roomId),
        redis.del(`meta:${auth.roomId}`),
        redis.del(`messages:${auth.roomId}`),
      ]);
    },
    { query: z.object({ roomId: z.string() }) }
  );

/* --------------------------
   MESSAGE ROUTES
--------------------------- */
const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth }) => {
      const { sender, text } = body;
      const { roomId } = auth;

      const roomExists = await redis.exists(`meta:${roomId}`);

      if (!roomExists) {
        throw new Error("Room does not exist");
      }

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      };

      await redis.rpush(`messages:${roomId}`, {
        ...message,
        token: auth.token,
      });

      await realtime.channel(roomId).emit("chat.message", message);

      const remaining = await redis.ttl(`meta:${roomId}`);
      await redis.expire(`messages:${roomId}`, remaining);
      await redis.expire(`history:${roomId}`, remaining);
      await redis.expire(roomId, remaining);
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100),
        text: z.string().max(1000),
      }),
    }
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(
        `messages:${auth.roomId}`,
        0,
        -1
      );

      return {
        messages: messages.map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      };
    },
    { query: z.object({ roomId: z.string() }) }
  );

/* --------------------------
   APP ROOT
--------------------------- */
const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages);

/* --------------------------
   CORS FIX (add below app)
--------------------------- */

// Change this in production:
// ALLOWED_ORIGIN="https://your-frontend-domain.com"
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || "https://chat.subhodeep.tech";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  // if using cookies/auth, uncomment this:
  // "Access-Control-Allow-Credentials": "true",
};

// Preflight handler
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// Wrap all responses with CORS
async function withCors(resp: Response) {
  const body = await resp.text();
  const headers = new Headers(resp.headers);

  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }

  return new Response(body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

/* --------------------------
   Final exports (with CORS)
--------------------------- */
export const GET = async (request: Request) => {
  const resp = await app.fetch(request);
  return withCors(resp);
};

export const POST = async (request: Request) => {
  const resp = await app.fetch(request);
  return withCors(resp);
};

export const DELETE = async (request: Request) => {
  const resp = await app.fetch(request);
  return withCors(resp);
};

export type App = typeof app;
