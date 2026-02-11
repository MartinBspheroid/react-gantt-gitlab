import { describe, it, expect } from 'vitest';
import {
  mapADOLinkTypeToGantt,
  extractWorkItemIdFromUrl,
  validateADOLink,
  convertADODependencyToILink,
  detectCircularDependencies,
  filterCircularDependencies,
  validateADOWorkItemFields,
  extractHierarchyParent,
  extractHierarchyChildren,
} from '../azure-devops';
import type { ADODependencyLink, ADOWorkItem } from '../azure-devops';

describe('azure-devops', () => {
  describe('mapADOLinkTypeToGantt', () => {
    it('should map forward dependency to e2s', () => {
      const result = mapADOLinkTypeToGantt(
        'System.LinkTypes.Dependency-Forward',
        true,
      );
      expect(result).toBe('e2s');
    });

    it('should map reverse dependency to s2e', () => {
      const result = mapADOLinkTypeToGantt(
        'System.LinkTypes.Dependency-Reverse',
        false,
      );
      expect(result).toBe('s2e');
    });

    it('should return e2s when isForward=true regardless of link type', () => {
      const result = mapADOLinkTypeToGantt(
        'System.LinkTypes.Dependency-Reverse',
        true,
      );
      expect(result).toBe('e2s');
    });
  });

  describe('extractWorkItemIdFromUrl', () => {
    it('should extract ID from valid URL', () => {
      const url = 'https://dev.azure.com/org/project/_apis/wit/workItems/12345';
      const result = extractWorkItemIdFromUrl(url);
      expect(result).toBe(12345);
    });

    it('should return null for invalid URL', () => {
      const result = extractWorkItemIdFromUrl('https://invalid-url.com');
      expect(result).toBeNull();
    });
  });

  describe('validateADOLink', () => {
    it('should validate a correct link', () => {
      const validIds = new Set([1, 2, 3]);
      const link: ADODependencyLink = {
        sourceId: 1,
        targetId: 2,
        type: 'e2s',
        relationType: 'System.LinkTypes.Dependency-Forward',
      };
      const result = validateADOLink(link, validIds);
      expect(result.valid).toBe(true);
    });

    it('should reject link with missing source', () => {
      const validIds = new Set([1, 2]);
      const link: ADODependencyLink = {
        sourceId: 0,
        targetId: 2,
        type: 'e2s',
        relationType: 'System.LinkTypes.Dependency-Forward',
      };
      const result = validateADOLink(link, validIds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('source or target ID');
    });

    it('should reject link with invalid source ID', () => {
      const validIds = new Set([1, 2]);
      const link: ADODependencyLink = {
        sourceId: 99,
        targetId: 2,
        type: 'e2s',
        relationType: 'System.LinkTypes.Dependency-Forward',
      };
      const result = validateADOLink(link, validIds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid source ID');
    });

    it('should reject self-referential link', () => {
      const validIds = new Set([1, 2]);
      const link: ADODependencyLink = {
        sourceId: 1,
        targetId: 1,
        type: 'e2s',
        relationType: 'System.LinkTypes.Dependency-Forward',
      };
      const result = validateADOLink(link, validIds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('same');
    });
  });

  describe('convertADODependencyToILink', () => {
    it('should convert dependency to ILink format', () => {
      const dep: ADODependencyLink = {
        sourceId: 1,
        targetId: 2,
        type: 'e2s',
        lag: 3,
        relationType: 'System.LinkTypes.Dependency-Forward',
      };
      const result = convertADODependencyToILink(dep);

      expect(result.id).toBe('1-2-e2s');
      expect(result.source).toBe(1);
      expect(result.target).toBe(2);
      expect(result.type).toBe('e2s');
      expect(result.lag).toBe(3);
    });

    it('should include ADO metadata in _ado property', () => {
      const dep: ADODependencyLink = {
        sourceId: 1,
        targetId: 2,
        type: 'e2s',
        lag: 5,
        relationType: 'System.LinkTypes.Dependency-Forward',
      };
      const result = convertADODependencyToILink(dep) as ILink & {
        _ado: { relationType: string; lag?: number };
      };

      expect(result._ado.relationType).toBe(
        'System.LinkTypes.Dependency-Forward',
      );
      expect(result._ado.lag).toBe(5);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency', () => {
      const links: ADODependencyLink[] = [
        {
          sourceId: 1,
          targetId: 2,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 2,
          targetId: 3,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 3,
          targetId: 1,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
      ];

      const cycles = detectCircularDependencies(links);
      expect(cycles.size).toBeGreaterThan(0);
    });

    it('should return empty set for acyclic dependencies', () => {
      const links: ADODependencyLink[] = [
        {
          sourceId: 1,
          targetId: 2,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 2,
          targetId: 3,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
      ];

      const cycles = detectCircularDependencies(links);
      expect(cycles.size).toBe(0);
    });

    it('should handle empty links array', () => {
      const cycles = detectCircularDependencies([]);
      expect(cycles.size).toBe(0);
    });
  });

  describe('filterCircularDependencies', () => {
    it('should filter out circular dependencies', () => {
      const links: ADODependencyLink[] = [
        {
          sourceId: 1,
          targetId: 2,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 2,
          targetId: 3,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 3,
          targetId: 1,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
      ];

      const { validLinks, circularLinks } = filterCircularDependencies(links);
      expect(circularLinks.length).toBeGreaterThan(0);
      expect(validLinks.length).toBeLessThan(links.length);
    });

    it('should keep all links when no cycles exist', () => {
      const links: ADODependencyLink[] = [
        {
          sourceId: 1,
          targetId: 2,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 2,
          targetId: 3,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 1,
          targetId: 3,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
      ];

      const { validLinks, circularLinks } = filterCircularDependencies(links);
      expect(validLinks.length).toBe(3);
      expect(circularLinks.length).toBe(0);
    });

    it('should handle diamond dependency pattern without cycles', () => {
      const links: ADODependencyLink[] = [
        {
          sourceId: 1,
          targetId: 2,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 1,
          targetId: 3,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 2,
          targetId: 4,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 3,
          targetId: 4,
          type: 'e2s',
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
      ];

      const { validLinks, circularLinks } = filterCircularDependencies(links);
      expect(validLinks.length).toBe(4);
      expect(circularLinks.length).toBe(0);
    });

    it('should handle lag values in dependencies', () => {
      const links: ADODependencyLink[] = [
        {
          sourceId: 1,
          targetId: 2,
          type: 'e2s',
          lag: 3,
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
        {
          sourceId: 2,
          targetId: 3,
          type: 'e2s',
          lag: -2,
          relationType: 'System.LinkTypes.Dependency-Forward',
        },
      ];

      const { validLinks, circularLinks } = filterCircularDependencies(links);
      expect(validLinks.length).toBe(2);
      expect(circularLinks.length).toBe(0);
      expect(validLinks[0].lag).toBe(3);
      expect(validLinks[1].lag).toBe(-2);
    });
  });

  describe('validateADOWorkItemFields', () => {
    it('should validate work item with all required fields', () => {
      const fields = {
        'System.Id': 123,
        'System.Title': 'Test Task',
        'System.State': 'Active',
        'System.WorkItemType': 'Task',
      } as ADOWorkItem['fields'];

      const result = validateADOWorkItemFields(fields);
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const fields = {
        'System.Id': 123,
        'System.Title': 'Test Task',
      } as ADOWorkItem['fields'];

      const result = validateADOWorkItemFields(fields);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('System.State');
      expect(result.missingFields).toContain('System.WorkItemType');
    });

    it('should warn about missing optional fields', () => {
      const fields = {
        'System.Id': 123,
        'System.Title': 'Test Task',
        'System.State': 'Active',
        'System.WorkItemType': 'Task',
      } as ADOWorkItem['fields'];

      const result = validateADOWorkItemFields(fields);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('AssignedTo'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('Priority'))).toBe(true);
    });
  });

  describe('extractHierarchyParent', () => {
    it('should extract parent from hierarchy-reverse relation', () => {
      const relations = [
        {
          rel: 'System.LinkTypes.Hierarchy-Reverse' as const,
          url: 'https://dev.azure.com/org/_apis/wit/workItems/100',
          attributes: {},
        },
      ];

      const parentId = extractHierarchyParent(relations);
      expect(parentId).toBe(100);
    });

    it('should return null when no hierarchy relation exists', () => {
      const relations = [
        {
          rel: 'System.LinkTypes.Dependency-Forward' as const,
          url: 'https://dev.azure.com/org/_apis/wit/workItems/200',
          attributes: {},
        },
      ];

      const parentId = extractHierarchyParent(relations);
      expect(parentId).toBeNull();
    });

    it('should return null when relations is undefined', () => {
      const parentId = extractHierarchyParent(undefined);
      expect(parentId).toBeNull();
    });
  });

  describe('extractHierarchyChildren', () => {
    it('should extract children from hierarchy-forward relations', () => {
      const relations = [
        {
          rel: 'System.LinkTypes.Hierarchy-Forward' as const,
          url: 'https://dev.azure.com/org/_apis/wit/workItems/101',
          attributes: {},
        },
        {
          rel: 'System.LinkTypes.Hierarchy-Forward' as const,
          url: 'https://dev.azure.com/org/_apis/wit/workItems/102',
          attributes: {},
        },
        {
          rel: 'System.LinkTypes.Dependency-Forward' as const,
          url: 'https://dev.azure.com/org/_apis/wit/workItems/200',
          attributes: {},
        },
      ];

      const childIds = extractHierarchyChildren(relations);
      expect(childIds).toEqual([101, 102]);
    });

    it('should return empty array when no hierarchy-forward relations', () => {
      const relations = [
        {
          rel: 'System.LinkTypes.Dependency-Forward' as const,
          url: 'https://dev.azure.com/org/_apis/wit/workItems/200',
          attributes: {},
        },
      ];

      const childIds = extractHierarchyChildren(relations);
      expect(childIds).toEqual([]);
    });

    it('should return empty array when relations is undefined', () => {
      const childIds = extractHierarchyChildren(undefined);
      expect(childIds).toEqual([]);
    });
  });
});

import type { ILink } from '@svar-ui/gantt-store';
