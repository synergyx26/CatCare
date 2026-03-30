/**
 * notify — preference-aware toast wrapper around Sonner.
 *
 * Reads the current notification preferences directly from the Zustand store
 * using getState() so it works in mutation callbacks outside React components.
 *
 * Design decisions:
 * - notify.error() ALWAYS fires regardless of preferences — errors are
 *   safety-critical and must never be silenced.
 * - notify.tierLimit() is a separate method so the tier_limit_toasts toggle
 *   applies cleanly without inspecting message strings.
 * - notify.raw exposes the underlying Sonner toast for advanced usage
 *   (toast.promise, toast.dismiss, etc.)
 */
import { toast } from 'sonner'
import type { ExternalToast } from 'sonner'
import { useNotificationStore } from '@/store/notificationStore'

function p() {
  return useNotificationStore.getState().preferences.in_app
}

export const notify = {
  success(message: string, opts?: ExternalToast) {
    if (!p().enabled || !p().success_toasts) return
    toast.success(message, opts)
  },

  /** Always fires — never suppressed by preferences. */
  error(message: string, opts?: ExternalToast) {
    toast.error(message, opts)
  },

  warning(message: string, opts?: ExternalToast) {
    if (!p().enabled || !p().success_toasts) return
    toast.warning(message, opts)
  },

  info(message: string, opts?: ExternalToast) {
    if (!p().enabled || !p().success_toasts) return
    toast.info(message, opts)
  },

  /** Use for "Plan limit reached / upgrade" messages. Respects tier_limit_toasts toggle. */
  tierLimit(message: string, opts?: ExternalToast) {
    if (!p().enabled || !p().tier_limit_toasts) return
    toast.error(message, opts)
  },

  /** Escape hatch for toast.promise, toast.dismiss, and other Sonner APIs. */
  raw: toast,
}
