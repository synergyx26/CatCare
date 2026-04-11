/** Supported currencies with display metadata. */
export interface CurrencyOption {
  code: string          // ISO 4217 code, e.g. "USD"
  label: string         // human-readable, e.g. "US Dollar"
  symbol: string        // short display symbol, e.g. "$"
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'US Dollar',            symbol: '$'   },
  { code: 'EUR', label: 'Euro',                 symbol: '€'   },
  { code: 'GBP', label: 'British Pound',        symbol: '£'   },
  { code: 'CAD', label: 'Canadian Dollar',      symbol: 'C$'  },
  { code: 'AUD', label: 'Australian Dollar',    symbol: 'A$'  },
  { code: 'NZD', label: 'New Zealand Dollar',   symbol: 'NZ$' },
  { code: 'CHF', label: 'Swiss Franc',          symbol: 'CHF' },
  { code: 'JPY', label: 'Japanese Yen',         symbol: '¥'   },
  { code: 'CNY', label: 'Chinese Yuan',         symbol: '¥'   },
  { code: 'HKD', label: 'Hong Kong Dollar',     symbol: 'HK$' },
  { code: 'SGD', label: 'Singapore Dollar',     symbol: 'S$'  },
  { code: 'SEK', label: 'Swedish Krona',        symbol: 'kr'  },
  { code: 'NOK', label: 'Norwegian Krone',      symbol: 'kr'  },
  { code: 'DKK', label: 'Danish Krone',         symbol: 'kr'  },
  { code: 'INR', label: 'Indian Rupee',         symbol: '₹'   },
  { code: 'KRW', label: 'South Korean Won',     symbol: '₩'   },
  { code: 'BRL', label: 'Brazilian Real',       symbol: 'R$'  },
  { code: 'MXN', label: 'Mexican Peso',         symbol: '$'   },
  { code: 'ZAR', label: 'South African Rand',   symbol: 'R'   },
  { code: 'AED', label: 'UAE Dirham',           symbol: 'د.إ' },
  { code: 'SAR', label: 'Saudi Riyal',          symbol: '﷼'   },
  { code: 'ILS', label: 'Israeli Shekel',       symbol: '₪'   },
  { code: 'PLN', label: 'Polish Zloty',         symbol: 'zł'  },
  { code: 'CZK', label: 'Czech Koruna',         symbol: 'Kč'  },
  { code: 'HUF', label: 'Hungarian Forint',     symbol: 'Ft'  },
  { code: 'RON', label: 'Romanian Leu',         symbol: 'lei' },
  { code: 'TRY', label: 'Turkish Lira',         symbol: '₺'   },
  { code: 'THB', label: 'Thai Baht',            symbol: '฿'   },
  { code: 'PHP', label: 'Philippine Peso',      symbol: '₱'   },
  { code: 'MYR', label: 'Malaysian Ringgit',    symbol: 'RM'  },
  { code: 'IDR', label: 'Indonesian Rupiah',    symbol: 'Rp'  },
]

/** Get the symbol for a given currency code. Falls back to the code itself. */
export function getCurrencySymbol(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency
}

/**
 * Format a numeric amount using the given ISO 4217 currency code.
 * Uses Intl.NumberFormat — respects locale-appropriate decimal/grouping separators.
 * For currencies without decimals (JPY, KRW) it omits the fraction digits automatically.
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Fallback for unsupported currency codes
    const symbol = getCurrencySymbol(currency)
    return `${symbol}${amount.toFixed(2)}`
  }
}
