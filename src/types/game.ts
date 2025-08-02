export interface GameState {
  currentTurn: number;
  chairsRemaining: boolean[];
  player1Score: number;
  player2Score: number;
  player1ElectricCount: number;
  player2ElectricCount: number;
  gameStatus: GameStatus;
  winner?: PlayerNumber;
}

export enum GameStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  PLAYER1_WIN = 'PLAYER1_WIN',
  PLAYER2_WIN = 'PLAYER2_WIN',
  DRAW = 'DRAW'
}

export enum PlayerNumber {
  PLAYER1 = 1,
  PLAYER2 = 2
}

export interface PlayerChoice {
  player: PlayerNumber;
  chairNumber: number;
}

export interface TurnResult {
  attacker: PlayerNumber;
  defender: PlayerNumber;
  attackerChoice: number;
  defenderChoice: number;
  matched: boolean;
  scoreGained: number;
  electricReceived: boolean;
  chairRemoved?: number;
  newGameState: GameState;
}

export const INITIAL_GAME_STATE: GameState = {
  currentTurn: 0,
  chairsRemaining: Array(12).fill(true),
  player1Score: 0,
  player2Score: 0,
  player1ElectricCount: 0,
  player2ElectricCount: 0,
  gameStatus: GameStatus.IN_PROGRESS
};

export const MAX_SCORE = 40;
export const MAX_ELECTRIC_COUNT = 3;
export const MAX_TURNS = 16;
export const CHAIR_COUNT = 12;

// 表形式得点表示用の型定義
export interface RoundScoreEntry {
  round: number;  // ラウンド番号（ターン1-2がラウンド1、ターン3-4がラウンド2...）
  player: PlayerNumber;
  points: number;
  electricShock: boolean;
  chairNumber: number;  // 選択した椅子番号
  turn: number;  // どのターンで発生したか
}

export type GameHistory = RoundScoreEntry[];