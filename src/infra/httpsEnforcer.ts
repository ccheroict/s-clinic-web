/**
 * HTTPS Enforcer - Pure domain logic for protocol validation
 * Validates: Requirements 8.1, 8.2
 */

/**
 * Check if URL uses HTTPS protocol
 * @param url - The URL to check
 * @returns true if URL uses https protocol
 */
export function isSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    // Invalid URL - treat as insecure
    return false;
  }
}

/**
 * Assert that URL uses HTTPS protocol
 * Allows http://localhost/* for development
 * @param url - The URL to validate
 * @returns true if URL is secure or localhost
 * @throws Error if URL is not secure and not localhost
 */
export function assertHttps(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Allow localhost for development
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (isLocalhost) {
      return true;
    }

    // For non-localhost, require HTTPS
    if (parsed.protocol !== 'https:') {
      throw new Error(`Insecure URL: ${url}. Only HTTPS is allowed (except localhost for development).`);
    }

    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Insecure URL:')) {
      throw error;
    }
    // Invalid URL - throw error
    throw new Error(`Invalid URL: ${url}`);
  }
}