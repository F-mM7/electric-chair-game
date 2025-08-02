export interface OptimalStrategy {
  player1Probabilities: number[]; // プレイヤー1の椅子選択確率 [椅子1, 椅子2, ..., 椅子12]
  player2Probabilities: number[]; // プレイヤー2の椅子選択確率 [椅子1, 椅子2, ..., 椅子12]
  expectedValue: number;          // プレイヤー1目線での期待値
  isCalculated: boolean;          // 計算済みフラグ
}

export interface AnalysisProgress {
  analyzedStates: Record<number, number>; // ターン別解析済み盤面数
  totalStates: Record<number, number>;    // ターン別総盤面数
  lastUpdated: string;          // 最終更新時刻
  isComplete: boolean;          // 全解析完了フラグ
}

export interface StateTransition {
  fromHash: number;             // 遷移元状態ハッシュ
  toHash: number;               // 遷移先状態ハッシュ
  attackerChoice: number;       // 攻撃側の選択
  defenderChoice: number;       // 防御側の選択
  probability: number;          // この遷移の確率
}

export interface StateOutcome {
  hash?: number;                // 進行状態の場合のハッシュ
  expectedValue?: number;       // 終了状態の場合の期待値
  isTerminal: boolean;          // 終了状態かどうか
}

export interface TurnAnalysisResult {
  turn: number;
  strategies: Record<number, OptimalStrategy>; // ハッシュ -> 最適戦略
  stateHashes: number[];        // このターンの全状態ハッシュ
  transitionCount: number;      // 処理した遷移数
}

export interface AnalysisConfig {
  maxBatchSize: number;         // 一度に処理する盤面数
  precisionDigits: number;      // 確率の精度（小数点以下桁数）
  saveInterval: number;         // 保存間隔（処理した盤面数）
  outputDirectory: string;      // 出力ディレクトリ
  drawValue: number;            // 引き分け時のプレイヤー1目線での得点
}