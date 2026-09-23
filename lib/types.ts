export type RatingValue = 1 | 2 | 3 | 4 | 5 | null;
export type SurveyId = "venta" | "distribuidores" | "oil-gas" | "agroindustria" | "servicios-industriales";
export type SatisfactionKey = "productQuality" | "commercialAttention" | "deliveryDeadlines" | "technicalInformation" | "claimResponse" | "logistics" | "packaging" | "lastPurchase";

export type CustomerData = {
  company: string;
  contactName: string;
  position?: string;
  email?: string;
  phone?: string;
  segment?: string;
};

export type SatisfactionData = {
  surveyId: SurveyId;
  module: string;
  ratings: Record<SatisfactionKey, RatingValue>;
  additionalComments?: string;
};

export type SurveyResponse = {
  id: string;
  createdAt: string;
  customer: CustomerData;
  satisfaction: SatisfactionData;
  consent: boolean;
  source: "poleas-rp";
  demo?: boolean;
};

export type ResponseFilters = {
  search?: string;
  company?: string;
  surveyId?: string;
  segment?: string;
  question?: string;
  rating?: string;
  from?: string;
  to?: string;
};
