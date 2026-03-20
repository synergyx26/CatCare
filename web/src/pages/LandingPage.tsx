import { Link } from 'react-router-dom'
import { Cat, Users, ChartLine, Shield, CheckCircle } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

const features = [
  {
    icon: CheckCircle,
    title: 'Always know who fed the cat',
    description:
      'See exactly what care happened today — feeding, water, litter, medication — updated in real time by everyone in your household.',
    color: 'text-sky-500',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
  },
  {
    icon: Users,
    title: 'Invite family and pet sitters',
    description:
      'Add household members with different roles. Pet sitters can log care without seeing household admin settings.',
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
  },
  {
    icon: ChartLine,
    title: 'Track health over time',
    description:
      'Weight trends, feeding frequency, vet visits — all in one place. Bring a real care history to every vet appointment.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    icon: Shield,
    title: 'Emergency info always ready',
    description:
      'Vet contacts, care instructions, and emergency numbers are accessible to everyone who needs them, even sitters.',
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
]

export function LandingPage() {
  usePageTitle('Home')

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-sky-950/20 dark:via-background dark:to-cyan-950/20">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/80 dark:bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Cat className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="font-bold text-sm tracking-tight">CatCare</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="h-8 px-4 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors flex items-center"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        {/* Hero */}
        <section className="pt-20 pb-16 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-xs font-medium">
            <Cat className="w-3.5 h-3.5" />
            Household cat care, coordinated
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight max-w-2xl mx-auto">
            Know your cat is cared for,{' '}
            <span className="text-sky-500">whoever's home</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            CatCare lets your whole household coordinate cat care in one place. No more "did anyone
            feed Mochi?" — just open the app and see.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/register"
              className="h-11 px-6 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm transition-colors w-full sm:w-auto flex items-center justify-center"
            >
              Create free account
            </Link>
            <Link
              to="/login"
              className="h-11 px-6 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium w-full sm:w-auto flex items-center justify-center"
            >
              Sign in
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section className="pb-20 grid sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, description, color, bg }) => (
            <div
              key={title}
              className="bg-card border border-border/50 rounded-2xl p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-base">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </section>

        {/* Bottom CTA */}
        <section className="pb-20">
          <div className="bg-sky-500 rounded-3xl p-8 sm:p-12 text-center space-y-4 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to get started?
            </h2>
            <p className="text-sky-100 text-sm sm:text-base max-w-md mx-auto">
              Free to use. Set up your household in under two minutes.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-white text-sky-600 font-semibold text-sm hover:bg-sky-50 transition-colors"
            >
              Create your account
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/60">
        CatCare — Helping you care for your feline friends
      </footer>
    </div>
  )
}
