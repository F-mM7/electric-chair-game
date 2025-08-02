import { GameState, PlayerNumber } from '../types/game';
import { getCurrentAttacker, getAvailableChairs } from './gameLogic';
import { encodeGameStateHash } from './stateHash';
import { getStaticStrategyAPI } from '../api/staticStrategyAPI';

export async function getCpuChoice(
  gameState: GameState,
  playerNumber: PlayerNumber
): Promise<number | null> {
  const api = getStaticStrategyAPI();
  const stateHash = encodeGameStateHash(gameState);
  const strategy = await api.getStrategy(stateHash);
  
  if (!strategy || !strategy.isCalculated) {
    // 戦略データがない場合はランダムに選択
    const availableChairs = getAvailableChairs(gameState);
    if (availableChairs.length === 0) return null;
    return availableChairs[Math.floor(Math.random() * availableChairs.length)];
  }

  // プレイヤーの役割を判定して適切な確率配列を選択
  const isAttacker = getCurrentAttacker(gameState.currentTurn) === playerNumber;
  const probabilities = isAttacker ? strategy.player1Probabilities : strategy.player2Probabilities;
  
  // 確率に基づいて椅子を選択
  return selectChairByProbability(probabilities, gameState);
}

function selectChairByProbability(
  probabilities: number[],
  gameState: GameState
): number {
  const availableChairs = getAvailableChairs(gameState);
  if (availableChairs.length === 0) return 1; // fallback

  // 利用可能な椅子の確率を正規化
  let totalProb = 0;
  const normalizedProbs: { chair: number; prob: number }[] = [];
  
  for (const chair of availableChairs) {
    const prob = probabilities[chair - 1] || 0;
    totalProb += prob;
    normalizedProbs.push({ chair, prob });
  }

  // 確率に基づいて選択
  const random = Math.random() * totalProb;
  let cumulative = 0;
  
  for (const { chair, prob } of normalizedProbs) {
    cumulative += prob;
    if (random <= cumulative) {
      return chair;
    }
  }

  // fallback: 最後の利用可能な椅子を返す
  return availableChairs[availableChairs.length - 1];
}