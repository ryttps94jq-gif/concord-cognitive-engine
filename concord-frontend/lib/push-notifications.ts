/**
 * Push Notifications Client
 *
 * Manages Web Push API subscription lifecycle:
 *   - Permission requests
 *   - PushManager subscribe / unsubscribe
 *   - Sends subscription to the server for storage
 *
 * Requires:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY env var (base64-encoded VAPID public key)
 *   - Server endpoint: POST /api/push/subscribe, DELETE /api/push/unsubscribe
 *   - A registered service worker at /sw.js
 */

const PUSH_SUBSCRIBE_ENDPOINT = '/api/push/subscribe';
const PUSH_UNSUBSCRIBE_ENDPOINT = '/api/push/unsubscribe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a URL-safe base64 VAPID key to a Uint8Array for the Push API. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getVapidPublicKey(): string | null {
  return typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
    : null;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/** Return the current notification permission state without prompting. */
export function getPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as PushPermissionState;
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  // Already decided
  if (Notification.permission !== 'default') {
    return Notification.permission as PushPermissionState;
  }

  const result = await Notification.requestPermission();
  return result as PushPermissionState;
}

// ---------------------------------------------------------------------------
// Subscribe / Unsubscribe
// ---------------------------------------------------------------------------

export interface PushSubscriptionResult {
  ok: boolean;
  subscription?: PushSubscription;
  error?: string;
}

/**
 * Subscribe the user to push notifications.
 *
 * Flow:
 *   1. Request notification permission (if not already granted)
 *   2. Subscribe via PushManager with the VAPID application server key
 *   3. Send the PushSubscription JSON to the server
 */
export async function subscribeToPush(): Promise<PushSubscriptionResult> {
  // Check browser support
  if (!('PushManager' in window)) {
    return { ok: false, error: 'Push notifications are not supported in this browser.' };
  }

  // Get permission
  const permission = await requestPermission();
  if (permission === 'denied') {
    return { ok: false, error: 'Notification permission was denied.' };
  }
  if (permission === 'unsupported') {
    return { ok: false, error: 'Notifications are not supported in this browser.' };
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission was not granted.' };
  }

  // Ensure VAPID key is available
  const vapidKey = getVapidPublicKey();
  if (!vapidKey) {
    return { ok: false, error: 'VAPID public key is not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY).' };
  }

  // Get SW registration
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { ok: false, error: 'Service worker is not registered.' };
  }

  try {
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }

    // Send subscription to server
    const response = await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, subscription, error: `Server rejected subscription: ${body}` };
    }

    return { ok: true, subscription };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to subscribe: ${message}` };
  }
}

/**
 * Unsubscribe from push notifications.
 *
 * Removes the PushSubscription locally and notifies the server.
 */
export async function unsubscribe(): Promise<{ ok: boolean; error?: string }> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { ok: false, error: 'Service worker is not registered.' };
  }

  try {
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return { ok: true }; // Already unsubscribed
    }

    // Notify server to remove subscription
    await fetch(PUSH_UNSUBSCRIBE_ENDPOINT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {
      // Server notification is best-effort; local unsubscribe still proceeds
    });

    await subscription.unsubscribe();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to unsubscribe: ${message}` };
  }
}

/**
 * Check whether the user currently has an active push subscription.
 */
export async function isSubscribed(): Promise<boolean> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}
