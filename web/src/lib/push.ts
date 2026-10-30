// Web Push device registration. Browsers only allow service workers and push
// on a secure context (https:// or localhost), so every entry point reports
// *why* push is unavailable instead of failing silently.
import { api } from '@/api/client'

export type PushState =
  | 'insecure'      // page isn't https — browser won't allow service workers
  | 'unsupported'   // browser has no Push API (e.g. iOS Safari outside an installed web app)
  | 'unconfigured'  // server has no VAPID keys
  | 'denied'        // user blocked notifications in browser settings
  | 'off'           // available, this device isn't subscribed
  | 'on'            // this device is subscribed

const SW_URL = '/sw.js'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function supported(): 'insecure' | 'unsupported' | null {
  if (!window.isSecureContext) return 'insecure'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return null
}

async function registration() {
  return navigator.serviceWorker.register(SW_URL).then(() => navigator.serviceWorker.ready)
}

export async function getPushState(): Promise<PushState> {
  const blocked = supported()
  if (blocked) return blocked
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

/** Ask permission, subscribe this device and register it with the API. */
export async function enablePush(): Promise<PushState> {
  const blocked = supported()
  if (blocked) return blocked

  let publicKey: string
  try {
    const res = await api.getPushConfig()
    publicKey = res.data.data.public_key
  } catch {
    return 'unconfigured'
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const reg = await registration()
  const existing = await reg.pushManager.getSubscription()
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  await api.registerPushSubscription(sub.toJSON())
  return 'on'
}

/** Unsubscribe this device only — other devices keep receiving. */
export async function disablePush(): Promise<PushState> {
  if (supported()) return getPushState()
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await api.removePushSubscription(sub.endpoint).catch(() => {})
    await sub.unsubscribe()
  }
  return 'off'
}
