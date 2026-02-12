# Hands-On Kitchen Sink Experience

This guide provides hands-on experience with the kitchen sink tests through interactive debugging and manual testing.

## What's Included

### 1. Kitchen Sink Playground Component

A visual, interactive demo that lets you see and interact with all kitchen sink components:

- **Location:** `src/components/__tests__/KitchenSinkPlayground.jsx`
- **Features:**
  - Interactive tabs to switch between Workspace and GanttView
  - Toggle controls for settings and auto-sync
  - Real-time component rendering
  - Component structure inspection

### 2. Interactive Test Runner

Enhanced test suite with interactive debugging capabilities:

- **Location:** `src/components/__tests__/KitchenSinkInteractive.test.jsx`
- **Features:**
  - Step-by-step test execution with detailed logging
  - Component inspection during tests
  - State inspection and verification
  - Real-time interaction logging
  - Performance metrics tracking

## How to Get Hands-On Experience

### Method 1: Interactive Test Runner (Recommended)

```bash
# Run the interactive test suite
npm run test:kitchensink
```

This will:

1. Start Vitest UI at http://localhost:51204/**vitest**/
2. Automatically navigate to KitchenSinkInteractive.test.jsx
3. Show detailed step-by-step test execution
4. Log all interactions and state changes
5. Provide component inspection information

**What You'll See:**

- 🚀 [TEST START] - Test begins execution
- 🔍 [STEP X] - Current step being executed
- 🎯 [INTERACTION] - User interaction being performed
- 🔍 [COMPONENT INSPECT] - Component state and structure
- 📊 [STATE INSPECT] - Current application state
- ✅ [TEST PASSED] - Test completed successfully
- ❌ [TEST FAILED] - Test encountered an error
- 📊 [TEST SUMMARY] - Overall test results

### Method 2: Kitchen Sink Playground

```bash
# Run the test with playground component
npm run test:kitchensink-playground
```

This starts a live demo where you can:

1. Click tabs to switch between Workspace and GanttView
2. Toggle settings and auto-sync checkboxes
3. See component rendering in real-time
4. Inspect component structure and state

## Hands-On Exercises

### Exercise 1: Component Structure Exploration

1. Run `npm run test:kitchensink`
2. Look for "Component Structure" in the logs
3. Observe how Workspace contains:
   - SharedToolbar
   - GanttView/KanbanView
   - FilterPanel
4. Note the component hierarchy and relationships

### Exercise 2: State Management

1. Run `npm run test:kitchensink`
2. Observe state changes during tab switching
3. Track how `activeTab`, `showSettings`, and `autoSync` change
4. See how state persists across re-renders

### Exercise 3: User Interactions

1. Follow the "INTERACTION" logs in the output
2. Observe how clicks and toggles trigger state updates
3. Watch component re-rendering in real-time
4. See how multiple interactions are handled

### Exercise 4: Error Handling

1. Look for error handling tests
2. Observe how missing APIs (localStorage, matchMedia, IntersectionObserver) are handled
3. See graceful degradation without crashes

### Exercise 5: Performance Testing

1. Observe performance metrics in the logs
2. Check render duration measurements
3. Watch rapid interaction handling
4. Verify system responds quickly under load

## Interactive Debugging Features

### Step Tracking

Each test provides detailed step-by-step information:

- Current step number
- Description of what's happening
- State information

### Component Inspection

Inspect components during test execution:

- Component structure
- Classes and attributes
- Text content
- Data attributes

### State Inspection

Monitor application state:

- Active tab
- Show settings flag
- Auto sync status
- Other state variables

### Interaction Logging

Track all user interactions:

- What action was performed
- When it occurred
- Resulting state changes

## Test Categories

### Interactive Workspace Tests

- Render Workspace with inspection
- Tab switching with state verification
- Settings toggle with state tracking
- Auto-sync toggle with state verification

### Interactive Component Integration

- Inspect Workspace components
- Inspect GanttView components
- Verify component relationships

### Interactive User Interactions

- Multiple sequential interactions
- Rapid interaction handling
- Complex interaction sequences

### Interactive State Management

- State persistence across renders
- State updates and tracking
- Multi-render cycle handling

### Interactive Performance Testing

- Render duration measurement
- Rapid interaction performance
- System efficiency verification

### Interactive Error Handling

- Missing localStorage handling
- Missing matchMedia handling
- Missing IntersectionObserver handling

## Getting Help

### View Test Output

The test output provides detailed logging:

- 📊 Statistics: Test counts, success rates
- 🔍 Detailed steps: What's happening at each step
- 📈 Performance metrics: Timing and efficiency
- ⚠️ Error information: Detailed error messages

### Debug Tests

If a test fails:

1. Look at the "❌ [TEST FAILED]" message
2. Check the error message and stack trace
3. Review the step-by-step execution
4. Inspect component state at failure point

### Inspect Components

During test execution:

1. Look for "🔍 [COMPONENT INSPECT]" logs
2. Note component structure
3. Check attributes and classes
4. Verify component rendering

### Monitor State

Watch state changes:

1. Look for "📊 [STATE INSPECT]" logs
2. Track variable values
3. See state transitions
4. Verify state persistence

## Hands-On Tips

1. **Take Your Time** - Read each step carefully
2. **Observe Patterns** - Look for common patterns in interactions
3. **Track State** - Note how state changes throughout tests
4. **Inspect Components** - Pay attention to component structure
5. **Monitor Performance** - Watch timing and efficiency
6. **Learn Error Handling** - See how errors are managed
7. **Compare Approaches** - Notice different testing strategies

## Next Steps

Once you've completed the hands-on exercises:

1. Review the test code to understand implementation
2. Modify the playground component for custom exploration
3. Create your own interactive tests
4. Add new component interactions to test
5. Explore performance optimization opportunities

## Additional Resources

- **Vitest UI:** http://localhost:51204/**vitest**/
- **Test Code:** `src/components/__tests__/KitchenSinkInteractive.test.jsx`
- **Playground Component:** `src/components/__tests__/KitchenSinkPlayground.jsx`
- **Documentation:** `docs/KITCHEN_SINK.md`

## Common Questions

**Q: What's the difference between KitchenSink.test.jsx and KitchenSinkInteractive.test.jsx?**
A: KitchenSink.test.jsx is a traditional unit test suite. KitchenSinkInteractive.test.jsx provides step-by-step debugging and component inspection for hands-on learning.

**Q: How do I pause a test to inspect components?**
A: The interactive test runner provides detailed step-by-step logging. Watch the console output to see exactly what's happening at each step.

**Q: Can I modify the playground component?**
A: Yes! Edit `KitchenSinkPlayground.jsx` and run the tests again to see your changes.

**Q: How do I add my own interactive tests?**
A: Create new describe blocks in `KitchenSinkInteractive.test.jsx` and use the interactive test runner macros.
