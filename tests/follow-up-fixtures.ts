import type { FollowUpCompany } from "../lib/follow-up-core";

export const companyFixture = (over: Partial<FollowUpCompany> = {}): FollowUpCompany => ({
  id: "11111111-1111-4111-8111-111111111111", name: "Empresa exacta S.A.", segment: "venta",
  contactName: "Ana", email: "ana@example.test", responseStatus: "responded",
  whatsapp: { mariaJose: true, sergio: false, jose: false }, notes: "Nota previa", sourceRow: "fila 3", linkedResponseId: "42",
  createdAt: "2026-10-01T12:00:00.000Z", createdBy: "importador", updatedAt: "2026-10-02T12:00:00.000Z", updatedBy: "editor", ...over
});

export function companyRow(company = companyFixture()) {
  return {
    id: company.id, name: company.name, segment: company.segment, contact_name: company.contactName, email: company.email,
    response_status: company.responseStatus, wa_maria_jose: company.whatsapp.mariaJose, wa_sergio: company.whatsapp.sergio,
    wa_jose: company.whatsapp.jose, notes: company.notes, source_row: company.sourceRow, linked_response_id: company.linkedResponseId,
    created_at: new Date(company.createdAt), created_by: company.createdBy, updated_at: new Date(company.updatedAt), updated_by: company.updatedBy
  };
}
