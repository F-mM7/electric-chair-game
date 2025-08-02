import { OptimalStrategy } from '../types/analysis';
import { OptimalStrategyCalculator } from './optimalStrategy';
import { ChunkedAnalysisStorage } from './chunkedAnalysisStorage';
import { decodeGameStateHash, formatHashForDisplay } from './stateHash';

/**
 * 保存済み戦略を優先的に使用する最適戦略計算機
 */
export class OptimalStrategyCalculatorWithStorage extends OptimalStrategyCalculator {
  private storage: ChunkedAnalysisStorage;
  private loadedStrategies: Map<number, OptimalStrategy> = new Map();

  constructor(drawValue: number = 0.0) {
    super(drawValue);
    this.storage = new ChunkedAnalysisStorage({
      maxBatchSize: 1000,
      precisionDigits: 6,
      saveInterval: 100,
      outputDirectory: './analysis-results',
      drawValue: drawValue
    });
    
    // 基底クラスに戦略プロバイダーを設定
    this.setStrategyProvider((stateHash: number) => {
      try {
        const state = decodeGameStateHash(stateHash);
        const strategy = this.storage.getStrategyForState(stateHash, state.turn);
        
        if (!strategy) {
          // 戦略が見つからない場合の詳細デバッグ情報
          console.error(`❌ STRATEGY LOAD ERROR: Strategy not found for state ${formatHashForDisplay(stateHash)}`);
          console.error(`🔍 Strategy load context:`);
          console.error(`   - State hash: ${formatHashForDisplay(stateHash)}`);
          console.error(`   - Turn: ${state.turn}`);
          console.error(`   - Cached strategies count: ${this.loadedStrategies.size}`);
          
          // ストレージから直接読み込みを試行
          console.error(`🔄 Attempting direct storage load...`);
          const directStrategy = this.storage.getStrategyForState(stateHash, state.turn);
          if (directStrategy) {
            console.error(`✅ Direct load successful - caching issue detected`);
            this.loadedStrategies.set(stateHash, directStrategy);
            return directStrategy;
          } else {
            console.error(`❌ Direct load also failed - strategy truly missing`);
          }
        }
        
        return strategy;
      } catch (error) {
        console.error(`❌ Error in strategy provider for state ${formatHashForDisplay(stateHash)}:`, error);
        return null;
      }
    });
  }

  /**
   * 戦略計算をオーバーライド：保存済みデータを優先
   */
  public async calculateOptimalStrategy(stateHash: number): Promise<OptimalStrategy> {
    // 1. メモリキャッシュを確認
    if (this.loadedStrategies.has(stateHash)) {
      return this.loadedStrategies.get(stateHash)!;
    }

    // 2. 保存済みストレージから読み込み
    const state = decodeGameStateHash(stateHash);
    const savedStrategy = this.storage.getStrategyForState(stateHash, state.turn);
    
    if (savedStrategy) {
      // 保存済み戦略をキャッシュして返す
      this.loadedStrategies.set(stateHash, savedStrategy);
      return savedStrategy;
    }

    // 3. 保存されていない場合は基底クラスで計算
    const strategy = await super.calculateOptimalStrategy(stateHash);
    
    // 4. 計算結果をキャッシュ
    this.loadedStrategies.set(stateHash, strategy);
    
    return strategy;
  }

  /**
   * 特定ターンの戦略を事前ロード（パフォーマンス向上）
   */
  public preloadTurnStrategies(turn: number): void {
    console.log(`📚 Preloading strategies for turn ${turn}...`);
    
    const strategies = this.storage.loadTurnStrategies(turn);
    if (strategies) {
      for (const [hash, strategy] of Object.entries(strategies)) {
        this.loadedStrategies.set(parseInt(hash, 16), strategy);
      }
      console.log(`✅ Loaded ${Object.keys(strategies).length} strategies for turn ${turn}`);
    }
  }

  /**
   * キャッシュクリア（メモリ管理）
   */
  public clearCache(): void {
    super.clearCache();
    
    // ロード済み戦略も一部クリア（最新ターンは保持）
    if (this.loadedStrategies.size > 50000) {
      const keysToDelete = Array.from(this.loadedStrategies.keys()).slice(0, 10000);
      keysToDelete.forEach(key => this.loadedStrategies.delete(key));
    }
  }

  /**
   * ロード済み戦略の統計情報
   */
  public getLoadedStrategyStats(): { cached: number, loaded: number } {
    return {
      cached: this.getCacheSize(),
      loaded: this.loadedStrategies.size
    };
  }

}