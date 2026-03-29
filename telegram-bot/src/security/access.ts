import { resolve } from "path";
import { readFileSync, writeFileSync, renameSync } from "fs";
import { config } from "../config.js";
import type { MiddlewareFn, Context } from "grammy";

const ACCESS_FILE = resolve(config.BOT_DIR, "access.json");

interface AccessData {
  allowedUserIds: number[];
}

let allowedUsers = new Set<number>();
const adminUsers = new Set<number>(config.ADMIN_USER_IDS);

function read(): AccessData {
  try {
    const raw = readFileSync(ACCESS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { allowedUserIds: [] };
  }
}

function persist(): void {
  const data: AccessData = {
    allowedUserIds: [...allowedUsers].filter((id) => !adminUsers.has(id)),
  };
  const tmp = ACCESS_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, ACCESS_FILE);
}

export function loadAccess(): void {
  const data = read();
  allowedUsers = new Set([...data.allowedUserIds, ...config.ADMIN_USER_IDS]);
}

export function isAllowed(userId: number): boolean {
  return allowedUsers.has(userId);
}

export function isAdmin(userId: number): boolean {
  return adminUsers.has(userId);
}

export function addUser(userId: number): void {
  allowedUsers.add(userId);
  persist();
}

export function removeUser(userId: number): boolean {
  if (adminUsers.has(userId)) return false; // cannot revoke admins
  allowedUsers.delete(userId);
  persist();
  return true;
}

export function listUsers(): number[] {
  return [...allowedUsers];
}

/** Guard middleware — silently drops messages from unauthorized users. */
export function guardMiddleware(): MiddlewareFn<Context> {
  return (ctx, next) => {
    if (!ctx.from || !isAllowed(ctx.from.id)) return;
    return next();
  };
}
