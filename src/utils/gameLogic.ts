import { GameState, GameStatus, PlayerNumber, TurnResult, MAX_SCORE, MAX_ELECTRIC_COUNT, MAX_TURNS } from '../types/game';

// 攻撃側（椅子を選択し電流を仕掛ける側）
export function getCurrentAttacker(turn: number): PlayerNumber {
  return turn % 2 === 0 ? PlayerNumber.PLAYER1 : PlayerNumber.PLAYER2;
}

// 防御側（椅子を選択し電気を避ける側）
export function getCurrentDefender(turn: number): PlayerNumber {
  return turn % 2 === 0 ? PlayerNumber.PLAYER2 : PlayerNumber.PLAYER1;
}

// UI表示用: 椅子選択側のプレイヤー（UI上の攻撃側表示）
export function getChairSelector(turn: number): PlayerNumber {
  return getCurrentAttacker(turn); // 攻撃側と同じ
}

// UI表示用: 電気仕掛け側のプレイヤー（UI上の防御側表示）
export function getElectricSetter(turn: number): PlayerNumber {
  return getCurrentDefender(turn); // 防御側と同じ
}

export function getAvailableChairs(gameState: GameState): number[] {
  return gameState.chairsRemaining
    .map((remaining, index) => remaining ? index + 1 : -1)
    .filter(chair => chair !== -1);
}

export function processTurn(
  gameState: GameState,
  attackerChoice: number,
  defenderChoice: number
): TurnResult {
  const attacker = getCurrentAttacker(gameState.currentTurn);
  const defender = getCurrentDefender(gameState.currentTurn);
  const matched = attackerChoice === defenderChoice;
  
  let newState = { 
    ...gameState,
    chairsRemaining: [...gameState.chairsRemaining] // 配列を深くコピー
  };
  let scoreGained = 0;
  let electricReceived = false;
  let chairRemoved: number | undefined;

  // 両者の選択による処理
  if (matched) {
    // 一致した場合：攻撃側が電流を受ける
    electricReceived = true;
    if (attacker === PlayerNumber.PLAYER1) {
      newState.player1Score = 0;
      newState.player1ElectricCount += 1;
    } else {
      newState.player2Score = 0;
      newState.player2ElectricCount += 1;
    }
    // 椅子は撤去されない
  } else {
    // 不一致の場合：攻撃側が点数を獲得し、攻撃側の選択した椅子が撤去される
    scoreGained = attackerChoice;
    chairRemoved = attackerChoice;
    newState.chairsRemaining[attackerChoice - 1] = false;
    
    if (attacker === PlayerNumber.PLAYER1) {
      newState.player1Score += scoreGained;
    } else {
      newState.player2Score += scoreGained;
    }
  }

  // ゲーム終了条件をチェック（ターン進行前に判定）
  // 椅子撤去・点数獲得後の状態で終了判定を行う
  newState.gameStatus = checkGameEnd(newState);
  newState.winner = getWinner(newState);
  
  // 終了していなければターン進行
  if (newState.gameStatus === GameStatus.IN_PROGRESS) {
    newState.currentTurn += 1;
  }

  return {
    attacker,
    defender,
    attackerChoice,
    defenderChoice,
    matched,
    scoreGained,
    electricReceived,
    chairRemoved,
    newGameState: newState
  };
}

export function checkGameEnd(gameState: GameState): GameStatus {
  // 電流3回で敗北（3回ちょうどで判定）
  if (gameState.player1ElectricCount === MAX_ELECTRIC_COUNT) {
    return GameStatus.PLAYER2_WIN;
  }
  
  if (gameState.player2ElectricCount === MAX_ELECTRIC_COUNT) {
    return GameStatus.PLAYER1_WIN;
  }
  
  // 40点以上で勝利
  if (gameState.player1Score >= MAX_SCORE) {
    return GameStatus.PLAYER1_WIN;
  }
  
  if (gameState.player2Score >= MAX_SCORE) {
    return GameStatus.PLAYER2_WIN;
  }
  
  const remainingChairs = gameState.chairsRemaining.filter(chair => chair).length;
  
  // 残り椅子1個時またはターン15終了時（16ターン実行後）の点数勝負
  // 注意: checkGameEndはターン進行前に呼ばれるため、Turn15処理後はcurrentTurn=15のまま
  if (remainingChairs === 1 || gameState.currentTurn >= (MAX_TURNS - 1)) {
    if (gameState.player1Score > gameState.player2Score) {
      return GameStatus.PLAYER1_WIN;
    } else if (gameState.player2Score > gameState.player1Score) {
      return GameStatus.PLAYER2_WIN;
    } else {
      return GameStatus.DRAW;
    }
  }
  
  return GameStatus.IN_PROGRESS;
}

export function getWinner(gameState: GameState): PlayerNumber | undefined {
  switch (gameState.gameStatus) {
    case GameStatus.PLAYER1_WIN:
      return PlayerNumber.PLAYER1;
    case GameStatus.PLAYER2_WIN:
      return PlayerNumber.PLAYER2;
    default:
      return undefined;
  }
}

export function getGameStateHash(gameState: GameState): string {
  const chairs = gameState.chairsRemaining.map(c => c ? '1' : '0').join('');
  return `${gameState.currentTurn}-${chairs}-${gameState.player1Score}-${gameState.player2Score}-${gameState.player1ElectricCount}-${gameState.player2ElectricCount}`;
}