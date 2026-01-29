/**
 * GitLab Projects/Groups API
 * Provides functions to fetch user's accessible projects and groups,
 * and build hierarchical tree structures for navigation.
 *
 * This module is designed for the project/group selection UI in the
 * shared credentials feature.
 */

import {
  gitlabRestRequestPaginated,
  type GitLabProxyConfig,
} from './GitLabApiUtils';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * GitLab namespace information
 * Namespaces represent either a user or a group that owns projects
 */
export interface GitLabNamespace {
  id: number;
  name: string;
  path: string;
  kind: 'user' | 'group';
  full_path: string;
  parent_id: number | null;
  avatar_url: string | null;
  web_url: string;
}

/**
 * GitLab project information with extended fields
 * Used for project selection and display
 */
export interface GitLabProjectInfo {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  namespace: GitLabNamespace;
  description: string | null;
  avatar_url: string | null;
  web_url: string;
  last_activity_at: string;
}

/**
 * GitLab group information with extended fields
 * Used for group selection and display
 */
export interface GitLabGroupInfo {
  id: number;
  name: string;
  path: string;
  full_path: string;
  description: string | null;
  avatar_url: string | null;
  web_url: string;
  parent_id: number | null;
}

/**
 * Tree node for hierarchical project/group display
 * Used in the project selector UI component
 */
export interface TreeNode {
  id: string;
  name: string;
  type: 'group' | 'project';
  path: string;
  fullPath: string;
  children: TreeNode[];
  /** Original data from GitLab API */
  data: GitLabProjectInfo | GitLabGroupInfo;
}

// ============================================================================
// Fetch Options
// ============================================================================

export interface FetchProjectsOptions {
  /** Search term to filter projects by name */
  search?: string;
  /** Number of results per page (default: 100, max: 100) */
  perPage?: number;
  /** Order results by field (default: 'last_activity_at') */
  orderBy?:
    | 'id'
    | 'name'
    | 'path'
    | 'created_at'
    | 'updated_at'
    | 'last_activity_at';
  /** Sort direction (default: 'desc') */
  sort?: 'asc' | 'desc';
  /** Maximum pages to fetch (default: 5 for comprehensive load) */
  maxPages?: number;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /**
   * Use simple=true to return limited fields for faster response
   * When true, only returns: id, name, path, path_with_namespace, namespace (basic)
   * Default: true for project browser (we only need names)
   */
  simple?: boolean;
}

export interface FetchGroupsOptions {
  /** Search term to filter groups by name */
  search?: string;
  /** Number of results per page (default: 100, max: 100) */
  perPage?: number;
  /** Order results by field (default: 'name') */
  orderBy?: 'id' | 'name' | 'path' | 'similarity';
  /** Sort direction (default: 'asc') */
  sort?: 'asc' | 'desc';
  /** Only fetch top-level groups (no subgroups) */
  topLevelOnly?: boolean;
  /** Maximum pages to fetch (default: 5 for comprehensive load) */
  maxPages?: number;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch user's accessible projects
 * Uses membership=true to only get projects the user is a member of
 *
 * @param config - GitLab proxy configuration
 * @param options - Fetch options (search, pagination, sorting)
 * @returns Array of accessible projects
 */
export async function fetchAccessibleProjects(
  config: GitLabProxyConfig,
  options: FetchProjectsOptions = {},
): Promise<GitLabProjectInfo[]> {
  const {
    search,
    perPage = 100, // Increased for fewer API calls
    orderBy = 'last_activity_at',
    sort = 'desc',
    maxPages = 5, // Increased for comprehensive coverage
    signal,
    simple = true, // Default to simple mode for faster response
  } = options;

  // Build query parameters
  const params = new URLSearchParams();
  params.set('membership', 'true');
  params.set('per_page', String(perPage));
  params.set('order_by', orderBy);
  params.set('sort', sort);

  // simple=true returns minimal fields for faster response
  // Only returns: id, name, path, path_with_namespace, namespace (basic info)
  if (simple) {
    params.set('simple', 'true');
  }

  if (search) {
    params.set('search', search);
  }

  const endpoint = `/projects?${params.toString()}`;

  return gitlabRestRequestPaginated<GitLabProjectInfo>(
    endpoint,
    config,
    {},
    maxPages,
    signal,
  );
}

/**
 * Fetch user's accessible groups
 *
 * @param config - GitLab proxy configuration
 * @param options - Fetch options (search, pagination, sorting, topLevelOnly)
 * @returns Array of accessible groups
 */
export async function fetchAccessibleGroups(
  config: GitLabProxyConfig,
  options: FetchGroupsOptions = {},
): Promise<GitLabGroupInfo[]> {
  const {
    search,
    perPage = 100, // Increased for fewer API calls
    orderBy = 'name',
    sort = 'asc',
    topLevelOnly = false,
    maxPages = 5, // Increased for comprehensive coverage
    signal,
  } = options;

  // Build query parameters
  const params = new URLSearchParams();
  params.set('per_page', String(perPage));
  params.set('order_by', orderBy);
  params.set('sort', sort);

  if (search) {
    params.set('search', search);
  }

  if (topLevelOnly) {
    params.set('top_level_only', 'true');
  }

  const endpoint = `/groups?${params.toString()}`;

  return gitlabRestRequestPaginated<GitLabGroupInfo>(
    endpoint,
    config,
    {},
    maxPages,
    signal,
  );
}

/**
 * Fetch subgroups of a specific group
 *
 * @param config - GitLab proxy configuration
 * @param groupId - Group ID or URL-encoded full path
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Array of subgroups
 */
export async function fetchSubgroups(
  config: GitLabProxyConfig,
  groupId: string | number,
  signal?: AbortSignal,
): Promise<GitLabGroupInfo[]> {
  // URL-encode the group ID in case it's a path
  const encodedGroupId = encodeURIComponent(String(groupId));
  const endpoint = `/groups/${encodedGroupId}/subgroups?per_page=100`;

  return gitlabRestRequestPaginated<GitLabGroupInfo>(
    endpoint,
    config,
    {},
    10,
    signal,
  );
}

/**
 * Fetch projects within a specific group
 *
 * @param config - GitLab proxy configuration
 * @param groupId - Group ID or URL-encoded full path
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Array of projects in the group
 */
export async function fetchGroupProjects(
  config: GitLabProxyConfig,
  groupId: string | number,
  signal?: AbortSignal,
): Promise<GitLabProjectInfo[]> {
  // URL-encode the group ID in case it's a path
  const encodedGroupId = encodeURIComponent(String(groupId));
  const endpoint = `/groups/${encodedGroupId}/projects?per_page=100`;

  return gitlabRestRequestPaginated<GitLabProjectInfo>(
    endpoint,
    config,
    {},
    10,
    signal,
  );
}

// ============================================================================
// Tree Building Functions
// ============================================================================

/**
 * Check if a project belongs to a user namespace (not in any group)
 * Projects in user namespaces have namespace.kind === 'user'
 */
function isUserNamespaceProject(project: GitLabProjectInfo): boolean {
  return project.namespace.kind === 'user';
}

/**
 * Build a hierarchical tree from flat lists of projects and groups
 * Groups are placed first (sorted alphabetically), then projects
 *
 * Algorithm:
 * 1. Create a map of groups by their full_path
 * 2. Build group hierarchy based on parent_id
 * 3. Place projects under their namespace group
 * 4. Projects in user namespaces go to root level
 *
 * @param projects - Flat list of projects
 * @param groups - Flat list of groups
 * @returns Hierarchical tree of nodes
 */
export function buildProjectTree(
  projects: GitLabProjectInfo[],
  groups: GitLabGroupInfo[],
): TreeNode[] {
  // Create a map of groups by full_path for quick lookup
  const groupMap = new Map<string, TreeNode>();

  // Create tree nodes for all groups
  for (const group of groups) {
    const node: TreeNode = {
      id: `group-${group.id}`,
      name: group.name,
      type: 'group',
      path: group.path,
      fullPath: group.full_path,
      children: [],
      data: group,
    };
    groupMap.set(group.full_path, node);
  }

  // Build group hierarchy
  // First, identify root groups (no parent) and child groups
  const rootGroups: TreeNode[] = [];

  for (const group of groups) {
    const node = groupMap.get(group.full_path)!;

    if (group.parent_id === null) {
      // Root group
      rootGroups.push(node);
    } else {
      // Find parent group by matching full_path
      // Parent path is everything before the last '/'
      const parentPath = group.full_path.substring(
        0,
        group.full_path.lastIndexOf('/'),
      );
      const parentNode = groupMap.get(parentPath);

      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Parent not in our list, treat as root
        // This can happen if user has access to subgroup but not parent
        rootGroups.push(node);
      }
    }
  }

  // Add projects to their respective groups or root
  const rootProjects: TreeNode[] = [];

  for (const project of projects) {
    const projectNode: TreeNode = {
      id: `project-${project.id}`,
      name: project.name,
      type: 'project',
      path: project.path,
      fullPath: project.path_with_namespace,
      children: [], // Projects don't have children
      data: project,
    };

    if (isUserNamespaceProject(project)) {
      // User namespace projects go to root
      rootProjects.push(projectNode);
    } else {
      // Find the parent group using namespace.full_path
      const parentGroup = groupMap.get(project.namespace.full_path);

      if (parentGroup) {
        parentGroup.children.push(projectNode);
      } else {
        // Parent group not in our list, put at root
        // This can happen if we don't have all groups loaded
        rootProjects.push(projectNode);
      }
    }
  }

  // Sort function: groups first, then projects, alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      // Groups come before projects
      if (a.type !== b.type) {
        return a.type === 'group' ? -1 : 1;
      }
      // Same type: sort alphabetically by name (case-insensitive)
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  };

  // Sort children of each group recursively
  const sortTreeRecursively = (nodes: TreeNode[]): TreeNode[] => {
    const sorted = sortNodes(nodes);
    for (const node of sorted) {
      if (node.children.length > 0) {
        node.children = sortTreeRecursively(node.children);
      }
    }
    return sorted;
  };

  // Combine root groups and root projects, then sort
  const rootNodes = [...rootGroups, ...rootProjects];
  return sortTreeRecursively(rootNodes);
}

/**
 * Filter a tree by search query
 * Matches against node name or fullPath (case-insensitive)
 * If a parent matches, all children are included
 * If a child matches, all ancestors are included
 *
 * @param nodes - Tree nodes to filter
 * @param query - Search query string
 * @returns Filtered tree (new array, original not modified)
 */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query || query.trim() === '') {
    return nodes;
  }

  const lowerQuery = query.toLowerCase().trim();

  /**
   * Check if a node matches the query
   */
  const nodeMatches = (node: TreeNode): boolean => {
    return (
      node.name.toLowerCase().includes(lowerQuery) ||
      node.fullPath.toLowerCase().includes(lowerQuery)
    );
  };

  /**
   * Recursively filter nodes
   * Returns [filteredNode, matchFound] where matchFound indicates
   * if this node or any descendant matches
   */
  const filterNode = (node: TreeNode): [TreeNode | null, boolean] => {
    const selfMatches = nodeMatches(node);

    if (node.children.length === 0) {
      // Leaf node: include only if it matches
      return selfMatches ? [{ ...node, children: [] }, true] : [null, false];
    }

    // Filter children recursively
    const filteredChildren: TreeNode[] = [];
    let anyChildMatches = false;

    for (const child of node.children) {
      const [filteredChild, childMatches] = filterNode(child);
      if (filteredChild) {
        filteredChildren.push(filteredChild);
        if (childMatches) {
          anyChildMatches = true;
        }
      }
    }

    // Include this node if:
    // 1. It matches (include all remaining children)
    // 2. Any child matches (include node as ancestor)
    if (selfMatches) {
      // Self matches: include with filtered children
      // Note: If self matches, we could include ALL children, but for
      // better UX, we still show filtered children to reduce clutter
      return [{ ...node, children: filteredChildren }, true];
    } else if (anyChildMatches) {
      // Child matches: include node as ancestor with filtered children
      return [{ ...node, children: filteredChildren }, true];
    }

    return [null, false];
  };

  // Filter all root nodes
  const result: TreeNode[] = [];
  for (const node of nodes) {
    const [filteredNode] = filterNode(node);
    if (filteredNode) {
      result.push(filteredNode);
    }
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Flatten a tree into a flat list of nodes
 * Useful for rendering in a flat list with indentation
 *
 * @param nodes - Tree nodes to flatten
 * @param depth - Current depth (for tracking nesting level)
 * @returns Flat list with depth information
 */
export function flattenTree(
  nodes: TreeNode[],
  depth: number = 0,
): Array<TreeNode & { depth: number }> {
  const result: Array<TreeNode & { depth: number }> = [];

  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }

  return result;
}

/**
 * Find a node by its id in the tree
 *
 * @param nodes - Tree nodes to search
 * @param id - Node id to find
 * @returns Found node or undefined
 */
export function findNodeById(
  nodes: TreeNode[],
  id: string,
): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Find a node by its fullPath in the tree
 *
 * @param nodes - Tree nodes to search
 * @param fullPath - Full path to find
 * @returns Found node or undefined
 */
export function findNodeByPath(
  nodes: TreeNode[],
  fullPath: string,
): TreeNode | undefined {
  for (const node of nodes) {
    if (node.fullPath === fullPath) {
      return node;
    }
    if (node.children.length > 0) {
      const found = findNodeByPath(node.children, fullPath);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Count total nodes in a tree
 *
 * @param nodes - Tree nodes to count
 * @returns Object with total, groups, and projects counts
 */
export function countTreeNodes(nodes: TreeNode[]): {
  total: number;
  groups: number;
  projects: number;
} {
  let groups = 0;
  let projects = 0;

  const countRecursive = (nodeList: TreeNode[]) => {
    for (const node of nodeList) {
      if (node.type === 'group') {
        groups++;
      } else {
        projects++;
      }
      if (node.children.length > 0) {
        countRecursive(node.children);
      }
    }
  };

  countRecursive(nodes);

  return {
    total: groups + projects,
    groups,
    projects,
  };
}
