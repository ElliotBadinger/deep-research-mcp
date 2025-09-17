import { ResearchProgress } from './deep-research.js';
import { logger } from './infrastructure/logging/Logger.js';

export class OutputManager {
  private progressLines: number = 4;
  private progressArea: string[] = [];
  private initialized: boolean = false;

  constructor() {
    // Initialize terminal using stderr only for TTYs
    if (process.stderr.isTTY) {
      process.stderr.write('\n'.repeat(this.progressLines));
      this.initialized = true;
    }
  }

  log(...args: any[]) {
    // Move cursor up to progress area
    if (this.initialized) {
      process.stderr.write(`\x1B[${this.progressLines}A`);
      // Clear progress area
      process.stderr.write('\x1B[0J');
    }
    // Print log message using structured logging
    const message = args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
    logger.info(message, { operation: 'output_manager' });
    // Redraw progress area if initialized
    if (this.initialized) {
      this.drawProgress();
    }
  }

  updateProgress(progress: ResearchProgress) {
    this.progressArea = [
      `Depth:    [${this.getProgressBar(progress.totalDepth - progress.currentDepth, progress.totalDepth)}] ${Math.round(((progress.totalDepth - progress.currentDepth) / progress.totalDepth) * 100)}%`,
      `Breadth:  [${this.getProgressBar(progress.totalBreadth - progress.currentBreadth, progress.totalBreadth)}] ${Math.round(((progress.totalBreadth - progress.currentBreadth) / progress.totalBreadth) * 100)}%`,
      `Queries:  [${this.getProgressBar(progress.completedQueries, progress.totalQueries)}] ${Math.round((progress.completedQueries / progress.totalQueries) * 100)}%`,
      progress.currentQuery ? `Current:  ${progress.currentQuery}` : '',
    ];
    this.drawProgress();
  }

  finish() {
    // Stop progress rendering and move cursor below the progress area
    if (this.initialized) {
      this.initialized = false;
      process.stderr.write('\n');
    }
  }

  private getProgressBar(value: number, total: number): string {
    const width = process.stderr.columns
      ? Math.min(30, process.stderr.columns - 20)
      : 30;
    const filled = Math.round((width * value) / total);
    return '█'.repeat(filled) + ' '.repeat(width - filled);
  }

  private drawProgress() {
    if (!this.initialized || this.progressArea.length === 0) return;

    // Move cursor to progress area
    const terminalHeight = process.stderr.rows || 24;
    process.stderr.write(`\x1B[${terminalHeight - this.progressLines};1H`);

    // Draw each line of the progress area
    for (const line of this.progressArea) {
      process.stderr.write(line + '\n');
    }
  }
}
