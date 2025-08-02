#!/usr/bin/env node
import { hashToGameState, formatHashForDisplay } from '../utils/stateHash';
import { getSuccessorStates } from '../utils/stateTransition';
import { GameStatus } from '../types/game';

const hashArg = process.argv[2];
if (!hashArg) {
  console.error('Usage: npm run debug-transition <hash>');
  process.exit(1);
}

const stateHash = parseInt(hashArg, hashArg.startsWith('0x') ? 16 : 10) >>> 0;
const gameState = hashToGameState(stateHash);

console.log(`\n🎮 Current State: ${formatHashForDisplay(stateHash)}`);
console.log(`Turn: ${gameState.currentTurn}`);
console.log(`P1: ${gameState.player1Score}pts (${gameState.player1ElectricCount}⚡)`);
console.log(`P2: ${gameState.player2Score}pts (${gameState.player2ElectricCount}⚡)`);
console.log(`Chairs: [${gameState.chairsRemaining.map((c, i) => c ? i + 1 : '×').join(', ')}]`);
console.log(`Status: ${gameState.gameStatus}`);

const successorData = getSuccessorStates(stateHash);
console.log(`\n📊 Successor States (${Object.keys(successorData.outcomes).length}):`);

for (const [key, outcome] of Object.entries(successorData.outcomes)) {
  const [attackChoice, defendChoice] = key.split('_').map(Number);
  let details = '';
  
  if (outcome.isTerminal) {
    details = `Terminal (${outcome.expectedValue})`;
    const nextState = hashToGameState(outcome.hash!);
    details += ` - ${nextState.gameStatus}`;
    if (nextState.gameStatus === GameStatus.IN_PROGRESS) {
      details += ` [P1:${nextState.player1Score}pts(${nextState.player1ElectricCount}⚡) P2:${nextState.player2Score}pts(${nextState.player2ElectricCount}⚡)]`;
    }
  } else {
    const nextState = hashToGameState(outcome.hash!);
    details = `${formatHashForDisplay(outcome.hash!)} - Turn ${nextState.currentTurn}`;
  }
  
  console.log(`  Attack:${attackChoice}, Defend:${defendChoice} → ${details}`);
}