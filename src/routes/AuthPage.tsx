import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { authApi } from '@/api'
import { AuthError } from '@/api/mock/MockAuthApi'
import { useAuthStore } from '@/store/authStore'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'

type Mode = 'login' | 'signup'

const HIGHLIGHTS = [
  'Conviction score, entry band and target band on every position.',
  'A written thesis behind every recommendation — never a bare number.',
  'Explicit risk/reward: upside target, downside risk, ratio, horizon.',
]

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const signIn = useAuthStore((s) => s.signIn)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  if (session) return <Navigate to="/app/portfolio" replace />

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrors({})
    setPending(true)
    try {
      const result =
        mode === 'signup'
          ? await authApi.signup(email, password, name)
          : await authApi.login(email, password)
      signIn(result)
      navigate('/app/portfolio', { replace: true })
    } catch (error) {
      if (error instanceof AuthError) {
        setErrors({ [error.field]: error.message })
      } else {
        setErrors({ form: 'Something went wrong. Try again.' })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* ---- Pitch panel (desktop) ---- */}
      <aside className="relative hidden overflow-hidden lg:block">
        <div className="ai-tint absolute inset-0" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Logo />
          <div>
            <span className="ai-gradient inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-white uppercase">
              <Sparkles size={12} />
              AI-native portfolio intelligence
            </span>
            <h2 className="mt-4 max-w-[440px] text-[34px] leading-[1.15] font-extrabold tracking-[-0.03em] text-ink">
              Every position comes with a thesis, not just a price.
            </h2>
            <ul className="mt-6 space-y-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft">
                  <span className="ai-gradient mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[12px] text-ink-muted">
            Demo build · simulated market data · not investment advice
          </p>
        </div>
      </aside>

      {/* ---- Form ---- */}
      <main className="flex items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[380px]"
        >
          <div className="lg:hidden">
            <Logo />
          </div>

          <h1 className="mt-6 text-[27px] leading-tight font-extrabold tracking-[-0.03em] text-ink lg:mt-0">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft">
            {mode === 'signup'
              ? 'Any email works — this is a demo, nothing is stored on a server.'
              : 'Any valid email and an 8+ character password will sign you in.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5" noValidate>
            {mode === 'signup' ? (
              <Field label="Name" error={errors.name}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  className={inputClass(Boolean(errors.name))}
                />
              </Field>
            ) : null}

            <Field label="Email" error={errors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass(Boolean(errors.email))}
              />
            </Field>

            <Field label="Password" error={errors.password}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="At least 8 characters"
                className={inputClass(Boolean(errors.password))}
              />
            </Field>

            {errors.form ? (
              <p className="rounded-xl bg-down-soft px-3 py-2.5 text-[12.5px] font-semibold text-down">
                {errors.form}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending
                ? mode === 'signup'
                  ? 'Creating account…'
                  : 'Signing in…'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Sign in'}
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-ink-soft">
            {mode === 'signup' ? 'Already have an account? ' : 'New to StratFolio? '}
            <Link
              to={mode === 'signup' ? '/login' : '/signup'}
              className="font-bold text-brand-600 hover:underline"
            >
              {mode === 'signup' ? 'Sign in' : 'Create one'}
            </Link>
          </p>

          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-ink-muted">
            Simulated authentication. Credentials are validated in the browser and never leave your
            device.
          </p>
        </motion.div>
      </main>
    </div>
  )
}

function inputClass(hasError: boolean): string {
  return cn(
    'h-12 w-full rounded-xl border bg-surface px-3.5 text-[15px] font-medium text-ink placeholder:text-ink-muted/70',
    hasError ? 'border-down' : 'border-line-strong',
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11.5px] font-semibold text-down">{error}</span>
      ) : null}
    </label>
  )
}
