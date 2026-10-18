import { describe, expect, it } from 'vitest';

import {
  allergySummary,
  allergyWarningFor,
  canConfirmAllergyReview,
  needsAllergyReview,
} from './allergyWarning';
import type { Allergy, AllergySeverity, Patient } from './types';

/**
 * Which warning a chart shows.
 *
 * The cases that matter are the ones where the system looks fine and is not: a
 * patient whose allergies are a sentence nobody has read, and a retired allergy
 * that would train people to dismiss the banner if it kept firing.
 */

function allergy(
  name: string,
  severity: AllergySeverity,
  active = true,
): Allergy {
  return {
    id: crypto.randomUUID(),
    patientId: 'p1',
    allergenCode: `ALG-${name.toUpperCase()}`,
    allergenName: name,
    allergenCategory: 'DRUG',
    reaction: 'Mẩn đỏ',
    severity,
    severe: severity === 'SEVERE',
    certainty: 'REPORTED',
    recordedOn: '2026-01-01',
    active,
    inactivationReason: active ? null : 'Đã loại trừ sau test',
    note: null,
  };
}

function patient(overrides: Partial<Patient> = {}): Pick<
  Patient,
  'allergyReviewRequired' | 'allergyLegacyNote'
> {
  return {
    allergyReviewRequired: false,
    allergyLegacyNote: null,
    ...overrides,
  };
}

describe('allergyWarningFor', () => {
  it('says nothing when there is nothing to say', () => {
    expect(allergyWarningFor(patient(), [])).toEqual({
      level: 'none',
      substances: [],
      legacyNote: null,
    });
  });

  it('warns on a severe allergy and names the substance', () => {
    const warning = allergyWarningFor(patient(), [allergy('Penicillin', 'SEVERE')]);

    // Naming it rather than counting: a clinician who has to open the record to
    // find out which substance has gained nothing from the banner.
    expect(warning.level).toBe('severe');
    expect(warning.substances).toEqual(['Penicillin']);
  });

  it('does not warn on mild or moderate allergies', () => {
    const warning = allergyWarningFor(patient(), [
      allergy('Sulfamid', 'MILD'),
      allergy('Bụi nhà', 'MODERATE'),
    ]);

    // They belong on the allergy list, not in a banner. A banner that fires for
    // everything is a banner people dismiss without reading.
    expect(warning.level).toBe('none');
  });

  it('ignores a retired severe allergy', () => {
    const warning = allergyWarningFor(patient(), [
      allergy('Penicillin', 'SEVERE', false),
    ]);

    // It stays in the history for the audit trail. Warning on it would train
    // people to dismiss the banner by reflex, which is worse than no banner.
    expect(warning.level).toBe('none');
    expect(warning.substances).toEqual([]);
  });

  it('lists every severe substance, not just the first', () => {
    const warning = allergyWarningFor(patient(), [
      allergy('Penicillin', 'SEVERE'),
      allergy('Sulfamid', 'MILD'),
      allergy('Aspirin', 'SEVERE'),
    ]);

    expect(warning.substances).toEqual(['Penicillin', 'Aspirin']);
  });

  it('flags a patient whose allergies are only prose', () => {
    const warning = allergyWarningFor(
      patient({
        allergyReviewRequired: true,
        allergyLegacyNote: 'Dị ứng penicillin, hải sản',
      }),
      [],
    );

    // Without this the chart is indistinguishable from one belonging to a
    // patient with no allergies at all.
    expect(warning.level).toBe('review');
    expect(warning.legacyNote).toBe('Dị ứng penicillin, hải sản');
  });

  it('shows the severe warning ahead of the review notice when both apply', () => {
    const warning = allergyWarningFor(
      patient({ allergyReviewRequired: true, allergyLegacyNote: 'Dị ứng hải sản' }),
      [allergy('Penicillin', 'SEVERE')],
    );

    // The confirmed severe allergy is the actionable one. The review flag is
    // still reported separately, through needsAllergyReview.
    expect(warning.level).toBe('severe');
  });

  it('treats missing data as nothing to warn about rather than throwing', () => {
    // The banner renders while the patient and the allergy list are still
    // loading, and a chart that fails to render tells a clinician less than one
    // that renders without a banner for a moment.
    expect(allergyWarningFor(null, null).level).toBe('none');
    expect(allergyWarningFor(patient(), null).level).toBe('none');
  });
});

describe('needsAllergyReview', () => {
  it('stays true even when a severe allergy has taken the banner', () => {
    // The unreviewed prose may name a second substance, and this flag is the
    // only thing saying so.
    expect(needsAllergyReview(patient({ allergyReviewRequired: true }))).toBe(true);
  });

  it('is false for a reviewed patient and for no patient', () => {
    expect(needsAllergyReview(patient())).toBe(false);
    expect(needsAllergyReview(null)).toBe(false);
  });
});

describe('allergySummary', () => {
  it('returns null when there is nothing to show', () => {
    // So a caller renders nothing rather than an empty chip.
    expect(allergySummary([])).toBeNull();
    expect(allergySummary(null)).toBeNull();
    expect(allergySummary([allergy('Penicillin', 'SEVERE', false)])).toBeNull();
  });

  it('leads with the severe substances when there are any', () => {
    const summary = allergySummary([
      allergy('Sulfamid', 'MILD'),
      allergy('Penicillin', 'SEVERE'),
    ]);

    expect(summary).toBe('Dị ứng nặng: Penicillin');
  });

  it('lists the substances when none are severe', () => {
    expect(allergySummary([allergy('Sulfamid', 'MILD')])).toBe('Dị ứng: Sulfamid');
  });
});

describe('canConfirmAllergyReview', () => {
  it('allows doctors and admins', () => {
    expect(canConfirmAllergyReview('DOCTOR')).toBe(true);
    expect(canConfirmAllergyReview('ADMIN')).toBe(true);
  });

  it('refuses receptionists and unauthenticated users', () => {
    // A receptionist has no clinical access, so confirming that the prose was
    // read is something they could only do blind. The backend refuses it too;
    // hiding the button keeps the UI from offering an action that will fail.
    expect(canConfirmAllergyReview('RECEPTIONIST')).toBe(false);
    expect(canConfirmAllergyReview(null)).toBe(false);
  });
});
