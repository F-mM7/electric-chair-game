import fs from 'fs';
import path from 'path';
import { OptimalStrategy, TurnAnalysisResult, AnalysisConfig } from '../types/analysis';

interface ChunkIndex {
  version: string;
  chunkSize: number;
  totalChunks: number;
  totalStates: number;
  hashToChunk: Record<string, number>;
}

interface ChunkData {
  chunkNumber: number;
  strategies: Record<string, OptimalStrategy>;
  count: number;
}

/**
 * チャンク分割による解析結果の保存・読み込みを管理するクラス
 * ハッシュ値からの高速検索をサポート
 */
export class ChunkedAnalysisStorage {
  private config: AnalysisConfig;
  private chunkSize: number;
  private indexCache: Map<number, ChunkIndex> = new Map();
  private chunkCache: Map<string, ChunkData> = new Map();
  private maxCacheSize = 10; // キャッシュするチャンク数

  constructor(config: AnalysisConfig, chunkSize = 1000) {
    this.config = config;
    this.chunkSize = chunkSize;
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
   * ターン別結果を保存（追記モード対応）
   */
  public saveTurnResults(turnResult: TurnAnalysisResult): void {
    const turnDir = path.join(this.config.outputDirectory, `turn-${turnResult.turn}`);
    const chunksDir = path.join(turnDir, 'chunks');
    
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    // 既存のインデックスを読み込み（なければ新規作成）
    let index = this.loadIndex(turnResult.turn);
    if (!index) {
      index = {
        version: '1.0',
        chunkSize: this.chunkSize,
        totalChunks: 0,
        totalStates: 0,
        hashToChunk: {}
      };
    }

    // 戦略を既存チャンクに追加または新規チャンク作成
    const strategiesByChunk = new Map<number, Record<number, OptimalStrategy>>();
    
    for (const [hashStr, strategy] of Object.entries(turnResult.strategies)) {
      const hash = parseInt(hashStr);
      const hexHashStr = (hash >>> 0).toString(16);
      
      // 既存のチャンク番号を確認
      let chunkNumber = index.hashToChunk[hexHashStr];
      
      if (chunkNumber === undefined) {
        // 新規ハッシュ値の場合、適切なチャンクを決定
        chunkNumber = Math.floor(index.totalStates / this.chunkSize);
        index.hashToChunk[hexHashStr] = chunkNumber;
        index.totalStates++;
      }
      
      if (!strategiesByChunk.has(chunkNumber)) {
        strategiesByChunk.set(chunkNumber, {});
      }
      
      strategiesByChunk.get(chunkNumber)![hash] = strategy;
    }

    // チャンクごとに保存
    for (const [chunkNumber, strategies] of strategiesByChunk) {
      this.saveChunk(turnResult.turn, chunkNumber, strategies);
      index.totalChunks = Math.max(index.totalChunks, chunkNumber + 1);
    }

    // インデックスを更新
    this.saveIndex(turnResult.turn, index);

    console.log(`✅ Turn ${turnResult.turn}: Saved ${Object.keys(turnResult.strategies).length} strategies across ${strategiesByChunk.size} chunks`);
  }

  /**
   * 特定の状態ハッシュの戦略を高速取得
   */
  public getStrategyForState(stateHash: number, turn: number): OptimalStrategy | null {
    const index = this.loadIndex(turn);
    if (!index) return null;

    const hexHashStr = (stateHash >>> 0).toString(16);
    const chunkNumber = index.hashToChunk[hexHashStr];
    if (chunkNumber === undefined) return null;

    const chunk = this.loadChunk(turn, chunkNumber);
    if (!chunk) return null;

    // チャンク内では16進数キーで保存されているため、16進数で検索
    return chunk.strategies[(stateHash >>> 0).toString(16)] || null;
  }

  /**
   * 複数の状態ハッシュの戦略を一括取得（効率的）
   */
  public getStrategiesForStates(stateHashes: number[], turn: number): Record<number, OptimalStrategy> {
    const index = this.loadIndex(turn);
    if (!index) return {};

    const result: Record<number, OptimalStrategy> = {};
    const chunkToHashes = new Map<number, number[]>();

    // ハッシュ値をチャンクごとにグループ化
    for (const hash of stateHashes) {
      const chunkNumber = index.hashToChunk[(hash >>> 0).toString(16)];
      if (chunkNumber !== undefined) {
        if (!chunkToHashes.has(chunkNumber)) {
          chunkToHashes.set(chunkNumber, []);
        }
        chunkToHashes.get(chunkNumber)!.push(hash);
      }
    }

    // チャンクごとに読み込み
    for (const [chunkNumber, hashes] of chunkToHashes) {
      const chunk = this.loadChunk(turn, chunkNumber);
      if (chunk) {
        for (const hash of hashes) {
          const hexHashStr = (hash >>> 0).toString(16);
          if (chunk.strategies[hexHashStr]) {
            result[hash] = chunk.strategies[hexHashStr];
          }
        }
      }
    }

    return result;
  }

  /**
   * インデックスを読み込み（キャッシュ付き）
   */
  private loadIndex(turn: number): ChunkIndex | null {
    if (this.indexCache.has(turn)) {
      return this.indexCache.get(turn)!;
    }

    const indexPath = path.join(this.config.outputDirectory, `turn-${turn}`, 'index.json');
    if (!fs.existsSync(indexPath)) {
      return null;
    }

    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      this.indexCache.set(turn, index);
      return index;
    } catch (error) {
      console.error(`Failed to load index for turn ${turn}:`, error);
      return null;
    }
  }

  /**
   * インデックスを保存
   */
  private saveIndex(turn: number, index: ChunkIndex): void {
    const indexPath = path.join(this.config.outputDirectory, `turn-${turn}`, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    this.indexCache.set(turn, index);
  }

  /**
   * チャンクを読み込み（キャッシュ付き）
   */
  private loadChunk(turn: number, chunkNumber: number): ChunkData | null {
    const cacheKey = `${turn}-${chunkNumber}`;
    
    if (this.chunkCache.has(cacheKey)) {
      return this.chunkCache.get(cacheKey)!;
    }

    const chunkPath = path.join(
      this.config.outputDirectory, 
      `turn-${turn}`, 
      'chunks', 
      `chunk-${chunkNumber.toString().padStart(4, '0')}.json`
    );

    if (!fs.existsSync(chunkPath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
      
      // キャッシュサイズ制限
      if (this.chunkCache.size >= this.maxCacheSize) {
        const firstKey = this.chunkCache.keys().next().value;
        if (firstKey !== undefined) {
          this.chunkCache.delete(firstKey);
        }
      }
      
      this.chunkCache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Failed to load chunk ${chunkNumber} for turn ${turn}:`, error);
      return null;
    }
  }

  /**
   * チャンクを保存（既存データとマージ）
   */
  private saveChunk(turn: number, chunkNumber: number, newStrategies: Record<number, OptimalStrategy>): void {
    const chunkPath = path.join(
      this.config.outputDirectory, 
      `turn-${turn}`, 
      'chunks', 
      `chunk-${chunkNumber.toString().padStart(4, '0')}.json`
    );

    // 既存のチャンクを読み込み
    let existingData = this.loadChunk(turn, chunkNumber);
    if (!existingData) {
      existingData = {
        chunkNumber,
        strategies: {},
        count: 0
      };
    }

    // 新しい戦略をマージ（16進数キー形式に変換）
    for (const [numKey, strategy] of Object.entries(newStrategies)) {
      const hash = typeof numKey === 'string' ? parseInt(numKey) : numKey;
      const hexKey = (hash >>> 0).toString(16);
      existingData.strategies[hexKey] = strategy;
    }
    existingData.count = Object.keys(existingData.strategies).length;

    // 保存
    const chunkData: ChunkData = {
      chunkNumber: existingData.chunkNumber,
      strategies: this.formatStrategiesForSave(existingData.strategies),
      count: existingData.count
    };

    fs.writeFileSync(chunkPath, JSON.stringify(chunkData, null, 2));
    
    // キャッシュを更新
    const cacheKey = `${turn}-${chunkNumber}`;
    this.chunkCache.set(cacheKey, chunkData);
  }


  /**
   * 戦略データを保存形式にフォーマット
   */
  private formatStrategiesForSave(strategies: Record<string, OptimalStrategy>): Record<string, OptimalStrategy> {
    const formatted: Record<string, OptimalStrategy> = {};

    for (const [hexHashStr, strategy] of Object.entries(strategies)) {
      formatted[hexHashStr] = {
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
   * 数値を指定精度で丸める
   */
  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.indexCache.clear();
    this.chunkCache.clear();
  }

  /**
   * 特定ターンの全戦略を読み込み
   */
  public loadTurnStrategies(turn: number): Record<number, OptimalStrategy> | null {
    const index = this.loadIndex(turn);
    if (!index) {
      return null;
    }

    const allStrategies: Record<number, OptimalStrategy> = {};
    
    // 全チャンクを読み込み
    for (let chunkNumber = 0; chunkNumber < index.totalChunks; chunkNumber++) {
      const chunk = this.loadChunk(turn, chunkNumber);
      if (chunk && chunk.strategies) {
        // 16進数キーを数値キーに変換して結果に追加
        for (const [hexKey, strategy] of Object.entries(chunk.strategies)) {
          const numKey = parseInt(hexKey, 16);
          allStrategies[numKey] = strategy;
        }
      }
    }

    return Object.keys(allStrategies).length > 0 ? allStrategies : null;
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
        const indexPath = path.join(this.config.outputDirectory, entry, 'index.json');
        
        if (fs.existsSync(indexPath)) {
          turns.push(turn);
        }
      }
    }

    return turns.sort((a, b) => b - a);
  }

  /**
   * 特定ターンの結果を削除
   */
  public deleteTurnResults(turn: number): boolean {
    const turnDir = path.join(this.config.outputDirectory, `turn-${turn}`);
    
    if (!fs.existsSync(turnDir)) {
      return false;
    }

    try {
      fs.rmSync(turnDir, { recursive: true, force: true });
      this.indexCache.delete(turn);
      
      // 該当ターンのチャンクキャッシュをクリア
      for (const key of this.chunkCache.keys()) {
        if (key.startsWith(`${turn}-`)) {
          this.chunkCache.delete(key);
        }
      }
      
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

    this.clearCache();
    console.log(`🧹 Cleared all analysis results`);
  }
}