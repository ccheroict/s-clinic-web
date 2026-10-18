import type { ConsentStatus, ConsentTypeCode, UserRole } from './types';

/**
 * What the consent screen should say and offer.
 *
 * Plain functions, so the decisions can be tested without a component. The one
 * that matters is {@link outstandingConsents}: the screen exists to show a
 * receptionist what is still missing for a patient in front of them, and a list
 * of what has already been collected answers the opposite question.
 */

/** Consents still to collect, in the order they should be asked for. */
export function outstandingConsents(
  statuses: readonly ConsentStatus[] | null,
): ConsentStatus[] {
  return (statuses ?? [])
    .filter((status) => !status.granted && !status.notConfigured)
    .slice()
    .sort(byUrgency);
}

/**
 * The ones that stop care, not merely a feature.
 *
 * Separated because the two require different conversations. "We cannot treat
 * you until you sign this" and "may we also use your photograph in an
 * advertisement" must never be presented as the same request, and bundling them
 * is how consent stops being freely given.
 */
export function blockingConsents(
  statuses: readonly ConsentStatus[] | null,
): ConsentStatus[] {
  return outstandingConsents(statuses).filter((status) => status.blocksCare);
}

/** Outstanding consents that are optional, for a separate, lower-key section. */
export function optionalConsents(
  statuses: readonly ConsentStatus[] | null,
): ConsentStatus[] {
  return outstandingConsents(statuses).filter((status) => !status.blocksCare);
}

/**
 * Types the clinic has not configured, which no amount of asking will fix.
 *
 * Surfaced to the user rather than hidden: a receptionist who cannot find the
 * photography consent needs to be told that nobody has published its wording,
 * not left to conclude the system is broken.
 */
export function unconfiguredConsents(
  statuses: readonly ConsentStatus[] | null,
): ConsentStatus[] {
  return (statuses ?? []).filter((status) => status.notConfigured);
}

/**
 * Whether the patient can be treated as far as consent is concerned.
 *
 * False while any care-blocking consent is missing. Deliberately not "all
 * consents granted": a patient who declines marketing use of their photographs
 * is fully treatable, and a check that demanded everything would turn an
 * optional request into a condition of care.
 */
export function careMayProceed(statuses: readonly ConsentStatus[] | null): boolean {
  if (statuses === null || statuses.length === 0) {
    // Nothing loaded yet. Reported as not-yet-cleared rather than cleared: the
    // honest answer while loading is "unknown", and of the two ways to be wrong,
    // briefly withholding a green light is the recoverable one.
    return false;
  }

  return blockingConsents(statuses).length === 0;
}

/**
 * Granted consents whose wording has since changed.
 *
 * Still valid — revoking consent because the clinic edited a form would be
 * wrong — but worth re-collecting at the next visit, which is a prompt rather
 * than a warning.
 */
export function staleWordingConsents(
  statuses: readonly ConsentStatus[] | null,
): ConsentStatus[] {
  return (statuses ?? []).filter((status) => status.granted && status.supersededWording);
}

/** Whether this patient may be sent appointment reminders. Requirement 11.7. */
export function remindersAllowed(statuses: readonly ConsentStatus[] | null): boolean {
  return (statuses ?? []).some(
    (status) => status.typeCode === 'APPOINTMENT_REMINDER' && status.granted,
  );
}

export function statusFor(
  statuses: readonly ConsentStatus[] | null,
  type: ConsentTypeCode,
): ConsentStatus | null {
  return (statuses ?? []).find((status) => status.typeCode === type) ?? null;
}

/**
 * Who may record consent.
 *
 * Everyone who can open a patient record. Consent is collected at reception,
 * which makes it a receptionist's job, and a withdrawal has to be recordable by
 * whoever the patient happens to speak to — refusing because the wrong person is
 * at the desk does not make the patient come back later, it makes the withdrawal
 * go unrecorded.
 */
export function canCollectConsent(role: UserRole | null): boolean {
  return role !== null;
}

/** Who may publish the wording. A different job, with a different risk. */
export function canPublishWording(role: UserRole | null): boolean {
  return role === 'ADMIN';
}

/**
 * Care-blocking first, then sensitive, then by name.
 *
 * The order the questions should be asked in: the ones that hold up treatment
 * come first because they are the reason the patient is waiting.
 */
function byUrgency(a: ConsentStatus, b: ConsentStatus): number {
  if (a.blocksCare !== b.blocksCare) {
    return a.blocksCare ? -1 : 1;
  }
  if (a.sensitive !== b.sensitive) {
    return a.sensitive ? -1 : 1;
  }
  return a.typeName.localeCompare(b.typeName, 'vi');
}

/**
 * A message for a failed consent call.
 *
 * The server's own wording is preferred wherever it sent some. Both refusals
 * that matter here — the patient has not consented, and nobody has published the
 * wording — are explained by the backend in terms a receptionist can act on, and
 * replacing either with "an error occurred" turns an actionable refusal into a
 * dead end.
 */
export function consentErrorMessage(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const result = error as { ok?: unknown; status?: string; message?: string };

    // Only a failed ApiResult, identified by shape. A thrown Error also has a
    // `message`, and that message is for a developer reading a console — "boom",
    // or the text of a TypeError — not for a receptionist with a patient waiting.
    const isApiFailure = result.ok === false && typeof result.status === 'string';

    if (isApiFailure) {
      if (typeof result.message === 'string' && result.message.trim() !== '') {
        return result.message;
      }

      if (result.status === 'validation') {
        return 'Thông tin chưa hợp lệ. Hãy kiểm tra lại phương thức thu và bằng chứng.';
      }
    }
  }

  return 'Không thực hiện được. Hãy thử lại.';
}
