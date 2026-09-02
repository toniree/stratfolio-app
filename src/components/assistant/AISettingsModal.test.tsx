import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AISettingsModal } from '@/components/assistant/AISettingsModal'
import { ApiError } from '@/api/http/problem'
import { QueryWrapper } from '@/test/queryWrapper'
import type { ExecutionPolicy } from '@/api/types'

/**
 * AI Settings in live mode (APP-114).
 *
 * The point of these tests is the honesty of the screen, not its layout: which
 * controls a *server* enforces, which are remembered by this device alone, and
 * what happens to a control whose write the platform refuses.
 */

/** Stands in for plt: a value the writes actually move, so a refused write is
 *  distinguishable from an accepted one by more than a spy call. */
const serverPolicy: ExecutionPolicy = {
  aiTradingEnabled: true,
  approvalMode: 'auto',
  tradingWindow: 'extended',
  unsetKeys: [],
  invalidKeys: [],
}

const calls: unknown[] = []
let nextWriteError: Error | null = null

function write<K extends keyof ExecutionPolicy>(key: K, value: ExecutionPolicy[K]) {
  calls.push({ [key]: value })
  if (nextWriteError) throw nextWriteError
  serverPolicy[key] = value
}

// Partial: the modal's risk dial reaches the price store, which binds the
// real quote provider from this same module.
vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  executionPolicyApi: {
    getPolicy: async () => ({ ...serverPolicy }),
    setAiTradingEnabled: async (enabled: boolean) => write('aiTradingEnabled', enabled),
    setApprovalMode: async (mode: ExecutionPolicy['approvalMode']) => write('approvalMode', mode),
    setTradingWindow: async (w: ExecutionPolicy['tradingWindow']) => write('tradingWindow', w),
  },
}))

function openSettings() {
  render(<AISettingsModal open onOpenChange={() => {}} />, { wrapper: QueryWrapper })
}

describe('AISettingsModal — server-enforced execution policy', () => {
  beforeEach(() => {
    calls.length = 0
    nextWriteError = null
    serverPolicy.aiTradingEnabled = true
    serverPolicy.approvalMode = 'auto'
    serverPolicy.tradingWindow = 'extended'
  })

  it('says which settings the platform enforces and which are device-local', async () => {
    openSettings()
    // The section header itself carries the claim, and so does the closing
    // note — both are the point, so assert on at least one of each.
    expect((await screen.findAllByText(/enforced by the platform/i)).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Everything else on this screen is saved on this device/i),
    ).toBeInTheDocument()
    // The three with no backend home say so on their own rows, rather than
    // sitting silently beside the enforced ones.
    expect(screen.getByText(/platform enforces its own allocation cap/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing measures day P&L server-side yet/i)).toBeInTheDocument()
  })

  it('describes the kill switch as stopping execution server-side', async () => {
    openSettings()
    expect(
      await screen.findByText(/Turning this off stops it server-side, not just here/i),
    ).toBeInTheDocument()
  })

  it('writes the master switch to the platform and updates optimistically', async () => {
    openSettings()
    const toggle = await screen.findByRole('switch', { name: 'AI Trading on' })
    fireEvent.click(toggle)
    await waitFor(() => expect(calls).toEqual([{ aiTradingEnabled: false }]))
    // …and the control follows the platform's new value.
    expect(await screen.findByRole('switch', { name: 'AI Trading off' })).toBeInTheDocument()
  })

  it('maps approval mode to plt’s own word', async () => {
    openSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Ask me' }))
    // The seam takes the app's word; `approve_each` is applied by the adapter.
    await waitFor(() => expect(calls).toEqual([{ approvalMode: 'approve' }]))
  })

  it('rolls back to the platform’s value when the write is refused', async () => {
    nextWriteError = new ApiError({
      message: 'policy.trading_window must be "extended" or "rth"',
      status: 422,
      problem: {
        rejection_reasons: ['CONFIG_VALUE_INVALID'],
        config_key: 'policy.trading_window',
      },
      url: '/plt/api/v1/config/policy.trading_window',
    })
    openSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Market hrs' }))

    expect(await screen.findByText(/refused that value and kept the one it had/i)).toBeInTheDocument()
    // Snapped back: the server still holds `extended`.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Extended' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
  })
})
