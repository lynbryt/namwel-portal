// Doc-type labels and scenario → required-doc mapping.
// Pure functions, kept out of _actions/ because Next.js disallows
// non-async exports from "use server" modules.

export const DOC_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport scan',
  eVisa: 'eVisa confirmation',
  unabridged_birth_cert: 'Unabridged birth certificate',
  parental_consent_affidavit: 'Parental consent affidavit',
  non_travelling_parent_id: 'Non-travelling parent ID/passport copy',
  death_certificate: 'Death certificate',
  court_order: 'Court order',
  guardianship_order: 'Guardianship order',
  receiving_person_letter: 'Letter from receiving person',
  receiving_person_id: 'Receiving person ID copy',
  insurance_certificate: 'Travel insurance certificate',
  driving_licence: 'Driving licence',
  idp: 'International Driving Permit',
  prescription_letter: "Doctor's letter for medication",
  other: 'Other supporting document',
};

export function labelForDocType(t: string): string {
  return DOC_TYPE_LABELS[t] ?? t;
}

// Required upload doc_types for each child scenario.
export function requiredDocsForScenario(scenario: string): string[] {
  const common = ['unabridged_birth_cert'];
  switch (scenario) {
    case 'both_parents':
      return common;
    case 'one_parent':
      return [...common, 'parental_consent_affidavit', 'non_travelling_parent_id'];
    case 'grandparent_guardian':
      return [...common, 'parental_consent_affidavit', 'non_travelling_parent_id'];
    case 'unaccompanied':
      return [...common, 'parental_consent_affidavit', 'non_travelling_parent_id', 'receiving_person_letter', 'receiving_person_id'];
    default:
      return common;
  }
}
