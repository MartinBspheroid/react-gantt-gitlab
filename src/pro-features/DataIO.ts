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

export function importData(
  dataString: string,
  options: IImportOptions,
): { tasks: ITask[]; links: ILink[] } {
  switch (options.format) {
    case 'csv':
      return importFromCSV(dataString, options);
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
  const format = file.name.endsWith('.csv') ? 'csv' : 'json';
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
