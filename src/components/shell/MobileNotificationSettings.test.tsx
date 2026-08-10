import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MobileNotificationSettings } from '@/components/shell/MobileNotificationSettings'
import { useNotificationPreferencesStore } from '@/store/notificationPreferencesStore'

describe('MobileNotificationSettings', () => {
  beforeEach(() => {
    useNotificationPreferencesStore.setState({
      newsEnabled: true,
      planExecutedEnabled: true,
      planExecutionSoonEnabled: true,
      aiTradeEnabled: true,
    })
  })

  it('exposes independent mobile notification switches', () => {
    render(<MobileNotificationSettings />)
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    expect(screen.getByRole('switch', { name: 'News notifications' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Plan executed notifications' })).toBeChecked()
    expect(
      screen.getByRole('switch', { name: 'Plan about to execute notifications' }),
    ).toBeChecked()
    expect(screen.getByRole('switch', { name: 'AI made a trade notifications' })).toBeChecked()

    fireEvent.click(screen.getByRole('switch', { name: 'Plan executed notifications' }))

    expect(useNotificationPreferencesStore.getState().planExecutedEnabled).toBe(false)
    expect(useNotificationPreferencesStore.getState().newsEnabled).toBe(true)
  })
})
