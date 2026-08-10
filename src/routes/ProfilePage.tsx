import { useNavigate } from 'react-router-dom'
import { LogOut, RotateCcw } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api'
import { resetDemoData } from '@/api/mock/resetDemo'
import { BROKERAGES } from '@/data/brokerages'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { AITradingControl } from '@/components/shell/AITradingControl'
import { NewsTickerToggle } from '@/components/news/NewsTickerToggle'
import { StaticPill } from '@/components/shared/Pill'
import { BrokerageLogo } from '@/components/shared/BrokerageBadge'

export function ProfilePage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)

  const handleSignOut = async () => {
    await authApi.logout()
    signOut()
    navigate('/login', { replace: true })
  }

  const user = session?.user

  return (
    <div className="space-y-4">
      <PageHeader
        title="Profile"
        mobileTitle="PROFILE"
      />

      <section className="card flex items-center gap-3.5 p-4">
        <span className="ai-gradient grid h-12 w-12 shrink-0 place-items-center rounded-full text-[17px] font-extrabold text-white">
          {(user?.name ?? 'Demo User')
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-ink">
            {user?.name ?? 'Demo User'}
          </div>
          <div className="truncate text-[12.5px] text-ink-muted">
            {user?.email ?? 'demo@stratfolio.app'}
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-[13px] font-bold tracking-[0.07em] text-ink-muted uppercase">
          Linked brokerages
        </h2>
        <ul className="mt-3 space-y-2.5">
          {BROKERAGES.map((brokerage) => (
            <li key={brokerage.id} className="flex items-center gap-2.5">
              <BrokerageLogo id={brokerage.id} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-ink">
                  {brokerage.name}
                </div>
                <div className="num truncate text-[11.5px] text-ink-muted">
                  {brokerage.accountMask}
                </div>
              </div>
              <StaticPill tone="positive">Connected</StaticPill>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] text-ink-muted">
          Simulated connections. No real brokerage account is linked in this build.
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-[13px] font-bold tracking-[0.07em] text-ink-muted uppercase">
          Preferences
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">Live news alerts</div>
            <p className="text-[11.5px] text-ink-muted">
              Ambient market headlines while you browse the demo.
            </p>
          </div>
          <NewsTickerToggle />
        </div>
        <AITradingControl variant="row" />
      </section>

      <section className="card p-4">
        <h2 className="text-[13px] font-bold tracking-[0.07em] text-ink-muted uppercase">
          About this demo
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          StratFolio is an AI-native portfolio intelligence surface. Every price is produced by a
          deterministic in-browser market simulator, every position and thesis is seeded demo data,
          and every model output is written copy — nothing here is investment advice, and no order
          reaches a real broker.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
          The data layer sits behind a swappable API interface, so replacing the mock
          implementations with a real HTTP client requires no component changes.
        </p>
      </section>

      {/* Reset is recoverable, signing out ends the session — so they read as
          different weights rather than two identical grey slabs. */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button
          variant="success"
          size="lg"
          className="plan-action-button h-11 flex-1 justify-center rounded-[14px]"
          onClick={() => resetDemoData()}
        >
          <RotateCcw size={16} />
          Reset demo data
        </Button>
        <Button
          variant="danger"
          size="lg"
          className="plan-action-button h-11 flex-1 justify-center rounded-[14px]"
          onClick={handleSignOut}
        >
          <LogOut size={16} />
          Sign out
        </Button>
      </div>
    </div>
  )
}
