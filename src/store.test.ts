import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore } from './store'

describe('AppState Store', () => {
    beforeEach(() => {
        useStore.getState()
        // Reset store state
        act(() => {
            useStore.setState({
                messages: [],
                files: [],
                pendingContext: [],
                knowledgeBase: [],
                currentView: 'home'
            })
        })
    })

    it('should add a message', () => {
        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.addMessage({ role: 'user', content: 'Hello' })
        })

        expect(result.current.messages).toHaveLength(1)
        expect(result.current.messages[0].content).toBe('Hello')
        expect(result.current.messages[0].role).toBe('user')
    })

    it('should clear messages', () => {
        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.addMessage({ role: 'user', content: 'test' })
            result.current.clearMessages()
        })

        expect(result.current.messages).toHaveLength(1)
        expect(result.current.messages[0].role).toBe('assistant')
    })

    it('should handle pending context', () => {
        const { result } = renderHook(() => useStore())
        const contextItem = {
            type: 'ai_prompt' as const, // Explicit cast to match union type
            title: 'Test Prompt',
            prompt: 'Test content'
        }

        act(() => {
            result.current.addPendingContext(contextItem)
        })

        expect(result.current.pendingContext).toHaveLength(1)
        expect(result.current.pendingContext[0].title).toBe('Test Prompt')

        const id = result.current.pendingContext[0].id

        act(() => {
            result.current.removePendingContext(id)
        })

        expect(result.current.pendingContext).toHaveLength(0)
    })
})
