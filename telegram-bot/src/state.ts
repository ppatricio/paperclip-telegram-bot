import { config, type CompanyConfig } from "./config.js";

// Per-user active company selection
const userCompany = new Map<number, string>(); // userId -> companyId

export function getActiveCompany(userId: number): CompanyConfig {
  const companyId = userCompany.get(userId);
  if (companyId) {
    const found = config.COMPANIES.find((c) => c.companyId === companyId);
    if (found) return found;
  }
  // Default to first company
  return config.COMPANIES[0];
}

export function setActiveCompany(userId: number, companyId: string): boolean {
  const found = config.COMPANIES.find((c) => c.companyId === companyId);
  if (!found) return false;
  userCompany.set(userId, companyId);
  return true;
}

export function setActiveCompanyByIndex(
  userId: number,
  index: number
): CompanyConfig | null {
  const company = config.COMPANIES[index];
  if (!company) return null;
  userCompany.set(userId, company.companyId);
  return company;
}
