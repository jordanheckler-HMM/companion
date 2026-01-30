import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock matchMedia for JSDOM
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-http', () => ({
    fetch: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
    open: vi.fn(),
}))

// Add global mocks if needed
