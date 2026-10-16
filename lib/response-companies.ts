import type { SurveyResponse } from "./types";

/**
 * Builds the company selector catalog from responses for one survey (or all of
 * them). This deliberately receives only the survey criterion: date, search
 * and company filters must never shrink the catalog itself.
 */
export function responseCompanies(records: SurveyResponse[], surveyId = "all") {
  const companies = new Map<string, string>();
  for (const response of records) {
    if (surveyId !== "all" && response.satisfaction?.surveyId !== surveyId) continue;
    const company = response.customer?.company;
    if (typeof company !== "string" || !company.trim()) continue;
    const name = company.trim();
    const key = name.toLocaleLowerCase("es");
    if (!companies.has(key)) companies.set(key, name);
  }
  return Array.from(companies.values()).sort((left, right) => left.localeCompare(right, "es"));
}
