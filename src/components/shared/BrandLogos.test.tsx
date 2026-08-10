import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrokerageBadge } from '@/components/shared/BrokerageBadge'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { getBrokerageLogoSrc, getCompanyLogoSrc } from '@/data/brandLogos'

describe('company logos', () => {
  it('resolves local vector and raster assets without a runtime network dependency', () => {
    expect(getCompanyLogoSrc(' nvda ')).toBe('/brand-logos/NVDA.svg')
    expect(getCompanyLogoSrc('msft')).toBe('/brand-logos/MSFT.png')
    expect(getCompanyLogoSrc('UNKNOWN')).toBeUndefined()
  })

  it('renders a labeled company mark', () => {
    const { container } = render(<SymbolIcon symbol="NVDA" />)

    expect(screen.getByRole('img', { name: 'NVDA company logo' })).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', '/brand-logos/NVDA.svg')
  })

  it('falls back to a stable ticker token if a local asset cannot load', () => {
    const { container } = render(<SymbolIcon symbol="AAPL" />)
    const image = container.querySelector('img')

    expect(image).not.toBeNull()
    fireEvent.error(image!)

    expect(screen.getByText('AA')).toBeInTheDocument()
  })
})

describe('brokerage logos', () => {
  it('resolves every brokerage to a bundled image', () => {
    expect(getBrokerageLogoSrc('robinhood')).toBe('/brand-logos/broker-robinhood.png')
    expect(getBrokerageLogoSrc('ibkr')).toBe('/brand-logos/broker-ibkr.png')
  })

  it('renders the real mark alongside the brokerage and account mask', () => {
    const { container } = render(
      <BrokerageBadge id="schwab" showName showMask />,
    )

    expect(screen.getByText('Schwab')).toBeInTheDocument()
    expect(screen.getByText('••••8830')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/brand-logos/broker-schwab.png',
    )
  })
})
