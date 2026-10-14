import type { ResponseFilters, SurveyResponse } from "./types";

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

/**
 * Read-only view of a stored record that the UI, filters and CSV export can rely on.
 * It never invents data: valid values are returned untouched, and an unusable date becomes ""
 * (rendered as "-") instead of a fake one. Callers must not persist the result.
 */
export function sanitizeResponse(record: SurveyResponse): SurveyResponse {
  const customer = (record.customer && typeof record.customer === "object" ? record.customer : {}) as Partial<SurveyResponse["customer"]>;
  const createdAt = text(record.createdAt);
  return {
    ...record,
    createdAt: Number.isNaN(Date.parse(createdAt)) ? "" : createdAt,
    customer: { ...customer, company: text(customer.company), contactName: text(customer.contactName) },
    satisfaction: {
      ...record.satisfaction,
      ratings: record.satisfaction?.ratings && typeof record.satisfaction.ratings === "object" ? record.satisfaction.ratings : {}
    }
  };
}

export function applyFilters(records: SurveyResponse[], filters: ResponseFilters) {
  const search = filters.search?.trim().toLowerCase();
  const company = filters.company?.trim().toLowerCase();
  return records.filter((record) => {
    const customer = record.customer || ({} as SurveyResponse["customer"]);
    const createdDay = text(record.createdAt).slice(0, 10);
    if (company && !text(customer.company).toLowerCase().includes(company)) return false;
    if (filters.surveyId && filters.surveyId !== "all" && record.satisfaction?.surveyId !== filters.surveyId) return false;
    if (filters.segment && customer.segment !== filters.segment) return false;
    if (filters.question && filters.rating) {
      if (String(record.satisfaction?.ratings?.[filters.question]) !== filters.rating) return false;
    }
    // A record without a usable date cannot be placed in a date range.
    if ((filters.from || filters.to) && Number.isNaN(Date.parse(text(record.createdAt)))) return false;
    if (filters.from && createdDay < filters.from) return false;
    if (filters.to && createdDay > filters.to) return false;
    if (!search) return true;
    return [customer.company, customer.contactName, customer.email, customer.position].filter(Boolean).map(text).join(" ").toLowerCase().includes(search);
  });
}
