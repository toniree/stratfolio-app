import { describe, expect, it, vi } from 'vitest'
import { AuthError, MockAuthApi } from '@/api/mock/MockAuthApi'

vi.mock('@/api/mock/latency', () => ({
  latency: () => Promise.resolve(),
}))

describe('MockAuthApi', () => {
  const api = new MockAuthApi()

  it('normalizes the email and derives a readable display name on login', async () => {
    const session = await api.login('  ada.lovelace@example.com  ', 'correct-horse')

    expect(session.user).toEqual({
      id: 'usr-ada.lovelace@example.com',
      email: 'ada.lovelace@example.com',
      name: 'Ada Lovelace',
    })
    expect(session.token).toMatch(/^demo-/)
  })

  it('trims the supplied name during signup', async () => {
    const session = await api.signup('grace@example.com', 'long-enough', '  Grace Hopper  ')

    expect(session.user.name).toBe('Grace Hopper')
    expect(session.user.email).toBe('grace@example.com')
  })

  it.each([
    {
      label: 'malformed email',
      email: 'not-an-email',
      password: 'long-enough',
      field: 'email' as const,
      message: 'Enter a valid email address.',
    },
    {
      label: 'short password',
      email: 'valid@example.com',
      password: 'short',
      field: 'password' as const,
      message: 'Password must be at least 8 characters.',
    },
  ])('returns a field-specific error for a $label', async ({ email, password, field, message }) => {
    await expect(api.login(email, password)).rejects.toMatchObject({
      name: 'AuthError',
      field,
      message,
    } satisfies Partial<AuthError>)
  })

  it('rejects a blank signup name independently of valid credentials', async () => {
    await expect(api.signup('valid@example.com', 'long-enough', ' ')).rejects.toMatchObject({
      field: 'name',
      message: 'Please enter your name.',
    })
  })
})
