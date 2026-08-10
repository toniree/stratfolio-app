import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Carousel, CarouselItem } from '@/components/shared/Carousel'

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      disconnect() {}
    },
  )
})

describe('Carousel position counter', () => {
  it('tracks the nearest snapped item', () => {
    render(
      <MemoryRouter>
        <Carousel title="Positions" showPosition itemCount={3}>
          {[1, 2, 3].map((item) => (
            <CarouselItem key={item}>Position {item}</CarouselItem>
          ))}
        </Carousel>
      </MemoryRouter>,
    )

    const track = screen.getByRole('group', { name: 'Positions carousel' })
    const items = Array.from(track.children).slice(0, 3)
    items.forEach((item, index) => {
      Object.defineProperty(item, 'offsetLeft', { configurable: true, value: index * 320 })
    })
    Object.defineProperties(track, {
      clientWidth: { configurable: true, value: 320 },
      scrollWidth: { configurable: true, value: 960 },
      scrollLeft: { configurable: true, writable: true, value: 0 },
    })

    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    track.scrollLeft = 320
    fireEvent.scroll(track)
    expect(screen.getByText('2 of 3')).toBeInTheDocument()

    track.scrollLeft = 640
    fireEvent.scroll(track)
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
  })
})
