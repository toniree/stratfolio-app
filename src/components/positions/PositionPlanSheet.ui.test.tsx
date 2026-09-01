import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Position } from '@/api/types'
import type { PlannerIdea } from '@/api/newsTypes'
import { PositionPlanSheet } from '@/components/positions/PositionPlanSheet'
import { QueryWrapper } from '@/test/queryWrapper'

const mutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  isPending: false,
}))
const updateMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}))

vi.mock('@/hooks/queries', () => ({
  useCreatePlannerIdea: () => mutation,
  useUpdatePlannerIdea: () => updateMutation,
  usePositions: () => ({ data: [] }),
  usePortfolioMeta: () => ({ data: { cash: 10_000, buyingPower: 10_000, totalDeposited: 0 } }),
}))

const position = {
  id: 'pos-nvda-call',
  symbol: 'NVDA',
  company: 'NVIDIA',
  assetType: 'option',
  contractDetail: "$150 Call · Jan 15 '27",
  avgCost: 8,
  ai: {
    targetLow: 20,
    targetHigh: 24,
    horizon: 'Before earnings',
    recommendationNote: 'Hold while demand remains durable.',
  },
} as Position

const plan = {
  id: 'plan-nvda-call',
  positionId: position.id,
  source: 'user',
  symbol: 'NVDA',
  assetType: 'option',
  contractDetail: position.contractDetail,
  title: 'Protect the upside into earnings',
  originalPrompt: 'Keep the upside open, but take enough off before earnings to protect the win.',
  notes: 'Concentration is too high going into the print.',
  maxAmount: 2500,
  entryLow: 8,
  entryHigh: 9,
  targetLow: 20,
  targetHigh: 24,
  risks: ['Earnings volatility can erase the premium.'],
  relatedNews: 'Blackwell supply commitments extend into next year.',
} as PlannerIdea

describe('PositionPlanSheet', () => {
  beforeEach(() => {
    mutation.mutateAsync.mockReset()
    mutation.reset.mockReset()
    updateMutation.mutateAsync.mockReset()
    updateMutation.mutateAsync.mockResolvedValue(plan)
    mutation.mutateAsync.mockResolvedValue({ ...plan, id: 'plan-created' })
  })

  it('shows a two-line prompt summary, plan data, and an AI prompt editor', async () => {
    render(
      <PositionPlanSheet
        position={position}
        plans={[plan]}
        open
        onOpenChange={vi.fn()}
        onOpenPlanner={vi.fn()}
      />,
      { wrapper: QueryWrapper },
    )

    expect(screen.getByText(plan.originalPrompt!)).toHaveClass('line-clamp-2')
    fireEvent.click(screen.getByRole('button', { name: /Show full plan/ }))

    expect(screen.getByText('$2,500')).toBeInTheDocument()
    expect(screen.getByText('Earnings volatility can erase the premium.')).toBeInTheDocument()
    expect(screen.getByText('Concentration is too high going into the print.')).toBeInTheDocument()
    expect(screen.getByText('$8.00 – $9.00')).toBeInTheDocument()
    expect(screen.getByText('$20.00 – $24.00')).toBeInTheDocument()
    expect(screen.getByText('Blackwell supply commitments extend into next year.')).toBeInTheDocument()
    expect(screen.getAllByText('Your plan').length).toBeGreaterThan(0)
    expect(screen.getByText('Options to watch · 1/3')).toBeInTheDocument()
    expect(screen.getAllByText(position.contractDetail!).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Edit prompt' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Plan prompt' }), {
      target: { value: 'Open with max $1,800, enter near $9 and target $22.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update with AI' }))

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        id: plan.id,
        input: expect.objectContaining({
          originalPrompt: 'Open with max $1,800, enter near $9 and target $22.',
          maxAmount: 1800,
          entryLow: 8.82,
          entryHigh: 9.18,
          targetLow: 21.56,
          targetHigh: 22.44,
        }),
      }),
    )
  })

  it('requires max sizing in the prompt and creates a plan scoped to the exact position', async () => {
    render(
      <PositionPlanSheet
        position={position}
        plans={[]}
        open
        onOpenChange={vi.fn()}
        onOpenPlanner={vi.fn()}
      />,
      { wrapper: QueryWrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add plan' }))
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled()
    expect(screen.getByText('Required in prompt')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open or close' }), {
      button: 0,
      ctrlKey: false,
    })
    expect(screen.getByRole('menu').className).toContain('slide-in-from-top-1')
    fireEvent.click(screen.getByRole('menuitem', { name: /Close position/ }))
    expect(screen.getByRole('button', { name: 'Open or close' })).toHaveTextContent('Close position')
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open or close' }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: /Open position/ }))

    fireEvent.change(screen.getByRole('textbox', { name: /Plan prompt/ }), {
      target: { value: 'Open before earnings with max $3,000, enter near $9 and target $22.' },
    })
    expect(screen.getByText('$3,000')).toBeInTheDocument()
    expect(screen.getByText('$8.82 – $9.18')).toBeInTheDocument()
    expect(screen.getByText('$21.56 – $22.44')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save plan' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))

    await waitFor(() =>
      expect(mutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          positionId: position.id,
          assetType: 'option',
          contractDetail: position.contractDetail,
          maxAmount: 3000,
          originalPrompt: 'Open before earnings with max $3,000, enter near $9 and target $22.',
          entryLow: 8.82,
          entryHigh: 9.18,
          targetLow: 21.56,
          targetHigh: 22.44,
        }),
      ),
    )
  })

  it('keeps Add plan available through three existing plans', () => {
    const { rerender } = render(
      <PositionPlanSheet
        position={position}
        plans={[plan, { ...plan, id: 'two' }, { ...plan, id: 'three' }]}
        open
        onOpenChange={vi.fn()}
        onOpenPlanner={vi.fn()}
      />,
      { wrapper: QueryWrapper },
    )

    expect(screen.getByRole('button', { name: 'Add plan' })).toBeInTheDocument()

    rerender(
      <PositionPlanSheet
        position={position}
        plans={[plan, { ...plan, id: 'two' }, { ...plan, id: 'three' }, { ...plan, id: 'four' }]}
        open
        onOpenChange={vi.fn()}
        onOpenPlanner={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Add plan' })).not.toBeInTheDocument()
  })
})
