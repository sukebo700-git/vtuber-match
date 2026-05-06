import { createHash } from "crypto";

const pepper = process.env.AUTH_PASSWORD_PEPPER || "vtuber-match-local-pepper";

export function hashPassword(password: string) {
  return createHash("sha256").update(`${pepper}:${password}`).digest("hex");
}

export function makeCreatorLoginId(seed = Date.now().toString(36)) {
  const random = Math.random().toString(36).slice(2, 8);
  return `vm-${seed}-${random}`;
}
