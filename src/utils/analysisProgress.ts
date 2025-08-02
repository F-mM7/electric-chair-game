import fs from 'fs';
import path from 'path';
import { AnalysisProgress, AnalysisConfig } from '../types/analysis';

const DEFAULT_CONFIG: AnalysisConfig = {
  maxBatchSize: 1000,
  precisionDigits: 6,
  saveInterval: 100,
  outputDirectory: './analysis-results'
};

/**
 * 解析進行状況を管理するクラス
 */
export class AnalysisProgressManager {
  private config: AnalysisConfig;
  private progressFilePath: string;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.progressFilePath = path.join(this.config.outputDirectory, 'progress.json');
    this.ensureOutputDirectory();
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.config.outputDirectory)) {
      fs.mkdirSync(this.config.outputDirectory, { recursive: true });
    }
  }

  /**
   * 進行状況を読み込み
   */
  public loadProgress(): AnalysisProgress {
    if (!fs.existsSync(this.progressFilePath)) {
      return this.createInitialProgress();
    }

    try {
      const data = fs.readFileSync(this.progressFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load progress, creating new:', error);
      return this.createInitialProgress();
    }
  }

  /**
   * 進行状況を保存
   */
  public saveProgress(progress: AnalysisProgress): void {
    progress.lastUpdated = new Date().toISOString();
    
    try {
      fs.writeFileSync(
        this.progressFilePath, 
        JSON.stringify(progress, null, 2), 
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save progress:', error);
      throw error;
    }
  }

  /**
   * 初期進行状況を作成
   */
  private createInitialProgress(): AnalysisProgress {
    return {
      analyzedStates: {},
      totalStates: {},
      lastUpdated: new Date().toISOString(),
      isComplete: false
    };
  }

  /**
   * 特定ターンの総状態数を設定
   */
  public setTotalStates(turn: number, count: number): void {
    const progress = this.loadProgress();
    progress.totalStates[turn] = count;
    this.saveProgress(progress);
  }

  /**
   * 特定ターンの解析済み状態数を更新
   */
  public updateAnalyzedStates(turn: number, count: number): void {
    const progress = this.loadProgress();
    progress.analyzedStates[turn] = count;
    
    // 全体の完了状況をチェック
    progress.isComplete = this.checkCompleteness(progress);
    
    this.saveProgress(progress);
  }

  /**
   * 解析完了かどうかをチェック
   */
  private checkCompleteness(progress: AnalysisProgress): boolean {
    for (const turn in progress.totalStates) {
      const total = progress.totalStates[turn];
      const analyzed = progress.analyzedStates[turn] || 0;
      
      if (analyzed < total) {
        return false;
      }
    }
    return Object.keys(progress.totalStates).length > 0;
  }

  /**
   * 次に処理すべきターンと状態数を取得
   */
  public getNextBatch(requestedSize: number): { turn: number; remainingCount: number } | null {
    const progress = this.loadProgress();
    
    // 降順でターンをチェック（大きいターンから処理）
    const sortedTurns = Object.keys(progress.totalStates)
      .map(Number)
      .sort((a, b) => b - a);

    for (const turn of sortedTurns) {
      const total = progress.totalStates[turn];
      const analyzed = progress.analyzedStates[turn] || 0;
      const remaining = total - analyzed;
      
      // 状態数が0のターンはスキップ
      if (total === 0) {
        continue;
      }
      
      if (remaining > 0) {
        return {
          turn,
          remainingCount: Math.min(remaining, requestedSize)
        };
      }
    }

    return null; // 全て完了
  }

  /**
   * 進行状況の表示用文字列を生成
   */
  public getProgressSummary(): string {
    const progress = this.loadProgress();
    const lines: string[] = [];
    
    lines.push('=== Analysis Progress ===');
    lines.push(`Last Updated: ${progress.lastUpdated}`);
    lines.push(`Status: ${progress.isComplete ? 'COMPLETE' : 'IN PROGRESS'}`);
    lines.push('');

    const sortedTurns = Object.keys(progress.totalStates)
      .map(Number)
      .sort((a, b) => b - a);

    for (const turn of sortedTurns) {
      const total = progress.totalStates[turn];
      const analyzed = progress.analyzedStates[turn] || 0;
      const percentage = total > 0 ? ((analyzed / total) * 100).toFixed(1) : '0.0';
      
      lines.push(`Turn ${turn.toString().padStart(2)}: ${analyzed.toString().padStart(6)}/${total.toString().padStart(6)} (${percentage.padStart(5)}%)`);
    }

    return lines.join('\n');
  }

  public getConfig(): AnalysisConfig {
    return { ...this.config };
  }
}