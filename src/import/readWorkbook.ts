import { parseGymSheet, type Cell, type ParseResult } from './gymSheet';

/** Reads an .xlsx/.xls file and parses every sheet. SheetJS is loaded on demand (it is large). */
export async function readGymWorkbook(file: File, today: Date = new Date()): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const result: ParseResult = { groups: [], warnings: [] };
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
    const parsed = parseGymSheet(name, rows, today);
    result.groups.push(...parsed.groups);
    result.warnings.push(...parsed.warnings);
  }
  return result;
}
