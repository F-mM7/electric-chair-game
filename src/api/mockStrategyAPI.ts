import { OptimalStrategy } from '../types/analysis';
import { decodeGameStateHash } from '../utils/stateHash';

/**
 * 開発用のモックAPI
 * 実際の解析データの代わりにダミーデータを返す
 */
export class MockStrategyAPI {
  /**
   * 単一の状態ハッシュから戦略を取得（モック）
   */
  public async getStrategy(stateHash: number): Promise<OptimalStrategy | null> {
    // デモ用：全てのターンでモック戦略を返す
    const state = decodeGameStateHash(stateHash);
    
    // 常にモックデータを返す（デモ用）

    // ランダムな戦略を生成（デモ用）
    const player1Probabilities = new Array(12).fill(0);
    const player2Probabilities = new Array(12).fill(0);
    
    // 利用可能な椅子に確率を割り当て
    let availableCount = 0;
    for (let i = 0; i < 12; i++) {
      if (state.chairs & (1 << i)) {
        availableCount++;
      }
    }

    if (availableCount > 0) {
      const equalProb = 1 / availableCount;
      for (let i = 0; i < 12; i++) {
        if (state.chairs & (1 << i)) {
          // デモ用：ランダムな重み付け
          const weight1 = Math.random() * 0.5 + 0.5;
          const weight2 = Math.random() * 0.5 + 0.5;
          player1Probabilities[i] = equalProb * weight1;
          player2Probabilities[i] = equalProb * weight2;
        }
      }

      // 正規化
      const sum1 = player1Probabilities.reduce((a, b) => a + b, 0);
      const sum2 = player2Probabilities.reduce((a, b) => a + b, 0);
      
      for (let i = 0; i < 12; i++) {
        player1Probabilities[i] /= sum1;
        player2Probabilities[i] /= sum2;
      }
    }

    // 期待値はプレイヤー1の得点差に基づく簡易計算
    const scoreDiff = state.player1Score - state.player2Score;
    const expectedValue = Math.tanh(scoreDiff / 20); // -1 to 1の範囲

    return {
      player1Probabilities,
      player2Probabilities,
      expectedValue,
      isCalculated: true
    };
  }

  /**
   * 解析進捗を取得（モック）
   */
  public async getAnalysisProgress(): Promise<any> {
    return {
      currentTurn: 10,
      analyzedStates: {
        10: 2000000,
        11: 2027888,
        12: 1231368,
        13: 475738,
        14: 96258
      },
      totalStates: {
        10: 2370792,
        11: 2027888,
        12: 1231368,
        13: 475738,
        14: 96258,
        15: 0
      },
      isComplete: false
    };
  }

  public clearCache(): void {
    // モックなのでキャッシュクリアは不要
  }
}

// シングルトンインスタンス
export const mockStrategyAPI = new MockStrategyAPI();