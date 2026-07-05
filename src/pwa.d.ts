/**
 * Type declarations for PWA-related browser events.
 * The BeforeInstallPromptEvent is not part of the standard TypeScript lib
 * since it's a non-standard Chromium-based browser feature.
 */

interface BeforeInstallPromptEvent extends Event {
  /**
   * Returns an array of DOMString items containing the platforms on which
   * the event was dispatched.
   */
  readonly platforms: string[];

  /**
   * A Promise that resolves with an object containing the user's choice
   * regarding the install prompt.
   */
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;

  /**
   * Shows the install prompt to the user. Returns a Promise that resolves
   * when the user has made a choice.
   */
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

export {};
