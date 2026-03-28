export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  module: string;
  message: string;
  data?: any;
}

class LogService {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 100;

  info(module: string, message: string, data?: any) {
    this.addLog('info', module, message, data);
  }

  warn(module: string, message: string, data?: any) {
    this.addLog('warn', module, message, data);
  }

  error(module: string, message: string, data?: any) {
    this.addLog('error', module, message, data);
    console.error(`[${module}] ${message}`, data);
  }

  private addLog(level: LogEntry['level'], module: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new LogService();
