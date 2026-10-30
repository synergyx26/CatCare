import { useEffect, useState } from 'react'
import { Smartphone, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { api } from '@/api/client'
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push'

const MESSAGES: Record<Exclude<PushState, 'off' | 'on'>, string> = {
  insecure: 'This page is loaded over plain HTTP, so your browser blocks push. Open CatCare over HTTPS (the secure address) to enable it.',
  unsupported: 'This browser can’t receive push here. On iPhone/iPad, add CatCare to your Home Screen first (Share → Add to Home Screen), then open it from there.',
  unconfigured: 'Push isn’t configured on the server yet (missing VAPID keys).',
  denied: 'Notifications are blocked for this site. Allow them in your browser’s site settings, then come back.',
}

/** Per-device opt-in: each phone/laptop subscribes independently. */
export function DevicePushCard() {
  const [state, setState] = useState<PushState | null>(null)
  useEffect(() => { getPushState().then(setState) }, [])

  const toggle = useMutation({
    mutationFn: () => (state === 'on' ? disablePush() : enablePush()),
    onSuccess: (next) => {
      setState(next)
      if (next === 'on') notify.success('Notifications enabled on this device')
      if (next === 'off') notify.success('Notifications turned off on this device')
    },
    onError: () => notify.error('Could not update notifications for this device. Please try again.'),
  })

  const test = useMutation({
    mutationFn: () => api.sendTestNotification(),
    onSuccess: () => notify.success('Test sent — it should arrive on every enabled device in a moment'),
    onError: () => notify.error('Could not send the test notification'),
  })

  if (state === null) return null
  const blocked = state !== 'on' && state !== 'off'

  return (
    <div className="mt-2 flex items-start gap-3 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-4 dark:border-sky-800/40 dark:from-sky-950/30 dark:to-indigo-950/30">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
        <Smartphone className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">This device</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {blocked
            ? MESSAGES[state]
            : state === 'on'
              ? 'Push is on for this device. Enable it on each phone and computer you want alerts on.'
              : 'Get alerts here even when CatCare is closed. Each device is enabled separately.'}
        </p>
        {!blocked && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={state === 'on' ? 'outline' : 'default'} disabled={toggle.isPending} onClick={() => toggle.mutate()}>
              {toggle.isPending && <Loader2 className="size-3.5 animate-spin" />}
              {state === 'on' ? 'Turn off on this device' : 'Enable on this device'}
            </Button>
            {state === 'on' && (
              <Button type="button" size="sm" variant="ghost" disabled={test.isPending} onClick={() => test.mutate()}>
                Send test notification
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
