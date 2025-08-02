import fs from 'fs';
import path from 'path';
import { OptimalStrategy, TurnAnalysisResult, AnalysisConfig } from '../types/analysis';

/**
 * 解析結果の保存・読み込みを管理するクラス
 */
export class AnalysisStorage {
  private config: AnalysisConfig;

  constructor(config: AnalysisConfig) {
    this.config = config;
    this.ensureDirectoryStructure();
  }

  /**
   * 必要なディレクトリ構造を作成
   */
  private ensureDirectoryStructure(): void {
    if (!fs.existsSync(this.config.outputDirectory)) {
      fs.mkdirSync(this.config.outputDirectory, { recursive: true });
    }
  }

  /**
   * ターン別結果を保存
   */
  public saveTurnResults(turnResult: TurnAnalysisResult): void {
    const turnDir = path.join(this.config.outputDirectory, `turn-${turnResult.turn}`);
    
    if (!fs.existsSync(turnDir)) {
      fs.mkdirSync(turnDir, { recursive: true });
    }

    // 戦略データを保存
    const strategiesPath = path.join(turnDir, 'strategies.json');
    const strategiesData = this.formatStrategiesForSave(turnResult.strategies);
    fs.writeFileSync(strategiesPath, JSON.stringify(strategiesData, null, 2));

    // 状態ハッシュリストを保存
    const statesPath = path.join(turnDir, 'states.json');
    const statesData = {
      turn: turnResult.turn,
      stateHashes: turnResult.stateHashes,
      count: turnResult.stateHashes.length,
      transitionCount: turnResult.transitionCount,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(statesPath, JSON.stringify(statesData, null, 2));

    console.log(`✅ Turn ${turnResult.turn}: Saved ${turnResult.stateHashes.length} strategies`);
  }

  /**
   * 戦略データを保存形式にフォーマット
   */
  private formatStrategiesForSave(strategies: Record<number, OptimalStrategy>): any {
    const formatted: any = {
      metadata: {
        precision: this.config.precisionDigits,
        savedAt: new Date().toISOString(),
        count: Object.keys(strategies).length
      },
      strategies: {}
    };

    for (const [hashStr, strategy] of Object.entries(strategies)) {
      const hash = parseInt(hashStr);
      const hexHashStr = hash.toString(16);
      formatted.strategies[hexHashStr] = {
        player1Probabilities: strategy.player1Probabilities.map(prob => 
          this.roundToPrecision(prob, this.config.precisionDigits)
        ),
        player2Probabilities: strategy.player2Probabilities.map(prob => 
          this.roundToPrecision(prob, this.config.precisionDigits)
        ),
        expectedValue: this.roundToPrecision(strategy.expectedValue, this.config.precisionDigits),
        isCalculated: strategy.isCalculated
      };
    }

    return formatted;
  }

  /**
   * 指定ターンの戦略を読み込み
   */
  public loadTurnStrategies(turn: number): Record<number, OptimalStrategy> | null {
    const strategiesPath = path.join(this.config.outputDirectory, `turn-${turn}`, 'strategies.json');
    
    if (!fs.existsSync(strategiesPath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(strategiesPath, 'utf-8'));
      const strategies: Record<number, OptimalStrategy> = {};

      for (const [hexHashStr, strategyData] of Object.entries(data.strategies)) {
        const hash = parseInt(hexHashStr, 16);
        strategies[hash] = strategyData as OptimalStrategy;
      }

      return strategies;
    } catch (error) {
      console.error(`Failed to load strategies for turn ${turn}:`, error);
      return null;
    }
  }

  /**
   * 指定ターンの状態リストを読み込み
   */
  public loadTurnStates(turn: number): number[] | null {
    const statesPath = path.join(this.config.outputDirectory, `turn-${turn}`, 'states.json');
    
    if (!fs.existsSync(statesPath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(statesPath, 'utf-8'));
      return data.stateHashes;
    } catch (error) {
      console.error(`Failed to load states for turn ${turn}:`, error);
      return null;
    }
  }

  /**
   * 特定の状態ハッシュの戦略を取得
   */
  public getStrategyForState(stateHash: number, turn: number): OptimalStrategy | null {
    const strategies = this.loadTurnStrategies(turn);
    return strategies?.[stateHash] || null;
  }

  /**
   * 解析済みターンのリストを取得
   */
  public getAnalyzedTurns(): number[] {
    const turns: number[] = [];
    
    if (!fs.existsSync(this.config.outputDirectory)) {
      return turns;
    }

    const entries = fs.readdirSync(this.config.outputDirectory);
    
    for (const entry of entries) {
      const match = entry.match(/^turn-(\d+)$/);
      if (match) {
        const turn = parseInt(match[1]);
        const strategiesPath = path.join(this.config.outputDirectory, entry, 'strategies.json');
        
        if (fs.existsSync(strategiesPath)) {
          turns.push(turn);
        }
      }
    }

    return turns.sort((a, b) => b - a); // 降順
  }

  /**
   * 解析結果のサマリーを取得
   */
  public getAnalysisSummary(): {
    totalTurns: number;
    totalStates: number;
    totalStrategies: number;
    turns: Array<{turn: number, states: number, strategies: number}>;
  } {
    const analyzedTurns = this.getAnalyzedTurns();
    let totalStates = 0;
    let totalStrategies = 0;
    const turnDetails: Array<{turn: number, states: number, strategies: number}> = [];

    for (const turn of analyzedTurns) {
      const states = this.loadTurnStates(turn);
      const strategies = this.loadTurnStrategies(turn);
      
      const stateCount = states?.length || 0;
      const strategyCount = strategies ? Object.keys(strategies).length : 0;
      
      totalStates += stateCount;
      totalStrategies += strategyCount;
      
      turnDetails.push({
        turn,
        states: stateCount,
        strategies: strategyCount
      });
    }

    return {
      totalTurns: analyzedTurns.length,
      totalStates,
      totalStrategies,
      turns: turnDetails
    };
  }

  /**
   * 数値を指定精度で丸める
   */
  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * 特定ターンの結果ファイルを削除
   */
  public deleteTurnResults(turn: number): boolean {
    const turnDir = path.join(this.config.outputDirectory, `turn-${turn}`);
    
    if (!fs.existsSync(turnDir)) {
      return false;
    }

    try {
      fs.rmSync(turnDir, { recursive: true, force: true });
      console.log(`🗑️  Deleted results for turn ${turn}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete turn ${turn} results:`, error);
      return false;
    }
  }

  /**
   * 全解析結果を削除
   */
  public clearAllResults(): void {
    const analyzedTurns = this.getAnalyzedTurns();
    
    for (const turn of analyzedTurns) {
      this.deleteTurnResults(turn);
    }

    console.log(`🧹 Cleared all analysis results`);
  }
}