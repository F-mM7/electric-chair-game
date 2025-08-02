import fs from 'fs';
import path from 'path';

/**
 * 完全解析用ハッシュローダー - チャンク分割ファイルから効率的に読み込み
 */

interface ChunkedTurnData {
  turn: number;
  totalCount: number;
  chunkSize: number;
  chunks: number;
}

interface ChunkData {
  turn: number;
  chunk: number;
  count: number;
  hashes: string[];
}

/**
 * 指定ターンのメタデータを読み込み
 */
export function loadTurnMetadata(turn: number): ChunkedTurnData | null {
  const metaFile = path.join('./state-hashes', `turn-${turn}`, 'meta.json');
  
  if (!fs.existsSync(metaFile)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(metaFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Failed to load turn ${turn} metadata:`, error);
    return null;
  }
}

/**
 * 指定ターンの指定チャンクを読み込み
 */
export function loadTurnChunk(turn: number, chunk: number): ChunkData | null {
  const chunkFile = path.join('./state-hashes', `turn-${turn}`, `chunk-${chunk}.json`);
  
  if (!fs.existsSync(chunkFile)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(chunkFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Failed to load turn ${turn} chunk ${chunk}:`, error);
    return null;
  }
}

/**
 * 指定ターンのハッシュを指定された範囲で取得（完全解析版）
 */
export function loadTurnHashRange(turn: number, startIndex: number, count: number): number[] {
  const metadata = loadTurnMetadata(turn);
  if (!metadata) {
    return [];
  }
  
  const endIndex = Math.min(startIndex + count, metadata.totalCount);
  const hashes: number[] = [];
  
  // 開始チャンクと終了チャンクを計算
  const startChunk = Math.floor(startIndex / metadata.chunkSize);
  const endChunk = Math.floor((endIndex - 1) / metadata.chunkSize);
  
  for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex++) {
    const chunkData = loadTurnChunk(turn, chunkIndex);
    if (!chunkData) {
      continue;
    }
    
    // チャンク内でのオフセットを計算
    const chunkStartIndex = chunkIndex * metadata.chunkSize;
    const localStartIndex = Math.max(0, startIndex - chunkStartIndex);
    const localEndIndex = Math.min(chunkData.count, endIndex - chunkStartIndex);
    
    if (localStartIndex < localEndIndex) {
      const chunkHashes = chunkData.hashes.slice(localStartIndex, localEndIndex).map(hexHash => parseInt(hexHash, 16));
      hashes.push(...chunkHashes);
    }
  }
  
  return hashes;
}

/**
 * 利用可能なターンの一覧を取得（完全解析版）
 */
export function getAvailableTurns(): number[] {
  const stateHashesDir = './state-hashes';
  
  if (!fs.existsSync(stateHashesDir)) {
    return [];
  }
  
  const dirs = fs.readdirSync(stateHashesDir);
  const turns: number[] = [];
  
  for (const dir of dirs) {
    const match = dir.match(/^turn-(\d+)$/);
    if (match) {
      const turn = parseInt(match[1]);
      const metaFile = path.join(stateHashesDir, dir, 'meta.json');
      if (fs.existsSync(metaFile)) {
        turns.push(turn);
      }
    }
  }
  
  return turns.sort((a, b) => b - a); // 降順でソート
}

/**
 * 全ターンの状態数を取得（完全解析版）
 */
export function getAllTurnCounts(): Record<number, number> {
  const turns = getAvailableTurns();
  const counts: Record<number, number> = {};
  
  for (const turn of turns) {
    const metadata = loadTurnMetadata(turn);
    if (metadata && metadata.totalCount > 0) {
      counts[turn] = metadata.totalCount;
    }
  }
  
  return counts;
}

/**
 * 完全解析ハッシュデータの利用可能性をチェック
 */
export function checkHashDataAvailability(): {
  available: boolean;
  turns: number[];
  totalStates: number;
  message: string;
} {
  const turnCounts = getAllTurnCounts();
  const turns = Object.keys(turnCounts).map(Number).sort((a, b) => b - a);
  const totalStates = Object.values(turnCounts).reduce((sum, count) => sum + count, 0);
  
  if (turns.length === 0) {
    return {
      available: false,
      turns: [],
      totalStates: 0,
      message: 'No hash files found. Run generateHashes.ts first.'
    };
  }
  
  return {
    available: true,
    turns,
    totalStates,
    message: `Found ${turns.length} turn directories with ${totalStates} total states`
  };
}

/**
 * 指定ターンの全ハッシュを取得（メモリ効率を考慮したイテレータ）
 */
export function* iterateTurnHashes(turn: number): Generator<number[], void, unknown> {
  const metadata = loadTurnMetadata(turn);
  if (!metadata) {
    return;
  }
  
  for (let chunkIndex = 0; chunkIndex < metadata.chunks; chunkIndex++) {
    const chunkData = loadTurnChunk(turn, chunkIndex);
    if (chunkData) {
      yield chunkData.hashes.map(hexHash => parseInt(hexHash, 16));
    }
  }
}