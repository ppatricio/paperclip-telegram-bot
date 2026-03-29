import { config, type CompanyConfig } from "./config.js";

const PAPERCLIP_URL = config.PAPERCLIP_URL;

interface ApiCompany {
  id: string;
  name: string;
  agents?: ApiAgent[];
  goalId?: string;
}

interface ApiAgent {
  id: string;
  role?: string;
}

async function fetchCompanies(): Promise<CompanyConfig[]> {
  const res = await fetch(`${PAPERCLIP_URL}/api/companies`);
  if (!res.ok) {
    throw new Error(`GET /api/companies returned ${res.status}`);
  }
  const companies: ApiCompany[] = await res.json();

  const configs: CompanyConfig[] = [];
  for (const c of companies) {
    // Find the CEO agent for this company
    let ceoAgent: ApiAgent | undefined;

    if (c.agents && c.agents.length > 0) {
      ceoAgent =
        c.agents.find((a) => a.role?.toLowerCase() === "ceo") ?? c.agents[0];
    } else {
      // Fetch agents separately if not embedded
      const agentsRes = await fetch(
        `${PAPERCLIP_URL}/api/companies/${c.id}/agents`
      );
      if (agentsRes.ok) {
        const agents: ApiAgent[] = await agentsRes.json();
        ceoAgent =
          agents.find((a) => a.role?.toLowerCase() === "ceo") ?? agents[0];
      }
    }

    if (!ceoAgent) {
      console.warn(`[sync] Skipping company "${c.name}" — no agents found`);
      continue;
    }

    configs.push({
      name: c.name,
      companyId: c.id,
      ceoAgentId: ceoAgent.id,
      goalId: c.goalId ?? "",
    });
  }

  return configs;
}

/**
 * Sync companies from the Paperclip API into config.COMPANIES.
 * Returns the number of companies after sync.
 */
export async function syncCompanies(): Promise<number> {
  try {
    const fresh = await fetchCompanies();
    if (fresh.length === 0 && config.COMPANIES.length > 0) {
      console.warn("[sync] API returned 0 companies — keeping existing list");
      return config.COMPANIES.length;
    }
    config.COMPANIES.splice(0, config.COMPANIES.length, ...fresh);
    console.log(
      `[sync] ${fresh.length} companies: ${fresh.map((c) => c.name).join(", ")}`
    );
    return fresh.length;
  } catch (err) {
    console.error("[sync] Failed to fetch companies:", err);
    return config.COMPANIES.length;
  }
}

/**
 * Start periodic company sync. Runs immediately, then every `intervalMs`.
 */
export function startCompanySync(intervalMs = 60_000): void {
  syncCompanies();
  setInterval(syncCompanies, intervalMs);
  console.log(`Company sync started (every ${intervalMs / 1000}s)`);
}
