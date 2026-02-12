import React from 'react';

const ADO_TYPE_ICONS_EMOJI = {
  'user story': { icon: '📖', color: '#3983eb' },
  bug: { icon: '🐛', color: '#dc3545' },
  task: { icon: '✓', color: '#00ba94' },
  feature: { icon: '⭐', color: '#fd7e14' },
  epic: { icon: '🏔️', color: '#6f42c1' },
};

const ADO_TYPE_ICONS_FA = {
  'user story': { icon: 'fa-solid fa-book', color: '#3983eb' },
  bug: { icon: 'fa-solid fa-bug', color: '#dc3545' },
  task: { icon: 'fa-solid fa-check', color: '#00ba94' },
  feature: { icon: 'fa-solid fa-star', color: '#fd7e14' },
  epic: { icon: 'fa-solid fa-mountain', color: '#6f42c1' },
};

const GITLAB_TYPE_ICONS_EMOJI = {
  milestone: { icon: '🚩', color: '#ad44ab' },
  task: { icon: '✓', color: '#00ba94' },
  issue: { icon: '📋', color: '#3983eb' },
};

const GITLAB_TYPE_ICONS_FA = {
  milestone: { icon: 'far fa-flag', color: '#ad44ab' },
  task: { icon: 'far fa-square-check', color: '#00ba94' },
  issue: { icon: 'far fa-clipboard', color: '#3983eb' },
};

export function getWorkItemIconConfig(task, mode = 'fontawesome') {
  const isMilestone = task.$isMilestone || task.type === 'milestone';

  if (task._ado?.workItemType) {
    const adoType = task._ado.workItemType.toLowerCase();
    const icons = mode === 'emoji' ? ADO_TYPE_ICONS_EMOJI : ADO_TYPE_ICONS_FA;
    return icons[adoType] || { icon: '📌', color: '#6c757d' };
  }

  if (task._gitlab || isMilestone) {
    const icons =
      mode === 'emoji' ? GITLAB_TYPE_ICONS_EMOJI : GITLAB_TYPE_ICONS_FA;

    if (isMilestone || task._gitlab?.type === 'milestone') {
      return icons.milestone;
    }

    if (task._gitlab?.workItemType === 'Task') {
      return icons.task;
    }

    return icons.issue;
  }

  if (task.workItemType) {
    const type = task.workItemType.toLowerCase();
    const icons = mode === 'emoji' ? ADO_TYPE_ICONS_EMOJI : ADO_TYPE_ICONS_FA;
    return icons[type] || null;
  }

  return null;
}

export function renderWorkItemIcon(task, mode = 'fontawesome') {
  const config = getWorkItemIconConfig(task, mode);
  if (!config) return null;

  if (mode === 'emoji' || typeof config.icon === 'string') {
    if (
      config.icon.startsWith('fa-') ||
      config.icon.startsWith('far ') ||
      config.icon.startsWith('fa-solid ')
    ) {
      return (
        <i
          className={config.icon}
          style={{ color: config.color }}
          aria-hidden="true"
        />
      );
    }
    return (
      <span style={{ color: config.color }} aria-hidden="true">
        {config.icon}
      </span>
    );
  }

  return config.icon;
}
