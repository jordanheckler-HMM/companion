# Testing Guide

This project uses **Vitest** for testing, along with **React Testing Library** for component testing.

## Running Tests

- Run all tests: `npm test` or `npm run test:run`
- Run tests in watch mode: `npm run test:watch`
- Run tests with UI: `npm run test:ui`

## Test Structure

- Unit tests are located next to the file they test (e.g., `src/services/aiService.test.ts`).
- `src/test/setup.ts` handles global test setup, including:
    - JSDOM environment configuration
    - Mocking Tauri APIs (`@tauri-apps/plugin-http`, `@tauri-apps/plugin-shell`)
    - Mocking browser APIs not present in JSDOM (`matchMedia`, `ResizeObserver`)

## Writing Tests

### Mocking Tauri APIs
Tauri APIs are mocked globally in `src/test/setup.ts`. If you need to customize the mock behavior for a specific test, use `vi.mocked()`:

```typescript
import { fetch } from '@tauri-apps/plugin-http'

vi.mocked(fetch).mockResolvedValue({
    ok: true,
    text: async () => 'mock response'
} as any)
```

### Testing Stores (Zustand)
When testing the store (`src/store.ts`), remember to reset the state between tests or use `act()` to perform state updates.

### Testing Services
Services often require mocking dependencies. Use `vi.mock()` to mock imported modules:

```typescript
vi.mock('./dependency', () => ({
    DependencyClass: {
        method: vi.fn()
    }
}))
```
