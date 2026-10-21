export const CONSERVATION_LABELS = {
  LC: "Least Concern", NT: "Near Threatened", VU: "Vulnerable",
  EN: "Endangered", CR: "Critically Endangered", EW: "Extinct in the Wild",
  EX: "Extinct", DD: "Data Deficient", NE: "Not Evaluated",
} as const;
export type ConservationCode = keyof typeof CONSERVATION_LABELS;
export const conservationLabel = (code?: string | null) =>
  CONSERVATION_LABELS[code as ConservationCode] ?? "Not Evaluated";
