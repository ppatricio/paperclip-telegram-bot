import { config } from "./config.js";
import { loadAccess } from "./security/access.js";
import { createBot } from "./bot.js";
import { syncCompanies, startCompanySync } from "./sync.js";

// Load access control state
loadAccess();

// Fetch companies from Paperclip API (uses env fallback if API is unreachable)
await syncCompanies();

if (config.COMPANIES.length === 0) {
  console.error("No companies configured. Set PAPERCLIP_COMPANIES or ensure the Paperclip API is running.");
  process.exit(1);
}

const bot = createBot();

// Re-sync companies every 60s to pick up new ones
startCompanySync(60_000);

if (config.BOT_MODE === "webhook") {
  const { webhookCallback } = await import("grammy");
  const handleUpdate = webhookCallback(bot, "std/http");

  Bun.serve({
    port: Number(process.env.PORT ?? 3000),
    async fetch(req) {
      if (new URL(req.url).pathname === "/webhook") {
        return handleUpdate(req);
      }
      return new Response("OK");
    },
  });

  // Set the webhook URL with Telegram
  await bot.api.setWebhook(config.WEBHOOK_URL + "/webhook");
  console.log(`Bot running in webhook mode on port ${process.env.PORT ?? 3000}`);
} else {
  bot.start({
    onStart: () => console.log("Bot running in polling mode"),
  });
}

// Graceful shutdown
const shutdown = () => bot.stop();
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
