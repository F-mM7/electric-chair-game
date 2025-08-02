import { generateStateTransitions } from '../utils/stateTransition';
import { encodeGameStateHash, decodeGameStateHash } from '../utils/stateHash';
import { GameState, GameStatus } from '../types/game';
import fs from 'fs';
import path from 'path';

/**
 * 完全解析用ハッシュ生成 - 状態数制限なし、ファイル分割でメモリ効率化
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

const CHUNK_SIZE = 10000; // 1ファイル当たりの状態数

/**
 * 初期状態（Turn 0）を生成
 */
function generateInitialHash(): number {
  const initialState: GameState = {
    currentTurn: 0,
    chairsRemaining: Array(12).fill(true),
    player1Score: 0,
    player2Score: 0,
    player1ElectricCount: 0,
    player2ElectricCount: 0,
    gameStatus: GameStatus.IN_PROGRESS,
    winner: undefined
  };

  return encodeGameStateHash(initialState);
}

/**
 * 前のターンから次のターンのハッシュを生成（完全版・チャンク分割）
 */
function generateNextTurnHashesComplete(currentTurn: number): ChunkedTurnData | null {
  const currentTurnDir = path.join('./state-hashes', `turn-${currentTurn}`);
  
  if (!fs.existsSync(currentTurnDir)) {
    console.log(`❌ Turn ${currentTurn} directory not found: ${currentTurnDir}`);
    return null;
  }

  // 現在のターンのメタデータを読み込み
  const metaFile = path.join(currentTurnDir, 'meta.json');
  if (!fs.existsSync(metaFile)) {
    console.log(`❌ Turn ${currentTurn} metadata not found: ${metaFile}`);
    return null;
  }

  const currentMeta: ChunkedTurnData = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  console.log(`📂 Loading turn ${currentTurn}: ${currentMeta.totalCount} states in ${currentMeta.chunks} chunks`);

  const nextTurn = currentTurn + 1;
  const nextTurnHashes = new Set<number>();
  
  console.log(`🔄 Processing ${currentMeta.totalCount} states...`);
  
  // 各チャンクを順次処理
  for (let chunkIndex = 0; chunkIndex < currentMeta.chunks; chunkIndex++) {
    const chunkFile = path.join(currentTurnDir, `chunk-${chunkIndex}.json`);
    
    if (!fs.existsSync(chunkFile)) {
      console.warn(`⚠️  Chunk file not found: ${chunkFile}`);
      continue;
    }

    const chunkData: ChunkData = JSON.parse(fs.readFileSync(chunkFile, 'utf-8'));
    
    for (let i = 0; i < chunkData.hashes.length; i++) {
      const currentHash = parseInt(chunkData.hashes[i], 16);
      
      // 進捗表示
      const globalIndex = chunkIndex * CHUNK_SIZE + i + 1;
      if (globalIndex % 1000 === 0 || globalIndex === 1) {
        const percentage = Math.floor((globalIndex / currentMeta.totalCount) * 100);
        console.log(`  Progress: ${globalIndex}/${currentMeta.totalCount} (${percentage}%)`);
      }
      
      try {
        const transitions = generateStateTransitions(currentHash);
        
        for (const transition of transitions) {
          const decoded = decodeGameStateHash(transition.toHash);
          
          // 次のターンであることを確認
          if (decoded.turn === nextTurn) {
            nextTurnHashes.add(transition.toHash);
          }
        }
        
      } catch (error) {
        console.warn(`⚠️  Error processing hash ${currentHash}:`, error);
      }
    }
    
    // メモリクリーンアップ
    if (chunkIndex % 10 === 0 && global.gc) {
      global.gc();
    }
  }

  console.log(`✅ Generated ${nextTurnHashes.size} unique states for turn ${nextTurn}`);

  // 次のターンのハッシュをチャンク分割して保存
  const nextTurnDir = path.join('./state-hashes', `turn-${nextTurn}`);
  if (!fs.existsSync(nextTurnDir)) {
    fs.mkdirSync(nextTurnDir, { recursive: true });
  }

  const hashArray = Array.from(nextTurnHashes).sort((a, b) => a - b);
  const totalChunks = Math.ceil(hashArray.length / CHUNK_SIZE);

  // チャンクファイルを作成
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const startIndex = chunkIndex * CHUNK_SIZE;
    const endIndex = Math.min(startIndex + CHUNK_SIZE, hashArray.length);
    const chunkHashes = hashArray.slice(startIndex, endIndex).map(hash => (hash >>> 0).toString(16));

    const chunkData: ChunkData = {
      turn: nextTurn,
      chunk: chunkIndex,
      count: chunkHashes.length,
      hashes: chunkHashes
    };

    const chunkFile = path.join(nextTurnDir, `chunk-${chunkIndex}.json`);
    fs.writeFileSync(chunkFile, JSON.stringify(chunkData, null, 2));
  }

  // メタデータを作成
  const nextMeta: ChunkedTurnData = {
    turn: nextTurn,
    totalCount: hashArray.length,
    chunkSize: CHUNK_SIZE,
    chunks: totalChunks
  };

  const nextMetaFile = path.join(nextTurnDir, 'meta.json');
  fs.writeFileSync(nextMetaFile, JSON.stringify(nextMeta, null, 2));

  return nextMeta;
}

// メイン実行
console.log('🔍 Generating complete hashes (no limits)...\n');

// state-hashesディレクトリを確保
const stateHashesDir = './state-hashes';
if (!fs.existsSync(stateHashesDir)) {
  fs.mkdirSync(stateHashesDir, { recursive: true });
}

// Turn 0を生成
const turn0Dir = path.join(stateHashesDir, 'turn-0');
const turn0MetaFile = path.join(turn0Dir, 'meta.json');

if (!fs.existsSync(turn0MetaFile)) {
  console.log('🔧 Generating initial turn 0...');
  
  if (!fs.existsSync(turn0Dir)) {
    fs.mkdirSync(turn0Dir, { recursive: true });
  }
  
  const initialHash = generateInitialHash();
  
  // チャンクファイル
  const chunkData: ChunkData = {
    turn: 0,
    chunk: 0,
    count: 1,
    hashes: [(initialHash >>> 0).toString(16)]
  };
  
  fs.writeFileSync(path.join(turn0Dir, 'chunk-0.json'), JSON.stringify(chunkData, null, 2));
  
  // メタデータ
  const metaData: ChunkedTurnData = {
    turn: 0,
    totalCount: 1,
    chunkSize: CHUNK_SIZE,
    chunks: 1
  };
  
  fs.writeFileSync(turn0MetaFile, JSON.stringify(metaData, null, 2));
  console.log('✅ Turn 0 complete files created');
}

// 段階的に次のターンを生成（完全版）
console.log('\n📋 Generating subsequent turns (complete analysis)...');
for (let currentTurn = 0; currentTurn < 16; currentTurn++) {
  const nextTurn = currentTurn + 1;
  const nextTurnDir = path.join(stateHashesDir, `turn-${nextTurn}`);
  const nextTurnMetaFile = path.join(nextTurnDir, 'meta.json');
  
  if (fs.existsSync(nextTurnMetaFile)) {
    const existingMeta: ChunkedTurnData = JSON.parse(fs.readFileSync(nextTurnMetaFile, 'utf-8'));
    console.log(`✅ Turn ${nextTurn} already exists: ${existingMeta.totalCount} states in ${existingMeta.chunks} chunks\n`);
    continue;
  }

  console.log(`\n==================================================`);
  console.log(`🎯 Generating Turn ${currentTurn} → Turn ${nextTurn} (Complete)`);
  console.log(`==================================================`);

  const nextTurnData = generateNextTurnHashesComplete(currentTurn);
  
  if (!nextTurnData) {
    console.log(`❌ Failed to generate turn ${nextTurn}`);
    break;
  }

  if (nextTurnData.totalCount === 0) {
    console.log(`🏁 No more states generated, stopping at turn ${nextTurn}`);
    break;
  }

  console.log(`💾 Saved turn ${nextTurn}: ${nextTurnData.totalCount} states in ${nextTurnData.chunks} chunks`);
}

console.log('\n🎉 Complete hash generation finished!');