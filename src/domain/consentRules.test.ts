import { describe, expect, it } from 'vitest';

import {
  blockingConsents,
  canCollectConsent,
  canPublishWording,
  careMayProceed,
  consentErrorMessage,
  optionalConsents,
  outstandingConsents,
  remindersAllowed,
  staleWordingConsents,
  statusFor,
  unconfiguredConsents,
} from './consentRules';
import type { ConsentStatus, ConsentTypeCode } from './types';

/**
 * What the consent screen shows and offers.
 *
 * The cases that matter are the ones where consent looks handled and is not: an
 * optional consent counted as a condition of care, a type nobody has configured
 * presented as a patient who has not signed, and a withdrawn consent reading as
 * one never asked for.
 */

function status(
  typeCode: ConsentTypeCode,
  overrides: Partial<ConsentStatus> = {},
): ConsentStatus {
  return {
    typeCode,
    typeName: typeCode,
    description: null,
    sensitive: false,
    blocksCare: false,
    notConfigured: false,
    currentVersion: 1,
    granted: false,
    supersededWording: false,
    grantedAt: null,
    withdrawnAt: null,
    ...overrides,
  };
}

describe('outstandingConsents', () => {
  it('lists only what is still missing', () => {
    const all = [
      status('TREATMENT', { granted: true }),
      status('CLINICAL_PHOTO'),
    ];

    // The screen exists to show what is left to collect. A list of what has been
    // collected answers the opposite question.
    expect(outstandingConsents(all).map((s) => s.typeCode)).toEqual(['CLINICAL_PHOTO']);
  });

  it('leaves out types the clinic has not configured', () => {
    const all = [status('PROCEDURE', { notConfigured: true, currentVersion: null })];

    // No amount of asking the patient will fix it, so it does not belong on a
    // to-collect list. It is reported separately.
    expect(outstandingConsents(all)).toEqual([]);
    expect(unconfiguredConsents(all).map((s) => s.typeCode)).toEqual(['PROCEDURE']);
  });

  it('puts care-blocking consents first', () => {
    const all = [
      status('PHOTO_MARKETING'),
      status('TREATMENT', { blocksCare: true }),
      status('CLINICAL_PHOTO', { sensitive: true }),
    ];

    // The order to ask in: the ones holding up treatment come first, because
    // they are why the patient is waiting.
    expect(outstandingConsents(all).map((s) => s.typeCode)).toEqual([
      'TREATMENT',
      'CLINICAL_PHOTO',
      'PHOTO_MARKETING',
    ]);
  });

  it('does not mutate the list it was given', () => {
    const all = [status('PHOTO_MARKETING'), status('TREATMENT', { blocksCare: true })];
    const order = all.map((s) => s.typeCode);

    outstandingConsents(all);

    // Sorting in place would reorder whatever the query cache is holding.
    expect(all.map((s) => s.typeCode)).toEqual(order);
  });

  it('handles nothing loaded yet', () => {
    expect(outstandingConsents(null)).toEqual([]);
  });
});

describe('blocking versus optional', () => {
  it('separates the two', () => {
    const all = [
      status('TREATMENT', { blocksCare: true }),
      status('PHOTO_MARKETING'),
    ];

    // "We cannot treat you until you agree to this" and "may we use your
    // photograph in an advertisement" are different conversations, and showing
    // them as one list is how consent stops being freely given.
    expect(blockingConsents(all).map((s) => s.typeCode)).toEqual(['TREATMENT']);
    expect(optionalConsents(all).map((s) => s.typeCode)).toEqual(['PHOTO_MARKETING']);
  });

  it('counts neither once granted', () => {
    const all = [
      status('TREATMENT', { blocksCare: true, granted: true }),
      status('PHOTO_MARKETING', { granted: true }),
    ];

    expect(blockingConsents(all)).toEqual([]);
    expect(optionalConsents(all)).toEqual([]);
  });
});

describe('careMayProceed', () => {
  it('is false while a required consent is missing', () => {
    expect(careMayProceed([status('TREATMENT', { blocksCare: true })])).toBe(false);
  });

  it('is true when only optional consents are missing', () => {
    const all = [
      status('TREATMENT', { blocksCare: true, granted: true }),
      status('PHOTO_MARKETING'),
      status('APPOINTMENT_REMINDER'),
    ];

    // A patient who declines marketing use of their photographs is fully
    // treatable. A check demanding everything would turn an optional request
    // into a condition of care, which is exactly what the law forbids.
    expect(careMayProceed(all)).toBe(true);
  });

  it('is false while nothing has loaded', () => {
    // The honest answer is "unknown", and of the two ways to be wrong, briefly
    // withholding a green light is the recoverable one.
    expect(careMayProceed(null)).toBe(false);
    expect(careMayProceed([])).toBe(false);
  });
});

describe('staleWordingConsents', () => {
  it('flags consent given against older wording without revoking it', () => {
    const all = [
      status('TREATMENT', { granted: true, supersededWording: true, blocksCare: true }),
    ];

    // Still consent — revoking it because the clinic edited a form would be
    // wrong — so it must not appear as outstanding, and care may proceed.
    expect(staleWordingConsents(all).map((s) => s.typeCode)).toEqual(['TREATMENT']);
    expect(outstandingConsents(all)).toEqual([]);
    expect(careMayProceed(all)).toBe(true);
  });

  it('ignores current wording and withdrawn consents', () => {
    expect(staleWordingConsents([status('TREATMENT', { granted: true })])).toEqual([]);
    expect(
      staleWordingConsents([status('TREATMENT', { supersededWording: true })]),
    ).toEqual([]);
  });
});

describe('remindersAllowed', () => {
  it('requires the reminder consent specifically', () => {
    const treatedOnly = [status('TREATMENT', { granted: true, blocksCare: true })];

    // Agreeing to be treated is not agreeing to be messaged.
    expect(remindersAllowed(treatedOnly)).toBe(false);
    expect(remindersAllowed([status('APPOINTMENT_REMINDER', { granted: true })])).toBe(
      true,
    );
  });

  it('is false once the consent is withdrawn', () => {
    // Requirement 11.7. The status comes back granted = false with a withdrawal
    // time, and reminders stop from that point.
    const withdrawn = [
      status('APPOINTMENT_REMINDER', {
        granted: false,
        withdrawnAt: '2026-10-18T10:00:00Z',
      }),
    ];

    expect(remindersAllowed(withdrawn)).toBe(false);
  });

  it('is false with nothing loaded', () => {
    expect(remindersAllowed(null)).toBe(false);
  });
});

describe('statusFor', () => {
  it('finds one type, or returns null', () => {
    const all = [status('TREATMENT', { granted: true })];

    expect(statusFor(all, 'TREATMENT')?.granted).toBe(true);
    expect(statusFor(all, 'PHOTO_MARKETING')).toBeNull();
    expect(statusFor(null, 'TREATMENT')).toBeNull();
  });
});

describe('who may do what', () => {
  it('lets any signed-in role collect and withdraw consent', () => {
    // Consent is collected at reception, and a withdrawal has to be recordable
    // by whoever the patient speaks to. Refusing because the wrong person is at
    // the desk does not make the patient return later; it makes the withdrawal
    // go unrecorded.
    expect(canCollectConsent('RECEPTIONIST')).toBe(true);
    expect(canCollectConsent('DOCTOR')).toBe(true);
    expect(canCollectConsent('ADMIN')).toBe(true);
    expect(canCollectConsent(null)).toBe(false);
  });

  it('restricts publishing the wording to admins', () => {
    // Deciding what patients are asked is a different job, with a different
    // risk, from recording what they answered.
    expect(canPublishWording('ADMIN')).toBe(true);
    expect(canPublishWording('DOCTOR')).toBe(false);
    expect(canPublishWording('RECEPTIONIST')).toBe(false);
  });
});

describe('consentErrorMessage', () => {
  it('keeps the server wording for a refusal', () => {
    const forbidden = {
      ok: false,
      status: 'forbidden',
      message: 'Thiếu sự đồng ý: Đồng ý chụp và lưu ảnh lâm sàng (CLINICAL_PHOTO).',
    };

    // The backend names the missing consent so the desk knows the fix is a form
    // the patient can sign. Replacing it with "an error occurred" turns that
    // into a dead end.
    expect(consentErrorMessage(forbidden)).toContain('CLINICAL_PHOTO');
  });

  it('passes through a generic server message rather than inventing one', () => {
    // Unpublished wording comes back as a 503, and classifyResponse replaces
    // every 5xx body with a generic message on purpose — it cannot tell a
    // message the application wrote from one a proxy produced. The screen learns
    // which types are unconfigured from the status endpoint instead, which is
    // why this path only has to avoid making things worse.
    const unavailable = {
      ok: false,
      status: 'server',
      code: 'SERVER_ERROR',
      message: 'An error occurred. Please try again later.',
    };

    expect(consentErrorMessage(unavailable)).toBe('An error occurred. Please try again later.');
  });

  it('explains a validation failure that carried no message', () => {
    expect(consentErrorMessage({ ok: false, status: 'validation', errors: {} })).toContain(
      'chưa hợp lệ',
    );
  });

  it('falls back for anything unrecognised', () => {
    expect(consentErrorMessage(null)).toBe('Không thực hiện được. Hãy thử lại.');
    expect(consentErrorMessage(new Error('boom'))).toBe(
      'Không thực hiện được. Hãy thử lại.',
    );
  });
});
