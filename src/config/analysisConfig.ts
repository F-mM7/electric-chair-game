import fs from 'fs';
import path from 'path';
import { AnalysisConfig } from '../types/analysis';

/**
 * 解析設定を管理するクラス
 */
export class AnalysisConfigManager {
  private static instance: AnalysisConfigManager;
  private config: AnalysisConfig;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), 'analysis.config.json');
    this.config = this.loadConfig();
  }

  public static getInstance(): AnalysisConfigManager {
    if (!AnalysisConfigManager.instance) {
      AnalysisConfigManager.instance = new AnalysisConfigManager();
    }
    return AnalysisConfigManager.instance;
  }

  /**
   * 設定ファイルを読み込み
   */
  private loadConfig(): AnalysisConfig {
    const defaultConfig: AnalysisConfig = {
      maxBatchSize: 1000,
      precisionDigits: 6,
      saveInterval: 100,
      outputDirectory: './analysis-results',
      drawValue: 0.0
    };

    if (!fs.existsSync(this.configPath)) {
      console.log(`⚠️  Config file not found at ${this.configPath}, using defaults`);
      return defaultConfig;
    }

    try {
      const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      
      return {
        maxBatchSize: configData.analysis?.maxBatchSize ?? defaultConfig.maxBatchSize,
        precisionDigits: configData.analysis?.precisionDigits ?? defaultConfig.precisionDigits,
        saveInterval: configData.analysis?.saveInterval ?? defaultConfig.saveInterval,
        outputDirectory: configData.analysis?.outputDirectory ?? defaultConfig.outputDirectory,
        drawValue: configData.evaluation?.draw ?? defaultConfig.drawValue
      };
    } catch (error) {
      console.warn(`⚠️  Failed to load config from ${this.configPath}:`, error);
      console.warn('Using default configuration');
      return defaultConfig;
    }
  }

  /**
   * 設定を取得
   */
  public getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  /**
   * 引き分け得点を取得
   */
  public getDrawValue(): number {
    return this.config.drawValue;
  }

  /**
   * 評価値設定を取得
   */
  public getEvaluationConfig(): {
    player1Win: number;
    player2Win: number;
    draw: number;
  } {
    return {
      player1Win: 1.0,
      player2Win: -1.0,
      draw: this.config.drawValue
    };
  }

  /**
   * 設定を更新（メモリ内のみ、ファイルは更新しない）
   */
  public updateConfig(partialConfig: Partial<AnalysisConfig>): void {
    this.config = { ...this.config, ...partialConfig };
  }

  /**
   * 設定ファイルを再読み込み
   */
  public reloadConfig(): void {
    this.config = this.loadConfig();
  }

  /**
   * 設定の表示
   */
  public displayConfig(): void {
    console.log('📋 Current Analysis Configuration:');
    console.log(`   Draw Value: ${this.config.drawValue}`);
    console.log(`   Max Batch Size: ${this.config.maxBatchSize}`);
    console.log(`   Precision Digits: ${this.config.precisionDigits}`);
    console.log(`   Save Interval: ${this.config.saveInterval}`);
    console.log(`   Output Directory: ${this.config.outputDirectory}`);
    console.log(`   Config File: ${this.configPath}`);
  }
}

/**
 * グローバル設定インスタンスを取得
 */
export function getAnalysisConfig(): AnalysisConfig {
  return AnalysisConfigManager.getInstance().getConfig();
}

/**
 * 引き分け得点を取得
 */
export function getDrawValue(): number {
  return AnalysisConfigManager.getInstance().getDrawValue();
}