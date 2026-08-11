import { createHash, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1時間

export function createResetToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  };
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isResetTokenValid(storedHash: string | undefined, expiresAt: string | undefined, suppliedToken: string) {
  if (!storedHash || !expiresAt || !suppliedToken) return false;
  if (new Date(expiresAt).getTime() < Date.now()) return false;

  const suppliedHash = hashResetToken(suppliedToken);
  const storedBuffer = Buffer.from(storedHash);
  const suppliedBuffer = Buffer.from(suppliedHash);
  if (storedBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(storedBuffer, suppliedBuffer);
}
