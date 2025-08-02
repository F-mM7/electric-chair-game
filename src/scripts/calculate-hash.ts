#!/usr/bin/env node
import { GameState, GameStatus } from '../types/game';
import { encodeGameStateHash, formatHashForDisplay } from '../utils/stateHash';

/**
 * ゲーム状況の入力からハッシュ値を計算するスクリプト
 * 
 * 使用例:
 *   npm run calculate-hash -- --turn 13 --p1-score 0 --p2-score 3 --p1-electric 1 --p2-electric 2 --chairs 1,4
 *   npm run calculate-hash -- -t 14 -p1 0 -p2 0 -e1 2 -e2 2 -c 1,2
 */

interface GameInput {
  turn: number;
  player1Score: number;
  player2Score: number;
  player1Electric: number;
  player2Electric: number;
  chairs: number[];
  help?: boolean;
}

function parseArgs(): GameInput {
  const args = process.argv.slice(2);
  const input: Partial<GameInput> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--turn':
      case '-t':
        input.turn = parseInt(args[++i]);
        break;
      case '--p1-score':
      case '-p1':
        input.player1Score = parseInt(args[++i]);
        break;
      case '--p2-score':
      case '-p2':
        input.player2Score = parseInt(args[++i]);
        break;
      case '--p1-electric':
      case '-e1':
        input.player1Electric = parseInt(args[++i]);
        break;
      case '--p2-electric':
      case '-e2':
        input.player2Electric = parseInt(args[++i]);
        break;
      case '--chairs':
      case '-c':
        input.chairs = args[++i].split(',').map(n => parseInt(n.trim()));
        break;
      case '--help':
      case '-h':
        input.help = true;
        break;
    }
  }
  
  return input as GameInput;
}

function validateInput(input: GameInput): string[] {
  const errors: string[] = [];
  
  if (input.turn === undefined || input.turn < 0 || input.turn > 15) {
    errors.push('ターン数は0-15の範囲で指定してください');
  }
  
  if (input.player1Score === undefined || input.player1Score < 0 || input.player1Score > 63) {
    errors.push('プレイヤー1得点は0-63の範囲で指定してください');
  }
  
  if (input.player2Score === undefined || input.player2Score < 0 || input.player2Score > 63) {
    errors.push('プレイヤー2得点は0-63の範囲で指定してください');
  }
  
  if (input.player1Electric === undefined || input.player1Electric < 0 || input.player1Electric > 3) {
    errors.push('プレイヤー1電流回数は0-3の範囲で指定してください');
  }
  
  if (input.player2Electric === undefined || input.player2Electric < 0 || input.player2Electric > 3) {
    errors.push('プレイヤー2電流回数は0-3の範囲で指定してください');
  }
  
  if (!input.chairs || input.chairs.length === 0) {
    errors.push('残り椅子を指定してください');
  } else {
    for (const chair of input.chairs) {
      if (chair < 1 || chair > 12) {
        errors.push(`椅子番号は1-12の範囲で指定してください: ${chair}`);
      }
    }
    
    // 重複チェック
    const uniqueChairs = [...new Set(input.chairs)];
    if (uniqueChairs.length !== input.chairs.length) {
      errors.push('椅子番号に重複があります');
    }
  }
  
  return errors;
}

function createGameState(input: GameInput): GameState {
  // 椅子残存配列を作成
  const chairsRemaining = Array(12).fill(false);
  for (const chair of input.chairs) {
    chairsRemaining[chair - 1] = true;
  }
  
  // ゲーム状態を判定
  let gameStatus = GameStatus.IN_PROGRESS;
  
  // 勝利条件チェック
  if (input.player1Score === 40) {
    gameStatus = GameStatus.PLAYER1_WIN;
  } else if (input.player2Score === 40) {
    gameStatus = GameStatus.PLAYER2_WIN;
  }
  // 電流回数による敗北チェック
  else if (input.player1Electric === 3) {
    gameStatus = GameStatus.PLAYER2_WIN;
  } else if (input.player2Electric === 3) {
    gameStatus = GameStatus.PLAYER1_WIN;
  }
  // 椅子が尽きた場合の引き分けチェック
  else if (input.chairs.length === 0) {
    gameStatus = GameStatus.DRAW;
  }
  
  return {
    currentTurn: input.turn,
    chairsRemaining,
    player1Score: input.player1Score,
    player2Score: input.player2Score,
    player1ElectricCount: input.player1Electric,
    player2ElectricCount: input.player2Electric,
    gameStatus,
    winner: undefined
  };
}

function displayHelp(): void {
  console.log(`
🧮 ゲーム状況からハッシュ値計算ツール

使用方法:
  npm run calculate-hash [オプション]

必須オプション:
  --turn, -t <数値>          ターン数 (0-15)
  --p1-score, -p1 <数値>     プレイヤー1得点 (0-63)
  --p2-score, -p2 <数値>     プレイヤー2得点 (0-63)
  --p1-electric, -e1 <数値>  プレイヤー1電流回数 (0-3)
  --p2-electric, -e2 <数値>  プレイヤー2電流回数 (0-3)
  --chairs, -c <椅子番号>    残り椅子 (カンマ区切り、例: 1,4,7)

オプション:
  --help, -h                 このヘルプを表示

例:
  # ターン13、P1:0点1電流、P2:3点2電流、椅子1,4残り
  npm run calculate-hash -- --turn 13 --p1-score 0 --p2-score 3 --p1-electric 1 --p2-electric 2 --chairs 1,4
  
  # 短縮形式
  npm run calculate-hash -- -t 14 -p1 0 -p2 0 -e1 2 -e2 2 -c 1,2
  
  # 全椅子残り（初期状態）
  npm run calculate-hash -- -t 1 -p1 0 -p2 0 -e1 0 -e2 0 -c 1,2,3,4,5,6,7,8,9,10,11,12
  `);
}

function main(): void {
  console.log('🧮 === ハッシュ値計算ツール ===');
  
  const input = parseArgs();
  
  if (input.help) {
    displayHelp();
    return;
  }
  
  // 入力検証
  const errors = validateInput(input);
  if (errors.length > 0) {
    console.log('❌ 入力エラー:');
    errors.forEach(error => console.log(`  - ${error}`));
    console.log('\nヘルプを表示: npm run calculate-hash -- --help');
    process.exit(1);
  }
  
  try {
    // ゲーム状態を作成
    const gameState = createGameState(input);
    
    // ハッシュ値を計算
    const hash = encodeGameStateHash(gameState);
    const hashUnsigned = hash >>> 0; // 32ビット符号なし整数として正規化
    const hashSigned = hash | 0; // 32ビット符号付き整数として表示
    
    console.log('\n📊 === 入力内容 ===');
    console.log(`ターン: ${input.turn}`);
    console.log(`プレイヤー1: ${input.player1Score}点 (${input.player1Electric}回電流)`);
    console.log(`プレイヤー2: ${input.player2Score}点 (${input.player2Electric}回電流)`);
    console.log(`残り椅子: [${input.chairs.sort((a, b) => a - b).join(', ')}]`);
    console.log(`ゲーム状態: ${gameState.gameStatus}`);
    
    console.log('\n🔢 === ハッシュ値 ===');
    console.log(`16進数: 0x${hashUnsigned.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`フォーマット済み: ${formatHashForDisplay(hashUnsigned)}`);
    
    console.log('\n✅ デバッグ用コマンド:');
    console.log(`npm run debug-strategy -- 0x${hashUnsigned.toString(16).toUpperCase().padStart(8, '0')}`);
    
  } catch (error) {
    console.error('❌ 計算エラー:', error);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// メイン実行
main();