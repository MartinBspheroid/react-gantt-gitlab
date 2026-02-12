import { describe, it, expect } from 'vitest';
import {
  exportToJSON,
  exportToCSV,
  importFromJSON,
  importFromCSV,
  importFromMSProjectXML,
} from '../DataIO';
import type { ITask, ILink } from '@svar-ui/gantt-store';

describe('DataIO', () => {
  const createTask = (
    id: string,
    text: string,
    start?: Date,
    end?: Date,
  ): ITask => ({
    id,
    text,
    start: start || new Date('2024-01-01'),
    end: end || new Date('2024-01-05'),
    duration: 4,
    progress: 0.5,
    type: 'task',
  });

  const createLink = (source: string, target: string): ILink => ({
    id: `${source}-${target}`,
    source,
    target,
    type: 'e2s' as const,
  });

  const tasks: ITask[] = [createTask('1', 'Task 1'), createTask('2', 'Task 2')];

  const links: ILink[] = [createLink('1', '2')];

  describe('exportToJSON', () => {
    it('should export tasks and links to JSON', () => {
      const json = exportToJSON(tasks, links);
      const data = JSON.parse(json);

      expect(data.tasks).toHaveLength(2);
      expect(data.links).toHaveLength(1);
    });

    it('should include version and timestamp', () => {
      const json = exportToJSON(tasks, links);
      const data = JSON.parse(json);

      expect(data.version).toBe('1.0');
      expect(data.exportedAt).toBeDefined();
    });

    it('should exclude links when option is false', () => {
      const json = exportToJSON(tasks, links, {
        format: 'json',
        includeLinks: false,
      });
      const data = JSON.parse(json);

      expect(data.links).toBeUndefined();
    });

    it('should include baselines when option is true', () => {
      const taskWithBaseline: ITask = {
        ...createTask('1', 'Task 1'),
        base_start: new Date('2024-01-01'),
        base_end: new Date('2024-01-06'),
      };

      const json = exportToJSON([taskWithBaseline], [], {
        format: 'json',
        includeBaselines: true,
      });
      const data = JSON.parse(json);

      expect(data.tasks[0].base_start).toBeDefined();
    });
  });

  describe('exportToCSV', () => {
    it('should export tasks to CSV format', () => {
      const csv = exportToCSV(tasks, links);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('id,text,start,end');
      expect(lines).toHaveLength(3);
    });

    it('should escape commas in text', () => {
      const taskWithComma = createTask('1', 'Task, with comma');
      const csv = exportToCSV([taskWithComma], []);

      expect(csv).toContain('"Task, with comma"');
    });

    it('should escape quotes in text', () => {
      const taskWithQuote = createTask('1', 'Task "quoted"');
      const csv = exportToCSV([taskWithQuote], []);

      expect(csv).toContain('""quoted""');
    });
  });

  describe('importFromJSON', () => {
    it('should import tasks from JSON', () => {
      const json = JSON.stringify({
        tasks: [
          { id: '1', text: 'Task 1', start: '2024-01-01', end: '2024-01-05' },
          { id: '2', text: 'Task 2', start: '2024-01-05', end: '2024-01-10' },
        ],
        links: [{ id: 'l1', source: '1', target: '2', type: 'e2s' }],
      });

      const result = importFromJSON(json);

      expect(result.tasks).toHaveLength(2);
      expect(result.links).toHaveLength(1);
      expect(result.tasks[0].start).toBeInstanceOf(Date);
    });

    it('should handle empty tasks array', () => {
      const json = JSON.stringify({ tasks: [], links: [] });
      const result = importFromJSON(json);

      expect(result.tasks).toHaveLength(0);
      expect(result.links).toHaveLength(0);
    });

    it('should parse dates correctly', () => {
      const json = JSON.stringify({
        tasks: [{ id: '1', start: '2024-01-15T00:00:00.000Z' }],
      });

      const result = importFromJSON(json);
      expect(result.tasks[0].start?.getUTCFullYear()).toBe(2024);
    });
  });

  describe('importFromCSV', () => {
    it('should import tasks from CSV', () => {
      const csv = `id,text,start,end,duration,progress,type,parent
1,Task 1,2024-01-01,2024-01-05,4,0.5,task,
2,Task 2,2024-01-05,2024-01-10,5,,task,1`;

      const result = importFromCSV(csv);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].text).toBe('Task 1');
      expect(result.tasks[0].duration).toBe(4);
    });

    it('should handle empty CSV', () => {
      const result = importFromCSV('');
      expect(result.tasks).toHaveLength(0);
    });

    it('should handle CSV with only headers', () => {
      const csv = 'id,text,start,end';
      const result = importFromCSV(csv);

      expect(result.tasks).toHaveLength(0);
    });

    it('should handle quoted values', () => {
      const csv = `id,text,start
1,"Task, with comma",2024-01-01`;

      const result = importFromCSV(csv);
      expect(result.tasks[0].text).toBe('Task, with comma');
    });
  });

  describe('importFromMSProjectXML', () => {
    const validMSProjectXML = `<?xml version="1.0" encoding="UTF-8"?>
<Project>
  <Tasks>
    <Task>
      <UID>1</UID>
      <Name>Task 1</Name>
      <Start>2024-01-01T08:00:00</Start>
      <Finish>2024-01-05T17:00:00</Finish>
      <Duration>P4D</Duration>
      <PercentComplete>50</PercentComplete>
      <OutlineLevel>1</OutlineLevel>
    </Task>
    <Task>
      <UID>2</UID>
      <Name>Task 2</Name>
      <Start>2024-01-06T08:00:00</Start>
      <Finish>2024-01-10T17:00:00</Finish>
      <Duration>P4D</Duration>
      <PercentComplete>0</PercentComplete>
      <OutlineLevel>1</OutlineLevel>
      <PredecessorLink>
        <PredecessorUID>1</PredecessorUID>
        <Type>0</Type>
      </PredecessorLink>
    </Task>
  </Tasks>
</Project>`;

    it('should import tasks from MS Project XML', () => {
      const result = importFromMSProjectXML(validMSProjectXML);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].text).toBe('Task 1');
      expect(result.tasks[0].id).toBe('ms-1');
    });

    it('should parse dates correctly', () => {
      const result = importFromMSProjectXML(validMSProjectXML);

      expect(result.tasks[0].start).toBeInstanceOf(Date);
      expect(result.tasks[0].end).toBeInstanceOf(Date);
      expect(result.tasks[0].start?.getFullYear()).toBe(2024);
    });

    it('should parse duration correctly', () => {
      const result = importFromMSProjectXML(validMSProjectXML);

      expect(result.tasks[0].duration).toBe(4);
    });

    it('should parse progress as decimal', () => {
      const result = importFromMSProjectXML(validMSProjectXML);

      expect(result.tasks[0].progress).toBe(0.5);
      expect(result.tasks[1].progress).toBe(0);
    });

    it('should import dependencies as links', () => {
      const result = importFromMSProjectXML(validMSProjectXML);

      expect(result.links).toHaveLength(1);
      expect(result.links[0].source).toBe('ms-1');
      expect(result.links[0].target).toBe('ms-2');
      expect(result.links[0].type).toBe('finish_to_start');
    });

    it('should map link types correctly', () => {
      const startToStartXML = `<?xml version="1.0" encoding="UTF-8"?>
<Project>
  <Tasks>
    <Task><UID>1</UID><Name>A</Name><OutlineLevel>1</OutlineLevel></Task>
    <Task><UID>2</UID><Name>B</Name><OutlineLevel>1</OutlineLevel>
      <PredecessorLink>
        <PredecessorUID>1</PredecessorUID>
        <Type>1</Type>
      </PredecessorLink>
    </Task>
  </Tasks>
</Project>`;

      const result = importFromMSProjectXML(startToStartXML);
      expect(result.links[0].type).toBe('start_to_start');
    });

    it('should handle empty tasks', () => {
      const emptyXML = `<?xml version="1.0" encoding="UTF-8"?>
<Project><Tasks></Tasks></Project>`;

      const result = importFromMSProjectXML(emptyXML);
      expect(result.tasks).toHaveLength(0);
      expect(result.links).toHaveLength(0);
    });

    it('should throw error for invalid XML', () => {
      expect(() => importFromMSProjectXML('not valid xml')).toThrow();
    });

    it('should handle tasks without optional fields', () => {
      const minimalXML = `<?xml version="1.0" encoding="UTF-8"?>
<Project>
  <Tasks>
    <Task>
      <UID>1</UID>
      <Name>Minimal Task</Name>
      <OutlineLevel>1</OutlineLevel>
    </Task>
  </Tasks>
</Project>`;

      const result = importFromMSProjectXML(minimalXML);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].text).toBe('Minimal Task');
    });
  });

  describe('round-trip', () => {
    it('should maintain data through JSON export/import cycle', () => {
      const json = exportToJSON(tasks, links);
      const imported = importFromJSON(json);

      expect(imported.tasks).toHaveLength(tasks.length);
      expect(imported.links).toHaveLength(links.length);
    });

    it('should maintain data through CSV export/import cycle', () => {
      const csv = exportToCSV(tasks, links);
      const imported = importFromCSV(csv);

      expect(imported.tasks).toHaveLength(tasks.length);
      expect(imported.tasks[0].id).toBe(tasks[0].id);
      expect(imported.tasks[0].text).toBe(tasks[0].text);
    });
  });
});
