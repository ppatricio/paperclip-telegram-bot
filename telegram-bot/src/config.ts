import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";

const botDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(botDir, ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Missing required environment variable: ${name}\n` +
        `Copy .env.example to .env and fill in the values.`
    );
    process.exit(1);
  }
  return value;
}

function parseUserIds(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const n = Number(s);
      if (!Number.isInteger(n) || n <= 0) {
        console.error(`Invalid user ID in ADMIN_USER_IDS: "${s}"`);
        process.exit(1);
      }
      return n;
    });
}

export interface CompanyConfig {
  name: string;
  companyId: string;
  ceoAgentId: string;
  goalId: string;
}

function parseCompanies(): CompanyConfig[] {
  const raw = process.env.PAPERCLIP_COMPANIES;
  if (!raw) return []; // will be populated dynamically from the API
  try {
    const arr = JSON.parse(raw) as CompanyConfig[];
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error("must be a non-empty array");
    }
    for (const c of arr) {
      if (!c.name || !c.companyId || !c.ceoAgentId) {
        throw new Error(`each company needs name, companyId, ceoAgentId`);
      }
    }
    return arr;
  } catch (err) {
    console.error(`Invalid PAPERCLIP_COMPANIES JSON: ${err}`);
    process.exit(1);
  }
}

const projectRoot = resolve(botDir, "..");

export const config = {
  TELEGRAM_BOT_TOKEN: required("TELEGRAM_BOT_TOKEN"),
  ADMIN_USER_IDS: parseUserIds(required("ADMIN_USER_IDS")),
  BOT_MODE: (process.env.BOT_MODE ?? "polling") as "polling" | "webhook",
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  MAX_HISTORY: 50,
  AGENTS_DIR: resolve(projectRoot, "agents"),
  BOT_DIR: botDir,
  // Paperclip API
  PAPERCLIP_URL: process.env.PAPERCLIP_URL ?? "http://127.0.0.1:3100",
  COMPANIES: parseCompanies() as CompanyConfig[],
};

if (config.BOT_MODE === "webhook" && !config.WEBHOOK_URL) {
  console.error("WEBHOOK_URL is required when BOT_MODE=webhook");
  process.exit(1);
}
