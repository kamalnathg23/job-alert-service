import { createClient } from "redis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let redisClient: ReturnType<typeof createClient> | null = null;
let redisAvailable = true;

async function getRedis() {
  if (!redisAvailable) return null;

  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
    });

    redisClient.on("error", (err) => {
      console.error("[cache] Redis error:", err.message);
      redisAvailable = false;
      redisClient = null;
    });

    try {
      await redisClient.connect();
      redisAvailable = true;
    } catch (err) {
      console.error("[cache] Redis connect failed:", err);
      redisAvailable = false;
      redisClient = null;
    }
  }

  return redisClient;
}

const inFlight = new Map<string, Promise<unknown>>();

export interface JobSearchParams {
  location?: string;
  remote?: boolean;
  skills?: string[];
  limit?: number;
}

function buildCacheKey(params: JobSearchParams): string {
  return `jobs:search:${JSON.stringify({
    location: params.location ?? "",
    remote: params.remote ?? "",
    skills: [...(params.skills ?? [])].sort().join(","),
    limit: params.limit ?? 20,
  })}`;
}

async function fetchFromDB(params: JobSearchParams) {
  const jobs = await prisma.job.findMany({
    where: {
      ...(params.location && {
        location: { contains: params.location, mode: "insensitive" },
      }),
      ...(params.remote !== undefined && { remote: params.remote }),
      ...(params.skills?.length && {
        skills: { hasSome: params.skills },
      }),
    },
    take: params.limit ?? 20,
    orderBy: { createdAt: "desc" },
  });
  return jobs;
}

export async function searchJobs(params: JobSearchParams) {
  const cacheKey = buildCacheKey(params);
  const redis = await getRedis();

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { source: "cache", jobs: JSON.parse(cached) };
      }
    } catch (err) {
      console.error("[cache] Redis get failed:", err);
      redisAvailable = false;
    }
  }

  if (inFlight.has(cacheKey)) {
    const jobs = await inFlight.get(cacheKey);
    return { source: "db-deduped", jobs };
  }

  const fetchPromise = fetchFromDB(params);
  inFlight.set(cacheKey, fetchPromise);

  try {
    const jobs = await fetchPromise;

    if (redis) {
      redis
        .set(cacheKey, JSON.stringify(jobs), { EX: 60 })
        .catch((err) => console.error("[cache] Redis set failed:", err));
    }

    return { source: "db", jobs };
  } finally {
    inFlight.delete(cacheKey);
  }
}

export async function invalidateSearchCache() {
  const redis = await getRedis();
  if (!redis) return;

  try {
    const keys = await redis.keys("jobs:search:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (err) {
    console.error("[cache] invalidate failed:", err);
  }
}