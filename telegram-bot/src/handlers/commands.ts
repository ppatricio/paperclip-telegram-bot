import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { isAdmin, addUser, removeUser, listUsers } from "../security/access.js";
import { clearHistory } from "../ai/claude.js";
import { config } from "../config.js";
import { getActiveCompany, setActiveCompanyByIndex } from "../state.js";

export async function startCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const company = userId ? getActiveCompany(userId) : config.COMPANIES[0];
  await ctx.reply(
    `Connected to *${company.name}*. Send a message to talk to the CEO.\n\nUse /company to switch companies.`,
    { parse_mode: "Markdown" }
  );
}

export async function clearCommand(ctx: Context): Promise<void> {
  if (ctx.from) clearHistory(ctx.from.id);
  await ctx.reply("Conversation cleared. Fresh start.");
}

export async function agentCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const company = userId ? getActiveCompany(userId) : config.COMPANIES[0];
  await ctx.reply(`Active company: *${company.name}*\nAgent: CEO`, {
    parse_mode: "Markdown",
  });
}

export async function companyCommand(ctx: Context): Promise<void> {
  const keyboard = new InlineKeyboard();
  const userId = ctx.from?.id;
  const active = userId ? getActiveCompany(userId) : null;

  for (let i = 0; i < config.COMPANIES.length; i++) {
    const c = config.COMPANIES[i];
    const label = c.companyId === active?.companyId ? `✅ ${c.name}` : c.name;
    keyboard.text(label, `company:${i}`);
  }

  await ctx.reply("Select a company:", { reply_markup: keyboard });
}

export async function helpCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      "/start — Say hello",
      "/company — Switch company",
      "/clear — Reset conversation",
      "/agent — Show active agent",
      "/help — This message",
      "",
      "Admin only:",
      "/allow <user_id> — Add user to allowlist",
      "/revoke <user_id> — Remove user from allowlist",
      "/users — List allowed users",
    ].join("\n")
  );
}

export async function allowCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply("Not authorized.");
    return;
  }
  const arg = ctx.message?.text?.split(/\s+/)[1];
  const id = Number(arg);
  if (!arg || !Number.isInteger(id) || id <= 0) {
    await ctx.reply("Usage: /allow <user_id>");
    return;
  }
  addUser(id);
  await ctx.reply(`User ${id} added to allowlist.`);
}

export async function revokeCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply("Not authorized.");
    return;
  }
  const arg = ctx.message?.text?.split(/\s+/)[1];
  const id = Number(arg);
  if (!arg || !Number.isInteger(id) || id <= 0) {
    await ctx.reply("Usage: /revoke <user_id>");
    return;
  }
  if (!removeUser(id)) {
    await ctx.reply("Cannot revoke admin users.");
    return;
  }
  await ctx.reply(`User ${id} removed from allowlist.`);
}

export async function usersCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply("Not authorized.");
    return;
  }
  const ids = listUsers();
  if (ids.length === 0) {
    await ctx.reply("No users in allowlist.");
    return;
  }
  await ctx.reply(`Allowed users:\n${ids.join("\n")}`);
}
