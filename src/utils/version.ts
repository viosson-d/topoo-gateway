/**
 * Application version utility
 * Automatically reads version from package.json
 */

// Vite exposes package.json version via import.meta.env
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || __APP_VERSION__ || '0.0.0';

// Formatted version with 'v' prefix
export const APP_VERSION_DISPLAY = `v${APP_VERSION}`;

/**
 * Get the current application version
 * @returns Version string (e.g., "0.0.126")
 */
export function getAppVersion(): string {
    return APP_VERSION;
}

/**
 * Get the current application version with 'v' prefix
 * @returns Formatted version string (e.g., "v0.0.126")
 */
export function getAppVersionDisplay(): string {
    return APP_VERSION_DISPLAY;
}
