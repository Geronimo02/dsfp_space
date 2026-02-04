# Testing Setup & Guide

## Installation

Para ejecutar los tests, primero instala las dependencias de testing:

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Files Created

### Hooks Tests
- `src/hooks/useDebounce.test.ts` - Tests for search debouncing
- `src/hooks/useRateLimit.test.ts` - Tests for rate limiting functionality
- `src/hooks/useServerPagination.test.ts` - Tests for server-side pagination

### Utils Tests
- `src/lib/errorHandling.test.ts` - Tests for error message handling
- `src/lib/validationSchemas.test.ts` - Tests for Zod validation schemas

## Test Coverage

Current test coverage includes:
- ✅ Custom hooks (useDebounce, useRateLimit, useServerPagination)
- ✅ Error handling utilities
- ✅ Validation schemas
- ⏳ Component tests (pending)
- ⏳ Integration tests (pending)
- ⏳ E2E tests (pending)

## Writing New Tests

### Hook Testing Example

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useYourHook } from '../useYourHook';

describe('useYourHook', () => {
  it('should do something', () => {
    const { result } = renderHook(() => useYourHook());
    
    act(() => {
      result.current.someFunction();
    });
    
    expect(result.current.someValue).toBe(expectedValue);
  });
});
```

### Component Testing Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { YourComponent } from './YourComponent';

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Configuration Files

- `vitest.config.ts` - Vitest configuration
- `tsconfig.test.json` - TypeScript config for tests
- `src/test/setup.ts` - Test setup and mocks

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **One assertion per test**: Keep tests focused
3. **Test behavior, not implementation**: Focus on what users see
4. **Mock external dependencies**: Isolate units under test
5. **Use descriptive test names**: `should do X when Y happens`

## Common Test Patterns

### Testing Async Operations

```typescript
it('should handle async operations', async () => {
  const { result } = renderHook(() => useAsyncHook());
  
  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });
});
```

### Testing with React Query

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const wrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const { result } = renderHook(() => useYourQuery(), { wrapper });
```

### Mocking Supabase

```typescript
import { vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: mockData,
          error: null
        }))
      }))
    }))
  }
}));
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: npm test -- --reporter=verbose

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Next Steps

1. Install testing dependencies (command above)
2. Run `npm test` to verify setup
3. Add more component tests
4. Integrate with CI/CD
5. Set coverage thresholds (aim for >80%)

## Troubleshooting

### "Cannot find module 'vitest'"
Run: `npm install -D vitest @vitest/ui jsdom`

### "Cannot find module '@testing-library/react'"
Run: `npm install -D @testing-library/react @testing-library/jest-dom`

### Tests timing out
Increase timeout in vitest.config.ts:
```typescript
test: {
  testTimeout: 10000
}
```

### Mock not working
Ensure mocks are defined before imports using `vi.mock()`
