import { beforeEach, describe, expect, it } from 'vitest'
import { entityKey, useRepromptStore, type AssistantReference } from '@/store/repromptStore'
import { useAssistantChatStore } from '@/store/assistantChatStore'

const thesis: AssistantReference = {
  kind: 'thesis',
  id: 'idea-nvda-call',
  label: "NVDA $150C JAN 15 '27",
  detail: 'BUY · 88/100 conviction',
  to: '/app/thesis/idea-nvda-call',
}

const position: AssistantReference = { ...thesis, kind: 'position', id: 'idea-nvda-call' }

describe('reprompt capture', () => {
  beforeEach(() => {
    useRepromptStore.setState({ byEntity: {} })
    useAssistantChatStore.setState({
      messages: [],
      mode: 'bubble',
      thinking: false,
      unread: false,
      context: null,
    })
  })

  it('keys a plan and a position with the same id separately', () => {
    expect(entityKey('plan', 'x')).not.toBe(entityKey('position', 'x'))

    useRepromptStore.getState().record(thesis, 'why not AMD?')
    useRepromptStore.getState().record(position, 'why this size?')

    expect(useRepromptStore.getState().forEntity('thesis', thesis.id)).toHaveLength(1)
    expect(useRepromptStore.getState().forEntity('position', position.id)).toHaveLength(1)
  })

  it('records the question against the entity and fills in the answer', async () => {
    await useAssistantChatStore.getState().sendMessage('why not AMD?', thesis)

    const records = useRepromptStore.getState().forEntity('thesis', thesis.id)
    expect(records).toHaveLength(1)
    expect(records[0].question).toBe('why not AMD?')
    expect(records[0].answer).toBeTruthy()
    expect(records[0].createdAt).toBeTruthy()
  })

  it('falls back to the page the user is on when no reference is given', async () => {
    useAssistantChatStore.getState().setContext(position)
    await useAssistantChatStore.getState().sendMessage('should I roll this?')

    const records = useRepromptStore.getState().forEntity('position', position.id)
    expect(records).toHaveLength(1)
    expect(useAssistantChatStore.getState().messages[0].reference?.kind).toBe('position')
  })

  it('records nothing when the question has no subject at all', async () => {
    await useAssistantChatStore.getState().sendMessage('what is theta?')

    expect(useRepromptStore.getState().byEntity).toEqual({})
    expect(useAssistantChatStore.getState().messages[0].reference).toBeUndefined()
  })
})

describe('unread signalling', () => {
  beforeEach(() => {
    useRepromptStore.setState({ byEntity: {} })
    useAssistantChatStore.setState({
      messages: [],
      mode: 'bubble',
      thinking: false,
      unread: false,
      context: null,
    })
  })

  it('marks a reply unread only when the user minimised before it landed', async () => {
    const pending = useAssistantChatStore.getState().sendMessage('why not AMD?', thesis)
    // Walk away mid-flight.
    useAssistantChatStore.getState().minimize()
    await pending

    expect(useAssistantChatStore.getState().unread).toBe(true)
    useAssistantChatStore.getState().openWindow()
    expect(useAssistantChatStore.getState().unread).toBe(false)
  })

  it('leaves the reply read when the window stayed open', async () => {
    await useAssistantChatStore.getState().sendMessage('why not AMD?', thesis)
    expect(useAssistantChatStore.getState().mode).toBe('window')
    expect(useAssistantChatStore.getState().unread).toBe(false)
  })
})
