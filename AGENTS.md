# Agent Instructions

This project uses **bd** (beads) for issue tracking and workflow automation. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work (issues not blocked and unassigned)
bd show <id>          # View issue details and dependencies
bd list --status=open # List all open issues
bd update <id> --status=in_progress  # Claim work (mark as assigned and in progress)
bd close <id>         # Mark work complete
bd close <id> <id2> <id3>  # Close multiple issues at once (efficient)
bd sync               # Sync beads changes with git
```

## Project Workflow

### Starting Work

1. Run `bd ready` to find available tasks
2. Review task details with `bd show <task-id>`
3. Verify task has no blockers (check dependencies)
4. Update status: `bd update <task-id> --status=in_progress`
5. Start coding

### Creating New Work

```bash
bd create --title="Task title" --type=task|bug|feature --priority=2
# Priority: 0=critical, 1=high, 2=medium, 3=low, 4=backlog
bd dep add <new-id> <depends-on-id>  # Create dependencies
```

### Testing & Quality

**Before completing work:**

```bash
    npm test                    # Run tests in watch mode
    npm run test:ui             # Open browser-based test UI
    npm run lint                # Check code style
    npm run format              # Format code
    npm run test:coverage       # View coverage (optional)
```

**Test Guidelines:**

- All changes must have passing tests
- Write tests alongside features (see docs/TESTING.md)
- Current test suite: 114 tests passing
- Target coverage: Utilities 100%, Hooks 80%+, Components 60%+
- Build must succeed: 'bun run build' must pas

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for any follow-up work

   ```bash
   bd create --title="..." --type=task --priority=2
   ```

2. **Run quality gates** (if code changed):

   ```bash
    npm test          # Must pass
    npm run lint      # Must pass
    npm run format    # Format code
   ```

3. **Update issue status** - Close finished work, update in-progress items:

   ```bash
   bd close <id1> <id2> ...  # Close completed issues
   bd update <id> --status=in_progress --notes="Current progress..."  # Update active work
   ```

4. **PUSH TO REMOTE** - This is MANDATORY:

   ```bash
   git pull --rebase          # Sync with remote
   bd sync                    # Commit beads changes
   git add <files>            # Stage code changes
   git commit -m "..."        # Commit with descriptive message
   bd sync                    # Sync again if needed
   git push                   # CRITICAL: Push to remote
   git status                 # MUST show "up to date with origin"
   ```

5. **Clean up** - Clear stashes, prune remote branches:

   ```bash
   git stash drop              # If no stashes, OK to skip
   git fetch --prune           # Optional: clean up local refs
   ```

6. **Verify** - All changes committed AND pushed:
   - Run `git status` - should show "up to date with origin/main"
   - Check remote repo - new commits should be visible

7. **Hand off** - Provide context for next session:
   - Document any blockers or dependencies
   - Note architecture decisions made
   - Update memory/notes in .claude/projects/ if needed

**CRITICAL RULES:**

- ⛔ Work is NOT complete until `git push` succeeds
- ⛔ NEVER stop before pushing - that leaves work stranded locally
- ⛔ NEVER say "ready to push when you are" - YOU must push
- ⛔ If push fails, resolve the issue and retry until it succeeds
- ✅ All tests must pass before pushing
- ✅ Code must be formatted with oxfmt before committing

## Architecture Notes for Agents

### Current Project State (Phase 8 Complete)

**Architecture:** Data-source-agnostic Gantt chart library

- Generic DataProviderInterface for any data source (Azure DevOps, custom)
- DataProviderFactory pattern for provider instantiation
- Generic components: GanttChart, Workspace, GanttView
- Generic hooks: useDataSync, useGanttState extracted from GanttView

**Testing Infrastructure Established:**

- Vitest with jsdom environment, globals enabled, coverage reporting
- Browser-based UI available at http://localhost:51204/**vitest**/
- Run with `npm run test:ui` for interactive test exploration
- 114 tests passing across 7 test files
- Test setup includes mocks for browser APIs (matchMedia, localStorage, IntersectionObserver)
- See docs/TESTING.md and docs/TESTING_UI.md for patterns and best practices

### Key File Locations

**Core Data Layer:**

- `/src/providers/core/DataProviderInterface.ts` - Provider contract
- `/src/providers/adapters/` - Provider implementations (one per data source)
- `/src/contexts/DataContext.tsx` - Generic data context provider

**Generic Components:**

- `/src/components/Workspace/` - Main UI container
- `/src/components/GanttChart.jsx` - Chart component
- `/src/components/GanttView/GanttView.jsx` - Main Gantt view (partially refactored)

**Utilities:**

- `/src/utils/DataFilters.ts` - Filter logic
- `/src/utils/LinkUtils.ts` - Link utilities
- `/src/utils/MilestoneIdUtils.ts` - Milestone ID handling
- `/src/utils/WorkloadUtils.ts` - Workload grouping

**Configuration:**

- `/src/config/DataSourceConfigManager.ts` - Config management
- `/src/config/DataSourceCredentialManager.ts` - Credential management

### Common Development Tasks

**Adding a test:**

```bash
# Create test file in __tests__ directory next to source
src/components/MyComponent.jsx
src/components/__tests__/MyComponent.test.jsx

# Run tests
npm test  # Watch mode
npm test  # Run once (CI)
```

**Checking test coverage:**

```bash
npm run test:coverage
# Reports in console and coverage/ directory
```

**Fixing failing tests:**

1. Run `npm test` to see failures
2. Read error message carefully
3. Check test file first (often test expectations are wrong)
4. Check source code (fix actual bug if needed)
5. Run `npm test` again to verify

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
