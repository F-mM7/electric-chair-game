import { AnalysisProgressManager } from '../utils/analysisProgress';
import { AnalysisStorage } from '../utils/analysisStorage';
import { ChunkedAnalysisStorage } from '../utils/chunkedAnalysisStorage';
import { OptimalStrategyCalculatorWithStorage } from '../utils/optimalStrategyWithStorage';
import { formatHashForDisplay, decodeGameStateHash } from '../utils/stateHash';
import { AnalysisConfig, TurnAnalysisResult, OptimalStrategy } from '../types/analysis';  
import { checkHashDataAvailability, getAllTurnCounts, loadTurnHashRange } from '../utils/hashLoader';
import { getAnalysisConfig } from '../config/analysisConfig';

/**
 * ゲーム戦略解析のメインエンジン
 */
export class AnalysisEngine {
  private progressManager: AnalysisProgressManager;
  private storage: AnalysisStorage;
  private chunkedStorage: ChunkedAnalysisStorage;
  private calculator: OptimalStrategyCalculatorWithStorage;
  private config: AnalysisConfig;
  private useChunkedStorage: boolean;

  constructor(config: Partial<AnalysisConfig> = {}) {
    // 設定ファイルから基本設定を読み込み、パラメータでオーバーライド
    const fileConfig = getAnalysisConfig();
    this.config = {
      ...fileConfig,
      ...config
    };

    this.progressManager = new AnalysisProgressManager(this.config);
    this.storage = new AnalysisStorage(this.config);
    this.chunkedStorage = new ChunkedAnalysisStorage(this.config, 1000);
    this.calculator = new OptimalStrategyCalculatorWithStorage(this.config.drawValue);
    this.useChunkedStorage = true; // デフォルトでチャンク分割保存を使用
  }

  /**
   * 全解析の初期化
   * state-hashesディレクトリからハッシュデータを読み込み
   */
  public async initializeAnalysis(): Promise<void> {
    console.log('🔍 Checking hash data availability...');
    
    // state-hashesディレクトリの状況確認
    const hashCheck = checkHashDataAvailability();
    
    if (!hashCheck.available) {
      console.log('❌ No hash data found.');
      console.log('💡 Run: npm run generate-hashes');
      throw new Error(hashCheck.message);
    }
    
    console.log(`✅ ${hashCheck.message}`);
    
    // チャンク分割ファイルから状態数を取得
    const turnCounts = getAllTurnCounts();
    console.log(`📊 Loading state counts from chunked files...`);
    
    // 進行状況を初期化
    const progress = this.progressManager.loadProgress();
    progress.totalStates = turnCounts;
    
    // ターン別の状態数を表示
    const sortedTurns = Object.keys(turnCounts).map(Number).sort((a, b) => b - a);
    for (const turn of sortedTurns) {
      console.log(`📋 Turn ${turn.toString().padStart(2)}: ${turnCounts[turn].toString().padStart(8)} states`);
    }
    
    this.progressManager.saveProgress(progress);
    console.log(`✅ Complete analysis initialization complete - ${hashCheck.totalStates} total states`);
  }

  /**
   * 現在の解析対象ターンの戦略を事前ロード（スクリプト開始時に一度だけ実行）
   */
  public async preloadStrategiesForCurrentAnalysis(): Promise<void> {
    const batch = this.progressManager.getNextBatch(1); // 処理対象ターンを取得
    
    if (!batch) {
      console.log('🎉 No analysis needed - all complete!');
      return;
    }

    const currentTurn = batch.turn;
    console.log(`📚 Preloading strategies for analysis of turn ${currentTurn}...`);
    
    // 次のターンの戦略を事前ロード（パフォーマンス向上）
    if (currentTurn > 0) {
      const progress = this.progressManager.loadProgress();
      const nextTurn = currentTurn + 1;
      const nextTurnTotal = progress.totalStates[nextTurn] || 0;
      const nextTurnAnalyzed = progress.analyzedStates[nextTurn] || 0;
      
      if (nextTurnTotal > 0 && nextTurnAnalyzed === nextTurnTotal) {
        console.log(`📋 Loading strategies for turn ${nextTurn} (${nextTurnTotal} states)...`);
        this.calculator.preloadTurnStrategies(nextTurn);
        console.log(`✅ Turn ${nextTurn} strategies loaded successfully`);
      } else {
        console.log(`⚠️  Turn ${nextTurn} not ready for preload (${nextTurnAnalyzed}/${nextTurnTotal} analyzed)`);
      }
    } else {
      console.log(`ℹ️  Turn ${currentTurn} is terminal turn - no preload needed`);
    }
  }

  /**
   * 指定数の盤面を解析
   */
  public async analyzeBatch(requestedCount: number): Promise<number> {
    const batch = this.progressManager.getNextBatch(requestedCount);
    
    if (!batch) {
      console.log('🎉 All analysis complete!');
      return 0;
    }

    console.log(`🔄 Analyzing turn ${batch.turn}: ${batch.remainingCount} states`);
    
    // 進行状況を取得
    const progress = this.progressManager.loadProgress();
    const alreadyAnalyzed = progress.analyzedStates[batch.turn] || 0;
    
    // チャンク分割ファイルから該当範囲のハッシュを直接読み込み
    const statesToAnalyze = loadTurnHashRange(batch.turn, alreadyAnalyzed, batch.remainingCount);
    
    if (statesToAnalyze.length === 0) {
      console.log(`⚠️  No states to analyze for turn ${batch.turn}`);
      return 0;
    }
    
    // 戦略を計算
    const strategies: Record<number, OptimalStrategy> = {};
    let processedCount = 0;

    for (const stateHash of statesToAnalyze) {
      try {
        const strategy = await this.calculator.calculateOptimalStrategy(stateHash);
        strategies[stateHash] = strategy;
        
        processedCount++;

        // 進捗表示
        if (processedCount % 100 === 0) {
          console.log(`  📈 Processed ${processedCount}/${statesToAnalyze.length} states`);
        }

      } catch (error) {
        console.error(`❌ CRITICAL ERROR: Failed to analyze state ${formatHashForDisplay(stateHash)}`);
        console.error(`🔍 Error details:`, error);
        console.error(`📊 Analysis context:`);
        console.error(`   - Current batch: ${batch.turn}`);
        console.error(`   - State hash: ${stateHash}`);
        console.error(`   - Progress: ${processedCount}/${statesToAnalyze.length} states processed`);
        console.error(`   - Already analyzed this turn: ${alreadyAnalyzed}`);
        
        // 状態の詳細情報を出力
        try {
          const gameState = decodeGameStateHash(stateHash);
          console.error(`🎮 Game state details:`, gameState);
        } catch (decodeError) {
          console.error(`⚠️  Could not decode game state: ${decodeError}`);
        }
        
        // 解析を停止
        console.error(`🛑 Stopping analysis due to critical error`);
        process.exit(1);
      }
    }

    // 結果を保存
    const turnResult: TurnAnalysisResult = {
      turn: batch.turn,
      strategies,
      stateHashes: statesToAnalyze,
      transitionCount: processedCount
    };

    if (this.useChunkedStorage) {
      this.chunkedStorage.saveTurnResults(turnResult);
    } else {
      this.storage.saveTurnResults(turnResult);
    }

    // 進行状況を更新
    progress.analyzedStates[batch.turn] = alreadyAnalyzed + processedCount;
    this.progressManager.saveProgress(progress);

    console.log(`✅ Turn ${batch.turn}: Analyzed ${processedCount} states (${progress.analyzedStates[batch.turn]}/${progress.totalStates[batch.turn]} total)`);
    
    // ターン完了の通知
    if (progress.analyzedStates[batch.turn] === progress.totalStates[batch.turn]) {
      console.log(`🎯 Turn ${batch.turn} completed!`);
    }
    
    return processedCount;
  }


  /**
   * 解析の進行状況を表示
   */
  public displayProgress(): void {
    console.log(this.progressManager.getProgressSummary());
    console.log('\n' + '='.repeat(50));
    
    const summary = this.storage.getAnalysisSummary();
    console.log(`📊 Storage Summary:`);
    console.log(`   Total Turns Analyzed: ${summary.totalTurns}`);
    console.log(`   Total States: ${summary.totalStates}`);
    console.log(`   Total Strategies: ${summary.totalStrategies}`);
    console.log(`   Cache Size: ${this.calculator.getCacheSize()}`);
  }

  /**
   * 特定状態の戦略を取得
   */
  public getStrategyForState(stateHash: number, turn: number): OptimalStrategy | null {
    if (this.useChunkedStorage) {
      return this.chunkedStorage.getStrategyForState(stateHash, turn);
    }
    return this.storage.getStrategyForState(stateHash, turn);
  }

  /**
   * 解析完了かどうかをチェック
   */
  public isAnalysisComplete(): boolean {
    const progress = this.progressManager.loadProgress();
    return progress.isComplete;
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.calculator.clearCache();
    if (this.useChunkedStorage) {
      this.chunkedStorage.clearCache();
    }
    console.log('🧹 Strategy cache cleared');
  }

  /**
   * 全解析結果を削除
   */
  public clearAllResults(): void {
    if (this.useChunkedStorage) {
      this.chunkedStorage.clearAllResults();
    } else {
      this.storage.clearAllResults();
    }
    
    // 進行状況もリセット
    const progress = this.progressManager.loadProgress();
    progress.analyzedStates = {};
    progress.isComplete = false;
    this.progressManager.saveProgress(progress);
    
    this.clearCache();
    console.log('🧹 All analysis data cleared');
  }

  /**
   * 設定を取得
   */
  public getConfig(): AnalysisConfig {
    return { ...this.config };
  }
}