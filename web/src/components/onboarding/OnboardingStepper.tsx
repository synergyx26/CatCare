import { Check } from 'lucide-react'

const STEPS = [
  { label: 'Create account' },
  { label: 'Your household' },
  { label: 'Add a cat' },
]

interface Props {
  /** 0-based index of the current step (0 = create account, 1 = household, 2 = add cat) */
  step: 0 | 1 | 2
}

export function OnboardingStepper({ step }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((s, i) => {
        const done = i < step
        const active = i === step

        return (
          <div key={s.label} className="flex items-center">
            {/* Node */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  done
                    ? 'bg-sky-500 text-white'
                    : active
                    ? 'bg-sky-100 dark:bg-sky-900/40 border-2 border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'bg-muted text-muted-foreground border-2 border-border',
                ].join(' ')}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={[
                  'text-[11px] font-medium whitespace-nowrap',
                  active ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground',
                ].join(' ')}
              >
                {s.label}
              </span>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'w-12 h-0.5 mx-1 mb-4 transition-colors',
                  i < step ? 'bg-sky-500' : 'bg-border',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
