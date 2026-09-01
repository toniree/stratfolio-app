import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ThesisCard } from '@/components/thesis/ThesisCard'
import { toThesisView } from '@/api/http/adapters/thesis'
import { THESIS_FIXTURE, THESIS_SPARSE_FIXTURE } from '@/test/msw/fixtures/plt'

function renderCard(wire = THESIS_FIXTURE) {
  return render(
    <MemoryRouter>
      <ThesisCard thesis={toThesisView(wire)} />
    </MemoryRouter>,
  )
}

describe('ThesisCard', () => {
  it('renders the recorded thesis fields', () => {
    renderCard()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('BULLISH')).toBeInTheDocument()
    expect(screen.getByText(THESIS_FIXTURE.rationale)).toBeInTheDocument()
    expect(screen.getByText(THESIS_FIXTURE.expected_catalyst!)).toBeInTheDocument()
    expect(screen.getByText('Close below the 50-day')).toBeInTheDocument()
    expect(screen.getByText('Iv rank')).toBeInTheDocument()
  })

  it('formats the 0..1 confidence as a percentage at render, not in the adapter', () => {
    renderCard()
    // 0.72 on the wire → "72%" on screen. Never "0.72", never "7200".
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.queryByText('7200%')).not.toBeInTheDocument()
    expect(screen.queryByText('0.72')).not.toBeInTheDocument()
  })

  it('formats the ISO-8601 horizon for humans', () => {
    renderCard()
    expect(screen.getByText(/horizon 14 days/)).toBeInTheDocument()
  })

  it('shows no price, target, upside or recommendation anywhere', () => {
    const { container } = renderCard()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\$\d/)
    expect(text).not.toMatch(/\bupside\b/i)
    expect(text).not.toMatch(/\bBUY\b|\bHOLD\b|\bTRIM\b/)
    expect(text).toMatch(/no entry, target or sizing/i)
  })

  it('says a confidence is missing instead of rendering a zero', () => {
    renderCard(THESIS_SPARSE_FIXTURE)
    expect(screen.getByText('No confidence')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })
})
