/**
 * PWA install prompt types.
 *
 * `beforeinstallprompt` is not in the standard DOM typings because it is not a
 * cross-browser standard, so the event shape has to be declared here for the
 * install button to type-check.
 */

interface BeforeInstallPromptEvent extends Event {
  /** Platforms the prompt can target, e.g. ["web", "android"]. */
  readonly platforms: string[];

  /** Resolves once the user has accepted or dismissed the prompt. */
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;

  /** Shows the browser install prompt. May only be called once per event. */
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}
