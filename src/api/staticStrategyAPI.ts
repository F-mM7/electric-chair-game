import { OptimalStrategy } from '../types/analysis';
import { decodeGameStateHash } from '../utils/stateHash';

/**
 * 静的ファイルから解析結果を読み込むAPI
 * 解析結果JSONファイルを直接fetchで取得
 */
export class StaticStrategyAPI {
  private cache: Map<string, any> = new Map();
  private baseUrl: string;

  constructor(baseUrl = '/analysis-results') {
    this.baseUrl = baseUrl;
  }

  /**
   * 特定ターンのインデックスファイルを読み込み
   */
  private async loadTurnIndex(turn: number): Promise<any> {
    const cacheKey = `index-${turn}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.baseUrl}/turn-${turn}/index.json`);
      if (!response.ok) {
        return null;
      }
      
      const index = await response.json();
      this.cache.set(cacheKey, index);
      return index;
    } catch (error) {
      console.error(`Failed to load index for turn ${turn}:`, error);
      return null;
    }
  }

  /**
   * 特定チャンクファイルを読み込み
   */
  private async loadChunk(turn: number, chunkNumber: number): Promise<any> {
    const cacheKey = `chunk-${turn}-${chunkNumber}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const chunkFileName = `chunk-${chunkNumber.toString().padStart(4, '0')}.json`;
      const response = await fetch(`${this.baseUrl}/turn-${turn}/chunks/${chunkFileName}`);
      
      if (!response.ok) {
        return null;
      }
      
      const chunk = await response.json();
      this.cache.set(cacheKey, chunk);
      return chunk;
    } catch (error) {
      console.error(`Failed to load chunk ${chunkNumber} for turn ${turn}:`, error);
      return null;
    }
  }

  /**
   * 単一の状態ハッシュから戦略を取得
   */
  public async getStrategy(stateHash: number): Promise<OptimalStrategy | null> {
    try {
      const state = decodeGameStateHash(stateHash);
      const index = await this.loadTurnIndex(state.turn);
      
      if (!index || !index.hashToChunk) {
        return null;
      }

      const hexHashStr = (stateHash >>> 0).toString(16);
      const chunkNumber = index.hashToChunk[hexHashStr];
      if (chunkNumber === undefined) {
        return null;
      }

      const chunk = await this.loadChunk(state.turn, chunkNumber);
      if (!chunk || !chunk.strategies) {
        return null;
      }

      return chunk.strategies[hexHashStr] || null;
    } catch (error) {
      console.error('Failed to get strategy:', error);
      return null;
    }
  }

  /**
   * 複数の状態ハッシュから戦略を一括取得
   */
  public async getStrategies(stateHashes: number[]): Promise<Record<number, OptimalStrategy>> {
    const result: Record<number, OptimalStrategy> = {};
    
    // ターンごとにグループ化
    const hashByTurn = new Map<number, number[]>();
    
    for (const hash of stateHashes) {
      const state = decodeGameStateHash(hash);
      if (!hashByTurn.has(state.turn)) {
        hashByTurn.set(state.turn, []);
      }
      hashByTurn.get(state.turn)!.push(hash);
    }

    // ターンごとに処理
    for (const [turn, hashes] of hashByTurn) {
      const index = await this.loadTurnIndex(turn);
      if (!index) continue;

      // チャンクごとにグループ化
      const chunkToHashes = new Map<number, number[]>();
      
      for (const hash of hashes) {
        const hexHashStr = (hash >>> 0).toString(16);
        const chunkNumber = index.hashToChunk[hexHashStr];
        if (chunkNumber !== undefined) {
          if (!chunkToHashes.has(chunkNumber)) {
            chunkToHashes.set(chunkNumber, []);
          }
          chunkToHashes.get(chunkNumber)!.push(hash);
        }
      }

      // チャンクを読み込んで戦略を取得
      for (const [chunkNumber, chunkHashes] of chunkToHashes) {
        const chunk = await this.loadChunk(turn, chunkNumber);
        if (chunk && chunk.strategies) {
          for (const hash of chunkHashes) {
            const hexHashStr = (hash >>> 0).toString(16);
            if (chunk.strategies[hexHashStr]) {
              result[hash] = chunk.strategies[hexHashStr];
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * 解析進捗を取得
   */
  public async getAnalysisProgress(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/progress.json`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch analysis progress:', error);
      return null;
    }
  }

  /**
   * 解析済みターンのリストを取得
   */
  public async getAnalyzedTurns(): Promise<number[]> {
    const progress = await this.getAnalysisProgress();
    if (!progress || !progress.analyzedStates) {
      return [];
    }

    return Object.keys(progress.analyzedStates)
      .map(Number)
      .sort((a, b) => b - a);
  }

  /**
   * 状態の詳細情報と戦略を合わせて取得
   */
  public async getStrategyWithDetails(stateHash: number): Promise<{
    state: ReturnType<typeof decodeGameStateHash>;
    strategy: OptimalStrategy | null;
  } | null> {
    const strategy = await this.getStrategy(stateHash);
    if (!strategy) return null;

    const state = decodeGameStateHash(stateHash);
    return {
      state,
      strategy
    };
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

// シングルトンインスタンス
let apiInstance: StaticStrategyAPI | null = null;

/**
 * StaticStrategyAPIのシングルトンインスタンスを取得
 */
export function getStaticStrategyAPI(baseUrl?: string): StaticStrategyAPI {
  if (!apiInstance || baseUrl) {
    apiInstance = new StaticStrategyAPI(baseUrl);
  }
  return apiInstance;
}