import type { Session } from '@/api/types'
import type { AuthApi } from '@/api/portfolioApi'
import { latency } from '@/api/mock/latency'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export class AuthError extends Error {
  field: 'email' | 'password' | 'name' | 'form'
  constructor(field: 'email' | 'password' | 'name' | 'form', message: string) {
    super(message)
    this.name = 'AuthError'
    this.field = field
  }
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0].replace(/[._-]+/g, ' ')
  return local
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/** Mock auth. Any well-formed email plus an 8+ character password succeeds. */
export class MockAuthApi implements AuthApi {
  async signup(email: string, password: string, name: string): Promise<Session> {
    await latency(600)
    this.validate(email, password)
    if (name.trim().length < 2) {
      throw new AuthError('name', 'Please enter your name.')
    }
    return this.session(email, name.trim())
  }

  async login(email: string, password: string): Promise<Session> {
    await latency(600)
    this.validate(email, password)
    return this.session(email, nameFromEmail(email))
  }

  async logout(): Promise<void> {
    await latency(120)
  }

  private validate(email: string, password: string) {
    if (!EMAIL_RE.test(email.trim())) {
      throw new AuthError('email', 'Enter a valid email address.')
    }
    if (password.length < 8) {
      throw new AuthError('password', 'Password must be at least 8 characters.')
    }
  }

  private session(email: string, name: string): Session {
    return {
      token: `demo-${btoa(email.trim().toLowerCase()).replace(/=/g, '')}`,
      user: { id: `usr-${email.trim().toLowerCase()}`, email: email.trim().toLowerCase(), name },
    }
  }
}

export const mockAuthApi = new MockAuthApi()
