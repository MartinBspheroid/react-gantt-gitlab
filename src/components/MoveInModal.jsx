/**
 * MoveInModal Component
 * Modal for moving selected tasks/issues to a different parent (Issue, Milestone, or Epic)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import './MoveInModal.css';

/**
 * @typedef {'parent' | 'milestone' | 'epic'} MoveType
 */

/**
 * MoveInModal - Batch move selected items to a target
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {() => void} props.onClose - Close callback
 * @param {Array} props.selectedTasks - Currently selected tasks
 * @param {Array} props.allTasks - All tasks (for finding available parents and milestones)
 * @param {Array} props.epics - Available epics
 * @param {(type: MoveType, targetId: number|string|null, items: Array) => Promise<void>} props.onMove - Move callback
 * @param {boolean} props.isProcessing - Whether a move operation is in progress
 */
export function MoveInModal({
  isOpen,
  onClose,
  selectedTasks = [],
  allTasks = [],
  epics = [],
  onMove,
  isProcessing = false,
}) {
  // Tab state: 'parent' | 'milestone' | 'epic'
  const [activeTab, setActiveTab] = useState(null);

  // Selected target for each tab
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [selectedEpic, setSelectedEpic] = useState(null);

  // Search terms for each tab
  const [parentSearch, setParentSearch] = useState('');
  const [milestoneSearch, setMilestoneSearch] = useState('');
  const [epicSearch, setEpicSearch] = useState('');

  // Extract milestones from allTasks (milestones are tasks with _gitlab.type === 'milestone')
  const milestones = useMemo(() => {
    return allTasks
      .filter((task) => task._gitlab?.type === 'milestone')
      .map((task) => ({
        // Convert task to milestone-like object for display
        // Note: Milestone task's _gitlab.id is the milestone iid (not milestoneIid which is for Issue/Task)
        iid: task._gitlab?.id,
        title: task.text,
        globalId: task._gitlab?.globalId,
      }));
  }, [allTasks]);

  // Filter tasks that can be moved to a parent Issue (only Tasks can have Issue parents)
  const tasksMovableToParent = useMemo(() => {
    return selectedTasks.filter((task) => task._gitlab?.workItemType === 'Task');
  }, [selectedTasks]);

  // Filter tasks that can be moved to a Milestone (both Issues and Tasks)
  const tasksMovableToMilestone = useMemo(() => {
    // All selected items can be moved to milestone
    return selectedTasks;
  }, [selectedTasks]);

  // Filter tasks that can be moved to an Epic (only Issues, not Tasks)
  const tasksMovableToEpic = useMemo(() => {
    return selectedTasks.filter((task) => task._gitlab?.workItemType !== 'Task');
  }, [selectedTasks]);

  // Get available parent Issues (exclude selected tasks, milestones, and Tasks)
  // Note: Only Issues can be parents for Tasks (GitLab hierarchy rule)
  const availableParentIssues = useMemo(() => {
    const selectedIds = new Set(selectedTasks.map((t) => t.id));
    return allTasks.filter((task) => {
      // Must be an Issue (not a Task, not a Milestone)
      // Use _gitlab metadata to determine type - NEVER use ID ranges
      if (task._gitlab?.workItemType === 'Task') return false;
      if (task._gitlab?.type === 'milestone') return false;
      // Must not be in the selection
      if (selectedIds.has(task.id)) return false;
      return true;
    });
  }, [allTasks, selectedTasks]);

  // Filter parent issues by search
  const filteredParentIssues = useMemo(() => {
    if (!parentSearch.trim()) return availableParentIssues;
    const searchLower = parentSearch.toLowerCase();
    return availableParentIssues.filter(
      (task) =>
        task.text.toLowerCase().includes(searchLower) ||
        String(task.id).includes(searchLower)
    );
  }, [availableParentIssues, parentSearch]);

  // Filter milestones by search
  const filteredMilestones = useMemo(() => {
    if (!milestoneSearch.trim()) return milestones;
    const searchLower = milestoneSearch.toLowerCase();
    return milestones.filter((m) => m.title.toLowerCase().includes(searchLower));
  }, [milestones, milestoneSearch]);

  // Filter epics by search
  const filteredEpics = useMemo(() => {
    if (!epicSearch.trim()) return epics;
    const searchLower = epicSearch.toLowerCase();
    return epics.filter((e) => e.title.toLowerCase().includes(searchLower));
  }, [epics, epicSearch]);

  // Check if there are any movable items at all
  const hasAnyMovableItems = useMemo(() => {
    return (
      tasksMovableToParent.length > 0 ||
      tasksMovableToMilestone.length > 0 ||
      (epics.length > 0 && tasksMovableToEpic.length > 0)
    );
  }, [tasksMovableToParent.length, tasksMovableToMilestone.length, tasksMovableToEpic.length, epics.length]);

  // Set default tab when modal opens - select based on selection content
  useEffect(() => {
    if (isOpen && activeTab === null) {
      // If only Tasks are selected (no Issues), default to "To Issue" tab
      // Otherwise default to "To Milestone" which is most commonly used
      const hasOnlyTasks =
        tasksMovableToParent.length > 0 && tasksMovableToEpic.length === 0;

      if (hasOnlyTasks) {
        // Only Tasks selected - default to "To Issue"
        setActiveTab('parent');
      } else if (tasksMovableToMilestone.length > 0) {
        // Has Issues - default to "To Milestone"
        setActiveTab('milestone');
      } else if (tasksMovableToParent.length > 0) {
        setActiveTab('parent');
      } else if (epics.length > 0 && tasksMovableToEpic.length > 0) {
        setActiveTab('epic');
      }
    }
  }, [isOpen, activeTab, tasksMovableToMilestone.length, tasksMovableToParent.length, tasksMovableToEpic.length, epics.length]);

  // Reset activeTab when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab(null);
    }
  }, [isOpen]);

  // Get current tab's movable items count
  const getCurrentMovableCount = () => {
    switch (activeTab) {
      case 'parent':
        return tasksMovableToParent.length;
      case 'milestone':
        return tasksMovableToMilestone.length;
      case 'epic':
        return tasksMovableToEpic.length;
      default:
        return 0;
    }
  };

  // Get current selection based on active tab
  const getCurrentSelection = () => {
    switch (activeTab) {
      case 'parent':
        return selectedParent;
      case 'milestone':
        return selectedMilestone;
      case 'epic':
        return selectedEpic;
      default:
        return null;
    }
  };

  // Handle move action
  const handleMove = useCallback(async () => {
    let items;
    let targetId;

    switch (activeTab) {
      case 'parent':
        items = tasksMovableToParent;
        targetId = selectedParent; // Issue iid or null
        break;
      case 'milestone':
        items = tasksMovableToMilestone;
        targetId = selectedMilestone; // Milestone iid or null
        break;
      case 'epic':
        items = tasksMovableToEpic;
        targetId = selectedEpic; // Epic iid or null
        break;
      default:
        return;
    }

    if (items.length === 0) return;

    try {
      await onMove(activeTab, targetId, items);
      // Reset selections and close modal on success
      setSelectedParent(null);
      setSelectedMilestone(null);
      setSelectedEpic(null);
      onClose();
    } catch {
      // Error handling is done in parent component (GitLabGantt)
    }
  }, [
    activeTab,
    tasksMovableToParent,
    tasksMovableToMilestone,
    tasksMovableToEpic,
    selectedParent,
    selectedMilestone,
    selectedEpic,
    onMove,
    onClose,
  ]);

  // Get display text for selected target
  const getSelectedTargetText = () => {
    switch (activeTab) {
      case 'parent':
        if (selectedParent === null) return 'None (Remove Parent)';
        const parentTask = availableParentIssues.find((t) => t.id === selectedParent);
        return parentTask ? `#${parentTask.id} ${parentTask.text}` : '';
      case 'milestone':
        if (selectedMilestone === null) return 'None (Remove Milestone)';
        const milestone = milestones.find((m) => m.iid === selectedMilestone);
        return milestone ? milestone.title : '';
      case 'epic':
        if (selectedEpic === null) return 'None (Remove Epic)';
        const epic = epics.find((e) => e.iid === selectedEpic);
        return epic ? epic.title : '';
      default:
        return '';
    }
  };

  // Reset state when modal closes
  const handleClose = () => {
    setSelectedParent(null);
    setSelectedMilestone(null);
    setSelectedEpic(null);
    setParentSearch('');
    setMilestoneSearch('');
    setEpicSearch('');
    onClose();
  };

  if (!isOpen) return null;

  const hasEpics = epics && epics.length > 0;

  // Handle case when no items can be moved
  if (!hasAnyMovableItems) {
    return (
      <div className="move-in-modal-overlay" onClick={handleClose}>
        <div className="move-in-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Move In...</h3>
            <button className="modal-close" onClick={handleClose}>
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body">
            <div className="move-in-empty-state">
              <i className="fas fa-info-circle" />
              <p>No items can be moved.</p>
              <p className="move-in-empty-hint">
                Select Tasks to move to an Issue, or Issues to move to a Milestone or Epic.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <div className="selected-summary" />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="move-in-modal-overlay" onClick={handleClose}>
      <div className="move-in-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Move In...</h3>
          <button className="modal-close" onClick={handleClose}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="modal-body">
          {/* Tab Navigation */}
          <div className="move-in-tabs">
            <button
              className={`move-in-tab ${activeTab === 'parent' ? 'active' : ''}`}
              onClick={() => setActiveTab('parent')}
              disabled={tasksMovableToParent.length === 0}
            >
              To Issue
              {tasksMovableToParent.length > 0 && (
                <span className="tab-badge">{tasksMovableToParent.length}</span>
              )}
            </button>
            <button
              className={`move-in-tab ${activeTab === 'milestone' ? 'active' : ''}`}
              onClick={() => setActiveTab('milestone')}
              disabled={tasksMovableToMilestone.length === 0}
            >
              To Milestone
              {tasksMovableToMilestone.length > 0 && (
                <span className="tab-badge">{tasksMovableToMilestone.length}</span>
              )}
            </button>
            {hasEpics && (
              <button
                className={`move-in-tab ${activeTab === 'epic' ? 'active' : ''}`}
                onClick={() => setActiveTab('epic')}
                disabled={tasksMovableToEpic.length === 0}
              >
                To Epic
                {tasksMovableToEpic.length > 0 && (
                  <span className="tab-badge">{tasksMovableToEpic.length}</span>
                )}
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="move-in-tab-content">
            {/* To Issue (Parent) Tab */}
            {activeTab === 'parent' && (
              <div className="move-in-section">
                <div className="section-description">
                  Move {tasksMovableToParent.length} Task(s) to an Issue as children
                </div>

                {/* Search */}
                <div className="target-search">
                  <input
                    type="text"
                    value={parentSearch}
                    onChange={(e) => setParentSearch(e.target.value)}
                    placeholder="Search issues..."
                    className="target-search-input"
                  />
                </div>

                {/* Options */}
                <div className="target-options">
                  {/* None option */}
                  <label
                    className={`target-option ${selectedParent === null ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="parent-target"
                      checked={selectedParent === null}
                      onChange={() => setSelectedParent(null)}
                    />
                    <span className="target-option-text">
                      <span className="target-none">None (Remove Parent)</span>
                    </span>
                  </label>

                  {filteredParentIssues.map((task) => (
                    <label
                      key={task.id}
                      className={`target-option ${selectedParent === task.id ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="parent-target"
                        checked={selectedParent === task.id}
                        onChange={() => setSelectedParent(task.id)}
                      />
                      <span className="target-option-text">
                        <span className="target-id">#{task.id}</span>
                        <span className="target-title">{task.text}</span>
                      </span>
                    </label>
                  ))}

                  {filteredParentIssues.length === 0 && parentSearch && (
                    <div className="target-empty">No matching issues</div>
                  )}
                </div>
              </div>
            )}

            {/* To Milestone Tab */}
            {activeTab === 'milestone' && (
              <div className="move-in-section">
                <div className="section-description">
                  Move {tasksMovableToMilestone.length} item(s) to a Milestone
                </div>

                {/* Search */}
                <div className="target-search">
                  <input
                    type="text"
                    value={milestoneSearch}
                    onChange={(e) => setMilestoneSearch(e.target.value)}
                    placeholder="Search milestones..."
                    className="target-search-input"
                  />
                </div>

                {/* Options */}
                <div className="target-options">
                  {/* None option */}
                  <label
                    className={`target-option ${selectedMilestone === null ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="milestone-target"
                      checked={selectedMilestone === null}
                      onChange={() => setSelectedMilestone(null)}
                    />
                    <span className="target-option-text">
                      <span className="target-none">None (Remove Milestone)</span>
                    </span>
                  </label>

                  {filteredMilestones.map((milestone) => (
                    <label
                      key={milestone.iid}
                      className={`target-option ${selectedMilestone === milestone.iid ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="milestone-target"
                        checked={selectedMilestone === milestone.iid}
                        onChange={() => setSelectedMilestone(milestone.iid)}
                      />
                      <span className="target-option-text">
                        <span className="target-title">{milestone.title}</span>
                      </span>
                    </label>
                  ))}

                  {filteredMilestones.length === 0 && milestoneSearch && (
                    <div className="target-empty">No matching milestones</div>
                  )}

                  {milestones.length === 0 && !milestoneSearch && (
                    <div className="target-empty">No milestones available</div>
                  )}
                </div>
              </div>
            )}

            {/* To Epic Tab */}
            {activeTab === 'epic' && hasEpics && (
              <div className="move-in-section">
                <div className="section-description">
                  Move {tasksMovableToEpic.length} Issue(s) to an Epic
                </div>

                {/* Search */}
                <div className="target-search">
                  <input
                    type="text"
                    value={epicSearch}
                    onChange={(e) => setEpicSearch(e.target.value)}
                    placeholder="Search epics..."
                    className="target-search-input"
                  />
                </div>

                {/* Options */}
                <div className="target-options">
                  {/* None option */}
                  <label
                    className={`target-option ${selectedEpic === null ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="epic-target"
                      checked={selectedEpic === null}
                      onChange={() => setSelectedEpic(null)}
                    />
                    <span className="target-option-text">
                      <span className="target-none">None (Remove Epic)</span>
                    </span>
                  </label>

                  {filteredEpics.map((epic) => (
                    <label
                      key={epic.iid}
                      className={`target-option ${selectedEpic === epic.iid ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="epic-target"
                        checked={selectedEpic === epic.iid}
                        onChange={() => setSelectedEpic(epic.iid)}
                      />
                      <span className="target-option-text">
                        <span className="target-title">{epic.title}</span>
                      </span>
                    </label>
                  ))}

                  {filteredEpics.length === 0 && epicSearch && (
                    <div className="target-empty">No matching epics</div>
                  )}
                </div>
              </div>
            )}

            {/* Items Preview */}
            <div className="items-preview">
              <div className="items-preview-header">
                Items to move ({getCurrentMovableCount()})
              </div>
              <div className="items-preview-list">
                {activeTab === 'parent' &&
                  tasksMovableToParent.map((task) => (
                    <div key={task.id} className="preview-item">
                      <span className="preview-item-id">#{task.id}</span>
                      <span className="preview-item-title">{task.text}</span>
                    </div>
                  ))}
                {activeTab === 'milestone' &&
                  tasksMovableToMilestone.map((task) => (
                    <div key={task.id} className="preview-item">
                      <span className="preview-item-id">#{task.id}</span>
                      <span className="preview-item-title">{task.text}</span>
                    </div>
                  ))}
                {activeTab === 'epic' &&
                  tasksMovableToEpic.map((task) => (
                    <div key={task.id} className="preview-item">
                      <span className="preview-item-id">#{task.id}</span>
                      <span className="preview-item-title">{task.text}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="selected-summary">
            {getCurrentSelection() !== undefined && (
              <span>Target: {getSelectedTargetText()}</span>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={handleClose} disabled={isProcessing}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleMove}
              disabled={isProcessing || getCurrentMovableCount() === 0}
            >
              {isProcessing ? 'Moving...' : `Move ${getCurrentMovableCount()} item(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MoveInModal;
