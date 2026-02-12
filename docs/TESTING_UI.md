# Test Runner - Vitest UI

The project uses **Vitest** with a browser-based UI for viewing test results and debugging.

## Running Tests

### Run Tests in Browser UI

Open a terminal and run:

```bash
npm run test:ui
```

This will start the Vitest UI server at:

- **URL:** http://localhost:51204/**vitest**/
- **Port:** 51204 (or next available)

The UI will automatically open in your default browser. If not, manually navigate to the URL above.

### Other Test Commands

```bash
# Run all tests in watch mode (auto-reloads on changes)
npm run test:watch

# Run all tests once
npm run test

# Run tests with coverage report
npm run test:coverage
```

## Using the Vitest UI

The browser-based UI provides:

1. **Test Explorer** - Browse all test files and test cases
2. **Live Results** - See test results update in real-time
3. **Debug Mode** - Step through tests interactively
4. **Coverage View** - Visualize test coverage
5. **Component Testing** - Inspect rendered components

## Kitchen Sink Integration Tests

To view the kitchen sink integration tests:

1. Run `npm run test:ui`
2. Navigate to http://localhost:51204/**vitest**/
3. Expand the "Kitchen Sink Integration Test" suite
4. Run individual tests or the entire suite

The kitchen sink tests cover:

- Workspace component integration
- GanttView component integration
- KanbanView component integration
- Data flow between components
- Performance and accessibility
- Error handling
- Edge cases

## Configuration

Vitest configuration is in `vitest.config.ts`. Key settings:

- **Environment:** jsdom (DOM simulation)
- **Globals:** Enabled for test functions
- **Setup Files:** `./vitest.setup.ts` for test helpers
- **UI:** Enabled for browser-based test runner
