# CSS Color Variable Mapping Document

## Overview

This document maps hardcoded hex color values to CSS variable references for the react-gantt-gitlab theme system.

## Color Categories

### Primary Colors (Brand/Accent)

| Hex Value | CSS Variable                 | Usage                                 |
| --------- | ---------------------------- | ------------------------------------- |
| #1f75cb   | --wx-color-primary           | Primary buttons, links, active states |
| #1a65b3   | --wx-color-primary-hover     | Primary button hover state            |
| #3983eb   | --wx-color-accent-blue       | Accent elements, info states          |
| #37a9ef   | --wx-color-accent-light      | Light blue accents                    |
| #3b82f6   | --wx-color-accent-blue-alt   | Alternative blue accent               |
| #2563eb   | --wx-color-accent-blue-hover | Blue accent hover state               |
| #00ba94   | --wx-color-success           | Success states, task bars             |
| #099f81   | --wx-color-success-hover     | Success hover state                   |
| #dc2626   | --wx-color-danger            | Error messages, delete actions        |
| #ad44ab   | --wx-color-milestone         | Milestone bars                        |
| #d97706   | --wx-color-warning           | Warning states                        |
| #f59e0b   | --wx-color-warning-alt       | Alternative warning color             |
| #a883e4   | --wx-color-purple            | Purple accent elements                |
| #1f6bd9   | --wx-color-info              | Info states                           |

### Background Colors

| Hex Value | CSS Variable                      | Usage                        |
| --------- | --------------------------------- | ---------------------------- |
| #ffffff   | --wx-color-background             | Main background              |
| #fff      | --wx-color-background             | Main background (short)      |
| #f9fafb   | --wx-color-background-secondary   | Secondary background         |
| #f8f9fa   | --wx-color-background-tertiary    | Tertiary background, headers |
| #f5f5f5   | --wx-color-background-muted       | Muted/subtle background      |
| #f3f4f6   | --wx-color-background-gray        | Gray background              |
| #f0f6fa   | --wx-color-background-holiday     | Holiday background in grid   |
| #fef2f2   | --wx-color-background-error       | Error message background     |
| #fef3c7   | --wx-color-background-warning     | Warning message background   |
| #fee2e2   | --wx-color-background-error-light | Light error background       |
| #f8d7da   | --wx-color-background-error-alt   | Alternative error background |
| #dbeafe   | --wx-color-background-info        | Info message background      |
| #fbfbfb   | --wx-color-background-sidebar     | Demo sidebar background      |
| #f7f7f7   | --wx-color-background-hover       | Hover background             |
| #f1f1f1   | --wx-color-background-active      | Active/pressed background    |
| #f9f9f9   | --wx-color-background-light       | Light background             |
| #f0f0f0   | --wx-color-background-neutral     | Neutral background           |
| #fafafa   | --wx-color-background-minimal     | Minimal background           |

### Text/Foreground Colors

| Hex Value | CSS Variable                    | Usage                            |
| --------- | ------------------------------- | -------------------------------- |
| #333333   | --wx-color-text-primary         | Primary text                     |
| #333      | --wx-color-text-primary         | Primary text (short)             |
| #374151   | --wx-color-text-secondary       | Secondary text                   |
| #384047   | --wx-color-text-tertiary        | Tertiary text                    |
| #666666   | --wx-color-text-muted           | Muted text                       |
| #666      | --wx-color-text-muted           | Muted text (short)               |
| #9fa1ae   | --wx-color-text-subtle          | Subtle text, hints               |
| #6b7280   | --wx-color-text-gray            | Gray text                        |
| #9ca3af   | --wx-color-text-light           | Light text                       |
| #d1d5db   | --wx-color-text-lighter         | Very light text                  |
| #ffffff   | --wx-color-text-inverse         | Text on dark backgrounds         |
| #fff      | --wx-color-text-inverse         | Text on dark backgrounds (short) |
| #595b66   | --wx-color-text-sidebar         | Demo sidebar text                |
| #42454d   | --wx-color-text-sidebar-primary | Demo sidebar primary text        |
| #878994   | --wx-color-text-icon            | Icon color                       |
| #999999   | --wx-color-text-placeholder     | Placeholder text                 |
| #999      | --wx-color-text-placeholder     | Placeholder text (short)         |

### Border Colors

| Hex Value | CSS Variable                | Usage                    |
| --------- | --------------------------- | ------------------------ |
| #dddddd   | --wx-color-border           | Default borders          |
| #ddd      | --wx-color-border           | Default borders (short)  |
| #e6e6e6   | --wx-color-border-light     | Light borders            |
| #cccccc   | --wx-color-border-muted     | Muted borders            |
| #ccc      | --wx-color-border-muted     | Muted borders (short)    |
| #e5e7eb   | --wx-color-border-gray      | Gray borders             |
| #e1e4e8   | --wx-color-border-subtle    | Subtle borders           |
| #e0e0e0   | --wx-color-border-light-alt | Alternative light border |
| #ebebeb   | --wx-color-border-sidebar   | Demo sidebar border      |
| #eeeeee   | --wx-color-border-minimal   | Minimal borders          |
| #eee      | --wx-color-border-minimal   | Minimal borders (short)  |
| #d1d5db   | --wx-color-border-input     | Input borders            |
| #c0c3ce   | --wx-color-border-control   | Control borders          |
| #dcdcde   | --wx-color-border-gray-alt  | Alternative gray border  |

### Semantic Colors (Status/States)

| Hex Value | CSS Variable                    | Usage               |
| --------- | ------------------------------- | ------------------- |
| #dc2626   | --wx-color-status-error         | Error/danger state  |
| #b91c1c   | --wx-color-status-error-dark    | Dark error color    |
| #721c24   | --wx-color-status-error-text    | Error text color    |
| #fecaca   | --wx-color-status-error-border  | Error border color  |
| #28a745   | --wx-color-status-success       | Success state       |
| #059669   | --wx-color-status-success-dark  | Dark success color  |
| #10b981   | --wx-color-status-success-alt   | Alternative success |
| #d97706   | --wx-color-status-warning       | Warning state       |
| #b45309   | --wx-color-status-warning-dark  | Dark warning color  |
| #fcd34d   | --wx-color-status-warning-light | Light warning       |
| #3b82f6   | --wx-color-status-info          | Info state          |
| #1d4ed8   | --wx-color-status-info-dark     | Dark info color     |
| #1976d2   | --wx-color-status-info-alt      | Alternative info    |
| #6c5ce7   | --wx-color-status-purple        | Purple status       |
| #a29bfe   | --wx-color-status-purple-light  | Light purple status |

### Chart/Gantt Specific Colors

| Hex Value | CSS Variable               | Usage                       |
| --------- | -------------------------- | --------------------------- |
| #2c2f33   | --wx-gantt-chart-text      | Chart text color            |
| #1d1e26   | --wx-gantt-chart-border    | Chart border                |
| #eaedf5   | --wx-gantt-select-bg       | Selection background        |
| #9fa1ae   | --wx-gantt-link-color      | Link/connection lines       |
| #f0f6fa   | --wx-gantt-holiday-bg      | Holiday background          |
| #c0c3ce   | --wx-gantt-progress-border | Progress bar border         |
| #4f525a   | --wx-gantt-tooltip-bg      | Tooltip background          |
| #e6e6e6   | --wx-gantt-tooltip-text    | Tooltip text                |
| #06bdf8   | --wx-gantt-marker-color    | Today marker (with opacity) |

### Kanban Specific Colors

| Hex Value | CSS Variable             | Usage               |
| --------- | ------------------------ | ------------------- |
| #6b7280   | --wx-kanban-text-muted   | Muted kanban text   |
| #374151   | --wx-kanban-text-primary | Kanban primary text |
| #f9fafb   | --wx-kanban-background   | Kanban background   |
| #e5e7eb   | --wx-kanban-border       | Kanban border       |
| #d1d5db   | --wx-kanban-border-light | Light kanban border |

### Shadow Colors (with alpha)

| Value               | CSS Variable        | Usage         |
| ------------------- | ------------------- | ------------- |
| rgba(0,0,0,0.5)     | --wx-shadow-overlay | Modal overlay |
| rgba(44,47,60,0.06) | --wx-shadow-sm      | Small shadow  |
| rgba(44,47,60,0.12) | --wx-shadow-md      | Medium shadow |
| rgba(0,0,0,0.15)    | --wx-shadow-lg      | Large shadow  |

## Implementation Notes

1. All CSS variables should be defined in the theme files (Willow.css, WillowDark.css)
2. Variables should have fallback values for backwards compatibility
3. Light theme uses the colors as-is, dark theme provides inverted/muted equivalents
4. Semantic colors should remain consistent across themes (e.g., error is always red)
