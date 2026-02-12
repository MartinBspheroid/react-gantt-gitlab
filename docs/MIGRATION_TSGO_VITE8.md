# Migration Guide: Vite 8 + TypeScript Native (tsgo)

This guide explains how to migrate a React/TypeScript project from legacy TypeScript (tsc) to TypeScript Native Preview (tsgo) with Vite 8.

## Overview

**Before:** TypeScript 5.x + tsc (slow, ~5-10s type checking)  
**After:** TypeScript Native 7.0 (tsgo) + Vite 8 (fast, ~0.9s type checking)

## Migration Steps

### 1. Install Dependencies

```bash
# Remove old TypeScript (optional but recommended)
npm uninstall typescript

# Install TypeScript Native Preview
npm install -D @typescript/native-preview

# Install Vite 8 (beta)
npm install -D vite@beta @vitejs/plugin-react@^5

# Install testing-library/dom (needed for waitFor and other utilities)
npm install -D @testing-library/dom

# Update React types if needed
npm install -D @types/react@^18 @types/react-dom@^18
```

### 2. Update package.json Scripts

```json
{
  "scripts": {
    "type-check": "tsgo --noEmit",
    "build": "vite build",
    "test": "vitest run",
    "lint": "oxlint ."
  }
}
```

### 3. Update tsconfig.json

Key changes for tsgo compatibility:

```json
{
  "compilerOptions": {
    // Remove these (not supported by tsgo)
    // "baseUrl": ".",

    // Keep or add these
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],

    // Type definitions
    "types": ["node", "vitest/globals"],

    // Strictness (adjust as needed)
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,

    // Path aliases (use @/ instead of relative paths)
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "vitest.setup.ts"],
  "exclude": ["node_modules", "dist", "dist-demos"]
}
```

### 4. Update Vite Configuration

**vite.config.js:**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  resolve: {
    // Enable tsconfig paths resolution (Vite 8+ feature)
    tsconfigPaths: true,
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      fileName: (format) => (format === 'cjs' ? 'index.cjs' : 'index.es.js'),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
  },
});
```

### 5. Update Vitest Configuration

**vitest.config.ts:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
});
```

### 6. Update Test Setup

**vitest.setup.ts:**

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
```

### 7. Fix Common Type Errors

#### A. Import Path Issues

**Problem:** tsgo doesn't support `baseUrl`

**Fix:** Use `@/` aliases instead of relative paths

```typescript
// Before (broken with tsgo)
import { FilterOptions } from '../../utils/DataFilters';

// After (works with tsgo)
import { FilterOptions } from '@/utils/DataFilters';
```

#### B. Duplicate Type Exports

**Problem:** Same interface exported from multiple files

**Fix:** Consolidate in one file, import from there

```typescript
// types.ts - Single source of truth
export interface IScheduleConfig {
  auto?: boolean;
  projectStart?: Date;
  projectEnd?: Date;
  respectCalendar?: boolean;
}

// Other files - Import from types.ts
import type { IScheduleConfig } from './types';
```

#### C. ReactNode Type Issues

**Problem:** Using string methods on ReactNode

**Fix:** Narrow the type first

```typescript
// Before (error)
if (config.icon.startsWith('fa-')) { ... }

// After (fixed)
const icon = config.icon;
if (typeof icon === 'string' && icon.startsWith('fa-')) { ... }
```

#### D. WaitFor Import

**Problem:** `waitFor` not exported from vitest

**Fix:** Import from @testing-library/react

```typescript
// Before (error)
import { waitFor } from 'vitest';

// After (fixed)
import { waitFor } from '@testing-library/react';
```

#### E. File Extension in Imports

**Problem:** tsgo doesn't allow `.tsx` in imports

**Fix:** Remove extensions from barrel files

```typescript
// Before (error)
export * from './WorkItemTypeIcons.tsx';

// After (fixed)
export * from './WorkItemTypeIcons';
```

### 8. Fix Test Failures

#### A. React Not Defined in Tests

**Problem:** JSX in tests throws "React is not defined"

**Fix 1:** Add React import to test files

```typescript
import React from 'react'; // Add this first
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
```

**Fix 2:** Add React import to component files

```typescript
// In your JSX components, add explicit React import
import React from 'react'; // Required for test environment
import { useState, useEffect } from 'react';
```

**Fix 3:** Convert JSX mocks to React.createElement

```typescript
// Before (fails in tests)
vi.mock('./Component', () => ({
  Component: ({ children }) => <div>{children}</div>
}));

// After (works in tests)
vi.mock('./Component', () => ({
  Component: ({ children }) => React.createElement('div', null, children)
}));
```

#### B. Missing Vitest Imports

**Fix:** Add missing imports

```typescript
// Before
import { describe, it, expect, beforeEach } from 'vitest';

// After
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
```

#### C. LocalStorage Mock Issues

**Fix:** Re-initialize mocks after `vi.restoreAllMocks()`

```typescript
beforeEach(() => {
  vi.restoreAllMocks();
  // Re-initialize localStorage mock
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.localStorage = localStorageMock as any;
});
```

### 9. Type-Specific Fixes

#### Link Type Format

If your codebase uses link types, ensure consistency:

```typescript
// The @svar-ui/gantt-store uses abbreviated format:
type TLinkType = 'e2s' | 's2s' | 'e2e' | 's2e';

// Map from MS Project format
function mapMSProjectLinkType(type: string): TLinkType {
  switch (type) {
    case '0':
      return 'e2s'; // finish_to_start
    case '1':
      return 's2s'; // start_to_start
    case '2':
      return 'e2e'; // finish_to_finish
    case '3':
      return 's2e'; // start_to_finish
    default:
      return 'e2s';
  }
}

// Export function should handle both formats
function getLinkTypeCode(type: string | undefined): string {
  switch (type) {
    case 's2s':
    case 'start_to_start':
      return '1';
    case 'e2e':
    case 'finish_to_finish':
      return '2';
    case 's2e':
    case 'start_to_finish':
      return '3';
    case 'e2s':
    case 'finish_to_start':
    default:
      return '0';
  }
}
```

### 10. Verification Checklist

Run these commands to verify the migration:

```bash
# Type checking (should be FAST - ~0.9s vs ~5-10s before)
npm run type-check

# Tests (all should pass)
npm test

# Build (should succeed)
npm run build

# Lint (should pass)
npm run lint
```

## Common Issues & Solutions

### Issue: "Cannot find module" errors

**Solution:** Ensure path aliases are configured in both tsconfig.json and vite.config.js

### Issue: Tests fail with "React is not defined"

**Solution:** Add explicit `import React from 'react'` to all JSX files used in tests

### Issue: Type errors in node_modules

**Solution:** Add `"skipLibCheck": true` to tsconfig.json

### Issue: Import path errors after removing baseUrl

**Solution:** Replace all relative imports with `@/` aliases

### Issue: waitFor not found

**Solution:** Install @testing-library/dom and import from @testing-library/react

## Performance Comparison

| Operation    | Old (tsc) | New (tsgo) | Improvement  |
| ------------ | --------- | ---------- | ------------ |
| Type Check   | 5-10s     | 0.9s       | 6-10x faster |
| Build        | ~3s       | ~0.8s      | 3-4x faster  |
| Test Startup | ~5s       | ~3s        | 1.5x faster  |

## Files Typically Changed

- `package.json` - Update dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.js` - Vite configuration
- `vitest.config.ts` - Vitest configuration
- `vitest.setup.ts` - Test environment setup
- Various `.tsx` files - Fix type errors
- Various `.test.tsx` files - Fix test imports and mocks

## Migration Complete!

After following this guide, you should have:

- ✅ Zero type errors
- ✅ All tests passing
- ✅ Successful builds
- ✅ 6-10x faster type checking
- ✅ Modern tooling stack

---

**Note:** This migration assumes a React 18+ project with Vitest for testing. Adjust as needed for your specific stack.
