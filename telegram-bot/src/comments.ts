import { Bot } from "grammy";
import { config } from "./config.js";

const PAPERCLIP_URL = config.PAPERCLIP_URL;

interface Issue {
  id: string;
  title: string;
  status: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt?: string;
}

// Track which comments we've already forwarded
const notifiedComments = new Set<string>();

async function fetchCompanyIssues(companyId: string): Promise<Issue[]> {
  const res = await fetch(
    `${PAPERCLIP_URL}/api/companies/${companyId}/issues`
  );
  if (!res.ok) return [];
  return res.json();
}

async function fetchIssueComments(issueId: string): Promise<Comment[]> {
  const res = await fetch(`${PAPERCLIP_URL}/api/issues/${issueId}/comments`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

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

export function startCommentPoller(bot: Bot, adminUserIds: number[]): void {
  const POLL_INTERVAL = 15_000; // 15 seconds — gentler than approval poller

  async function poll() {
    try {
      for (const company of config.COMPANIES) {
        const issues = await fetchCompanyIssues(company.companyId);
        if (!Array.isArray(issues)) continue;

        for (const issue of issues) {
          // Skip issues created via Telegram — those already get
          // responses through the waitForComments flow in claude.ts
          if (issue.title?.startsWith("[Telegram]")) continue;

          // Only watch active issues
          if (issue.status === "cancelled") continue;

          const comments = await fetchIssueComments(issue.id);

          for (const comment of comments) {
            if (!comment.id || notifiedComments.has(comment.id)) continue;
            notifiedComments.add(comment.id);

            const title = issue.title || "(untitled)";
            const body = comment.body || "(empty comment)";
            const header = `\uD83D\uDCAC *New comment* \u2014 ${company.name}\n\uD83D\uDCCB ${title}\n\n`;
            const chunks = chunkText(header + body);

            for (const adminId of adminUserIds) {
              try {
                for (const chunk of chunks) {
                  await bot.api.sendMessage(adminId, chunk, {
                    parse_mode: "Markdown",
                  });
                }
              } catch (err) {
                console.error(`Failed to notify admin ${adminId}:`, err);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Comment poll error:", err);
    }
  }

  // Initial poll — seed notifiedComments with existing comments
  // so we don't flood Telegram with old comments on startup
  async function seedExistingComments() {
    try {
      for (const company of config.COMPANIES) {
        const issues = await fetchCompanyIssues(company.companyId);
        if (!Array.isArray(issues)) continue;

        for (const issue of issues) {
          const comments = await fetchIssueComments(issue.id);
          for (const comment of comments) {
            if (comment.id) notifiedComments.add(comment.id);
          }
        }
      }
    } catch (err) {
      console.error("Comment poller seed error:", err);
    }
  }

  seedExistingComments().then(() => {
    setInterval(poll, POLL_INTERVAL);
    console.log(
      `Comment poller started (every ${POLL_INTERVAL / 1000}s) for ${config.COMPANIES.length} companies`
    );
  });
}
