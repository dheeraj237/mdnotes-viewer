let gisLoaded = false;
let tokenClient: any = null;

const CLIENT_ID = import.meta.env.VITE_AUTH_APP_CLIENT_ID || import.meta.env.VITE_FIREBASE_API_KEY;
// Use only the per-file Drive scope to avoid branding/verification requirements.
// `drive.file` allows read/write access to files the app created or that the
// user explicitly opened with the Picker. It cannot list or access arbitrary
// Drive files owned by the user without additional scopes that may require
// OAuth verification.
const SCOPES = "https://www.googleapis.com/auth/drive.file openid profile email";

export async function ensureGisLoaded(): Promise<void> {
  if (gisLoaded) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-gis]');
    if (existing) {
      gisLoaded = true;
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.setAttribute("data-gis", "1");
    s.async = true;
    s.onload = () => {
      gisLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

async function initTokenClient() {
  if (tokenClient) return tokenClient;
  // `google` will be available after loading gis client
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    throw new Error("Google Identity Services not initialized");
  }
  // Note: we create token clients per-request to allow varying scopes.
  tokenClient = null;
  return tokenClient;
}

/**
 * Request an access token for Drive. If `interactive` is true, the user will be shown a consent prompt when needed.
 */
export async function requestAccessTokenForScopes(scopes: string, interactive = true): Promise<string | null> {
  await ensureGisLoaded();

  if (!CLIENT_ID) {
    throw new Error("Google Client ID is not configured. Set VITE_AUTH_APP_CLIENT_ID in your .env files.");
  }

  // create a fresh token client for the requested scopes
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: scopes,
    callback: (resp: any) => {},
  });

  return await new Promise((resolve, reject) => {
    try {
      client.callback = (resp: any) => {
        if (resp && resp.access_token) resolve(resp.access_token);
        else resolve(null);
      };
      client.requestAccessToken({ prompt: interactive ? "consent" : "" });
    } catch (err) {
      reject(err);
    }
  });
}

export async function requestDriveAccessToken(interactive = true): Promise<string | null> {
  return requestAccessTokenForScopes(SCOPES, interactive);
}

let gapiLoaded = false;
/** Load Google API JS (gapi) and Picker library */
export async function ensureGapiPickerLoaded(): Promise<void> {
  if (gapiLoaded) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-gapi]');
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (window.gapi && (window as any).google && (window as any).google.picker) {
        gapiLoaded = true;
        resolve();
        return;
      }
    }
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.setAttribute('data-gapi', '1');
    s.async = true;
    s.onload = () => {
      // Load the picker library
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.gapi.load('picker', () => {
        gapiLoaded = true;
        resolve();
      });
    };
    s.onerror = () => reject(new Error('Failed to load Google API (gapi)'));
    document.head.appendChild(s);
  });
}

export function clearTokens() {
  // nothing persisted long-term; tokens are short lived
}

export default {
  ensureGisLoaded,
  requestDriveAccessToken,
  clearTokens,
};
