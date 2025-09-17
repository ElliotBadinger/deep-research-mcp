import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface LogEntry {
  level: number;
  time: number;
  msg: string;
  operation?: string;
  error?: string;
  stack?: string;
  [key: string]: any;
}

export class LogReader {
  private logFile: string;

  constructor(logFile?: string) {
    this.logFile = logFile || resolve(process.cwd(), 'app.log');
    
    // Create log file if it doesn't exist
    try {
      if (!existsSync(this.logFile)) {
        require('fs').writeFileSync(this.logFile, '');
      }
    } catch {}
  }

  getRecentLogs(lines: number = 50): LogEntry[] {
    if (!existsSync(this.logFile)) {
      return [];
    }

    try {
      const content = readFileSync(this.logFile, 'utf-8');
      const logLines = content.trim().split('\n').slice(-lines);
      
      return logLines
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is LogEntry => entry !== null);
    } catch {
      return [];
    }
  }

  getErrorLogs(since?: Date): LogEntry[] {
    const logs = this.getRecentLogs(200);
    const sinceTime = since?.getTime() || Date.now() - 3600000; // 1 hour ago
    
    return logs.filter(log => 
      log.level >= 50 && // ERROR level
      log.time >= sinceTime
    );
  }

  getOperationLogs(operation: string, since?: Date): LogEntry[] {
    const logs = this.getRecentLogs(200);
    const sinceTime = since?.getTime() || Date.now() - 3600000;
    
    return logs.filter(log => 
      log.operation === operation &&
      log.time >= sinceTime
    );
  }
}