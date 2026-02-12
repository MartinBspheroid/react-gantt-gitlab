# React Gantt Examples

This folder contains standalone examples demonstrating the key features of `@svar-ui/react-gantt`.

## Quick Start

Each example is a self-contained React component that can be copied and used in your project.

```bash
# Install dependencies
npm install @svar-ui/react-gantt

# Import the Gantt component
import { Gantt } from '@svar-ui/react-gantt';
```

## Examples Overview

### 1. Timeline Markers

Visual indicators on the Gantt timeline to highlight important dates.

**Files:**

- `timeline-markers/TimelineMarkersBasic.jsx` - Basic marker example (today, custom dates)
- `timeline-markers/TimelineMarkersAdvanced.jsx` - Multiple markers with custom CSS and programmatic management
- `timeline-markers/TimelineMarkersAdvanced.css` - Styling for markers

**Features demonstrated:**

- Adding a "Today" marker
- Creating custom date markers
- Dynamic marker management (add/remove)
- Custom marker styling
- Marker legends

**Usage:**

```jsx
const markers = [
  { start: new Date(), text: 'Today', css: 'marker-today' },
  { start: new Date(2024, 3, 15), text: 'Sprint Review', css: 'marker-review' },
];

<Gantt tasks={tasks} markers={markers} />;
```

---

### 2. Shadcn Theme Integration

Integration with shadcn/ui design system for consistent theming.

**Files:**

- `shadcn-theme/ThemeSwitcherDemo.jsx` - Light/dark theme switcher
- `shadcn-theme/ThemeSwitcherDemo.css` - Theme switcher styles
- `shadcn-theme/CustomVariableOverrides.jsx` - Custom CSS variable overrides
- `shadcn-theme/CustomVariableOverrides.css` - Override examples

**Features demonstrated:**

- Theme switching between light and dark modes
- Using Shadcn and ShadcnDark theme wrappers
- Customizing CSS variables
- Brand color integration

**Usage:**

```jsx
import { Shadcn, ShadcnDark } from '@svar-ui/react-gantt/themes';

// Light theme
<Shadcn>
  <Gantt tasks={tasks} />
</Shadcn>

// Dark theme
<ShadcnDark>
  <Gantt tasks={tasks} />
</ShadcnDark>
```

---

### 3. Row Grouping

Organize tasks into collapsible groups by assignee, epic, or custom criteria.

**Files:**

- `row-grouping/GroupByAssignee.jsx` - Group tasks by team member
- `row-grouping/GroupByAssignee.css` - Assignee grouping styles
- `row-grouping/GroupByEpic.jsx` - Group tasks by epic/feature
- `row-grouping/GroupByEpic.css` - Epic grouping styles

**Features demonstrated:**

- Grouping by assignee
- Grouping by epic with color coding
- Collapsible sections
- Summary rows
- Group statistics

**Usage:**

```jsx
// Group tasks by assignee
const groupedTasks = [
  // Group header
  { id: 1000, text: 'Alice', type: 'summary', open: true },
  // Tasks under group
  { id: 1, text: 'Task 1', parent: 1000, ... },
  { id: 2, text: 'Task 2', parent: 1000, ... },
];

<Gantt tasks={groupedTasks} />
```

---

### 4. Color Rules

Automatic styling of tasks based on labels, titles, or custom conditions.

**Files:**

- `color-rules/PriorityColoring.jsx` - Priority-based color coding
- `color-rules/PriorityColoring.css` - Priority styles
- `color-rules/StatusBasedStyling.jsx` - Status-based task styling
- `color-rules/StatusBasedStyling.css` - Status styles
- `color-rules/DateBasedFormatting.jsx` - Date-based conditional formatting
- `color-rules/DateBasedFormatting.css` - Date formatting styles

**Features demonstrated:**

- Priority-based coloring (Critical, High, Medium, Low)
- Status-based styling (Completed, In Progress, Blocked, etc.)
- Date-based conditional formatting (Overdue, Due Soon, Upcoming)
- Multiple rule matching (up to 3 stripes per task)
- Rule priority ordering

**Usage:**

```jsx
const colorRules = [
  {
    id: 'rule-1',
    name: 'High Priority',
    pattern: 'high',
    matchType: 'contains',
    conditionType: 'label', // or 'title'
    color: '#FF5722',
    opacity: 0.9,
    priority: 1,
    enabled: true,
  },
];

<Gantt tasks={tasks} colorRules={colorRules} />;
```

---

## Common Patterns

### Combining Features

You can combine multiple features together:

```jsx
<Gantt tasks={groupedTasks} markers={markers} colorRules={colorRules} zoom />
```

### Theme with Color Rules

When using themes with color rules, the colors work seamlessly together:

```jsx
<Shadcn>
  <Gantt tasks={tasks} colorRules={colorRules} markers={markers} />
</Shadcn>
```

### Dynamic Rule Updates

Color rules can be updated dynamically:

```jsx
const [rules, setRules] = useState([...]);

// Add a new rule
const addRule = () => {
  setRules([...rules, newRule]);
};

<Gantt tasks={tasks} colorRules={rules} />
```

---

## Code Snippets for Documentation

### Timeline Marker Snippet

```jsx
const markers = useMemo(
  () => [
    {
      start: new Date(),
      text: 'Today',
      css: 'marker-today',
    },
    {
      start: new Date(2024, 3, 15),
      text: 'Sprint Review',
      css: 'marker-review',
    },
  ],
  [],
);
```

### Color Rule Snippet

```jsx
const colorRules = useMemo(
  () => [
    {
      id: 'priority-high',
      name: 'High Priority',
      pattern: 'high',
      matchType: 'contains',
      conditionType: 'label',
      color: '#ea580c',
      opacity: 0.9,
      priority: 1,
      enabled: true,
    },
  ],
  [],
);
```

### Theme Wrapper Snippet

```jsx
import { Shadcn, ShadcnDark } from '@svar-ui/react-gantt/themes';

function App() {
  const [isDark, setIsDark] = useState(false);
  const Theme = isDark ? ShadcnDark : Shadcn;

  return (
    <Theme>
      <Gantt tasks={tasks} />
    </Theme>
  );
}
```

### Grouping Snippet

```jsx
const groupedTasks = useMemo(() => {
  const result = [];
  let groupId = 1000;

  assignees.forEach((assignee) => {
    const tasks = getTasksForAssignee(assignee);

    // Group header
    result.push({
      id: groupId,
      text: assignee,
      type: 'summary',
      open: true,
      parent: 0,
    });

    // Tasks under group
    tasks.forEach((task) => {
      result.push({ ...task, parent: groupId });
    });

    groupId++;
  });

  return result;
}, []);
```

---

## Requirements

- React 18+
- @svar-ui/react-gantt 2.3.0+
- CSS support for custom properties (all modern browsers)

## Browser Support

All examples work in:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## TypeScript Support

All examples can be used with TypeScript. Type definitions are included in the package:

```tsx
import { Gantt, Task, Link, ColorRule } from '@svar-ui/react-gantt';

const tasks: Task[] = [...];
const colorRules: ColorRule[] = [...];
```

---

## Additional Resources

- [SVAR Gantt Documentation](https://svar.dev/react/gantt/)
- [Shadcn/ui Documentation](https://ui.shadcn.com/)
- [GitHub Repository](https://github.com/svar-widgets/react-gantt)
