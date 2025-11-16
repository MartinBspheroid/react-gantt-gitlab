# GitLab Integration for React Gantt

Complete integration of GitLab (official and self-hosted) as a data source for react-gantt, enabling project management visualization with bidirectional synchronization.

## Features

- ✅ Support for both GitLab.com (official) and self-hosted GitLab instances
- ✅ Multiple project/group configurations with easy switching
- ✅ Bidirectional sync: changes in Gantt reflect in GitLab and vice versa
- ✅ Manual sync button with last sync timestamp
- ✅ Issues and Tasks as main entities
- ✅ Milestones and Epics as view filters
- ✅ Comprehensive field mapping (title, description, dates, assignees, labels, weight, tasks, relations)
- ✅ Filtering by milestone, epic, label, assignee, and state
- ✅ GitLab Personal Access Token authentication
- ✅ Project and Group level support
- ✅ Optimistic updates with error recovery
- ✅ Task statistics and progress tracking

## Quick Start

### 1. Import the Component

```jsx
import { GitLabGantt } from '@svar-ui/react-gantt/src/components/GitLabGantt';

function App() {
  return <GitLabGantt autoSync={false} />;
}
```

### 2. Configure Your GitLab Connection

On first run, click "Add" to configure your GitLab instance:

**For GitLab.com (Official):**

- GitLab URL: `https://gitlab.com`
- Access Token: Your personal access token (with `api` scope)
- Type: `project`
- Project ID: Your project ID (e.g., `12345` or `namespace/project`)

**For Self-Hosted GitLab:**

- GitLab URL: Your instance URL (e.g., `https://gitlab.example.com`)
- Access Token: Your personal access token
- Type: `project` or `group`
- Project/Group ID: Your project or group ID

### 3. Generate GitLab Access Token

1. Go to GitLab → User Settings → Access Tokens
2. Create a new token with `api` scope
3. Copy the token (you won't see it again!)
4. Use it in the configuration

## Architecture

### File Structure

```
src/
├── types/
│   └── gitlab.d.ts              # GitLab API type definitions
├── config/
│   └── GitLabConfigManager.ts   # Multi-project configuration manager
├── providers/
│   └── GitLabDataProvider.ts    # Core GitLab API integration
├── utils/
│   └── GitLabFilters.ts         # Filtering and grouping utilities
├── hooks/
│   └── useGitLabSync.ts         # React hook for sync logic
└── components/
    ├── ProjectSelector.jsx      # Project/group selector UI
    ├── SyncButton.jsx           # Manual sync button
    ├── FilterPanel.jsx          # Milestone/Epic/Label filters
    └── GitLabGantt.jsx          # Main integration component
```

### Data Flow

```
GitLab API (Issues/MRs)
        ↓
GitLabDataProvider (fetch & convert)
        ↓
useGitLabSync hook (state management)
        ↓
GitLabFilters (filtering & grouping)
        ↓
Gantt Component (visualization)
        ↓
User edits task
        ↓
GitLabDataProvider (update GitLab)
```

## Field Mapping

### GitLab Issue → Gantt Task

| GitLab Field             | Gantt Field | Notes                                         |
| ------------------------ | ----------- | --------------------------------------------- |
| `iid`                    | `id`        | Issue internal ID                             |
| `title`                  | `text`      | Task title                                    |
| `created_at`             | `start`     | Start date (or use `start_date` if available) |
| `due_date`               | `end`       | Due date                                      |
| `weight`                 | `weight`    | Issue weight                                  |
| `state`                  | `state`     | `opened` or `closed`                          |
| `description`            | `details`   | Full description                              |
| `assignees`              | `assigned`  | Comma-separated assignee names                |
| `labels`                 | `labels`    | Comma-separated labels                        |
| `task_completion_status` | `progress`  | Percentage of completed tasks                 |
| `milestone`              | `parent`    | Milestone as parent for grouping              |

### GitLab Issue Link → Gantt Link

| GitLab Link Type | Gantt Link Type | Description                                           |
| ---------------- | --------------- | ----------------------------------------------------- |
| `blocks`         | `e2s`           | End-to-Start: source must finish before target starts |
| `is_blocked_by`  | `s2e`           | Start-to-End: target must finish before source starts |
| `relates_to`     | `e2s`           | Default relation type                                 |

## API Reference

### GitLabGantt Component

```jsx
<GitLabGantt
  initialConfigId="config_id" // Optional: ID of initial config to load
  autoSync={false} // Enable/disable auto-sync (default: false)
/>
```

### GitLabDataProvider

```typescript
import { GitLabDataProvider } from './providers/GitLabDataProvider';

const provider = new GitLabDataProvider({
  gitlabUrl: 'https://gitlab.com',
  token: 'glpat-xxxx',
  projectId: '12345',
  type: 'project',
});

// Fetch all issues and convert to Gantt format
const { tasks, links, milestones, epics } = await provider.getData({
  includeClosed: false,
  milestoneId: 10,
  labels: ['bug', 'feature'],
});

// Create new issue
await provider.createIssue({
  text: 'New Task',
  details: 'Task description',
  end: new Date('2024-12-31'),
});

// Update issue
await provider.updateIssue(42, {
  text: 'Updated Title',
  progress: 50,
});
```

### useGitLabSync Hook

```jsx
import { useGitLabSync } from './hooks/useGitLabSync';

function MyComponent() {
  const {
    tasks,
    links,
    milestones,
    epics,
    syncState,
    sync,
    syncTask,
    createTask,
    deleteTask,
  } = useGitLabSync(provider, autoSync);

  // Manual sync
  const handleSync = () => {
    sync({ milestoneId: 10 });
  };

  // Update task
  const handleUpdate = (taskId, updates) => {
    syncTask(taskId, updates);
  };

  return (
    <div>
      {syncState.isLoading && <p>Loading...</p>}
      {syncState.error && <p>Error: {syncState.error}</p>}
      <button onClick={handleSync}>Sync</button>
    </div>
  );
}
```

### GitLabFilters Utility

```typescript
import { GitLabFilters } from './utils/GitLabFilters';

// Apply multiple filters
const filtered = GitLabFilters.applyFilters(tasks, {
  milestoneIds: [1, 2],
  epicIds: [10],
  labels: ['bug', 'critical'],
  assignees: ['john', 'jane'],
  states: ['opened'],
  search: 'authentication',
});

// Calculate statistics
const stats = GitLabFilters.calculateStats(tasks);
// {
//   total: 50,
//   completed: 20,
//   inProgress: 15,
//   notStarted: 15,
//   overdue: 5,
//   averageProgress: 45
// }
```

## Configuration Management

### GitLabConfigManager

Manages multiple GitLab configurations with localStorage persistence.

```typescript
import { gitlabConfigManager } from './config/GitLabConfigManager';

// Add new configuration
const config = gitlabConfigManager.addConfig({
  name: 'My Project',
  gitlabUrl: 'https://gitlab.com',
  token: 'glpat-xxxx',
  type: 'project',
  projectId: '12345',
});

// Get active configuration
const activeConfig = gitlabConfigManager.getActiveConfig();

// Switch active configuration
gitlabConfigManager.setActiveConfig(config.id);

// Test connection
const result = await GitLabConfigManager.testConnection({
  gitlabUrl: 'https://gitlab.com',
  token: 'glpat-xxxx',
});
```

## Advanced Usage

### Custom Columns

```jsx
const customColumns = [
  { id: 'text', header: 'Title', width: 300 },
  { id: 'assigned', header: 'Assignees', width: 150 },
  { id: 'labels', header: 'Labels', width: 200 },
  {
    id: 'milestone',
    header: 'Milestone',
    width: 150,
    template: (task) => task._gitlab?.milestone?.title || '-',
  },
  {
    id: 'web_url',
    header: 'Link',
    width: 80,
    template: (task) => `<a href="${task.web_url}" target="_blank">View</a>`,
  },
];
```

### Filter by Milestone/Epic

```jsx
import { FilterPanel } from './components/FilterPanel';

<FilterPanel
  milestones={milestones}
  epics={epics}
  tasks={tasks}
  onFilterChange={(filters) => {
    console.log('Active filters:', filters);
    // filters = { milestoneIds: [1, 2], epicIds: [10], ... }
  }}
/>;
```

### Auto-Sync Configuration

```jsx
// Enable auto-sync every 60 seconds
<GitLabGantt autoSync={true} />

// Or use the hook directly
const { ... } = useGitLabSync(
  provider,
  true,     // autoSync enabled
  60000     // sync interval in ms
);
```

## Security Considerations

### Token Storage

- Tokens are stored in browser's localStorage
- Consider implementing encryption for production use
- Never commit tokens to version control

### Backend Proxy (Recommended for Production)

Instead of exposing tokens in the frontend, create a backend proxy:

```javascript
// Backend API endpoint
app.post('/api/gitlab/issues', authenticateUser, async (req, res) => {
  const userToken = await getUserGitLabToken(req.user.id);

  const response = await fetch(
    `https://gitlab.com/api/v4/projects/${req.body.projectId}/issues`,
    {
      headers: { 'PRIVATE-TOKEN': userToken },
    },
  );

  res.json(await response.json());
});

// Frontend: point provider to your backend
const provider = new GitLabDataProvider({
  gitlabUrl: '/api/gitlab', // Your backend endpoint
  token: sessionToken, // Session token, not GitLab token
  projectId: '12345',
  type: 'project',
});
```

## GitLab API Rate Limits

- **GitLab.com**: 300 requests per minute per user
- **Self-hosted**: Configurable by admin (default: unlimited)

To avoid rate limits:

- Use auto-sync sparingly (60+ seconds interval recommended)
- Implement batching for bulk operations
- Cache responses when possible

## Troubleshooting

### Connection Failed

1. Verify GitLab URL is correct (include https://)
2. Check token has `api` scope
3. Ensure project/group ID is correct
4. Check network connectivity / firewall

### Tasks Not Syncing

1. Check browser console for errors
2. Verify token permissions (Maintainer+ for write access)
3. Check GitLab API version compatibility (v4 required)
4. Ensure dates are valid (due_date must be in future for some GitLab versions)

### Missing Epics

Epics are a GitLab Premium feature. They will only work with:

- GitLab Premium/Ultimate subscriptions
- Group-level configuration (not project-level)

## Examples

### Basic Usage

```jsx
import { GitLabGantt } from '@svar-ui/react-gantt';

export default function App() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <GitLabGantt />
    </div>
  );
}
```

### With Custom Event Handlers

```jsx
import { useState } from 'react';
import { GitLabGantt } from '@svar-ui/react-gantt';
import { gitlabConfigManager } from '@svar-ui/react-gantt/config/GitLabConfigManager';

export default function App() {
  const [config, setConfig] = useState(null);

  const handleProjectChange = (newConfig) => {
    setConfig(newConfig);
    console.log('Switched to project:', newConfig.name);
  };

  return <GitLabGantt initialConfigId={config?.id} autoSync={true} />;
}
```

### Programmatic Configuration

```jsx
import { useEffect } from 'react';
import { gitlabConfigManager } from '@svar-ui/react-gantt/config/GitLabConfigManager';
import { GitLabGantt } from '@svar-ui/react-gantt';

export default function App() {
  useEffect(() => {
    // Pre-configure on app start
    gitlabConfigManager.addConfig({
      name: 'Production Project',
      gitlabUrl: process.env.REACT_APP_GITLAB_URL,
      token: process.env.REACT_APP_GITLAB_TOKEN,
      type: 'project',
      projectId: process.env.REACT_APP_PROJECT_ID,
      isDefault: true,
    });
  }, []);

  return <GitLabGantt />;
}
```

## License

Same as @svar-ui/react-gantt

## Support

For issues and questions:

- Check the [react-gantt documentation](https://docs.svar.dev/gantt/)
- Review [GitLab API documentation](https://docs.gitlab.com/ee/api/)
- Open an issue in the repository

## Contributing

Contributions welcome! Please ensure:

- Code follows existing style
- All features are documented
- Examples are provided for new features
