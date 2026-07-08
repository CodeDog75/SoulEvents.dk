import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const RATE_LIMIT_MESSAGE = "Du har foretaget for mange forsøg. Prøv igen om et øjeblik.";

export type RateLimitAction =
  | "auth:login"
  | "auth:password-reset"
  | "auth:resend-verification"
  | "auth:signup";

type RateLimitConfig = {
  limit: number;
  windowSeconds: number;
  blockSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type MemoryEntry = {
  blockedUntil: number;
  count: number;
  windowStart: number;
};

const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  "auth:login": {
    limit: 8,
    windowSeconds: 10 * 60,
    blockSeconds: 10 * 60,
  },
  "auth:password-reset": {
    limit: 10,
    windowSeconds: 15 * 60,
    blockSeconds: 15 * 60,
  },
  "auth:resend-verification": {
    limit: 3,
    windowSeconds: 15 * 60,
    blockSeconds: 15 * 60,
  },
  "auth:signup": {
    limit: 5,
    windowSeconds: 30 * 60,
    blockSeconds: 30 * 60,
  },
};

const PASSWORD_RESET_IP_BACKSTOP: RateLimitConfig = {
  limit: 60,
  windowSeconds: 15 * 60,
  blockSeconds: 15 * 60,
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __souleventsRateLimitStore?: Map<string, MemoryEntry>;
};

const memoryStore = globalForRateLimit.__souleventsRateLimitStore ?? new Map<string, MemoryEntry>();
globalForRateLimit.__souleventsRateLimitStore = memoryStore;

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;
  readonly status = 429;

  constructor(retryAfterSeconds: number) {
    super(RATE_LIMIT_MESSAGE);
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isRateLimitExceededError(error: unknown): error is RateLimitExceededError {
  return error instanceof RateLimitExceededError;
}

export async function assertRateLimit(action: RateLimitAction) {
  const config = RATE_LIMITS[action];
  const ip = await getClientIp();
  const ipHash = hashSubject("ip", ip);

  const result = await checkPersistentRateLimit(action, ipHash, config);

  if (!result.allowed) {
    throw new RateLimitExceededError(result.retryAfterSeconds);
  }
}

export async function assertPasswordResetRateLimit(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const emailHash = hashSubject("email", normalizedEmail);
  const emailResult = await checkPersistentRateLimit(
    "auth:password-reset:email",
    emailHash,
    RATE_LIMITS["auth:password-reset"],
  );

  if (!emailResult.allowed) {
    throw new RateLimitExceededError(emailResult.retryAfterSeconds);
  }

  const ip = await getClientIp();
  const ipHash = hashSubject("ip", ip);
  const ipResult = await checkPersistentRateLimit("auth:password-reset:ip", ipHash, PASSWORD_RESET_IP_BACKSTOP);

  if (!ipResult.allowed) {
    throw new RateLimitExceededError(ipResult.retryAfterSeconds);
  }
}

async function getClientIp() {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    forwardedFor ||
    headerList.get("x-real-ip") ||
    headerList.get("cf-connecting-ip") ||
    headerList.get("x-vercel-forwarded-for") ||
    "unknown"
  );
}

function hashSubject(scope: string, value: string) {
  const salt = env.supabaseUrl || "soulevents";
  return createHash("sha256").update(`${salt}:${scope}:${value}`).digest("hex");
}

async function checkPersistentRateLimit(
  action: string,
  ipHash: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (!env.supabaseServiceRoleKey) {
    return checkMemoryRateLimit(action, ipHash, config);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_action: action,
      p_block_seconds: config.blockSeconds,
      p_ip_hash: ipHash,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds,
    });

    if (error) {
      console.error("[rate-limit] Supabase rate limit failed; using in-memory fallback", {
        action,
        code: error.code,
        message: error.message,
      });

      return checkMemoryRateLimit(action, ipHash, config);
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
      allowed: row?.allowed !== false,
      retryAfterSeconds: Number(row?.retry_after_seconds ?? config.blockSeconds),
    };
  } catch (error) {
    console.error("[rate-limit] Rate limit fallback activated", error);
    return checkMemoryRateLimit(action, ipHash, config);
  }
}

function checkMemoryRateLimit(
  action: string,
  ipHash: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const key = `${action}:${ipHash}`;
  const existing = memoryStore.get(key);

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.blockedUntil - now) / 1000),
    };
  }

  if (!existing || existing.windowStart + config.windowSeconds * 1000 <= now) {
    memoryStore.set(key, {
      blockedUntil: 0,
      count: 1,
      windowStart: now,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= config.limit) {
    existing.blockedUntil = now + config.blockSeconds * 1000;
    memoryStore.set(key, existing);

    return {
      allowed: false,
      retryAfterSeconds: config.blockSeconds,
    };
  }

  existing.count += 1;
  memoryStore.set(key, existing);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
