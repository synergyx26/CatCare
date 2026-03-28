import * as React from 'react'
import PhoneInputLib, { formatPhoneNumberIntl, type Country } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

/** Format a stored phone number for display. Returns the formatted international
 *  string for E.164 values, the raw value for legacy formats, or '' for nullish. */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) return ''
  const formatted = formatPhoneNumberIntl(value)
  return formatted || value
}
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ─── Styled text input forwarded to the library ───────────────────────────────

// react-phone-number-input passes standard input props; our Input already
// forwards refs, so we just need to satisfy the expected interface.
const PhoneInputText = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => (
  <Input ref={ref} {...props} className="rounded-l-none border-l-0 focus-visible:ring-0 focus-visible:border-ring" />
))
PhoneInputText.displayName = 'PhoneInputText'

// ─── Public component ─────────────────────────────────────────────────────────

export interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  defaultCountry?: Country
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = 'US',
  placeholder,
  className,
  disabled,
}: PhoneInputProps) {
  return (
    <div className={cn('phone-input-wrapper', className)}>
      <PhoneInputLib
        international
        defaultCountry={defaultCountry}
        value={value && value.startsWith('+') ? value : undefined}
        onChange={(v) => onChange(v ?? '')}
        inputComponent={PhoneInputText}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}
