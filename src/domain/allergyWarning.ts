import type { Allergy, Patient, UserRole } from './types';

/**
 * What the chart has to say about a patient's allergies before anything else.
 *
 * Kept as a plain function rather than logic inside a component so the decision
 * is testable on its own. Requirement 10.4 asks for a prominent warning when a
 * severe allergy is on file, and "prominent" is a property of the component;
 * *whether there is something to warn about* is a property of the data, and that
 * is what this decides.
 */

export type AllergyWarningLevel = 'none' | 'review' | 'severe';

export interface AllergyWarning {
  level: AllergyWarningLevel;
  /** Substance names for a severe warning, in the order the backend sent them. */
  substances: string[];
  /** The prose a clinician still has to read, when that is the finding. */
  legacyNote: string | null;
}

const NONE: AllergyWarning = { level: 'none', substances: [], legacyNote: null };

/**
 * Decides which warning a chart shows.
 *
 * Severe outranks review. Both can be true at once — a patient can have one
 * coded severe allergy and a sentence nobody has processed — and in that case
 * the actionable fact is the confirmed severe allergy, so it takes the banner.
 * The review notice still appears elsewhere on the page; it is not urgent in the
 * way an anaphylaxis history is.
 *
 * Retired records are ignored. An allergy ruled out years ago is in the history
 * for the audit trail, and warning on it would train people to dismiss the
 * banner — which is the failure mode that matters here, since a banner people
 * dismiss by reflex is worse than no banner at all.
 */
export function allergyWarningFor(
  patient: Pick<Patient, 'allergyReviewRequired' | 'allergyLegacyNote'> | null,
  allergies: readonly Allergy[] | null,
): AllergyWarning {
  const severe = (allergies ?? []).filter((a) => a.active && a.severity === 'SEVERE');

  if (severe.length > 0) {
    return {
      level: 'severe',
      substances: severe.map((a) => a.allergenName),
      legacyNote: null,
    };
  }

  if (patient?.allergyReviewRequired) {
    return {
      level: 'review',
      substances: [],
      legacyNote: patient.allergyLegacyNote ?? null,
    };
  }

  return NONE;
}

/**
 * Whether the patient has allergy information that no automated check can read.
 *
 * Separate from the banner because it stays true even when a severe coded
 * allergy has taken the banner: the unreviewed prose may name a second
 * substance, and the flag is the only thing saying so.
 */
export function needsAllergyReview(
  patient: Pick<Patient, 'allergyReviewRequired'> | null,
): boolean {
  return patient?.allergyReviewRequired === true;
}

/**
 * Short summary for a list row, where a full banner does not fit.
 *
 * Returns null when there is nothing to say, so a caller can render nothing
 * rather than an empty chip.
 */
export function allergySummary(allergies: readonly Allergy[] | null): string | null {
  const live = (allergies ?? []).filter((a) => a.active);

  if (live.length === 0) {
    return null;
  }

  const severe = live.filter((a) => a.severity === 'SEVERE');

  // Naming the severe substances rather than counting them: "1 dị ứng nặng"
  // makes a clinician open the record to find out which, and the point of a
  // summary is to save that step.
  if (severe.length > 0) {
    return `Dị ứng nặng: ${severe.map((a) => a.allergenName).join(', ')}`;
  }

  return `Dị ứng: ${live.map((a) => a.allergenName).join(', ')}`;
}

/**
 * Who may confirm that the migrated free-text allergies have been read.
 *
 * Clearing the flag asserts that someone qualified looked at the prose and
 * recorded whatever coded allergies it implied. A receptionist has no access to
 * clinical data at all, so they could only make that assertion blind — the
 * backend refuses them, and hiding the button keeps the UI from offering an
 * action that will fail.
 */
export function canConfirmAllergyReview(role: UserRole | null): boolean {
  return role === 'DOCTOR' || role === 'ADMIN';
}
