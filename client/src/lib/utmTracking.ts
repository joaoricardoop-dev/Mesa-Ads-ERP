const STORAGE_KEY = "mesaads_tracking";
const COOKIE_KEY = "mesaads_tracking";
const COOKIE_MAX_AGE_DAYS = 30;

export interface TrackingData {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPath?: string;
  capturedAt?: string;
}

const UTM_PARAMS: Array<[string, keyof TrackingData]> = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_content", "utmContent"],
  ["utm_term", "utmTerm"],
];

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function captureTrackingFromUrl(landingPath?: string): TrackingData | null {
  if (typeof window === "undefined") return null;

  const existing = getTracking();
  const params = new URLSearchParams(window.location.search);
  const captured: TrackingData = {};
  let hasUtm = false;

  for (const [param, field] of UTM_PARAMS) {
    const v = params.get(param);
    if (v) {
      (captured as any)[field] = v.slice(0, 255);
      hasUtm = true;
    }
  }

  // If there's no UTM in the URL, keep existing tracking from session/cookie.
  if (!hasUtm && existing) return existing;

  if (!hasUtm && !existing) {
    // First visit without UTM — still record referrer + landing path so we can
    // distinguish organic/direct traffic later.
    const ref = document.referrer || "";
    const sameOrigin = ref && ref.startsWith(window.location.origin);
    if (ref && !sameOrigin) captured.referrer = ref.slice(0, 500);
    captured.landingPath = (landingPath ?? window.location.pathname).slice(0, 255);
    captured.capturedAt = new Date().toISOString();
    persist(captured);
    return captured;
  }

  // We have UTMs — overwrite previous attribution (latest touch wins).
  const ref = document.referrer || "";
  const sameOrigin = ref && ref.startsWith(window.location.origin);
  if (ref && !sameOrigin) captured.referrer = ref.slice(0, 500);
  captured.landingPath = (landingPath ?? window.location.pathname).slice(0, 255);
  captured.capturedAt = new Date().toISOString();
  persist(captured);
  return captured;
}

function persist(data: TrackingData) {
  try {
    const json = JSON.stringify(data);
    sessionStorage.setItem(STORAGE_KEY, json);
    writeCookie(COOKIE_KEY, json, COOKIE_MAX_AGE_DAYS);
  } catch {
    /* ignore */
  }
}

export function getTracking(): TrackingData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || readCookie(COOKIE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TrackingData;
  } catch {
    return null;
  }
}

export function clearTracking() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    writeCookie(COOKIE_KEY, "", -1);
  } catch {
    /* ignore */
  }
}
