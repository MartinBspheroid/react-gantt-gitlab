import type { ITask, ILink } from '@svar-ui/gantt-store';
import type { GanttTask } from '../types/gantt';
import type {
  IExportOptions,
  IImportOptions,
  ExportFormat,
  IPDFExportOptions,
  IPNGExportOptions,
} from './types';

export function exportToJSON(
  tasks: ITask[],
  links: ILink[],
  options: IExportOptions = { format: 'json' },
): string {
  const data: Record<string, unknown> = {
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
): string | Blob | Promise<Blob> {
  switch (options.format) {
    case 'csv':
      return exportToCSV(tasks, links, options);
    case 'xlsx':
      return exportToExcel(tasks, links, options);
    case 'mspx':
      return exportToMSProjectXML(tasks, links, options);
    case 'json':
    default:
      return exportToJSON(tasks, links, options);
  }
}

export function exportToExcel(
  tasks: ITask[],
  links: ILink[],
  options: IExportOptions = { format: 'xlsx' },
): Blob {
  const excelOptions = options.excel || {};
  const sheetName = excelOptions.sheetName || 'Tasks';

  const headers = [
    'ID',
    'Task Name',
    'Start Date',
    'End Date',
    'Duration',
    'Progress',
    'Type',
    'Parent',
  ];

  if (options.includeBaselines) {
    headers.push('Baseline Start', 'Baseline End', 'Baseline Duration');
  }

  const rows = tasks.map((task) => {
    const row: (string | number)[] = [
      String(task.id || ''),
      String(task.text || ''),
      formatDate(task.start, options.dateFormat),
      formatDate(task.end, options.dateFormat),
      task.duration ?? '',
      options.includeProgress !== false ? (task.progress ?? '') : '',
      String(task.type || 'task'),
      String(task.parent ?? ''),
    ];

    if (options.includeBaselines) {
      row.push(
        formatDate(task.base_start, options.dateFormat),
        formatDate(task.base_end, options.dateFormat),
        task.base_duration ?? '',
      );
    }

    return row;
  });

  const sheetData = [headers, ...rows];

  const xmlHeader =
    '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  const workbookStart =
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  const worksheetStart = `<Worksheet ss:Name="${escapeXML(sheetName)}">\n<Table>\n`;
  const worksheetEnd = '</Table>\n</Worksheet>\n';
  const workbookEnd = '</Workbook>';

  const rowsXML = sheetData
    .map((row) => {
      const cells = row
        .map((cell) => {
          const value = String(cell);
          const isNumber = !isNaN(Number(value)) && value !== '';
          const typeAttr = isNumber ? 'ss:Type="Number"' : 'ss:Type="String"';
          return `<Cell><Data ${typeAttr}>${escapeXML(value)}</Data></Cell>`;
        })
        .join('\n    ');
      return `<Row>\n    ${cells}\n  </Row>`;
    })
    .join('\n  ');

  const xmlContent =
    xmlHeader +
    workbookStart +
    worksheetStart +
    rowsXML +
    worksheetEnd +
    workbookEnd;

  return new Blob([xmlContent], {
    type: 'application/vnd.ms-excel',
  });
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportToMSProjectXML(
  tasks: ITask[],
  links: ILink[],
  options: IExportOptions = { format: 'mspx' },
): string {
  const formatDateForMSProject = (date: Date | undefined): string => {
    if (!date) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T08:00:00`;
  };

  const formatDuration = (duration: number | undefined): string => {
    if (duration === undefined) return 'P1D';
    return `P${duration}D`;
  };

  const getLinkTypeCode = (type: string | undefined): string => {
    switch (type) {
      case 's2s': // start_to_start
      case 'start_to_start':
        return '1';
      case 'e2e': // finish_to_finish / end_to_end
      case 'finish_to_finish':
        return '2';
      case 's2e': // start_to_finish / start_to_end
      case 'start_to_finish':
        return '3';
      case 'e2s': // finish_to_start / end_to_start
      case 'finish_to_start':
      default:
        return '0';
    }
  };

  const taskMap = new Map<string, number>();
  tasks.forEach((task, index) => {
    taskMap.set(String(task.id), index + 1);
  });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Exported Gantt Chart</Name>
  <Title>Gantt Export</Title>
  <Created>${new Date().toISOString()}</Created>
  <Tasks>
`;

  tasks.forEach((task, index) => {
    const uid = index + 1;
    const outlineLevel = task.parent ? 2 : 1;

    xml += `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <Name>${escapeXML(String(task.text || ''))}</Name>
      <Type>0</Type>
      <Start>${formatDateForMSProject(task.start)}</Start>
      <Finish>${formatDateForMSProject(task.end)}</Finish>
      <Duration>${formatDuration(task.duration)}</Duration>
      <PercentComplete>${Math.round((task.progress || 0) * 100)}</PercentComplete>
      <OutlineLevel>${outlineLevel}</OutlineLevel>
`;

    if (options.includeBaselines && task.base_start) {
      xml += `      <Baseline>
        <Start>${formatDateForMSProject(task.base_start)}</Start>
        <Finish>${formatDateForMSProject(task.base_end)}</Finish>
      </Baseline>
`;
    }

    xml += `    </Task>\n`;
  });

  xml += `  </Tasks>
  <Links>\n`;

  links.forEach((link, index) => {
    const sourceUid = taskMap.get(String(link.source));
    const targetUid = taskMap.get(String(link.target));

    if (sourceUid && targetUid) {
      xml += `    <Link>
      <UID>${index + 1}</UID>
      <Source>${sourceUid}</Source>
      <Target>${targetUid}</Target>
      <Type>${getLinkTypeCode(link.type)}</Type>
    </Link>\n`;
    }
  });

  xml += `  </Links>
</Project>`;

  return xml;
}

export async function exportToPNG(
  element: HTMLElement,
  options: IExportOptions & { png?: IPNGExportOptions } = { format: 'png' },
): Promise<Blob> {
  const pngOptions = options.png || {};
  const scale = pngOptions.scale || 2;
  const quality = pngOptions.quality || 1;
  const backgroundColor = pngOptions.backgroundColor || '#ffffff';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const rect = element.getBoundingClientRect();
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;

  ctx.scale(scale, scale);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, rect.width, rect.height);

  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${element.outerHTML}
        </div>
      </foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        },
        'image/png',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG for PNG export'));
    };
    img.src = url;
  });
}

export async function exportToPDF(
  element: HTMLElement,
  options: IExportOptions & { pdf?: IPDFExportOptions } = { format: 'pdf' },
): Promise<Blob> {
  const pdfOptions = options.pdf || {};
  const pageSize = pdfOptions.pageSize || 'a4';
  const orientation = pdfOptions.orientation || 'landscape';
  const fitToPage = pdfOptions.fitToPage !== false;
  const quality = pdfOptions.quality || 2;

  const pageSizes: Record<string, { width: number; height: number }> = {
    a4: { width: 297, height: 210 },
    letter: { width: 279.4, height: 215.9 },
    legal: { width: 355.6, height: 215.9 },
    a3: { width: 420, height: 297 },
  };

  const size = pageSizes[pageSize];
  const pageWidth = orientation === 'landscape' ? size.width : size.height;
  const pageHeight = orientation === 'landscape' ? size.height : size.width;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  const rect = element.getBoundingClientRect();
  canvas.width = rect.width * quality;
  canvas.height = rect.height * quality;

  ctx.scale(quality, quality);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);

  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${element.outerHTML}
        </div>
      </foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      let imgWidth = rect.width;
      let imgHeight = rect.height;

      if (fitToPage) {
        const scaleX = pageWidth / imgWidth;
        const scaleY = pageHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1);
        imgWidth *= scale;
        imgHeight *= scale;
      }

      const xOffset = (pageWidth - imgWidth) / 2;
      const yOffset = (pageHeight - imgHeight) / 2;

      const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /XObject << /Img0 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
q ${imgWidth} 0 0 ${imgHeight} ${xOffset} ${yOffset} cm /Img0 Do Q
endstream
endobj
5 0 obj
<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length 0 >>
stream
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000359 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
520
%%EOF`;

      resolve(new Blob([pdfContent], { type: 'application/pdf' }));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG for PDF export'));
    };
    img.src = url;
  });
}

export function downloadExport(
  data: string | Blob,
  filename: string,
  format: ExportFormat,
): void {
  const mimeTypes: Record<string, string> = {
    json: 'application/json',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mspx: 'application/xml',
    pdf: 'application/pdf',
    png: 'image/png',
  };

  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: mimeTypes[format] || 'text/plain' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadBlob(
  blob: Blob | Promise<Blob>,
  filename: string,
): Promise<void> {
  const resolvedBlob = await blob;
  const url = URL.createObjectURL(resolvedBlob);

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

  const tasks: ITask[] = (data.tasks || []).map((t: Record<string, unknown>) => ({
    ...t,
    start: t.start ? new Date(t.start as string) : undefined,
    end: t.end ? new Date(t.end as string) : undefined,
    base_start: t.base_start ? new Date(t.base_start as string) : undefined,
    base_end: t.base_end ? new Date(t.base_end as string) : undefined,
  }));

  const links: ILink[] = (data.links || []).map((l: Record<string, unknown>) => ({
    id: l.id as string | number,
    type: l.type as 'e2s' | 's2e' | 'e2e' | 's2s',
    source: l.source as string | number,
    target: l.target as string | number,
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
    const task: Record<string, unknown> = {};

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

function mapMSProjectLinkType(type: string): 'e2s' | 's2s' | 'e2e' | 's2e' {
  switch (type) {
    case '0':
      return 'e2s'; // finish_to_start
    case '1':
      return 's2s'; // start_to_start
    case '2':
      return 'e2e'; // finish_to_finish
    case '3':
      return 's2e'; // start_to_finish
    default:
      return 'e2s'; // finish_to_start (default)
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

function formatTaskForExport(
  task: ITask,
  options: IExportOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
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
      result[key] = (task as GanttTask)[key as keyof GanttTask];
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
