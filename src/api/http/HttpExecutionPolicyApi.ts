import type { ExecutionApprovalMode, ExecutionPolicy, TradingWindow } from '@/api/types'
import type { ExecutionPolicyApi } from '@/api/portfolioApi'
import { request } from '@/api/http/client'
import type { PltConfigEntry, PltUpdateConfig } from '@/api/http/wire/plt'
import {
  POLICY_KEY,
  approvalModeToWire,
  toExecutionPolicy,
} from '@/api/http/adapters/executionPolicy'

/**
 * The execution policy plt enforces (AI-021, contracts §16).
 *
 * Read on open, written one key at a time. There is deliberately no local
 * cache and no write-on-open: the app does not push its stored preferences
 * into plt the first time a settings sheet is rendered, because that would
 * overwrite an operator's server-side choice with whatever this browser
 * happened to remember. It reads what plt holds and writes only what the user
 * changes.
 */
export class HttpExecutionPolicyApi implements ExecutionPolicyApi {
  async getPolicy(): Promise<ExecutionPolicy> {
    // An ARRAY of entries, not a map — `ConfigController.all()` returns
    // `List<ConfigEntryResponse>`.
    const entries = await request<PltConfigEntry[]>('plt', '/api/v1/config')
    return toExecutionPolicy(entries)
  }

  /**
   * Flip the master switch.
   *
   * A JSON boolean, always: plt's write-time validation refuses anything else
   * with a 422 (`CONFIG_VALUE_INVALID`), and its own resolver reads a stored
   * string as unparseable and therefore disabled.
   */
  async setAiTradingEnabled(enabled: boolean): Promise<void> {
    await this.put(POLICY_KEY.aiTradingEnabled, enabled)
  }

  async setApprovalMode(mode: ExecutionApprovalMode): Promise<void> {
    // `approve` is `approve_each` on the wire — the one word that differs.
    await this.put(POLICY_KEY.approvalMode, approvalModeToWire(mode))
  }

  async setTradingWindow(window: TradingWindow): Promise<void> {
    await this.put(POLICY_KEY.tradingWindow, window)
  }

  private async put(key: string, value: unknown): Promise<void> {
    await request<PltConfigEntry>('plt', `/api/v1/config/${key}`, {
      method: 'PUT',
      body: { value } satisfies PltUpdateConfig,
    })
  }
}

export const httpExecutionPolicyApi = new HttpExecutionPolicyApi()
