import { GameState } from '../types/game';

export interface GameStateHash {
  turn: number;           // 0-15 (4ビット)
  chairs: number;         // 12ビットマスク
  player1Score: number;   // 0-39 (6ビット)
  player2Score: number;   // 0-39 (6ビット)
  player1Electric: number; // 0-2 (2ビット)
  player2Electric: number; // 0-2 (2ビット)
}

/**
 * ゲーム状態を32ビット整数ハッシュにエンコード
 * bit 28-31: ターン (4ビット) - 最上位
 * bit 16-27: 椅子残存状態 (12ビット)
 * bit 10-15: プレイヤー1点数 (6ビット)
 * bit 4-9: プレイヤー2点数 (6ビット) 
 * bit 2-3: プレイヤー1電流回数 (2ビット)
 * bit 0-1: プレイヤー2電流回数 (2ビット)
 */
export function encodeGameStateHash(state: GameState): number {
  // 椅子残存状態をビットマスクに変換
  let chairBits = 0;
  for (let i = 0; i < 12; i++) {
    if (state.chairsRemaining[i]) {
      chairBits |= (1 << i);
    }
  }

  // 各フィールドを適切なビット位置にシフト
  const turnBits = (state.currentTurn & 0xF) << 28;       // 4ビット (最上位)
  const chairsBits = (chairBits & 0xFFF) << 16;          // 12ビット
  const p1ScoreBits = (state.player1Score & 0x3F) << 10; // 6ビット
  const p2ScoreBits = (state.player2Score & 0x3F) << 4;  // 6ビット
  const p1ElecBits = (state.player1ElectricCount & 0x3) << 2; // 2ビット
  const p2ElecBits = (state.player2ElectricCount & 0x3);      // 2ビット (最下位)

  return turnBits | chairsBits | p1ScoreBits | p2ScoreBits | p1ElecBits | p2ElecBits;
}

/**
 * 32ビット整数ハッシュをゲーム状態構造にデコード
 */
export function decodeGameStateHash(hash: number): GameStateHash {
  const turn = (hash >> 28) & 0xF;
  const chairBits = (hash >> 16) & 0xFFF;
  const player1Score = (hash >> 10) & 0x3F;
  const player2Score = (hash >> 4) & 0x3F;
  const player1Electric = (hash >> 2) & 0x3;
  const player2Electric = hash & 0x3;

  return {
    turn,
    chairs: chairBits,
    player1Score,
    player2Score,
    player1Electric,
    player2Electric
  };
}

/**
 * ハッシュから完全なGameStateオブジェクトを復元
 */
export function hashToGameState(hash: number): GameState {
  const decoded = decodeGameStateHash(hash);
  
  // 椅子残存配列を復元
  const chairsRemaining: boolean[] = [];
  for (let i = 0; i < 12; i++) {
    chairsRemaining[i] = (decoded.chairs & (1 << i)) !== 0;
  }

  return {
    currentTurn: decoded.turn,
    chairsRemaining,
    player1Score: decoded.player1Score,
    player2Score: decoded.player2Score,
    player1ElectricCount: decoded.player1Electric,
    player2ElectricCount: decoded.player2Electric,
    gameStatus: getGameStatusFromHash(decoded),
    winner: undefined // 必要に応じて計算
  };
}

/**
 * ハッシュデータからゲーム状態を判定
 */
function getGameStatusFromHash(hash: GameStateHash) {
  const MAX_SCORE = 40;
  const MAX_ELECTRIC_COUNT = 3;
  const MAX_TURNS = 16;
  
  // 電流3回で敗北
  if (hash.player1Electric === MAX_ELECTRIC_COUNT) {
    return 'PLAYER2_WIN' as any;
  }
  if (hash.player2Electric === MAX_ELECTRIC_COUNT) {
    return 'PLAYER1_WIN' as any;
  }
  
  // 40点以上で勝利
  if (hash.player1Score >= MAX_SCORE) {
    return 'PLAYER1_WIN' as any;
  }
  if (hash.player2Score >= MAX_SCORE) {
    return 'PLAYER2_WIN' as any;
  }
  
  // 残り椅子数を計算
  const remainingChairs = Array.from({ length: 12 }, (_, i) => (hash.chairs & (1 << i)) !== 0)
    .filter(remaining => remaining).length;
    
  // 残り椅子1個時またはターン15終了時（16ターン実行後）の点数勝負
  if (remainingChairs === 1 || hash.turn >= (MAX_TURNS - 1)) {
    if (hash.player1Score > hash.player2Score) {
      return 'PLAYER1_WIN' as any;
    } else if (hash.player2Score > hash.player1Score) {
      return 'PLAYER2_WIN' as any;
    } else {
      return 'DRAW' as any;
    }
  }
  
  return 'IN_PROGRESS' as any;
}

/**
 * ハッシュ値の可読表示用
 */
export function formatHashForDisplay(hash: number): string {
  const decoded = decodeGameStateHash(hash);
  const chairsList = [];
  for (let i = 0; i < 12; i++) {
    if (decoded.chairs & (1 << i)) {
      chairsList.push(i + 1);
    }
  }
  
  const hexHash = '0x' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${hexHash} Turn:${decoded.turn} Chairs:[${chairsList.join(',')}] P1:${decoded.player1Score}pts(${decoded.player1Electric}⚡) P2:${decoded.player2Score}pts(${decoded.player2Electric}⚡)`;
}