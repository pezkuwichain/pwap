/**
 * Cloudflare Turnstile token for Supabase Auth calls.
 *
 * GoTrue verifies these itself — it POSTs to challenges.cloudflare.com with the
 * widget secret before /signup, /recover, /resend, /magiclink, /otp and /token
 * (grant_type=password). There is no siteverify call in this codebase and there
 * should not be: the only way to protect those endpoints is inside the service
 * that serves them, since anyone can call /auth/v1/signup directly and skip
 * whatever the browser was asked to do.
 *
 * Why it exists: signup had no bot protection at all. An account is not the
 * prize — GoTrue refuses a session until the address is confirmed. The prize is
 * our mail: /signup and /recover send to whatever address the caller types, so
 * a stranger could make pezkuwichain.io mail thousands of people who never asked.
 * That burns the sending domain's reputation, and reputation takes months to
 * rebuild.
 *
 * One shared widget in `execution: "execute"` mode rather than one per form.
 * Some of these are buttons, not forms — "resend confirmation" on the dashboard
 * has nowhere to put a checkbox — and a challenge that only appears when
 * Cloudflare asks for one keeps the common case invisible.
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// A challenge that needs interaction still has to be visible and clickable, so
// this is positioned rather than hidden.
const CONTAINER_ID = 'pezkuwi-turnstile';

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(el: HTMLElement | string, opts?: Record<string, unknown>): void;
  reset(id?: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let container: HTMLElement | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Let the next attempt retry instead of caching the failure forever.
      scriptPromise = null;
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function ensureContainer(): HTMLElement {
  if (container?.isConnected) return container;
  container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.style.position = 'fixed';
  container.style.bottom = '1rem';
  container.style.right = '1rem';
  container.style.zIndex = '2147483647';
  document.body.appendChild(container);
  return container;
}

/**
 * Resolve a fresh Turnstile token, or undefined when no site key is configured.
 *
 * Undefined rather than throwing: without a key there is nothing to send, and a
 * local dev build with captcha disabled server-side should still be able to log
 * in. Once GoTrue has captcha enabled it rejects the tokenless request itself,
 * which is the check that matters.
 *
 * Tokens are single-use. Every call resets the widget first, so a retry after a
 * failed submit gets a new token instead of being refused as a duplicate.
 */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;

  await loadScript();
  const turnstile = window.turnstile;
  if (!turnstile) throw new Error('Turnstile unavailable');

  const el = ensureContainer();

  // Render fresh each time and tear the old one down. Calling render() twice on
  // one container would leave two widgets stacked on the page, and reusing a
  // widget means its callbacks still close over the previous call's promise.
  if (widgetId !== null) {
    try {
      turnstile.remove(widgetId);
    } catch {
      // Already gone (page navigation, script reload) — nothing to clean up.
    }
    widgetId = null;
  }

  return new Promise<string>((resolve, reject) => {
    widgetId = turnstile.render(el, {
      sitekey: SITE_KEY,
      execution: 'execute',
      appearance: 'interaction-only',
      action: 'turnstile-spin-v2',
      callback: (token: string) => resolve(token),
      'error-callback': () => reject(new Error('Captcha failed')),
      'timeout-callback': () => reject(new Error('Captcha timed out')),
    });

    turnstile.execute(el);
  });
}
