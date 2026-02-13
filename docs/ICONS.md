# Icon System Guidelines

This project uses a standardized icon system that supports three icon libraries with clear guidelines for when to use each.

## Overview

The icon system is centralized in `/src/components/common/Icon.tsx` which provides:
- A unified `Icon` component that works with all three icon systems
- Convenience components (`SvarIcon`, `FontAwesomeIcon`) for common use cases
- Predefined icon configurations for consistency
- TypeScript support for type safety

## Icon Systems

### 1. SVAR Icons (`type="svar"`)

**Prefix**: `wxi-*`  
**Source**: @svar-ui library  
**Use for**: UI controls, toolbar buttons, navigation, grid actions

**When to use:**
- Toolbar buttons and actions
- Editor controls (close, delete, save)
- Grid actions (expand/collapse, add row)
- Navigation elements (menu arrows, expand/collapse)
- Resizer controls
- Any component integrated with @svar-ui

**Examples:**
```jsx
import { Icon, SvarIcon } from '../common/Icon';

// Using Icon component
<Icon type="svar" name="plus" />
<Icon type="svar" name="close" onClick={handleClose} />

// Using convenience component
<SvarIcon name="delete" />

// Direct usage (for @svar-ui integration)
<i className="wxi-plus" />
<i className="wxi-close" />
```

**Common SVAR icons:**
- `wxi-plus` - Add/Create
- `wxi-close` - Close/Dismiss
- `wxi-delete` - Delete/Remove
- `wxi-folder` - Folder/Group
- `wxi-split` - Split action
- `wxi-expand` / `wxi-collapse` - Expand/Collapse
- `wxi-menu-left` / `wxi-menu-right` / `wxi-menu-down` - Navigation arrows

### 2. Font Awesome (`type="fontawesome"`)

**Prefix**: `fa-*`, `fa-solid fa-*`, `far fa-*`  
**Source**: @fortawesome/fontawesome-free  
**Use for**: Work item types, semantic icons, feature indicators

**When to use:**
- Work item type icons (bug, task, feature, epic, user story)
- Semantic icons that convey meaning
- Icons matching external systems (Azure DevOps, GitLab)
- Status indicators

**Examples:**
```jsx
import { Icon, FontAwesomeIcon } from '../common/Icon';

// Using Icon component
<Icon type="fontawesome" name="fa-solid fa-bug" color="#dc3545" />

// Using convenience component
<FontAwesomeIcon name="fa-solid fa-check" />

// Direct usage (when already imported)
<i className="fa-solid fa-star" />
<i className="far fa-flag" />
```

**Common Font Awesome icons:**
- `fa-solid fa-bug` - Bug
- `fa-solid fa-check` / `fa-solid fa-check-square` - Task
- `fa-solid fa-book` - User Story
- `fa-solid fa-star` - Feature
- `fa-solid fa-mountain` - Epic
- `far fa-flag` - Milestone
- `far fa-clipboard` - Issue
- `fa-solid fa-sync` - Sync/Refresh

**Note**: Font Awesome CSS is imported in components that use it:
```jsx
import '@fortawesome/fontawesome-free/css/all.min.css';
```

### 3. Inline SVG (`type="svg"`)

**Use for**: Custom icons, brand icons, complex graphics not available in other systems

**When to use:**
- Icons not available in SVAR or Font Awesome
- Brand logos (GitHub, etc.)
- Complex icons requiring precise control
- Icons with custom animations
- One-off custom icons

**Examples:**
```jsx
import { Icon } from '../common/Icon';

<Icon 
  type="svg" 
  svg={
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41..." fill="currentColor" />
    </svg>
  }
  size={16}
/>
```

## Decision Tree

```
Need an icon?
├── Is it a UI control/button/action?
│   └── Use SVAR Icons (wxi-*)
├── Is it a work item type or semantic icon?
│   └── Use Font Awesome (fa-*)
└── Is it custom/brand/complex?
    └── Use Inline SVG
```

## Migration Guide

### From inline SVG to Icon component

**Before:**
```jsx
<svg viewBox="0 0 24 24" width="16" height="16">
  <path d="M19 6.41L17.59 5..." fill="currentColor" />
</svg>
```

**After:**
```jsx
import { Icon } from '../common/Icon';
import { CloseIcon } from '../common/icons'; // If extracted to reusable component

<Icon type="svar" name="close" size={16} />
// Or if no SVAR equivalent:
<Icon type="svg" svg={<CloseIcon />} size={16} />
```

### From raw wxi-* classes to Icon component

**Before:**
```jsx
<i className="wxi-plus" onClick={handleAdd} />
```

**After:**
```jsx
import { Icon } from '../common/Icon';

<Icon type="svar" name="plus" onClick={handleAdd} />
```

### From raw Font Awesome classes to Icon component

**Before:**
```jsx
<i className="fa-solid fa-bug" style={{ color: '#dc3545' }} />
```

**After:**
```jsx
import { Icon } from '../common/Icon';

<Icon type="fontawesome" name="fa-solid fa-bug" color="#dc3545" />
```

## Current Icon Usage Audit

| Component | Icon System | Icon(s) Used |
|-----------|-------------|--------------|
| `Toolbar.jsx` | SVAR | wxi-plus |
| `Editor.jsx` | SVAR | wxi-close |
| `Resizer.jsx` | SVAR | wxi-menu-left, wxi-menu-right |
| `Fullscreen.jsx` | SVAR | wxi-expand, wxi-collapse |
| `TextCell.jsx` | SVAR | wxi-menu-down, wxi-menu-right |
| `ActionCell.jsx` | SVAR | wxi-plus |
| `Links.jsx` | SVAR | wxi-delete |
| `GanttView.jsx` | SVAR | wxi-folder, wxi-split |
| `WorkItemTypeIcons.tsx` | Font Awesome | fa-solid fa-bug, fa-check, etc. |
| `SmartTaskContent.jsx` | Font Awesome | (via WorkItemTypeIcons) |
| `DrawBarConfirmDialog.jsx` | Inline SVG | Close icon |
| `SyncButton.jsx` | Inline SVG | Sync icon |

## Best Practices

1. **Use the Icon component** for new code to ensure consistency
2. **Import Font Awesome CSS** in the top-level component if using FA icons
3. **Prefer SVAR for UI controls** since they're already integrated with @svar-ui
4. **Keep existing raw usage** in stable components unless refactoring
5. **Use semantic naming** - prefer descriptive names over generic ones
6. **Specify size explicitly** when using SVG icons for consistency
7. **Add aria-label** for interactive icons (buttons, clickable icons)

## File Structure

```
src/
├── components/
│   └── common/
│       └── Icon.tsx          # Main Icon component
├── widgets/
│   └── IconButton.jsx        # Icon button wrapper
└── utils/
    └── WorkItemTypeIcons.tsx # Font Awesome work item icons
```

## Adding New Icons

### To add a new SVAR icon:
1. Check if it exists in @svar-ui documentation
2. Add to `icons.svar` object in Icon.tsx
3. Use via `<Icon type="svar" name="new-icon" />`

### To add a new Font Awesome icon:
1. Check Font Awesome Free documentation
2. Add to `icons.fontawesome` object in Icon.tsx
3. Ensure CSS is imported in the component

### To add a new SVG icon:
1. Create the SVG component in `src/components/common/icons/`
2. Export it from `src/components/common/icons/index.ts`
3. Use via `<Icon type="svg" svg={<NewIcon />} />`
