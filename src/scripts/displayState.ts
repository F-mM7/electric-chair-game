#!/usr/bin/env node
import { formatHashForDisplay, hashToGameState } from '../utils/stateHash';

/**
 * ハッシュ値から人間が読める形式でゲーム状態を表示するスクリプト
 * 使用例:
 *   npm run display-state -- -1547697649
 *   npm run display-state -- --hash -1547697649
 *   npm run display-state -- --detailed -1547697649
 */

interface DisplayOptions {
  hash?: number;
  detailed?: boolean;
  help?: boolean;
}

function parseArgs(): DisplayOptions {
  const args = process.argv.slice(2);
  const options: DisplayOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--hash':
      case '-h':
        options.hash = parseInt(args[++i]);
        break;
      case '--detailed':
      case '-d':
        options.detailed = true;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        // 引数がマイナス記号で始まる数値の場合
        if (!isNaN(parseInt(arg))) {
          options.hash = parseInt(arg);
        }
        break;
    }
  }
  
  return options;
}

function displayHelp() {
  console.log(`
電気椅子ゲーム状態表示スクリプト

使用方法:
  npm run display-state -- <ハッシュ値>
  npm run display-state -- --hash <ハッシュ値> [オプション]

引数:
  <ハッシュ値>           表示したい状態のハッシュ値（負の数も可）

オプション:
  --detailed, -d        詳細表示モード
  --help                このヘルプを表示

例:
  npm run display-state -- -1547697649
  npm run display-state -- --hash 123456789 --detailed
  npm run display-state -- -d -1547697649
  `);
}

function displayBasic(hash: number) {
  console.log(`🎯 ハッシュ値: ${hash}`);
  console.log(`📋 状態: ${formatHashForDisplay(hash)}`);
}

function displayDetailed(hash: number) {
  console.log(`🎯 ハッシュ値: ${hash}`);
  console.log(`📋 簡易表示: ${formatHashForDisplay(hash)}`);
  console.log('');
  
  const gameState = hashToGameState(hash);
  
  console.log('📊 詳細情報:');
  console.log(`   ターン: ${gameState.currentTurn}`);
  console.log(`   ゲーム状態: ${gameState.gameStatus}`);
  console.log(`   勝者: ${gameState.winner || 'なし'}`);
  console.log('');
  
  console.log('👥 プレイヤー情報:');
  console.log(`   プレイヤー1: ${gameState.player1Score}点 (電流${gameState.player1ElectricCount}回)`);
  console.log(`   プレイヤー2: ${gameState.player2Score}点 (電流${gameState.player2ElectricCount}回)`);
  console.log('');
  
  console.log('🪑 椅子の状態:');
  const chairs: string[] = [];
  for (let i = 0; i < gameState.chairsRemaining.length; i++) {
    if (gameState.chairsRemaining[i]) {
      chairs.push(`椅子${i + 1}`);
    }
  }
  console.log(`   残存椅子 (${chairs.length}個): ${chairs.join(', ')}`);
  
  const removedChairs: string[] = [];
  for (let i = 0; i < gameState.chairsRemaining.length; i++) {
    if (!gameState.chairsRemaining[i]) {
      removedChairs.push(`椅子${i + 1}`);
    }
  }
  if (removedChairs.length > 0) {
    console.log(`   除去済み椅子 (${removedChairs.length}個): ${removedChairs.join(', ')}`);
  }
}

function main() {
  const options = parseArgs();
  
  if (options.help) {
    displayHelp();
    return;
  }
  
  if (options.hash === undefined) {
    console.error('❌ エラー: ハッシュ値が指定されていません');
    console.error('💡 使用方法: npm run display-state -- <ハッシュ値>');
    console.error('💡 ヘルプ: npm run display-state -- --help');
    process.exit(1);
  }
  
  if (isNaN(options.hash)) {
    console.error('❌ エラー: 無効なハッシュ値です');
    console.error(`入力値: "${options.hash}"`);
    process.exit(1);
  }
  
  console.log('🎯 Electric Chair Game State Display');
  console.log('=' .repeat(50));
  
  try {
    if (options.detailed) {
      displayDetailed(options.hash);
    } else {
      displayBasic(options.hash);
    }
  } catch (error) {
    console.error('❌ エラー: 状態の表示に失敗しました');
    console.error(`ハッシュ値: ${options.hash}`);
    console.error(`詳細: ${error}`);
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