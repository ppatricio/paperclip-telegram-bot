import { Bot } from "grammy";
import { config } from "./config.js";
import { guardMiddleware, isAdmin } from "./security/access.js";
import {
  startCommand,
  clearCommand,
  agentCommand,
  helpCommand,
  companyCommand,
  allowCommand,
  revokeCommand,
  usersCommand,
} from "./handlers/commands.js";
import { handleTextMessage, handlePhotoMessage } from "./handlers/message.js";
import {
  approveApproval,
  rejectApproval,
  startApprovalPoller,
} from "./approvals.js";
import { startCommentPoller } from "./comments.js";
import { setActiveCompanyByIndex, getActiveCompany } from "./state.js";

export function createBot(): Bot {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

  // Security: drop all messages from unauthorized users
  bot.use(guardMiddleware());

  // Commands
  bot.command("start", startCommand);
  bot.command("clear", clearCommand);
  bot.command("agent", agentCommand);
  bot.command("company", companyCommand);
  bot.command("help", helpCommand);
  bot.command("allow", allowCommand);
  bot.command("revoke", revokeCommand);
  bot.command("users", usersCommand);

  // Callback queries (approval buttons + company selection)
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.answerCallbackQuery({ text: "Unknown user." });
      return;
    }

    // Company selection: company:0, company:1, etc.
    if (data.startsWith("company:")) {
      const index = parseInt(data.slice("company:".length), 10);
      const company = setActiveCompanyByIndex(userId, index);
      if (company) {
        await ctx.editMessageText(`Switched to *${company.name}*`, {
          parse_mode: "Markdown",
        });
        await ctx.answerCallbackQuery({ text: `Now talking to ${company.name}` });
      } else {
        await ctx.answerCallbackQuery({ text: "Invalid company." });
      }
      return;
    }

    // Approval buttons (admin only)
    if (!isAdmin(userId)) {
      await ctx.answerCallbackQuery({ text: "Not authorized." });
      return;
    }

    if (data.startsWith("approve:")) {
      const approvalId = data.slice("approve:".length);
      const ok = await approveApproval(approvalId);
      if (ok) {
        await ctx.editMessageText(
          ctx.callbackQuery.message?.text + "\n\n✅ *Approved*",
          { parse_mode: "Markdown" }
        );
        await ctx.answerCallbackQuery({ text: "Approved!" });
      } else {
        await ctx.answerCallbackQuery({ text: "Failed to approve." });
      }
    } else if (data.startsWith("reject:")) {
      const approvalId = data.slice("reject:".length);
      const ok = await rejectApproval(approvalId);
      if (ok) {
        await ctx.editMessageText(
          ctx.callbackQuery.message?.text + "\n\n❌ *Rejected*",
          { parse_mode: "Markdown" }
        );
        await ctx.answerCallbackQuery({ text: "Rejected." });
      } else {
        await ctx.answerCallbackQuery({ text: "Failed to reject." });
      }
    }
  });

  // Messages
  bot.on("message:photo", handlePhotoMessage);
  bot.on("message:text", handleTextMessage);

  // Global error handler
  bot.catch((err) => {
    console.error("Bot error:", err.error);
  });

  // Start polling for pending approvals across ALL companies
  startApprovalPoller(bot, config.ADMIN_USER_IDS);

  // Start polling for new comments on non-Telegram issues
  startCommentPoller(bot, config.ADMIN_USER_IDS);

  return bot;
}
