import { useEffect } from 'react'
import { useAssistantChatStore } from '@/store/assistantChatStore'
import type { AssistantReference } from '@/store/repromptStore'

/**
 * Tells the assistant what the user is currently looking at.
 *
 * A question typed into the floating bubble carries no subject of its own, so
 * detail pages publish their entity here. That is what turns a stray "why not
 * AMD?" into a reprompt recorded against a specific thesis — the signal we
 * actually want, because it marks the moment the model's own output failed to
 * convince and the user had to intervene.
 */
export function useAssistantContext(reference: AssistantReference | null): void {
  const setContext = useAssistantChatStore((state) => state.setContext)

  // Serialised so a fresh object literal on each render does not re-fire.
  const key = reference ? JSON.stringify(reference) : null

  useEffect(() => {
    setContext(key ? (JSON.parse(key) as AssistantReference) : null)
    return () => setContext(null)
  }, [key, setContext])
}
