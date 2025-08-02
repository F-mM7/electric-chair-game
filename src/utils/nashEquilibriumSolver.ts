// Dynamic import for javascript-lp-solver since it's a CommonJS module
let Solver: any = null;

async function loadSolver() {
  if (!Solver) {
    const solverModule = await import('javascript-lp-solver');
    Solver = solverModule.default || solverModule;
  }
  return Solver;
}

/**
 * 線形計画法を使用した2プレイヤーゼロサムゲームのNash均衡計算
 * 
 * ゼロサムゲームでは、プレイヤー1の利得行列をMとすると：
 * - プレイヤー1は期待利得を最大化したい
 * - プレイヤー2は期待利得を最小化したい
 * 
 * この問題は以下の線形計画問題として定式化できる：
 * 
 * プレイヤー1の戦略を求める問題：
 * maximize v
 * subject to:
 *   Σ(i) x[i] * M[i][j] >= v  (for all j)
 *   Σ(i) x[i] = 1
 *   x[i] >= 0  (for all i)
 * 
 * プレイヤー2の戦略を求める問題：
 * minimize u
 * subject to:
 *   Σ(j) y[j] * M[i][j] <= u  (for all i)
 *   Σ(j) y[j] = 1
 *   y[j] >= 0  (for all j)
 */

export interface NashEquilibriumResult {
  player1Strategy: number[];
  player2Strategy: number[];
  gameValue: number;
  isValid: boolean;
  error?: string;
}

export class NashEquilibriumSolver {
  private readonly EPSILON = 5e-8;

  /**
   * 2プレイヤーゼロサムゲームのNash均衡を計算
   * @param payoffMatrix プレイヤー1目線の利得行列 (rows=P1 strategies, cols=P2 strategies)
   * @returns Nash均衡の戦略と期待値
   */
  public async solveZeroSumGame(payoffMatrix: number[][]): Promise<NashEquilibriumResult> {
    try {
      if (!payoffMatrix || payoffMatrix.length === 0 || payoffMatrix[0].length === 0) {
        return {
          player1Strategy: [],
          player2Strategy: [],
          gameValue: 0,
          isValid: false,
          error: '無効な利得行列'
        };
      }

      const numRows = payoffMatrix.length;
      const numCols = payoffMatrix[0].length;

      // 1x1の場合
      if (numRows === 1 && numCols === 1) {
        return {
          player1Strategy: [1.0],
          player2Strategy: [1.0],
          gameValue: payoffMatrix[0][0],
          isValid: true
        };
      }

      // ソルバーをロード
      await loadSolver();

      // プレイヤー1の戦略を求める（最大化問題）
      const player1Result = await this.solvePlayer1Strategy(payoffMatrix);
      if (!player1Result.isValid) {
        return player1Result;
      }

      // プレイヤー2の戦略を求める（最小化問題）
      const player2Result = await this.solvePlayer2Strategy(payoffMatrix);
      if (!player2Result.isValid) {
        return player2Result;
      }

      // ゲーム値の整合性チェック
      const valueDiff = Math.abs(player1Result.gameValue - player2Result.gameValue);
      if (valueDiff > this.EPSILON) {
        console.warn(`ゲーム値の不整合: P1=${player1Result.gameValue}, P2=${player2Result.gameValue}, 差=${valueDiff}`);
      }

      const gameValue = (player1Result.gameValue + player2Result.gameValue) / 2;

      return {
        player1Strategy: player1Result.player1Strategy,
        player2Strategy: player2Result.player2Strategy,
        gameValue,
        isValid: true
      };

    } catch (error) {
      return {
        player1Strategy: [],
        player2Strategy: [],
        gameValue: 0,
        isValid: false,
        error: `計算エラー: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * プレイヤー1の最適戦略を求める（最大化問題）
   * maximize v
   * subject to:
   *   Σ(i) x[i] * M[i][j] >= v  (for all j)
   *   Σ(i) x[i] = 1
   *   x[i] >= 0  (for all i)
   */
  private async solvePlayer1Strategy(payoffMatrix: number[][]): Promise<NashEquilibriumResult> {
    const numRows = payoffMatrix.length;
    const numCols = payoffMatrix[0].length;

    // 利得行列を正の値にシフト（必要に応じて）
    const minValue = Math.min(...payoffMatrix.flat());
    const shift = minValue < 0 ? Math.abs(minValue) + 1 : 0;
    const shiftedMatrix = payoffMatrix.map(row => row.map(val => val + shift));

    // 線形計画問題を定式化
    const model: any = {
      optimize: 'v',
      opType: 'max',
      constraints: {},
      variables: {}
    };

    // 変数定義: x[i] for i = 0, ..., numRows-1, v
    for (let i = 0; i < numRows; i++) {
      model.variables[`x${i}`] = { v: 0 };
    }
    model.variables['v'] = { v: 1 };

    // 制約条件1: Σ(i) x[i] * M[i][j] >= v  (for all j)
    for (let j = 0; j < numCols; j++) {
      const constraintName = `payoff_${j}`;
      model.constraints[constraintName] = { min: 0 };
      
      for (let i = 0; i < numRows; i++) {
        model.variables[`x${i}`][constraintName] = shiftedMatrix[i][j];
      }
      model.variables['v'][constraintName] = -1;
    }

    // 制約条件2: Σ(i) x[i] = 1
    model.constraints['prob_sum'] = { equal: 1 };
    for (let i = 0; i < numRows; i++) {
      model.variables[`x${i}`]['prob_sum'] = 1;
    }

    try {
      const solution = Solver.Solve(model);

      if (!solution || !solution.feasible) {
        return {
          player1Strategy: [],
          player2Strategy: [],
          gameValue: 0,
          isValid: false,
          error: 'プレイヤー1の問題が実行不可能'
        };
      }

      // 戦略を抽出
      const strategy = Array(numRows).fill(0);
      for (let i = 0; i < numRows; i++) {
        const value = solution[`x${i}`] || 0;
        strategy[i] = Math.max(0, value); // 負の値を0にクリップ
      }

      // 確率の正規化
      const sum = strategy.reduce((a, b) => a + b, 0);
      if (sum > this.EPSILON) {
        for (let i = 0; i < numRows; i++) {
          strategy[i] /= sum;
        }
      } else {
        // 均等分布にフォールバック
        strategy.fill(1 / numRows);
      }

      const gameValue = (solution.v || 0) - shift;

      return {
        player1Strategy: strategy,
        player2Strategy: [],
        gameValue,
        isValid: true
      };

    } catch (error) {
      return {
        player1Strategy: [],
        player2Strategy: [],
        gameValue: 0,
        isValid: false,
        error: `プレイヤー1の求解エラー: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * プレイヤー2の最適戦略を求める（最小化問題）
   * minimize u
   * subject to:
   *   Σ(j) y[j] * M[i][j] <= u  (for all i)
   *   Σ(j) y[j] = 1
   *   y[j] >= 0  (for all j)
   */
  private async solvePlayer2Strategy(payoffMatrix: number[][]): Promise<NashEquilibriumResult> {
    const numRows = payoffMatrix.length;
    const numCols = payoffMatrix[0].length;

    // 利得行列を正の値にシフト（必要に応じて）
    const minValue = Math.min(...payoffMatrix.flat());
    const shift = minValue < 0 ? Math.abs(minValue) + 1 : 0;
    const shiftedMatrix = payoffMatrix.map(row => row.map(val => val + shift));

    // 線形計画問題を定式化
    const model: any = {
      optimize: 'u',
      opType: 'min',
      constraints: {},
      variables: {}
    };

    // 変数定義: y[j] for j = 0, ..., numCols-1, u
    for (let j = 0; j < numCols; j++) {
      model.variables[`y${j}`] = { u: 0 };
    }
    model.variables['u'] = { u: 1 };

    // 制約条件1: Σ(j) y[j] * M[i][j] <= u  (for all i)
    for (let i = 0; i < numRows; i++) {
      const constraintName = `payoff_${i}`;
      model.constraints[constraintName] = { max: 0 };
      
      for (let j = 0; j < numCols; j++) {
        model.variables[`y${j}`][constraintName] = shiftedMatrix[i][j];
      }
      model.variables['u'][constraintName] = -1;
    }

    // 制約条件2: Σ(j) y[j] = 1
    model.constraints['prob_sum'] = { equal: 1 };
    for (let j = 0; j < numCols; j++) {
      model.variables[`y${j}`]['prob_sum'] = 1;
    }

    try {
      const solution = Solver.Solve(model);

      if (!solution || !solution.feasible) {
        return {
          player1Strategy: [],
          player2Strategy: [],
          gameValue: 0,
          isValid: false,
          error: 'プレイヤー2の問題が実行不可能'
        };
      }

      // 戦略を抽出
      const strategy = Array(numCols).fill(0);
      for (let j = 0; j < numCols; j++) {
        const value = solution[`y${j}`] || 0;
        strategy[j] = Math.max(0, value); // 負の値を0にクリップ
      }

      // 確率の正規化
      const sum = strategy.reduce((a, b) => a + b, 0);
      if (sum > this.EPSILON) {
        for (let j = 0; j < numCols; j++) {
          strategy[j] /= sum;
        }
      } else {
        // 均等分布にフォールバック
        strategy.fill(1 / numCols);
      }

      const gameValue = (solution.u || 0) - shift;

      return {
        player1Strategy: [],
        player2Strategy: strategy,
        gameValue,
        isValid: true
      };

    } catch (error) {
      return {
        player1Strategy: [],
        player2Strategy: [],
        gameValue: 0,
        isValid: false,
        error: `プレイヤー2の求解エラー: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Nash均衡の検証
   * @param payoffMatrix 利得行列
   * @param player1Strategy プレイヤー1の戦略
   * @param player2Strategy プレイヤー2の戦略
   * @param gameValue ゲーム値
   * @returns 検証結果
   */
  public verifyNashEquilibrium(
    payoffMatrix: number[][],
    player1Strategy: number[],
    player2Strategy: number[],
    gameValue: number
  ): {
    isValid: boolean;
    player1Regret: number;
    player2Regret: number;
    details: string[];
  } {
    const details: string[] = [];
    const numRows = payoffMatrix.length;
    const numCols = payoffMatrix[0].length;

    // プレイヤー1の各純戦略に対する期待ペイオフ
    let maxPlayer1Regret = 0;
    for (let i = 0; i < numRows; i++) {
      let expectedPayoff = 0;
      for (let j = 0; j < numCols; j++) {
        expectedPayoff += payoffMatrix[i][j] * player2Strategy[j];
      }
      const regret = Math.max(0, expectedPayoff - gameValue);
      maxPlayer1Regret = Math.max(maxPlayer1Regret, regret);
      
      if (regret > this.EPSILON) {
        details.push(`P1戦略${i}: 期待値${expectedPayoff.toFixed(6)}, 後悔値${regret.toFixed(6)}`);
      }
    }

    // プレイヤー2の各純戦略に対する期待ペイオフ
    let maxPlayer2Regret = 0;
    for (let j = 0; j < numCols; j++) {
      let expectedPayoff = 0;
      for (let i = 0; i < numRows; i++) {
        expectedPayoff += payoffMatrix[i][j] * player1Strategy[i];
      }
      const regret = Math.max(0, gameValue - expectedPayoff);
      maxPlayer2Regret = Math.max(maxPlayer2Regret, regret);
      
      if (regret > this.EPSILON) {
        details.push(`P2戦略${j}: 期待値${expectedPayoff.toFixed(6)}, 後悔値${regret.toFixed(6)}`);
      }
    }

    const isValid = maxPlayer1Regret <= this.EPSILON && maxPlayer2Regret <= this.EPSILON;

    // デバッグ情報
    if (!isValid) {
      details.push(`Debug: P1後悔値=${maxPlayer1Regret} > EPSILON=${this.EPSILON}? ${maxPlayer1Regret > this.EPSILON}`);
      details.push(`Debug: P2後悔値=${maxPlayer2Regret} > EPSILON=${this.EPSILON}? ${maxPlayer2Regret > this.EPSILON}`);
    }

    return {
      isValid,
      player1Regret: maxPlayer1Regret,
      player2Regret: maxPlayer2Regret,
      details
    };
  }
}