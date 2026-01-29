/**
 * ProjectBrowser Component
 * Tree-style browser component for selecting GitLab projects/groups.
 * Fetches accessible projects and groups from GitLab API and displays
 * them in a hierarchical tree structure.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchAccessibleProjects,
  fetchAccessibleGroups,
  buildProjectTree,
  filterTree,
} from '../providers/GitLabProjectsApi';

/**
 * Tree node item component for recursive rendering
 * @param {Object} props
 * @param {import('../providers/GitLabProjectsApi').TreeNode} props.node - Tree node data
 * @param {number} props.depth - Current nesting depth
 * @param {'project' | 'group'} props.selectableType - What type can be selected
 * @param {string|null} props.selectedId - Currently selected item ID
 * @param {Set<string>} props.expandedGroups - Set of expanded group IDs
 * @param {(id: string) => void} props.onToggleExpand - Toggle group expansion
 * @param {(node: import('../providers/GitLabProjectsApi').TreeNode) => void} props.onSelect - Selection callback
 */
function TreeNodeItem({
  node,
  depth,
  selectableType,
  selectedId,
  expandedGroups,
  onToggleExpand,
  onSelect,
}) {
  const isGroup = node.type === 'group';
  const isExpanded = expandedGroups.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isSelectable = node.type === selectableType;
  const isSelected = node.id === selectedId;

  const handleClick = () => {
    if (isGroup && hasChildren) {
      onToggleExpand(node.id);
    }
    if (isSelectable) {
      onSelect(node);
    }
  };

  const indentPx = depth * 20;

  return (
    <>
      <div
        className={`pb-tree-item ${isSelectable ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${indentPx + 8}px` }}
        onClick={handleClick}
        title={node.fullPath}
      >
        {/* Expand/collapse icon for groups with children */}
        <span className="pb-tree-icon">
          {isGroup && hasChildren ? (
            <span className="pb-expand-icon">{isExpanded ? '\u25BC' : '\u25B6'}</span>
          ) : (
            <span className="pb-expand-placeholder" />
          )}
        </span>

        {/* Type icon */}
        <span className="pb-type-icon">{isGroup ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>

        {/* Name */}
        <span className="pb-item-name">{node.name}</span>

        {/* Folder hint when selecting projects */}
        {isGroup && selectableType === 'project' && (
          <span className="pb-folder-hint">(folder)</span>
        )}
      </div>

      {/* Render children if expanded */}
      {isGroup && isExpanded && hasChildren && (
        <div className="pb-tree-children">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectableType={selectableType}
              selectedId={selectedId}
              expandedGroups={expandedGroups}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * ProjectBrowser Component
 * A tree-style browser for selecting GitLab projects or groups.
 *
 * @param {Object} props
 * @param {{ gitlabUrl: string, token: string }} props.proxyConfig - GitLab connection config
 * @param {'project' | 'group'} props.type - What can be selected (project or group)
 * @param {(item: { id: number, name: string, fullPath: string, type: 'project' | 'group' }) => void} props.onSelect - Selection callback
 * @param {string|null} [props.selectedId] - Currently selected item ID (format: "project-123" or "group-456")
 */
export function ProjectBrowser({ proxyConfig, type, onSelect, selectedId = null }) {
  // Data states
  const [projects, setProjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Loading progress state for better UX
  const [loadingStatus, setLoadingStatus] = useState('');

  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Load projects and groups on mount or when proxyConfig changes
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line no-undef -- AbortController is available in browser environment
    const controller = new AbortController();
    const signal = controller.signal;

    async function loadData() {
      if (!proxyConfig?.gitlabUrl || !proxyConfig?.token) {
        setError('Missing GitLab connection settings');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setLoadingStatus('Loading...');

      try {
        // Parallel fetch for both groups and projects (when needed)
        // This significantly speeds up loading compared to sequential requests
        if (type === 'project') {
          setLoadingStatus('Loading groups and projects...');

          // Fetch both in parallel
          const [groupsData, projectsData] = await Promise.all([
            fetchAccessibleGroups(proxyConfig, { signal: signal }),
            fetchAccessibleProjects(proxyConfig, { signal: signal }),
          ]);

          if (cancelled) return;
          setGroups(groupsData);
          setProjects(projectsData);
          setLoadingStatus(`Loaded ${projectsData.length} projects, ${groupsData.length} groups`);
        } else {
          // Group selection mode - only need groups
          setLoadingStatus('Loading groups...');
          const groupsData = await fetchAccessibleGroups(proxyConfig, { signal: signal });

          if (cancelled) return;
          setGroups(groupsData);
          setLoadingStatus(`Loaded ${groupsData.length} groups`);
        }

        if (!cancelled) {
          setLoading(false);
          setLoadingStatus('');
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load');
          setLoading(false);
          setLoadingStatus('');
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [proxyConfig?.gitlabUrl, proxyConfig?.token, type]);

  // Build and filter tree
  const tree = useMemo(() => {
    const fullTree = buildProjectTree(projects, groups);
    return filterTree(fullTree, searchQuery);
  }, [projects, groups, searchQuery]);

  // Toggle group expansion
  const handleToggleExpand = useCallback((groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Handle item selection
  const handleSelect = useCallback(
    (node) => {
      // Extract numeric ID from node.id (format: "project-123" or "group-456")
      const numericId = parseInt(node.id.split('-')[1], 10);

      onSelect({
        id: numericId,
        name: node.name,
        fullPath: node.fullPath,
        type: node.type,
      });
    },
    [onSelect]
  );

  // Auto-expand groups when search query is present
  useEffect(() => {
    if (searchQuery.trim()) {
      // Expand all groups in filtered tree
      const collectGroupIds = (nodes) => {
        const ids = [];
        for (const node of nodes) {
          if (node.type === 'group') {
            ids.push(node.id);
            if (node.children && node.children.length > 0) {
              ids.push(...collectGroupIds(node.children));
            }
          }
        }
        return ids;
      };
      const groupIds = collectGroupIds(tree);
      setExpandedGroups(new Set(groupIds));
    }
  }, [searchQuery, tree]);

  // Determine if tree is empty
  const isEmpty = !loading && !error && tree.length === 0;
  const noData = !loading && !error && projects.length === 0 && groups.length === 0;

  return (
    <div className="project-browser">
      {/* Search input */}
      <div className="pb-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Project/Group..."
          className="pb-search-input"
        />
        {searchQuery && (
          <button
            className="pb-search-clear"
            onClick={() => setSearchQuery('')}
            title="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      {/* Tree container */}
      <div className="pb-tree-container">
        {loading && (
          <div className="pb-status pb-loading">
            <div className="pb-loading-spinner"></div>
            <span>{loadingStatus || 'Loading...'}</span>
          </div>
        )}

        {error && <div className="pb-status pb-error">{error}</div>}

        {noData && <div className="pb-status">No accessible items</div>}

        {!loading && !error && !noData && isEmpty && (
          <div className="pb-status">No matching items found</div>
        )}

        {!loading && !error && tree.length > 0 && (
          <div className="pb-tree">
            {tree.map((node) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                depth={0}
                selectableType={type}
                selectedId={selectedId}
                expandedGroups={expandedGroups}
                onToggleExpand={handleToggleExpand}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .project-browser {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--wx-gitlab-filter-input-border, #dcdcde);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background, #fff);
          overflow: hidden;
        }

        .pb-search {
          position: relative;
          padding: 8px;
          border-bottom: 1px solid var(--wx-gitlab-filter-input-border, #dcdcde);
        }

        .pb-search-input {
          width: 100%;
          padding: 6px 28px 6px 10px;
          border: 1px solid var(--wx-gitlab-filter-input-border, #dcdcde);
          border-radius: 4px;
          background: var(--wx-gitlab-filter-input-background, #fff);
          color: var(--wx-gitlab-filter-text, #303030);
          font-size: 13px;
          box-sizing: border-box;
        }

        .pb-search-input:focus {
          outline: none;
          border-color: #1f75cb;
        }

        .pb-search-input::placeholder {
          color: var(--wx-gitlab-control-text, #868686);
        }

        .pb-search-clear {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--wx-gitlab-control-text, #868686);
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 2px 4px;
        }

        .pb-search-clear:hover {
          color: var(--wx-gitlab-filter-text, #303030);
        }

        .pb-tree-container {
          max-height: 300px;
          overflow-y: auto;
        }

        .pb-tree-container::-webkit-scrollbar {
          width: 6px;
        }

        .pb-tree-container::-webkit-scrollbar-track {
          background: var(--wx-gitlab-filter-hover-background, #f0f0f0);
        }

        .pb-tree-container::-webkit-scrollbar-thumb {
          background: var(--wx-gitlab-control-text, #868686);
          border-radius: 3px;
        }

        .pb-status {
          padding: 20px;
          text-align: center;
          color: var(--wx-gitlab-control-text, #868686);
          font-size: 13px;
        }

        .pb-status.pb-error {
          color: #dc3545;
        }

        .pb-tree {
          padding: 4px 0;
        }

        .pb-tree-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          cursor: default;
          font-size: 13px;
          color: var(--wx-gitlab-filter-text, #303030);
          transition: background 0.1s;
          user-select: none;
        }

        .pb-tree-item.selectable {
          cursor: pointer;
        }

        .pb-tree-item.selectable:hover {
          background: var(--wx-gitlab-filter-hover-background, #f0f0f0);
        }

        .pb-tree-item.selected {
          background: rgba(31, 117, 203, 0.15);
        }

        .pb-tree-item.selected:hover {
          background: rgba(31, 117, 203, 0.2);
        }

        .pb-tree-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          flex-shrink: 0;
        }

        .pb-expand-icon {
          font-size: 8px;
          color: var(--wx-gitlab-control-text, #868686);
        }

        .pb-expand-placeholder {
          width: 8px;
        }

        .pb-type-icon {
          flex-shrink: 0;
          font-size: 14px;
        }

        .pb-item-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pb-folder-hint {
          flex-shrink: 0;
          font-size: 11px;
          color: var(--wx-gitlab-control-text, #868686);
          font-style: italic;
        }

        .pb-tree-children {
          /* Children container for semantic grouping */
        }

        /* Loading status with spinner */
        .pb-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .pb-loading-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid var(--wx-gitlab-filter-input-border, #dcdcdc);
          border-top-color: #1f75cb;
          border-radius: 50%;
          animation: pb-spin 0.8s linear infinite;
        }

        @keyframes pb-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default ProjectBrowser;
