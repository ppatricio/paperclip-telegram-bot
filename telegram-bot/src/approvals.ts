import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";

const PAPERCLIP_URL = config.PAPERCLIP_URL;

interface Approval {
  id: string;
  type: string;
  status: string;
  requestedByAgentId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

// Track which approvals we've already notified about
const notifiedApprovals = new Set<string>();

async function fetchPendingApprovals(
  companyId: string
): Promise<Approval[]> {
  const res = await fetch(
    `${PAPERCLIP_URL}/api/companies/${companyId}/approvals`
  );
  const all: Approval[] = await res.json();
  return all.filter((a) => a.status === "pending");
}

export async function approveApproval(approvalId: string): Promise<boolean> {
  const res = await fetch(
    `${PAPERCLIP_URL}/api/approvals/${approvalId}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decidedByUserId: "local-board" }),
    }
  );
  return res.ok;
}

export async function rejectApproval(approvalId: string): Promise<boolean> {
  const res = await fetch(
    `${PAPERCLIP_URL}/api/approvals/${approvalId}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decidedByUserId: "local-board" }),
    }
  );
  return res.ok;
}

function formatApproval(companyName: string, a: Approval): string {
  const payload = a.payload;
  if (a.type === "hire_agent") {
    const name = (payload.name as string) || "Unknown";
    const role = (payload.role as string) || "";
    return `🔔 *Approval Request* — ${companyName}\n\nType: Hire Agent\nName: *${name}*\nRole: ${role}\nRequested by: CEO`;
  }
  return `🔔 *Approval Request* — ${companyName}\n\nType: ${a.type}\n${JSON.stringify(payload, null, 2).slice(0, 200)}`;
}

export function startApprovalPoller(bot: Bot, adminUserIds: number[]): void {
  const POLL_INTERVAL = 10_000;

  async function poll() {
    try {
      for (const company of config.COMPANIES) {
        const pending = await fetchPendingApprovals(company.companyId);

        for (const approval of pending) {
          if (notifiedApprovals.has(approval.id)) continue;
          notifiedApprovals.add(approval.id);

          const text = formatApproval(company.name, approval);
          const keyboard = new InlineKeyboard()
            .text("✅ Approve", `approve:${approval.id}`)
            .text("❌ Reject", `reject:${approval.id}`);

          for (const adminId of adminUserIds) {
            try {
              await bot.api.sendMessage(adminId, text, {
                parse_mode: "Markdown",
                reply_markup: keyboard,
              });
            } catch (err) {
              console.error(`Failed to notify admin ${adminId}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Approval poll error:", err);
    }
  }

  poll();
  setInterval(poll, POLL_INTERVAL);
  console.log(
    `Approval poller started (every ${POLL_INTERVAL / 1000}s) for ${config.COMPANIES.length} companies`
  );
}
