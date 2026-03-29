import type { Context } from "grammy";
import { chat } from "../ai/claude.js";

const CHUNK_LIMIT = 4096;

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_LIMIT) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > CHUNK_LIMIT) {
    const para = rest.lastIndexOf("\n\n", CHUNK_LIMIT);
    const line = rest.lastIndexOf("\n", CHUNK_LIMIT);
    const space = rest.lastIndexOf(" ", CHUNK_LIMIT);
    const cut =
      para > CHUNK_LIMIT / 2
        ? para
        : line > CHUNK_LIMIT / 2
          ? line
          : space > 0
            ? space
            : CHUNK_LIMIT;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function sendChunked(ctx: Context, text: string): Promise<void> {
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

/** Keep typing indicator alive until done. */
function startTyping(ctx: Context): () => void {
  ctx.replyWithChatAction("typing").catch(() => {});
  const interval = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);
  return () => clearInterval(interval);
}

export async function handleTextMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text || !ctx.from) return;

  const stopTyping = startTyping(ctx);
  try {
    const response = await chat(ctx.from.id, text);
    await sendChunked(ctx, response);
  } finally {
    stopTyping();
  }
}

export async function handlePhotoMessage(ctx: Context): Promise<void> {
  if (!ctx.message?.photo || !ctx.from) return;

  const caption = ctx.message.caption || "The user sent a photo.";
  const stopTyping = startTyping(ctx);
  try {
    // Claude CLI doesn't support inline images — tell the user
    const response = await chat(
      ctx.from.id,
      `[User sent a photo with caption: "${caption}"] Note: I can't see images in this mode. Please describe what you'd like to discuss.`
    );
    await sendChunked(ctx, response);
  } finally {
    stopTyping();
  }
}
