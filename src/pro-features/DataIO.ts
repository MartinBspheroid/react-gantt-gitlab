import type { ITask, ILink } from '@svar-ui/gantt-store';
import type { IExportOptions, IImportOptions } from './types';

export function exportToJSON(
  tasks: ITask[],
  links: ILink[],
  options: IExportOptions = { format: 'json' },
): string {
  const data: any = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    tasks: tasks.map((task) => formatTaskForExport(task, options)),
  };

  if (options.includeLinks !== false) {
    data.links = links.map((link) => ({
      id: link.id,
      type: link.type,
      source: link.source,
      target: link.target,
    }));
  }

  return JSON.stringify(data, null, 2);
}

export function exportToCSV(
  tasks: ITask[],
  _links: ILink[],
  options: IExportOptions = { format: 'csv' },
): string {
  const headers = [
    'id',
    'text',
    'start',
    'end',
    'duration',
    'progress',
    'type',
    'parent',
  ];

  if (options.includeBaselines) {
    headers.push('base_start', 'base_end', 'base_duration');
  }

  if (options.includeProgress !== false) {
    headers.push('progress');
  }

  const rows = tasks.map((task) => {
    const row: string[] = [
      String(task.id || ''),
      escapeCSV(String(task.text || '')),
      formatDate(task.start, options.dateFormat),
      formatDate(task.end, options.dateFormat),
      String(task.duration ?? ''),
      String(task.progress ?? ''),
      String(task.type || 'task'),
      String(task.parent ?? ''),
    ];

    if (options.includeBaselines) {
      row.push(
        formatDate(task.base_start, options.dateFormat),
        formatDate(task.base_end, options.dateFormat),
        String(task.base_duration ?? ''),
      );
    }

    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function exportData(
  tasks: ITask[],
  links: ILink[],
  options: IExportOptions,
): string {
  switch (options.format) {
    case 'csv':
      return exportToCSV(tasks, links, options);
    case 'json':
    default:
      return exportToJSON(tasks, links, options);
  }
}

export function downloadExport(
  data: string,
  filename: string,
  format: 'json' | 'csv',
): void {
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importFromJSON(
  jsonString: string,
  _options: IImportOptions = { format: 'json' },
): { tasks: ITask[]; links: ILink[] } {
  const data = JSON.parse(jsonString);

  const tasks: ITask[] = (data.tasks || []).map((t: any) => ({
    ...t,
    start: t.start ? new Date(t.start) : undefined,
    end: t.end ? new Date(t.end) : undefined,
    base_start: t.base_start ? new Date(t.base_start) : undefined,
    base_end: t.base_end ? new Date(t.base_end) : undefined,
  }));

  const links: ILink[] = (data.links || []).map((l: any) => ({
    id: l.id,
    type: l.type,
    source: l.source,
    target: l.target,
  }));

  return { tasks, links };
}

export function importFromCSV(
  csvString: string,
  options: IImportOptions = { format: 'csv' },
): { tasks: ITask[]; links: ILink[] } {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) {
    return { tasks: [], links: [] };
  }

  const headers = parseCSVLine(lines[0]);
  const tasks: ITask[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const task: any = {};

    headers.forEach((header, index) => {
      const value = values[index];
      if (value === undefined || value === '') return;

      switch (header.toLowerCase()) {
        case 'id':
          task.id = value;
          break;
        case 'text':
          task.text = value;
          break;
        case 'start':
          task.start = new Date(value);
          break;
        case 'end':
          task.end = new Date(value);
          break;
        case 'duration':
          task.duration = parseInt(value, 10);
          break;
        case 'progress':
          task.progress = parseFloat(value);
          break;
        case 'type':
          task.type = value;
          break;
        case 'parent':
          task.parent = value || undefined;
          break;
        case 'base_start':
          task.base_start = new Date(value);
          break;
        case 'base_end':
          task.base_end = new Date(value);
          break;
        case 'base_duration':
          task.base_duration = parseInt(value, 10);
          break;
      }
    });

    if (task.id) {
      tasks.push(task);
    }
  }

  return { tasks, links: [] };
}

export function importFromMSProjectXML(
  xmlString: string,
  _options: IImportOptions = { format: 'ms-xml' },
): { tasks: ITask[]; links: ILink[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Invalid XML: ${parseError.textContent}`);
  }

  const tasks: ITask[] = [];
  const links: ILink[] = [];
  const taskMap = new Map<string, string>();

  const taskElements = doc.querySelectorAll('Project > Tasks > Task');

  taskElements.forEach((taskEl) => {
    const uid = getTextContent(taskEl, 'UID');
    const name = getTextContent(taskEl, 'Name');
    const startStr = getTextContent(taskEl, 'Start');
    const finishStr = getTextContent(taskEl, 'Finish');
    const durationStr = getTextContent(taskEl, 'Duration');
    const outlineLevel = parseInt(
      getTextContent(taskEl, 'OutlineLevel') || '0',
      10,
    );
    const percentComplete = parseFloat(
      getTextContent(taskEl, 'PercentComplete') || '0',
    );

    if (!uid || !name) return;

    const taskId = `ms-${uid}`;
    taskMap.set(uid, taskId);

    const task: ITask = {
      id: taskId,
      text: name,
      start: startStr ? parseMSProjectDate(startStr) : undefined,
      end: finishStr ? parseMSProjectDate(finishStr) : undefined,
      duration: durationStr ? parseMSProjectDuration(durationStr) : undefined,
      progress: percentComplete / 100,
      type: outlineLevel > 0 ? 'task' : 'task',
      parent: 0,
    };

    tasks.push(task);

    const predecessorLinks = taskEl.querySelectorAll('PredecessorLink');
    predecessorLinks.forEach((linkEl, index) => {
      const predUid = getTextContent(linkEl, 'PredecessorUID');
      const linkType = getTextContent(linkEl, 'Type');

      if (predUid && taskMap.has(predUid)) {
        const sourceId = taskMap.get(predUid)!;
        links.push({
          id: `link-${sourceId}-${taskId}-${index}`,
          source: sourceId,
          target: taskId,
          type: mapMSProjectLinkType(linkType),
        });
      }
    });
  });

  buildTaskHierarchy(tasks, taskMap, doc);

  return { tasks, links };
}

function getTextContent(parent: Element | Document, tagName: string): string {
  const el = parent.querySelector(tagName);
  return el?.textContent?.trim() || '';
}

function parseMSProjectDate(dateStr: string): Date {
  const match = dateStr.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
  );
  if (match) {
    const [, year, month, day, hour, minute, second] = match.map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
  }
  return new Date(dateStr);
}

function parseMSProjectDuration(durationStr: string): number {
  const match = durationStr.match(/P(?:([^T]*)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (match) {
    const days = parseInt(match[1] || '0', 10);
    return days > 0 ? days : 1;
  }
  const hoursMatch = durationStr.match(/(\d+)\s*hrs?/i);
  if (hoursMatch) {
    return Math.ceil(parseInt(hoursMatch[1], 10) / 8);
  }
  const daysMatch = durationStr.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    return parseInt(daysMatch[1], 10);
  }
  return 1;
}

function mapMSProjectLinkType(
  type: string,
):
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish' {
  switch (type) {
    case '0':
      return 'finish_to_start';
    case '1':
      return 'start_to_start';
    case '2':
      return 'finish_to_finish';
    case '3':
      return 'start_to_finish';
    default:
      return 'finish_to_start';
  }
}

function buildTaskHierarchy(
  tasks: ITask[],
  taskMap: Map<string, string>,
  doc: Document,
): void {
  const taskElementsByUid = new Map<string, Element>();
  doc.querySelectorAll('Project > Tasks > Task').forEach((el) => {
    const uid = getTextContent(el, 'UID');
    if (uid) taskElementsByUid.set(uid, el);
  });

  const uidToOutlineLevel = new Map<string, number>();
  taskElementsByUid.forEach((el, uid) => {
    const level = parseInt(getTextContent(el, 'OutlineLevel') || '0', 10);
    uidToOutlineLevel.set(uid, level);
  });

  const sortedUids = Array.from(taskElementsByUid.keys()).sort((a, b) => {
    const levelA = uidToOutlineLevel.get(a) || 0;
    const levelB = uidToOutlineLevel.get(b) || 0;
    const elA = taskElementsByUid.get(a)!;
    const elB = taskElementsByUid.get(b)!;
    const idxA = Array.from(taskElementsByUid.values()).indexOf(elA);
    const idxB = Array.from(taskElementsByUid.values()).indexOf(elB);
    if (levelA !== levelB) return levelA - levelB;
    return idxA - idxB;
  });

  const taskStack: Array<{ uid: string; level: number }> = [];

  sortedUids.forEach((uid) => {
    const level = uidToOutlineLevel.get(uid) || 0;
    const taskId = taskMap.get(uid);
    if (!taskId) return;

    while (
      taskStack.length > 0 &&
      taskStack[taskStack.length - 1].level >= level
    ) {
      taskStack.pop();
    }

    if (taskStack.length > 0) {
      const parentUid = taskStack[taskStack.length - 1].uid;
      const parentId = taskMap.get(parentUid);
      const task = tasks.find((t) => t.id === taskId);
      if (task && parentId) {
        task.parent = parentId;
      }
    }

    taskStack.push({ uid, level });
  });
}

export function importData(
  dataString: string,
  options: IImportOptions,
): { tasks: ITask[]; links: ILink[] } {
  switch (options.format) {
    case 'csv':
      return importFromCSV(dataString, options);
    case 'ms-xml':
      return importFromMSProjectXML(dataString, options);
    case 'json':
    default:
      return importFromJSON(dataString, options);
  }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function importFromFile(
  file: File,
  options?: IImportOptions,
): Promise<{ tasks: ITask[]; links: ILink[] }> {
  const content = await readFileAsText(file);

  let format: 'json' | 'csv' | 'ms-xml' = 'json';
  if (file.name.endsWith('.csv')) {
    format = 'csv';
  } else if (file.name.endsWith('.xml')) {
    format = 'ms-xml';
  }

  return importData(content, { ...options, format });
}

function formatTaskForExport(task: ITask, options: IExportOptions): any {
  const result: any = {
    id: task.id,
    text: task.text,
    start: formatDate(task.start, options.dateFormat),
    end: formatDate(task.end, options.dateFormat),
    duration: task.duration,
    type: task.type || 'task',
    parent: task.parent,
  };

  if (options.includeProgress !== false && task.progress !== undefined) {
    result.progress = task.progress;
  }

  if (options.includeBaselines) {
    result.base_start = formatDate(task.base_start, options.dateFormat);
    result.base_end = formatDate(task.base_end, options.dateFormat);
    result.base_duration = task.base_duration;
  }

  Object.keys(task).forEach((key) => {
    if (!result.hasOwnProperty(key) && key !== 'data') {
      result[key] = (task as any)[key];
    }
  });

  return result;
}

function formatDate(date: Date | undefined, format?: string): string {
  if (!date) return '';

  if (format) {
    return customFormat(date, format);
  }

  return date.toISOString().split('T')[0];
}

function customFormat(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  return format
    .replace('yyyy', date.getFullYear().toString())
    .replace('yy', date.getFullYear().toString().slice(-2))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('M', (date.getMonth() + 1).toString())
    .replace('dd', pad(date.getDate()))
    .replace('d', date.getDate().toString());
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}
