import { GameState, GameStatus } from '../types/game';
import { processTurn, getAvailableChairs } from './gameLogic';
import { encodeGameStateHash, hashToGameState } from './stateHash';
import { StateTransition, StateOutcome } from '../types/analysis';
import { getDrawValue } from '../config/analysisConfig';

/**
 * 指定された状態から可能な全ての遷移を生成
 */
export function generateStateTransitions(stateHash: number): StateTransition[] {
  const gameState = hashToGameState(stateHash);
  
  // ゲーム終了状態の場合は遷移なし
  if (gameState.gameStatus !== GameStatus.IN_PROGRESS) {
    return [];
  }

  const availableChairs = getAvailableChairs(gameState);
  const transitions: StateTransition[] = [];

  // 攻撃側と防御側の全ての選択組み合わせを生成
  for (const attackerChoice of availableChairs) {
    for (const defenderChoice of availableChairs) {
      try {
        const result = processTurn(gameState, attackerChoice, defenderChoice);
        const toHash = encodeGameStateHash(result.newGameState);
        
        transitions.push({
          fromHash: stateHash,
          toHash,
          attackerChoice,
          defenderChoice,
          probability: 1.0 // 初期値、後で最適戦略計算時に更新
        });
      } catch (error) {
        // 無効な遷移はスキップ
        console.warn(`Invalid transition from ${stateHash}: ${attackerChoice} -> ${defenderChoice}`);
      }
    }
  }

  return transitions;
}

/**
 * 指定ターンの全到達可能状態を生成
 */
export function generateReachableStates(maxTurn: number): Set<number> {
  const reachableStates = new Set<number>();
  const queue: number[] = [];
  
  // 初期状態から開始
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
  
  const initialHash = encodeGameStateHash(initialState);
  queue.push(initialHash);
  reachableStates.add(initialHash);

  while (queue.length > 0) {
    const currentHash = queue.shift()!;
    const currentState = hashToGameState(currentHash);
    
    // 最大ターンに達したら終了
    if (currentState.currentTurn >= maxTurn) {
      continue;
    }

    // 現在の状態から可能な遷移を生成
    const transitions = generateStateTransitions(currentHash);
    
    for (const transition of transitions) {
      if (!reachableStates.has(transition.toHash)) {
        reachableStates.add(transition.toHash);
        queue.push(transition.toHash);
      }
    }
  }

  return reachableStates;
}

/**
 * ターン別に状態を分類
 */
export function groupStatesByTurn(stateHashes: Set<number>): Record<number, number[]> {
  const groupedStates: Record<number, number[]> = {};
  
  for (const hash of stateHashes) {
    const state = hashToGameState(hash);
    const turn = state.currentTurn;
    
    if (!groupedStates[turn]) {
      groupedStates[turn] = [];
    }
    groupedStates[turn].push(hash);
  }

  return groupedStates;
}

/**
 * 状態の後続状態を取得（最適戦略計算で使用）
 */
export function getSuccessorStates(stateHash: number): {
  attackerChoices: number[];
  defenderChoices: number[];
  outcomes: Record<string, StateOutcome>; // "attack_defend" -> StateOutcome
} {
  const gameState = hashToGameState(stateHash);
  const availableChairs = getAvailableChairs(gameState);
  const outcomes: Record<string, StateOutcome> = {};

  for (const attackerChoice of availableChairs) {
    for (const defenderChoice of availableChairs) {
      const result = processTurn(gameState, attackerChoice, defenderChoice);
      const key = `${attackerChoice}_${defenderChoice}`;
      
      // 終了状態かどうかを判定
      if (result.newGameState.gameStatus !== GameStatus.IN_PROGRESS) {
        // 終了状態: 期待値を直接計算
        let expectedValue: number;
        switch (result.newGameState.gameStatus) {
          case GameStatus.PLAYER1_WIN:
            expectedValue = 1.0;
            break;
          case GameStatus.PLAYER2_WIN:
            expectedValue = -1.0;
            break;
          case GameStatus.DRAW:
            expectedValue = getDrawValue();
            break;
          default:
            expectedValue = 0.0;
        }
        
        outcomes[key] = {
          expectedValue,
          isTerminal: true,
          hash: encodeGameStateHash(result.newGameState)
        };
      } else {
        // 進行状態: ハッシュを生成
        const resultHash = encodeGameStateHash(result.newGameState);
        outcomes[key] = {
          hash: resultHash,
          isTerminal: false
        };
      }
    }
  }

  return {
    attackerChoices: availableChairs,
    defenderChoices: availableChairs,
    outcomes
  };
}