import { join } from 'path';
import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { WikiFileHistoryRecord } from '../../shared/types';

const WIKI_HISTORY_FILE = join(app.getPath('userData'), 'wiki-file-history.json');

export function loadWikiHistory(): WikiFileHistoryRecord[] {
  if (!existsSync(WIKI_HISTORY_FILE)) return [];
  try {
    const raw = readFileSync(WIKI_HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as WikiFileHistoryRecord[];
  } catch {
    return [];
  }
}

function saveWikiHistory(records: WikiFileHistoryRecord[]): void {
  writeFileSync(WIKI_HISTORY_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export function addWikiHistoryRecord(record: WikiFileHistoryRecord): void {
  const records = loadWikiHistory();
  const idx = records.findIndex((r) => r.downloadUrl === record.downloadUrl);
  if (idx >= 0) {
    record.summaryPath = record.summaryPath ?? records[idx].summaryPath;
    records[idx] = record;
  } else {
    records.push(record);
  }
  saveWikiHistory(records);
}

export function updateWikiSummaryPath(downloadUrl: string, summaryPath: string): void {
  const records = loadWikiHistory();
  const target = records.find((r) => r.downloadUrl === downloadUrl);
  if (!target) return;
  target.summaryPath = summaryPath;
  saveWikiHistory(records);
}
