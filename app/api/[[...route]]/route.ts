import { Redis } from "@upstash/redis/cloudflare";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

export const runtime = "edge";

const app = new Hono().basePath("/api");

type EnvConfig = {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
};

app.use("/*", cors());

app.get("/search", async (c) => {
  try {
    const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } =
      env<EnvConfig>(c);

    const redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });

    const query = c.req.query("q")?.toUpperCase();
    if (!query) {
      return c.json(
        {
          message: "Query Is Required",
        },
        {
          status: 400,
        }
      );
    }

    const res = [];
    let temp: string[] = [];

    const start = performance.now();
    
    const rank = await redis.zrank("terms", query);
    if (rank !== null && rank !== undefined) {
      temp = await redis.zrange<string[]>("terms", rank, rank + 100);
    }

    const end = performance.now();

    for (const el of temp) {
      if (!el.startsWith(query)) {
        break;
      }
      if (el.endsWith("*")) {
        res.push(el.substring(0, el.length - 1));
      }
    }

    return c.json({
      results: res,
      duration: end - start,
    });
  } catch (error) {
    console.log("[REDIS_DATA_FETCH_ERROR]", error);
    return c.json(
      {
        results: [],
        message: "Something Went Wrong",
      },
      {
        status: 500,
      }
    );
  }
});

export const GET = handle(app);
export const POST = handle(app);
export default app as never;
