import { ipcMain, shell } from 'electron';
import { existsSync } from 'fs';
import { IPC } from '../../shared/channels';
import type {
  DownloadRecord,
  DownloadRecordWithStatus,
  WikiFileHistoryRecord,
  WikiFileHistoryRecordWithStatus
} from '../../shared/types';
import { loadHistory, addRecord, updateTranscription, removeRecord } from '../services/history';
import {
  loadWikiHistory,
  addWikiHistoryRecord,
  updateWikiSummaryPath
} from '../services/wikiHistory';

export function registerHistoryHandlers(): void {
  ipcMain.handle(IPC.GET_HISTORY, () => {
    const records = loadHistory();
    const withStatus: DownloadRecordWithStatus[] = records.map((r) => ({
      ...r,
      fileExists: existsSync(r.filePath),
      txtExists: r.txtPath ? existsSync(r.txtPath) : false,
      summaryExists: r.summaryPath ? existsSync(r.summaryPath) : false
    }));
    return { success: true, records: withStatus };
  });

  ipcMain.handle(IPC.ADD_HISTORY, (_event, record: DownloadRecord) => {
    addRecord(record);
    return { success: true };
  });

  ipcMain.handle(
    IPC.UPDATE_HISTORY_TRANSCRIPTION,
    (_event, contentId: string, txtPath: string, summaryPath?: string) => {
      updateTranscription(contentId, txtPath, summaryPath);
      return { success: true };
    }
  );

  ipcMain.handle(IPC.REMOVE_HISTORY, (_event, contentId: string) => {
    removeRecord(contentId);
    return { success: true };
  });

  ipcMain.handle(IPC.SHOW_IN_FOLDER, (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  ipcMain.handle(IPC.GET_WIKI_FILE_HISTORY, () => {
    const records = loadWikiHistory();
    const withStatus: WikiFileHistoryRecordWithStatus[] = records.map((r) => ({
      ...r,
      fileExists: existsSync(r.filePath),
      summaryExists: r.summaryPath ? existsSync(r.summaryPath) : false
    }));
    return { success: true, records: withStatus };
  });

  ipcMain.handle(IPC.ADD_WIKI_FILE_HISTORY, (_event, record: WikiFileHistoryRecord) => {
    addWikiHistoryRecord(record);
    return { success: true };
  });

  ipcMain.handle(
    IPC.UPDATE_WIKI_FILE_SUMMARY,
    (_event, downloadUrl: string, summaryPath: string) => {
      updateWikiSummaryPath(downloadUrl, summaryPath);
      return { success: true };
    }
  );
}
