import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Cat,
  Users,
  ChartLine,
  Shield,
  CheckCircle,
  XCircle,
  ClipboardList,
  ArrowRight,
  Sparkles,
  TrendingUp,
  PawPrint,
  ChevronDown,
} from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

// ─── Font ─────────────────────────────────────────────────────────────────────
function useFraunces() {
  useEffect(() => {
    const id = 'fraunces-font'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..700&display=swap'
    document.head.appendChild(link)
  }, [])
}

// ─── Photos ───────────────────────────────────────────────────────────────────
const PHOTO_COZY_BLACK_CAT =
  'https://images.pexels.com/photos/15990930/pexels-photo-15990930.jpeg?auto=compress&cs=tinysrgb&w=900'

// ─── Data ─────────────────────────────────────────────────────────────────────

type FeatureTier = 'pro' | 'premium' | undefined

const features: {
  icon: React.ElementType
  title: string
  description: string
  color: string
  bg: string
  tier: FeatureTier
}[] = [
  {
    icon: CheckCircle,
    title: 'Always know who fed the cat',
    description:
      'See exactly what care happened today — updated in real time by everyone in your household. Treats are tracked separately so they never falsely mark a feeding as done.',
    color: 'text-sky-500',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    tier: undefined,
  },
  {
    icon: Users,
    title: 'Roles for every household member',
    description:
      'Add family as admins or members. Pet sitters get a limited role — they can log care and see vet info without touching household settings.',
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    tier: undefined,
  },
  {
    icon: ChartLine,
    title: 'Care history & export',
    description:
      'Interactive charts for weight trends, feeding frequency, and more — plus a full filterable event table. Filter by cat, type, date, or logged-by member, then export to CSV for your vet.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    tier: 'premium',
  },
  {
    icon: Shield,
    title: 'Emergency info always ready',
    description:
      'Vet contacts, care instructions, and emergency numbers are accessible to everyone who needs them — including pet sitters.',
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    tier: undefined,
  },
  {
    icon: ClipboardList,
    title: '8 care event types',
    description:
      'Log feeding, water, litter, and notes on the free plan. Upgrade to Pro or Premium to add weight, medication, vet visits, and grooming — everything your vet wants to see.',
    color: 'text-rose-500',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    tier: 'pro' as FeatureTier,
  },
  {
    icon: TrendingUp,
    title: 'One tap to log care for everyone',
    description:
      "Create custom quick-action buttons — 'Morning meds', 'Evening kibble' — and log the same event for all your cats at once. Actions sync across all your devices automatically.",
    color: 'text-teal-500',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    tier: undefined,
  },
]

const steps = [
  {
    number: '01',
    title: 'Set up your home',
    description:
      'Sign up, name your household, and add your cats with photos and vet details. Takes about two minutes — no tech know-how needed.',
  },
  {
    number: '02',
    title: 'Add your partner or family',
    description:
      'Send a link to your partner, kids, or anyone who shares the care. Everyone gets their own account, and you stay in control.',
  },
  {
    number: '03',
    title: 'Stay in sync, effortlessly',
    description:
      "Anyone can log care from their phone — feeding, litter, meds, whatever. The whole family always knows what's been done.",
  },
]

const stats = [
  { value: '8', label: 'Care event types' },
  { value: '5', label: 'Analytics charts' },
  { value: '3', label: 'Plans available' },
  { value: '3', label: 'Household roles' },
]

type PlanFeatureItem = {
  label: string
  included: boolean
  note?: string
}

type Plan = {
  name: string
  monthlyPrice: string
  annualPrice: string
  priceSuffix: string
  description: string
  features: PlanFeatureItem[]
  cta: string
  highlighted: boolean
  badge?: string
  btnClass: string
  cardClass: string
}

const plans: Plan[] = [
  {
    name: 'Free',
    monthlyPrice: 'Free',
    annualPrice: 'Free',
    priceSuffix: '',
    description: 'Perfect for a single-cat household.',
    features: [
      { label: '1 cat', included: true },
      { label: '4 care event types (feeding, litter, water, note)', included: true },
      { label: 'Up to 2 household members', included: true },
      { label: '7-day care history', included: true },
      { label: 'Vet info & care instructions', included: true },
      { label: 'Pet sitter role', included: true },
      { label: 'Exportable care history table', included: false },
      { label: 'Email reminders', included: false },
      { label: 'Persistent photo storage', included: false },
    ],
    cta: 'Get started free',
    highlighted: false,
    badge: undefined,
    btnClass: 'border border-border hover:bg-muted text-foreground',
    cardClass: 'bg-card border border-border/60',
  },
  {
    name: 'Pro',
    monthlyPrice: '$4',
    annualPrice: '$3.20',
    priceSuffix: '/ mo',
    description: 'For households with two or three cats.',
    features: [
      { label: '2–3 cats', included: true },
      { label: 'All 8 care event types', included: true },
      { label: 'Unlimited household members', included: true },
      { label: '30-day care history', included: true },
      { label: 'All 5 analytics charts', included: true },
      { label: 'Vet info & care instructions', included: true },
      { label: 'Weight, medication, vet & grooming logs', included: true },
      { label: 'Exportable care history table', included: false },
      { label: 'Email reminders', included: false },
      { label: 'Persistent photo storage', included: false },
    ],
    cta: 'Start Pro',
    highlighted: true,
    badge: 'Most popular',
    btnClass: 'bg-sky-500 hover:bg-sky-600 text-white',
    cardClass: 'bg-card border-2 border-sky-500 shadow-lg shadow-sky-100 dark:shadow-sky-950/20',
  },
  {
    name: 'Premium',
    monthlyPrice: '$8',
    annualPrice: '$6.40',
    priceSuffix: '/ mo',
    description: 'For the dedicated multi-cat household.',
    features: [
      { label: '4+ cats (unlimited)', included: true },
      { label: 'All 8 care event types', included: true },
      { label: 'Unlimited household members', included: true },
      { label: '90-day care history', included: true },
      { label: 'All 5 analytics charts', included: true },
      { label: 'Exportable care history table with filters', included: true },
      { label: 'Email reminders', included: true, note: 'Coming soon' },
      { label: 'Persistent photo storage', included: true },
      { label: 'Priority support', included: true },
    ],
    cta: 'Go Premium',
    highlighted: false,
    badge: undefined,
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    cardClass: 'bg-card border border-border/60',
  },
]

const faqItems = [
  {
    question: 'Is the free plan really free?',
    answer:
      'Yes — always free, with no credit card required. The free plan gives you one cat, four care event types (feeding, litter, water, and notes), and up to two household members. Upgrade to Pro or Premium for weight, medication, vet visits, and grooming logs.',
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer:
      "All your care logs and history are kept. You just can't add more cats beyond your plan's limit until you upgrade again.",
  },
  {
    question: 'Can I switch plans at any time?',
    answer:
      'Yes. Upgrade or downgrade any time from your account settings. Billing adjusts at the next cycle.',
  },
  {
    question: 'When are email reminders available?',
    answer:
      'Coming soon on the Premium plan. The reminder infrastructure is already built — the delivery job will go live in the next release.',
  },
  {
    question: "What is 'persistent photo storage'?",
    answer:
      "On Free and Pro, cat photos are stored on the server and may be cleared when the app updates. Premium stores photos permanently in the cloud so they're never lost.",
  },
  {
    question: 'Do pet sitters need their own account?',
    answer:
      "Yes — you'll invite them with a link. They sign up for a free account and join your household with the sitter role. Their account doesn't count against your plan's cat limit.",
  },
  {
    question: 'Can I export my care history?',
    answer:
      'Yes, on the Premium plan. The care history table lets you filter by date range, cat, event type, sub-type (e.g. wet vs. dry feeding, specific symptoms), and household member — then download everything as a CSV. Useful for sharing a full record with your vet.',
  },
  {
    question: 'Do treats count as a feeding?',
    answer:
      "No. When you log a treat, it's recorded as a feeding event with food type 'Treats', but it doesn't count toward your cat's daily feeding requirement. Your feeding status badge and 'needs attention' alerts stay accurate.",
  },
]

// ─── App Dashboard Mockup ─────────────────────────────────────────────────────

function StatusChip({ emoji, label, ok }: { emoji: string; label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
        ok
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500'
      }`}
    >
      {emoji} {label}
    </span>
  )
}

function CatMockCard({
  name,
  emoji,
  status,
  issues,
}: {
  name: string
  emoji: string
  status: string
  issues?: boolean
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${
            issues ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-sky-100 dark:bg-sky-900/30'
          }`}
        >
          {emoji}
        </div>
        <div>
          <div className="font-semibold text-xs leading-none">{name}</div>
          <div
            className={`text-[10px] mt-0.5 font-medium ${
              issues ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {status}
          </div>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        <StatusChip emoji="🍽️" label="Fed" ok={!issues} />
        <StatusChip emoji="💧" label="Water" ok />
        <StatusChip emoji="🧹" label="Litter" ok />
      </div>
    </div>
  )
}

function LogRow({ emoji, text, sub }: { emoji: string; text: string; sub: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-sm mt-px flex-shrink-0">{emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-none truncate">
          {text}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
      </div>
    </div>
  )
}

function AppDashboardMockup() {
  return (
    <div className="relative">
      {/* Soft glow blobs behind the frame */}
      <div className="absolute -top-6 -left-6 w-40 h-40 rounded-full bg-amber-200/50 blur-3xl pointer-events-none dark:bg-amber-700/20" />
      <div className="absolute -bottom-8 -right-6 w-48 h-48 rounded-full bg-sky-200/50 blur-3xl pointer-events-none dark:bg-sky-800/20" />

      {/* Browser frame */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/40 dark:shadow-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        {/* Title bar */}
        <div className="h-9 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 bg-white dark:bg-slate-700 rounded h-5 flex items-center px-2.5 text-[10px] text-slate-400 border border-slate-200 dark:border-slate-600 max-w-44 mx-auto">
            catcare.app/dashboard
          </div>
        </div>

        {/* App content */}
        <div className="bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
          {/* App nav */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-sky-500 flex items-center justify-center">
                <Cat className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-xs tracking-tight">CatCare</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Thu, Mar 26</div>
              <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-[9px] font-bold text-sky-600 dark:text-sky-400">
                S
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Good morning, Sarah 👋
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              1 cat needs attention today
            </div>
          </div>

          {/* Cat cards */}
          <div className="grid grid-cols-2 gap-2">
            <CatMockCard name="Luna" emoji="🐱" status="All caught up" />
            <CatMockCard name="Mochi" emoji="🐈" status="Needs feeding" issues />
          </div>

          {/* Today's log */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="px-3 pt-2.5 pb-1 border-b border-slate-50 dark:border-slate-700/50">
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Today's activity
              </div>
            </div>
            <div className="px-3 pb-2 divide-y divide-slate-50 dark:divide-slate-700/30">
              <LogRow emoji="💧" text="Refreshed water · Luna" sub="Alex · 11:30 AM" />
              <LogRow emoji="🍽️" text="Fed Luna · 60g chicken pâté" sub="Sarah · 9:15 AM" />
              <LogRow emoji="💊" text="Mochi medication · 5mg" sub="You · 8:00 AM" />
              <LogRow emoji="🧹" text="Cleaned litter box · Luna" sub="Sarah · 7:30 AM" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating chip — sync status */}
      <div className="absolute -bottom-4 left-6 bg-white dark:bg-slate-800 rounded-2xl px-3 py-2 shadow-lg border border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
          Synced across 3 devices
        </span>
      </div>

      {/* Floating chip — members */}
      <div className="absolute -top-4 right-6 bg-white dark:bg-slate-800 rounded-2xl px-3 py-2 shadow-lg border border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <div className="flex -space-x-1.5">
          <div className="w-5 h-5 rounded-full bg-sky-400 border-2 border-white dark:border-slate-800 text-white text-[9px] font-bold flex items-center justify-center">
            S
          </div>
          <div className="w-5 h-5 rounded-full bg-violet-400 border-2 border-white dark:border-slate-800 text-white text-[9px] font-bold flex items-center justify-center">
            A
          </div>
          <div className="w-5 h-5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-800 text-white text-[9px] font-bold flex items-center justify-center">
            J
          </div>
        </div>
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
          3 members active
        </span>
      </div>
    </div>
  )
}

// ─── Analytics Preview Mockup ─────────────────────────────────────────────────

const WEIGHT_DATA = [4.2, 4.3, 4.2, 4.4, 4.3, 4.5, 4.4, 4.6, 4.5, 4.7, 4.6, 4.8]
const FEED_BARS = [3, 5, 2, 4, 6, 3, 5, 7]
const HEATMAP = [
  0.8, 0.3, 0.6, 0.1, 0.9, 0.5, 0.7, 0.2, 0.7, 0.4, 0.8, 0.3, 0.6, 0.9, 0.1, 0.5, 0.7, 0.2,
  0.8, 0.4, 0.6, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4,
]

function AnalyticsMockup() {
  const wMin = Math.min(...WEIGHT_DATA)
  const wMax = Math.max(...WEIGHT_DATA)
  const wRange = wMax - wMin || 1
  const feedMax = Math.max(...FEED_BARS)

  const wPoints = WEIGHT_DATA.map((v, i) => {
    const x = (i / (WEIGHT_DATA.length - 1)) * 260
    const y = 60 - ((v - wMin) / wRange) * 48
    return `${x},${y}`
  }).join(' ')

  const lastX = 260
  const lastY = 60 - ((WEIGHT_DATA[WEIGHT_DATA.length - 1] - wMin) / wRange) * 48

  function heatColor(v: number) {
    if (v > 0.7) return '#0ea5e9'
    if (v > 0.4) return '#7dd3fc'
    if (v > 0.1) return '#e0f2fe'
    return '#f1f5f9'
  }

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900">
      {/* Browser chrome */}
      <div className="h-9 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 bg-white dark:bg-slate-700 rounded h-5 flex items-center px-2.5 text-[10px] text-slate-400 border border-slate-200 dark:border-slate-600 max-w-52 mx-auto">
          catcare.app/cats/luna/history
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              🐱 Luna's care history
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Last 30 days · 47 events logged
            </div>
          </div>
          <div className="flex gap-1">
            {['7d', '30d', '90d'].map((r, i) => (
              <button
                key={r}
                className={`text-[10px] px-2 py-1 rounded-md font-medium ${
                  i === 1
                    ? 'bg-sky-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Weight trend */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Weight trend
              </div>
              <div className="text-[10px] text-slate-400">Healthy steady gain ↑</div>
            </div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">4.8 kg</div>
          </div>
          <svg viewBox="0 0 260 64" className="w-full" style={{ height: 52 }}>
            <defs>
              <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`${wPoints} 260,64 0,64`} fill="url(#wGrad)" />
            <polyline
              points={wPoints}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={lastX} cy={lastY} r="3" fill="#10b981" />
          </svg>
        </div>

        {/* Bottom row: feeding + donut */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Feeding / day
            </div>
            <div className="flex items-end gap-1 h-10">
              {FEED_BARS.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-amber-400"
                  style={{ height: `${(v / feedMax) * 100}%`, opacity: 0.4 + (v / feedMax) * 0.6 }}
                />
              ))}
            </div>
            <div className="text-[9px] text-slate-400 mt-1.5">Mon → Sun</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">
              By type
            </div>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 36 36" className="w-11 h-11 flex-shrink-0 -rotate-90">
                <circle cx="18" cy="18" r="12" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                <circle
                  cx="18"
                  cy="18"
                  r="12"
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="6"
                  strokeDasharray="34 42"
                  strokeDashoffset="0"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="12"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeDasharray="19 57"
                  strokeDashoffset="-34"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="12"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="6"
                  strokeDasharray="14 62"
                  strokeDashoffset="-53"
                />
              </svg>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400">Feed 45%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400">Water 25%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400">Litter 18%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Activity heatmap
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {HEATMAP.map((v, i) => (
              <div
                key={i}
                className="aspect-square rounded-sm"
                style={{ backgroundColor: heatColor(v) }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-slate-400">4 weeks ago</span>
            <span className="text-[9px] text-slate-400">Today</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: FeatureTier }) {
  if (!tier) return null
  if (tier === 'pro')
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 whitespace-nowrap">
        Pro
      </span>
    )
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 whitespace-nowrap">
      Premium
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LandingPage() {
  usePageTitle('Home')
  useFraunces()

  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
  }

  const displayFont: React.CSSProperties = {
    fontFamily: "'Fraunces', Georgia, serif",
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 dark:bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Cat className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="font-bold text-sm tracking-tight">CatCare</span>
          </div>
          <nav className="flex items-center gap-4">
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Pricing
            </a>
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="h-8 px-4 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
            >
              Get started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-[#faf8f5] dark:bg-background">
          {/* Background texture */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'radial-gradient(circle, #92400e 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          {/* Gradient blobs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/4 h-[500px] w-[500px] rounded-full bg-amber-200/40 blur-[120px] dark:bg-amber-700/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-20 right-0 h-[360px] w-[360px] rounded-full bg-sky-200/40 blur-[100px] dark:bg-sky-800/10"
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 xl:gap-16 items-center">
              {/* Copy */}
              <div className="space-y-7">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/80 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs font-medium border border-amber-200/60 dark:border-amber-800/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  Free plan available · Premium from $8 / mo
                </div>

                <h1
                  className="text-[2.75rem] sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.08] text-slate-900 dark:text-slate-50"
                  style={displayFont}
                >
                  Know your cat is{' '}
                  <span className="relative inline-block text-sky-500">
                    cared for,
                    <svg
                      aria-hidden
                      className="absolute -bottom-1 left-0 w-full"
                      viewBox="0 0 200 8"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M2 6 C40 2, 80 2, 100 4 S160 7, 198 5"
                        stroke="#0ea5e9"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        opacity="0.5"
                      />
                    </svg>
                  </span>{' '}
                  whoever's home
                </h1>

                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                  Whether you have one cat or a whole clowder, CatCare keeps your household in
                  sync. Log feeding, medication, vet visits, and more — so nothing falls through
                  the cracks.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Link
                    to="/register"
                    className="h-11 px-6 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-md shadow-sky-200 dark:shadow-sky-950/30 hover:shadow-lg hover:shadow-sky-200/60 dark:hover:shadow-sky-950/40 hover:-translate-y-px"
                  >
                    Start for free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={scrollToPricing}
                    className="h-11 px-6 rounded-xl border border-slate-200 dark:border-border bg-white/70 dark:bg-background/40 hover:bg-slate-50/80 dark:hover:bg-muted/60 transition-all duration-150 text-sm font-medium flex items-center justify-center backdrop-blur-sm text-slate-700 dark:text-slate-300"
                  >
                    See pricing
                  </button>
                </div>

                <div className="flex items-center gap-6 pt-1">
                  {[
                    'No credit card required',
                    'Set up in 2 minutes',
                    'Cancel anytime',
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* App mockup */}
              <div className="relative hidden lg:block">
                <AppDashboardMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section className="border-y border-border/50 bg-white dark:bg-muted/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {stats.map(({ value, label }) => (
                <div key={label} className="text-center space-y-0.5">
                  <div
                    className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                    style={displayFont}
                  >
                    {value}
                  </div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center space-y-3 mb-14">
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
              style={displayFont}
            >
              How it works
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
              Get your household set up in minutes and start coordinating care today.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-10 relative">
            {/* Connector line — runs between the circle centers; circles sit on top and cover the overlap */}
            <div
              aria-hidden
              className="absolute top-6 left-[16.67%] right-[16.67%] hidden sm:block h-0.5 bg-gradient-to-r from-sky-200 via-sky-300 to-sky-200 dark:from-sky-800 dark:via-sky-700 dark:to-sky-800"
            />
            {steps.map(({ number, title, description }) => (
              <div key={number} className="flex flex-col items-center text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-2xl bg-sky-500 flex items-center justify-center shadow-md shadow-sky-200 dark:shadow-sky-900/30 z-10">
                  <span className="text-white font-bold text-sm">{number}</span>
                </div>
                <h3 className="font-semibold text-base">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features grid ── */}
        <section className="bg-[#faf8f5] dark:bg-muted/10 border-y border-border/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
            <div className="text-center space-y-3 mb-14">
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                style={displayFont}
              >
                Everything your cats need, in one place
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
                From daily feeding logs to long-term health trends — CatCare has you covered.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map(({ icon: Icon, title, description, color, bg, tier }) => (
                <div
                  key={title}
                  className="group bg-white dark:bg-card border border-border/50 rounded-2xl p-6 space-y-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}
                    >
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <TierBadge tier={tier} />
                  </div>
                  <h3 className="font-semibold text-base">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Analytics callout — UI mockup ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Analytics mockup */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 dark:from-emerald-900/20 dark:via-teal-900/10 dark:to-sky-900/10 -z-10" />
              <AnalyticsMockup />
            </div>

            {/* Copy */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200/60 dark:border-emerald-800/30">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Care history dashboard
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Premium
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                style={displayFont}
              >
                See your cat's health story at a glance
              </h2>

              <p className="text-muted-foreground leading-relaxed">
                The care history dashboard gives you five interactive charts. Drag and resize them
                however you like. Bring a real care history to every vet appointment instead of
                guessing.
              </p>

              <ul className="space-y-2.5">
                {[
                  'Weight trend over time',
                  'Feeding frequency by day',
                  'Who contributed what care',
                  'Weekly activity heatmap',
                  'Care type breakdown',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <button
                  onClick={scrollToPricing}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-all duration-150 hover:-translate-y-px shadow-md shadow-emerald-200 dark:shadow-emerald-950/30"
                >
                  See Premium plan
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-xs text-muted-foreground/70">Available on Pro and Premium plans.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section
          id="pricing"
          className="relative overflow-hidden bg-[#faf8f5] dark:bg-muted/10 border-y border-border/40"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-sky-100/40 blur-[120px] dark:bg-sky-900/10"
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20">
            <div className="text-center space-y-3 mb-10">
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                style={displayFont}
              >
                Simple, honest pricing
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
                Start free. Upgrade when your household grows.
              </p>
            </div>

            {/* Annual toggle */}
            <div className="flex items-center justify-center gap-3 mb-12">
              <span
                className={`text-sm font-medium transition-colors ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                Monthly
              </span>
              <button
                onClick={() => setAnnual((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 ${annual ? 'bg-sky-500' : 'bg-border'}`}
                aria-label="Toggle annual billing"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${annual ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
              <span
                className={`text-sm font-medium transition-colors ${annual ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                Annual
              </span>
              {annual && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Save 20%
                </span>
              )}
            </div>

            {/* Plan cards */}
            <div className="grid sm:grid-cols-3 gap-6 items-start">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-6 space-y-6 transition-all duration-200 hover:-translate-y-1 ${plan.cardClass}`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full bg-sky-500 text-white text-xs font-semibold shadow-md">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1 pt-2">
                    <h3 className="font-bold text-lg" style={displayFont}>
                      {plan.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold tracking-tight" style={displayFont}>
                        {annual ? plan.annualPrice : plan.monthlyPrice}
                      </span>
                      {plan.priceSuffix && (
                        <span className="text-muted-foreground text-sm pb-1">{plan.priceSuffix}</span>
                      )}
                    </div>
                    {plan.priceSuffix && (
                      <p className="text-xs text-muted-foreground">
                        {annual ? 'billed annually' : 'billed monthly'}
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2.5">
                    {plan.features.map(({ label, included, note }) => (
                      <li key={label} className="flex items-center gap-2.5 text-sm">
                        {included ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                        )}
                        <span className={included ? 'text-foreground' : 'text-muted-foreground/60'}>
                          {label}
                        </span>
                        {note && (
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
                            {note}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/register"
                    className={`flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm transition-all duration-150 ${plan.btnClass}`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground/60 mt-8">
              Prices are indicative and subject to change before general availability.
            </p>
          </div>
        </section>

        {/* ── Pet sitter callout ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Copy */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium border border-violet-200/60 dark:border-violet-800/30">
                <PawPrint className="w-3.5 h-3.5" />
                Built for pet sitters too
              </div>

              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                style={displayFont}
              >
                Hand off to a sitter without the stress
              </h2>

              <p className="text-muted-foreground leading-relaxed">
                Invite your pet sitter with a single link. They get a dedicated sitter role — they
                can log care events, view vet info and care instructions, and see emergency
                contacts. Nothing more, nothing less.
              </p>

              <ul className="space-y-2.5">
                {[
                  'Sitters see vet contacts and care instructions',
                  'Sitters can log feeding, meds, and notes',
                  'Sitters cannot change household settings',
                  "Sitter accounts don't count against your cat limit",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              {/* Mini sitter role card */}
              <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800/30 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                  Sitter's view
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-lg">
                    🐱
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Luna</div>
                    <div className="text-xs text-muted-foreground">Feed 60g twice daily · Wet food only</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-violet-100 dark:border-slate-700">
                    <div className="text-muted-foreground text-[10px] mb-1">Vet</div>
                    <div className="font-medium">Westside Animal Hospital</div>
                    <div className="text-muted-foreground">(555) 012-3456</div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-violet-100 dark:border-slate-700">
                    <div className="text-muted-foreground text-[10px] mb-1">Emergency contact</div>
                    <div className="font-medium">Sarah (owner)</div>
                    <div className="text-muted-foreground">(555) 098-7654</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cat image */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-violet-100 via-purple-50 to-pink-50 dark:from-violet-900/30 dark:via-purple-900/20 dark:to-pink-900/10 transform rotate-2" />
              <div className="absolute -inset-1.5 rounded-[1.75rem] bg-white dark:bg-background" />
              <img
                src={PHOTO_COZY_BLACK_CAT}
                alt="Black cat peeking over the edge of a sofa"
                className="relative rounded-[1.5rem] object-cover w-full aspect-[4/3] shadow-xl shadow-slate-200/60 dark:shadow-slate-900/50"
                style={{ objectPosition: 'center 85%' }}
              />
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-[#faf8f5] dark:bg-muted/10 border-y border-border/40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
            <div className="text-center space-y-3 mb-12">
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
                style={displayFont}
              >
                Frequently asked questions
              </h2>
            </div>

            <div className="divide-y divide-border/60 rounded-2xl border border-border/50 overflow-hidden bg-white dark:bg-card">
              {faqItems.map(({ question, answer }, i) => (
                <div key={question}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-medium text-sm sm:text-base">{question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-200 ${openFaq === i ? 'max-h-48' : 'max-h-0'}`}
                  >
                    <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                      {answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="relative rounded-3xl overflow-hidden bg-sky-500 p-8 sm:p-12 text-center text-white">
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-600"
            />
            <div
              aria-hidden
              className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5"
            />
            <div
              aria-hidden
              className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/5"
            />

            <div className="relative space-y-5">
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={displayFont}
              >
                Start free. Upgrade when you're ready.
              </h2>
              <p className="text-sky-100 text-sm sm:text-base max-w-md mx-auto">
                No credit card required for the free plan. Upgrade anytime as your household grows.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-white text-sky-600 font-semibold text-sm hover:bg-sky-50 transition-all duration-150 hover:-translate-y-px shadow-lg"
                >
                  Create free account
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={scrollToPricing}
                  className="inline-flex items-center justify-center h-11 px-6 rounded-xl border border-white/30 text-white font-medium text-sm hover:bg-white/10 transition-colors"
                >
                  See pricing
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Cat className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="font-semibold text-sm tracking-tight">CatCare</span>
          </div>
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} CatCare. Made for cat people.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
            >
              Get started free →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
