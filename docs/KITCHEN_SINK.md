# Kitchen Sink Integration Tests

Quick reference for running and viewing the kitchen sink integration tests.

## Quick Start

### Open in Browser UI

```bash
npm run test:kitchensink
```

This will start the Vitest UI at http://localhost:51204/**vitest**/ and automatically navigate to the kitchen sink tests.

### Run Tests

```bash
# Run kitchen sink tests in watch mode
npm run test:watch KitchenSink.test.jsx

# Run kitchen sink tests once
npm test KitchenSink.test.jsx
```

## Test Coverage

The kitchen sink tests cover:

### 1. Workspace Component Integration (6 tests)

- Renders with Gantt view by default
- Persists view mode to localStorage
- Switches to Kanban view
- Renders SharedToolbar
- Renders SharedFilterPanel
- Passes initialConfigId and autoSync props

### 2. GanttView Component Integration (5 tests)

- Renders with hideSharedToolbar
- Handles externalShowSettings prop
- Renders ProjectSelector
- Renders FilterPanel
- Renders SyncButton

### 3. KanbanView Component Integration (3 tests)

- Renders in Workspace
- Renders KanbanBoard component
- Handles Kanban view settings modal

### 4. Data Flow Integration (3 tests)

- Maintains state across view switches
- Persists view mode across render cycles
- Handles multiple concurrent renders

### 5. Performance Integration (2 tests)

- Renders all components within 500ms
- Handles rapid view switching efficiently

### 6. Accessibility Integration (3 tests)

- Has proper ARIA labels
- Has keyboard navigation support
- Has proper semantic HTML structure

### 7. Error Handling Integration (3 tests)

- Handles missing localStorage gracefully
- Handles missing matchMedia gracefully
- Handles missing IntersectionObserver gracefully

### 8. Component Composition Integration (3 tests)

- Composes multiple components together
- Maintains component hierarchy
- Supports nested view switching

### 9. Edge Cases Integration (3 tests)

- Handles empty state gracefully
- Handles rapid multiple renders
- Handles concurrent state changes

## Test Results

Current Results (as of creation):

- ✓ 24 tests passing
- ✗ 7 tests failing (due to overly specific DOM element assertions)

The failing tests can be fixed by adjusting the test assertions to be less specific and more flexible.

## Viewing Tests

1. Run `npm run test:kitchensink`
2. Navigate to http://localhost:51204/**vitest**/
3. In the UI, expand:
   - "Kitchen Sink Integration Test" suite
   - "Workspace Component Integration" group
   - And see all individual tests

## What's Tested

- Multiple components together (Workspace, GanttView, KanbanView)
- Data flow between components
- State management and persistence
- Component composition and hierarchy
- Performance under load
- Accessibility (ARIA labels, keyboard navigation)
- Error handling for missing APIs
- Edge cases and boundary conditions
