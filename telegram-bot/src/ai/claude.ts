import { config, type CompanyConfig } from "../config.js";
import { getActiveCompany } from "../state.js";

const PAPERCLIP_URL = config.PAPERCLIP_URL;

async function paperclipFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${PAPERCLIP_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });
}

async function createIssue(
  company: CompanyConfig,
  title: string,
  description: string
): Promise<string> {
  const body: Record<string, unknown> = {
    title,
    description,
    assigneeAgentId: company.ceoAgentId,
    priority: "medium",
    status: "todo",
  };
  if (company.goalId) {
    body.goalId = company.goalId;
  }
  const res = await paperclipFetch(
    `/api/companies/${company.companyId}/issues`,
    { method: "POST", body: JSON.stringify(body) }
  );
  const data = await res.json();
  return data.id;
}

async function wakeAgent(company: CompanyConfig, issueId: string): Promise<string> {
  const res = await paperclipFetch(
    `/api/agents/${company.ceoAgentId}/wakeup`,
    {
      method: "POST",
      body: JSON.stringify({
        source: "assignment",
        triggerDetail: "manual",
        reason: "Telegram message",
        payload: { taskId: issueId },
      }),
    }
  );
  const data = await res.json();
  return data.id;
}

async function waitForComments(
  issueId: string,
  timeoutMs = 180_000
): Promise<string> {
  const start = Date.now();
  const pollInterval = 3000;

  while (Date.now() - start < timeoutMs) {
    const res = await paperclipFetch(`/api/issues/${issueId}/comments`);
    const comments = await res.json();

    if (Array.isArray(comments) && comments.length > 0) {
      return comments[comments.length - 1].body || "(Empty comment)";
    }

    const issueRes = await paperclipFetch(`/api/issues/${issueId}`);
    const issue = await issueRes.json();
    if (issue.status === "done" || issue.status === "cancelled") {
      const finalRes = await paperclipFetch(`/api/issues/${issueId}/comments`);
      const finalComments = await finalRes.json();
      if (Array.isArray(finalComments) && finalComments.length > 0) {
        return finalComments[finalComments.length - 1].body;
      }
      return "(Agent completed the task but left no comment)";
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  return "Agent is still working on this. Check Paperclip UI for updates.";
}

export function clearHistory(_userId: number): void {
  // No-op for Paperclip mode — each message is a new issue
}

export async function chat(userId: number, text: string): Promise<string> {
  const company = getActiveCompany(userId);

  try {
    const title = `[Telegram] ${text.slice(0, 100)}`;
    const description = `Message from board via Telegram:\n\n${text}\n\nPlease respond by commenting on this issue.`;

    const issueId = await createIssue(company, title, description);
    console.log(
      `[${company.name}] Created issue ${issueId} for: ${text.slice(0, 50)}`
    );

    const runId = await wakeAgent(company, issueId);
    console.log(`[${company.name}] Woke agent, run: ${runId}`);

    const response = await waitForComments(issueId);
    return response;
  } catch (err: unknown) {
    console.error(`[${company.name}] Paperclip bridge error:`, err);
    return "Something went wrong. Try again.";
  }
}
