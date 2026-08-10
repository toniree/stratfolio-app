import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'

describe('AIConvictionBadge', () => {
  it('uses a subtle green treatment for positive daily conviction', () => {
    render(<AIConvictionBadge score={82} delta={1} size="xs" />)

    const delta = screen.getByLabelText('Up 1')
    expect(delta).toHaveClass('text-up', 'text-[6.75px]', 'inline-flex')
    expect(delta.querySelector('svg')).toBeInTheDocument()
  })

  it('makes an unusually large positive move vividly green', () => {
    render(<AIConvictionBadge score={82} delta={40} size="xs" />)

    expect(screen.getByLabelText('Up 40')).toHaveClass(
      'text-up',
      'ring-up/50',
    )
  })

  it('uses a subtle pink treatment for negative daily conviction', () => {
    render(<AIConvictionBadge score={62} delta={-2} size="xs" />)

    expect(screen.getByLabelText('Down 2')).toHaveClass('text-pink-50')
  })
})
