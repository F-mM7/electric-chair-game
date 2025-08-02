import { GameState, GameStatus } from '../types/game';
import { OptimalStrategy } from '../types/analysis';
import { hashToGameState, formatHashForDisplay } from './stateHash';
import { getSuccessorStates } from './stateTransition';
import { getCurrentAttacker, getAvailableChairs } from './gameLogic';
import { NashEquilibriumSolver } from './nashEquilibriumSolver';

/**
 * 線形計画法に基づく正確な最適混合戦略計算エンジン
 * javascript-lp-solverライブラリを使用してNash均衡を計算します
 */
export class OptimalStrategyCalculator {
  private strategyCache: Map<number, OptimalStrategy> = new Map();
  private readonly MAX_CACHE_SIZE = 100000;
  private nashSolver: NashEquilibriumSolver;
  protected strategyProvider?: (stateHash: number) => OptimalStrategy | null;
  private drawValue: number;

  constructor(drawValue: number = 0.0) {
    this.nashSolver = new NashEquilibriumSolver();
    this.drawValue = drawValue;
  }

  /**
   * 指定状態の最適戦略を計算
   */
  public async calculateOptimalStrategy(stateHash: number): Promise<OptimalStrategy> {
    // キャッシュ確認
    if (this.strategyCache.has(stateHash)) {
      return this.strategyCache.get(stateHash)!;
    }

    const gameState = hashToGameState(stateHash);
    let strategy: OptimalStrategy;

    // 終了状態の場合
    if (gameState.gameStatus !== GameStatus.IN_PROGRESS) {
      strategy = this.calculateTerminalStrategy(gameState);
    } else {
      // 進行状態の場合：線形計画法によるNash均衡を計算
      strategy = await this.calculateMixedStrategyLP(stateHash, gameState);
    }

    // キャッシュサイズ制限チェック
    if (this.strategyCache.size >= this.MAX_CACHE_SIZE) {
      // LRU的に古いエントリを削除（最初の1000件を削除）
      const keysToDelete = Array.from(this.strategyCache.keys()).slice(0, 1000);
      keysToDelete.forEach(key => this.strategyCache.delete(key));
    }

    // キャッシュに保存
    this.strategyCache.set(stateHash, strategy);
    return strategy;
  }

  /**
   * 終了状態の戦略計算
   */
  private calculateTerminalStrategy(gameState: GameState): OptimalStrategy {
    let expectedValue: number;

    switch (gameState.gameStatus) {
      case GameStatus.PLAYER1_WIN:
        expectedValue = 1.0;
        break;
      case GameStatus.PLAYER2_WIN:
        expectedValue = -1.0;
        break;
      case GameStatus.DRAW:
        expectedValue = this.drawValue;
        break;
      default:
        expectedValue = 0.0;
    }

    return {
      player1Probabilities: Array(12).fill(0),
      player2Probabilities: Array(12).fill(0),
      expectedValue,
      isCalculated: true
    };
  }

  /**
   * 線形計画法による混合戦略Nash均衡の計算
   */
  private async calculateMixedStrategyLP(stateHash: number, gameState: GameState): Promise<OptimalStrategy> {
    const availableChairs = getAvailableChairs(gameState);
    
    if (availableChairs.length === 0) {
      return this.calculateTerminalStrategy(gameState);
    }

    // ペイオフ行列を構築（プレイヤー1目線）
    const payoffMatrix = this.buildPayoffMatrix(stateHash, gameState, availableChairs);
    
    // ログ無効化 - アルゴリズムは正常動作確認済み
    // if (gameState.currentTurn <= 12 && gameState.currentTurn >= 10) {
    //   console.log(`詳細調査 - ゲーム状態 (${stateHash}):`, JSON.stringify(gameState));
    //   console.log(`詳細調査 - ペイオフ行列 (${stateHash}):`, payoffMatrix);
    //   console.log(`詳細調査 - 利用可能椅子:`, availableChairs);
    // }
    
    // 線形計画法によるNash均衡を計算
    const nashResult = await this.nashSolver.solveZeroSumGame(payoffMatrix);
    
    // 詳細ログは一時的に無効化
    // console.log(`Nash計算結果 (${stateHash}): 有効=${nashResult.isValid}, ゲーム値=${nashResult.gameValue}`);
    // if (nashResult.isValid) {
    //   console.log(`P1戦略: [${nashResult.player1Strategy.map(p => p.toFixed(6)).join(', ')}]`);
    //   console.log(`P2戦略: [${nashResult.player2Strategy.map(p => p.toFixed(6)).join(', ')}]`);
    // }
    
    if (!nashResult.isValid) {
      console.error(`Nash均衡計算エラー (${formatHashForDisplay(stateHash)}): ${nashResult.error}`);
      console.error(`ペイオフ行列:`, payoffMatrix);
      console.error(`利用可能椅子:`, availableChairs);
      throw new Error(`Failed to compute Nash equilibrium for state ${formatHashForDisplay(stateHash)}: ${nashResult.error}`);
    }

    // 検証を再有効化して調査
    const verification = this.nashSolver.verifyNashEquilibrium(
      payoffMatrix,
      nashResult.player1Strategy,
      nashResult.player2Strategy,
      nashResult.gameValue
    );

    if (!verification.isValid) {
      console.warn(`Nash均衡検証失敗 (${formatHashForDisplay(stateHash)}): P1後悔値=${verification.player1Regret.toFixed(8)}, P2後悔値=${verification.player2Regret.toFixed(8)}`);
      console.warn(`ペイオフ行列:`, payoffMatrix);
      console.warn(`P1戦略: [${nashResult.player1Strategy.map(p => p.toFixed(6)).join(', ')}]`);
      console.warn(`P2戦略: [${nashResult.player2Strategy.map(p => p.toFixed(6)).join(', ')}]`);
      if (verification.details.length > 0) {
        console.warn('詳細:', verification.details.slice(0, 3).join(', '));
      }
    }

    // 結果を12椅子分の配列に変換
    const player1Probs = Array(12).fill(0);
    const player2Probs = Array(12).fill(0);
    
    for (let i = 0; i < availableChairs.length; i++) {
      const chairIndex = availableChairs[i] - 1;
      player1Probs[chairIndex] = nashResult.player1Strategy[i];
      player2Probs[chairIndex] = nashResult.player2Strategy[i];
    }

    return {
      player1Probabilities: player1Probs,
      player2Probabilities: player2Probs,
      expectedValue: nashResult.gameValue,
      isCalculated: true
    };
  }

  /**
   * ペイオフ行列の構築（プレイヤー1目線）
   * 行：プレイヤー1の行動、列：プレイヤー2の行動
   */
  private buildPayoffMatrix(stateHash: number, gameState: GameState, availableChairs: number[]): number[][] {
    const successorData = getSuccessorStates(stateHash);
    const currentAttacker = getCurrentAttacker(gameState.currentTurn);
    const matrix: number[][] = [];
    
    // 詳細ログは一時的に無効化
    // console.log(`ペイオフ行列構築開始 (${stateHash}): 攻撃者=${currentAttacker}`);

    // プレイヤー1の各選択に対して（行）
    for (const player1Choice of availableChairs) {
      const row: number[] = [];
      
      // プレイヤー2の各選択に対して（列）
      for (const player2Choice of availableChairs) {
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
        // console.log(`  選択組み合わせ [${player1Choice}, ${player2Choice}] -> 攻撃=${attackChoice}, 防御=${defendChoice}: 結果=${outcome.isTerminal ? '終了' : '継続'} 値=${outcome.expectedValue || 'TBD'}`);
        
        if (outcome.isTerminal) {
          // 終了状態: 期待値を直接使用
          expectedValue = outcome.expectedValue!;
        } else {
          // 進行状態: キャッシュまたは外部プロバイダーから取得
          let strategy = this.strategyCache.get(outcome.hash!);
          
          if (!strategy && this.strategyProvider) {
            const providedStrategy = this.strategyProvider(outcome.hash!);
            if (providedStrategy) {
              strategy = providedStrategy;
              this.strategyCache.set(outcome.hash!, strategy);
            }
          }
          
          if (!strategy) {
            throw new Error(`Strategy not found for state ${outcome.hash}. Analysis order may be incorrect.`);
          }
          
          expectedValue = strategy.expectedValue;
          // console.log(`    -> 継続状態ハッシュ=${outcome.hash}: 期待値=${expectedValue}`);
        }
        
        row.push(expectedValue);
      }
      
      matrix.push(row);
    }

    return matrix;
  }


  /**
   * 戦略キャッシュをクリア
   */
  public clearCache(): void {
    this.strategyCache.clear();
  }

  /**
   * キャッシュサイズを取得
   */
  public getCacheSize(): number {
    return this.strategyCache.size;
  }

  /**
   * 戦略プロバイダーを設定
   */
  public setStrategyProvider(provider: (stateHash: number) => OptimalStrategy | null): void {
    this.strategyProvider = provider;
  }
}