#!/usr/bin/env node
import { OptimalStrategyCalculator } from '../utils/optimalStrategy';
import { hashToGameState, formatHashForDisplay, decodeGameStateHash } from '../utils/stateHash';
import { getSuccessorStates } from '../utils/stateTransition';
import { getCurrentAttacker, getAvailableChairs } from '../utils/gameLogic';
import { GameStatus } from '../types/game';
import { ChunkedAnalysisStorage } from '../utils/chunkedAnalysisStorage';
import { getAnalysisConfig, getDrawValue } from '../config/analysisConfig';

/**
 * 最適戦略計算のデバッグ用スクリプト
 * 指定されたハッシュ値の盤面について、利得行列や計算過程を詳細に表示します
 * 
 * 使用例:
 *   npm run debug-strategy 12345
 *   npm run debug-strategy 0x3039  # 16進数も可
 */

class DebugStrategyCalculator extends OptimalStrategyCalculator {
  private storage: ChunkedAnalysisStorage;
  private debugHash: number = 0;

  constructor() {
    const config = getAnalysisConfig();
    super(config.drawValue);
    this.storage = new ChunkedAnalysisStorage(config);

    // 戦略プロバイダーを設定（保存済み戦略を参照）
    this.setStrategyProvider((stateHash: number) => {
      const state = decodeGameStateHash(stateHash);
      const strategy = this.storage.getStrategyForState(stateHash, state.turn);
      
      if (strategy && stateHash !== this.debugHash) {
        console.log(`  📚 Loaded strategy for state ${formatHashForDisplay(stateHash)} (turn ${state.turn}): expected value = ${strategy.expectedValue.toFixed(6)}`);
      }
      
      return strategy;
    });
  }

  public async debugOptimalStrategy(stateHash: number): Promise<void> {
    this.debugHash = stateHash;
    
    console.log('🔍 === 最適戦略デバッグ ===');
    console.log(`ハッシュ値: ${formatHashForDisplay(stateHash)} (${stateHash})`);
    console.log('='.repeat(60));

    const gameState = hashToGameState(stateHash);
    
    // 盤面状態を表示
    this.displayGameState(gameState);

    // 終了状態の場合
    if (gameState.gameStatus !== GameStatus.IN_PROGRESS) {
      console.log('\n🏁 終了状態です');
      const strategy = this.calculateOptimalStrategy(stateHash);
      console.log(`期待値: ${strategy.expectedValue}`);
      return;
    }

    // 進行状態の場合
    console.log('\n🎯 進行状態 - 混合戦略計算開始');
    
    const availableChairs = getAvailableChairs(gameState);
    const currentAttacker = getCurrentAttacker(gameState.currentTurn);
    
    console.log(`\n📋 利用可能椅子: [${availableChairs.join(', ')}]`);
    console.log(`⚔️  現在の攻撃側: プレイヤー${currentAttacker}`);

    // 後続状態を取得
    const successorData = getSuccessorStates(stateHash);
    console.log(`\n🔄 後続状態数: ${Object.keys(successorData.outcomes).length}`);

    // 利得行列を構築・表示
    console.log('\n📊 === 利得行列（プレイヤー1目線） ===');
    const payoffMatrix = this.buildPayoffMatrixWithDebug(stateHash, gameState, availableChairs);
    
    // 戦略計算
    console.log('\n🧮 === 最適戦略計算 ===');
    let strategy;
    
    try {
      strategy = await this.calculateOptimalStrategy(stateHash);
    } catch (error) {
      console.log('❌ 戦略計算でエラーが発生:', error);
      return;
    }
    
    if (!strategy) {
      console.log('❌ 戦略計算に失敗しました');
      return;
    }
    
    console.log('🔍 戦略オブジェクト:', JSON.stringify(strategy, null, 2));
    
    // 結果表示
    this.displayStrategy(strategy, availableChairs);
    
    // 検証
    this.verifyStrategy(payoffMatrix, strategy, availableChairs);
  }

  private displayGameState(gameState: any): void {
    console.log(`\n🎮 ゲーム状態:`);
    console.log(`  ターン: ${gameState.currentTurn}`);
    console.log(`  プレイヤー1得点: ${gameState.player1Score}`);
    console.log(`  プレイヤー2得点: ${gameState.player2Score}`);
    console.log(`  プレイヤー1電流回数: ${gameState.player1ElectricCount}`);
    console.log(`  プレイヤー2電流回数: ${gameState.player2ElectricCount}`);
    console.log(`  椅子残存状態: [${gameState.chairsRemaining.map((c: boolean, i: number) => c ? i + 1 : '×').join(', ')}]`);
    console.log(`  ゲーム状態: ${gameState.gameStatus}`);
  }

  private buildPayoffMatrixWithDebug(stateHash: number, gameState: any, availableChairs: number[]): number[][] {
    const successorData = getSuccessorStates(stateHash);
    const currentAttacker = getCurrentAttacker(gameState.currentTurn);
    const matrix: number[][] = [];

    console.log(`\n行: プレイヤー1の選択, 列: プレイヤー2の選択`);
    console.log(`現在のターン攻撃側: プレイヤー${currentAttacker}`);
    
    // ヘッダー行を表示
    let header = '       ';
    for (const p2Choice of availableChairs) {
      header += `P2:${p2Choice.toString().padStart(2)} `;
    }
    console.log(header);

    // プレイヤー1の各選択に対して（行）
    for (let i = 0; i < availableChairs.length; i++) {
      const player1Choice = availableChairs[i];
      const row: number[] = [];
      let rowDisplay = `P1:${player1Choice.toString().padStart(2)} |`;
      
      // プレイヤー2の各選択に対して（列）
      for (let j = 0; j < availableChairs.length; j++) {
        const player2Choice = availableChairs[j];
        
        // 現在のターンの攻撃側/防御側に応じて選択をマッピング
        let attackChoice: number, defendChoice: number;
        if (currentAttacker === 1) {
          attackChoice = player1Choice;
          defendChoice = player2Choice;
        } else {
          attackChoice = player2Choice;
          defendChoice = player1Choice;
        }
        
        const outcomeKey = `${attackChoice}_${defendChoice}`;
        const outcome = successorData.outcomes[outcomeKey];
        
        let expectedValue: number;
        
        if (outcome.isTerminal) {
          expectedValue = outcome.expectedValue!;
          console.log(`    🏁 結果 [P1:${player1Choice}, P2:${player2Choice}] → 終了状態 (期待値: ${expectedValue.toFixed(6)})`);
        } else {
          const nextState = decodeGameStateHash(outcome.hash!);
          const strategy = this.storage.getStrategyForState(outcome.hash!, nextState.turn);
          
          if (!strategy) {
            console.log(`    ❌ 結果 [P1:${player1Choice}, P2:${player2Choice}] → 戦略未計算 (${formatHashForDisplay(outcome.hash!)})`);
            expectedValue = 0;
          } else {
            expectedValue = strategy.expectedValue;
            console.log(`    ➡️  結果 [P1:${player1Choice}, P2:${player2Choice}] → ${formatHashForDisplay(outcome.hash!)} (期待値: ${expectedValue.toFixed(6)})`);
          }
        }
        
        row.push(expectedValue);
        rowDisplay += ` ${expectedValue.toFixed(3).padStart(6)}`;
      }
      
      matrix.push(row);
      console.log(rowDisplay);
    }

    return matrix;
  }

  private displayStrategy(strategy: any, availableChairs: number[]): void {
    console.log(`\n期待値: ${strategy.expectedValue.toFixed(6)}`);
    
    // プレイヤー1の戦略
    console.log('\n🔴 プレイヤー1の最適混合戦略:');
    for (let i = 0; i < availableChairs.length; i++) {
      const chair = availableChairs[i];
      const prob = strategy.player1Probabilities[chair - 1];
      if (prob > 1e-6) {
        console.log(`  椅子${chair}: ${(prob * 100).toFixed(2)}%`);
      }
    }
    
    // プレイヤー2の戦略
    console.log('\n🔵 プレイヤー2の最適混合戦略:');
    for (let i = 0; i < availableChairs.length; i++) {
      const chair = availableChairs[i];
      const prob = strategy.player2Probabilities[chair - 1];
      if (prob > 1e-6) {
        console.log(`  椅子${chair}: ${(prob * 100).toFixed(2)}%`);
      }
    }
  }

  /**
   * デバッグ情報付きNash均衡計算のオーバーライド
   */
  public calculateOptimalStrategy(stateHash: number): any {
    // 基底クラスの処理の前にデバッグ情報を追加
    const gameState = hashToGameState(stateHash);
    
    if (gameState.gameStatus !== GameStatus.IN_PROGRESS) {
      console.log('🏁 終了状態のため、基底クラスで処理');
      return super.calculateOptimalStrategy(stateHash);
    }

    const availableChairs = getAvailableChairs(gameState);
    console.log(`\n🎯 Nash均衡計算開始 (${availableChairs.length}×${availableChairs.length}行列)`);
    
    // まず支配戦略の分析を行う
    const payoffMatrix = this.buildPayoffMatrixWithDebug(stateHash, gameState, availableChairs);
    this.analyzeDominatingStrategies(payoffMatrix, availableChairs);
    
    // 基底クラスで実際の計算を実行
    return super.calculateOptimalStrategy(stateHash);
  }

  /**
   * 支配戦略の分析
   */
  private analyzeDominatingStrategies(matrix: number[][], availableChairs: number[]): void {
    const numRows = matrix.length;
    const numCols = matrix[0].length;

    console.log('\n🔍 === 支配戦略分析 ===');
    console.log(`行列サイズ: ${numRows}×${numCols}`);
    
    // 行の支配戦略チェック
    console.log('\n🔴 行の支配戦略チェック:');
    let rowDominanceFound = false;
    
    for (let i = 0; i < numRows; i++) {
      for (let k = 0; k < numRows; k++) {
        if (i === k) continue;
        
        let strictlyDominates = true;
        let weaklyDominates = true;
        
        for (let j = 0; j < numCols; j++) {
          if (matrix[i][j] <= matrix[k][j]) {
            strictlyDominates = false;
          }
          if (matrix[i][j] < matrix[k][j]) {
            weaklyDominates = false;
          }
        }
        
        if (strictlyDominates) {
          console.log(`  ✅ 行${i+1}(椅子${availableChairs[i]})が行${k+1}(椅子${availableChairs[k]})を厳密支配`);
          rowDominanceFound = true;
        } else if (weaklyDominates) {
          console.log(`  ⚪ 行${i+1}(椅子${availableChairs[i]})が行${k+1}(椅子${availableChairs[k]})を弱支配`);
        }
      }
    }
    
    if (!rowDominanceFound) {
      console.log('  ❌ 行の支配戦略なし');
    }

    // 列の支配戦略チェック
    console.log('\n🔵 列の支配戦略チェック:');
    let colDominanceFound = false;
    
    for (let j = 0; j < numCols; j++) {
      for (let l = 0; l < numCols; l++) {
        if (j === l) continue;
        
        let strictlyDominates = true;
        let weaklyDominates = true;
        
        for (let i = 0; i < numRows; i++) {
          // 列プレイヤーは最小化なので逆になる
          if (matrix[i][j] >= matrix[i][l]) {
            strictlyDominates = false;
          }
          if (matrix[i][j] > matrix[i][l]) {
            weaklyDominates = false;
          }
        }
        
        if (strictlyDominates) {
          console.log(`  ✅ 列${j+1}(椅子${availableChairs[j]})が列${l+1}(椅子${availableChairs[l]})を厳密支配`);
          colDominanceFound = true;
        } else if (weaklyDominates) {
          console.log(`  ⚪ 列${j+1}(椅子${availableChairs[j]})が列${l+1}(椅子${availableChairs[l]})を弱支配`);
        }
      }
    }
    
    if (!colDominanceFound) {
      console.log('  ❌ 列の支配戦略なし');
    }

    // 行列の統計情報
    console.log('\n📊 行列統計:');
    const flatMatrix = matrix.flat();
    const minValue = Math.min(...flatMatrix);
    const maxValue = Math.max(...flatMatrix);
    const avgValue = flatMatrix.reduce((a, b) => a + b, 0) / flatMatrix.length;
    
    console.log(`  最小値: ${minValue.toFixed(6)}`);
    console.log(`  最大値: ${maxValue.toFixed(6)}`);
    console.log(`  平均値: ${avgValue.toFixed(6)}`);
    console.log(`  値の範囲: ${(maxValue - minValue).toFixed(6)}`);
  }

  private verifyStrategy(payoffMatrix: number[][], strategy: any, availableChairs: number[]): void {
    console.log('\n🔍 === 戦略検証 ===');
    
    const numStrategies = availableChairs.length;
    
    // プレイヤー1の各純戦略に対する期待ペイオフを計算
    console.log('\n🔴 プレイヤー1の各戦略の期待ペイオフ:');
    let maxPayoff = -Infinity;
    let minPayoff = Infinity;
    
    for (let i = 0; i < numStrategies; i++) {
      let expectedPayoff = 0;
      for (let j = 0; j < numStrategies; j++) {
        expectedPayoff += payoffMatrix[i][j] * strategy.player2Probabilities[availableChairs[j] - 1];
      }
      
      maxPayoff = Math.max(maxPayoff, expectedPayoff);
      minPayoff = Math.min(minPayoff, expectedPayoff);
      
      const chair = availableChairs[i];
      const myProb = strategy.player1Probabilities[chair - 1];
      const status = myProb > 1e-6 ? '✅ 使用' : '⚪ 未使用';
      
      console.log(`  椅子${chair}: ${expectedPayoff.toFixed(6)} ${status}`);
    }
    
    // プレイヤー2の各純戦略に対する期待ペイオフを計算
    console.log('\n🔵 プレイヤー2の各戦略の期待ペイオフ（プレイヤー1目線）:');
    let maxP2Payoff = -Infinity;
    let minP2Payoff = Infinity;
    
    for (let j = 0; j < numStrategies; j++) {
      let expectedPayoff = 0;
      for (let i = 0; i < numStrategies; i++) {
        expectedPayoff += payoffMatrix[i][j] * strategy.player1Probabilities[availableChairs[i] - 1];
      }
      
      maxP2Payoff = Math.max(maxP2Payoff, expectedPayoff);
      minP2Payoff = Math.min(minP2Payoff, expectedPayoff);
      
      const chair = availableChairs[j];
      const myProb = strategy.player2Probabilities[chair - 1];
      const status = myProb > 1e-6 ? '✅ 使用' : '⚪ 未使用';
      
      console.log(`  椅子${chair}: ${expectedPayoff.toFixed(6)} ${status}`);
    }
    
    // Nash均衡の条件をチェック
    console.log('\n🎯 Nash均衡検証:');
    console.log(`期待値: ${strategy.expectedValue.toFixed(6)}`);
    console.log(`P1使用戦略の期待値範囲: ${minPayoff.toFixed(6)} ~ ${maxPayoff.toFixed(6)}`);
    console.log(`P2使用戦略の期待値範囲: ${minP2Payoff.toFixed(6)} ~ ${maxP2Payoff.toFixed(6)}`);
    
    const tolerance = 1e-5;
    const p1Consistent = Math.abs(maxPayoff - minPayoff) < tolerance;
    const p2Consistent = Math.abs(maxP2Payoff - minP2Payoff) < tolerance;
    const valueConsistent = Math.abs(strategy.expectedValue - maxPayoff) < tolerance && 
                           Math.abs(strategy.expectedValue - minP2Payoff) < tolerance;
    
    if (p1Consistent && p2Consistent && valueConsistent) {
      console.log('✅ Nash均衡条件を満たしています');
    } else {
      console.log('❌ Nash均衡条件を満たしていません');
      if (!p1Consistent) console.log('  - プレイヤー1の戦略が一貫していません');
      if (!p2Consistent) console.log('  - プレイヤー2の戦略が一貫していません');
      if (!valueConsistent) console.log('  - 期待値が一致していません');
    }
  }
}

function parseHashArgument(arg: string): number {
  if (arg.startsWith('0x') || arg.startsWith('0X')) {
    return parseInt(arg, 16);
  }
  return parseInt(arg, 10);
}

function displayHelp(): void {
  console.log(`
🔍 最適戦略デバッグツール

使用方法:
  npm run debug-strategy <ハッシュ値>

引数:
  <ハッシュ値>  デバッグしたい盤面のハッシュ値（10進数または16進数）

例:
  npm run debug-strategy 12345     # 10進数
  npm run debug-strategy 0x3039    # 16進数

このツールは指定された盤面について以下を表示します:
- 盤面の詳細情報
- 利用可能な選択肢
- 利得行列（プレイヤー1目線）
- 最適混合戦略
- Nash均衡の検証結果
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    displayHelp();
    return;
  }
  
  const hashArg = args[0];
  let stateHash: number;
  
  try {
    stateHash = parseHashArgument(hashArg);
  } catch (error) {
    console.error(`❌ 無効なハッシュ値: ${hashArg}`);
    console.error('10進数または16進数（0xプレフィックス付き）で指定してください');
    process.exit(1);
  }
  
  // 32ビット符号なし整数として正規化
  stateHash = stateHash >>> 0;
  
  try {
    const debugCalculator = new DebugStrategyCalculator();
    await debugCalculator.debugOptimalStrategy(stateHash);
  } catch (error) {
    console.error(`❌ デバッグ実行エラー:`, error);
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
main().catch(console.error);