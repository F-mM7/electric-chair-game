import React, { useState, useEffect } from "react";
import {
  GameState,
  INITIAL_GAME_STATE,
  GameStatus,
  GameHistory,
  RoundScoreEntry,
  PlayerNumber,
} from "./types/game";
import {
  processTurn,
  getAvailableChairs,
  getChairSelector,
  getElectricSetter,
} from "./utils/gameLogic";
import { getCpuChoice } from "./utils/cpuPlayer";
import GameBoard from "./components/GameBoard";
import StrategyDisplay from "./components/StrategyDisplay";
import ScoreTable from "./components/ScoreTable";
import CpuSettings from "./components/CpuSettings";
import "./App.css";

enum GamePhase {
  ATTACKER_SELECTION = "ATTACKER_SELECTION",
  DEFENDER_SELECTION = "DEFENDER_SELECTION",
  GAME_ENDED = "GAME_ENDED",
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [attackerChoice, setAttackerChoice] = useState<number | null>(null);
  const [defenderChoice, setDefenderChoice] = useState<number | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>(
    GamePhase.DEFENDER_SELECTION
  );
  const [isStrategyVisible, setIsStrategyVisible] = useState<boolean>(false);
  const [gameHistory, setGameHistory] = useState<GameHistory>([]);
  const [isPlayer1Cpu, setIsPlayer1Cpu] = useState<boolean>(false);
  const [isPlayer2Cpu, setIsPlayer2Cpu] = useState<boolean>(false);
  const [isProcessingCpu, setIsProcessingCpu] = useState<boolean>(false);

  const chairSelector = getChairSelector(gameState.currentTurn);
  const electricSetter = getElectricSetter(gameState.currentTurn);
  const availableChairs = getAvailableChairs(gameState);

  const handleDefenderChoice = (chairNumber: number) => {
    setDefenderChoice(chairNumber);
    setGamePhase(GamePhase.ATTACKER_SELECTION);
  };

  const handleAttackerChoice = (chairNumber: number) => {
    setAttackerChoice(chairNumber);
    // 攻撃側が選択したら即座にターンを実行
    if (defenderChoice !== null) {
      // UI上: chairNumber=椅子選択側, defenderChoice=電気仕掛け側
      // processTurn(gameState, 椅子選択, 電気仕掛け)
      const result = processTurn(gameState, chairNumber, defenderChoice);
      setGameState(result.newGameState);

      // ゲーム履歴に追加（椅子選択側のアクションを記録）
      const round = Math.floor(gameState.currentTurn / 2) + 1;
      const chairSelector = getChairSelector(gameState.currentTurn);

      if (result.scoreGained > 0 || result.electricReceived) {
        const historyEntry: RoundScoreEntry = {
          round: round,
          player: chairSelector,
          points: result.scoreGained,
          electricShock: result.electricReceived,
          chairNumber: chairNumber,
          turn: gameState.currentTurn,
        };
        setGameHistory((prev) => [...prev, historyEntry]);
      }

      if (result.newGameState.gameStatus === GameStatus.IN_PROGRESS) {
        // 次のターンに直接移行
        setAttackerChoice(null);
        setDefenderChoice(null);
        setGamePhase(GamePhase.DEFENDER_SELECTION);
      } else {
        setGamePhase(GamePhase.GAME_ENDED);
      }
    }
  };

  const resetGame = () => {
    setGameState(INITIAL_GAME_STATE);
    setAttackerChoice(null);
    setDefenderChoice(null);
    setGamePhase(GamePhase.DEFENDER_SELECTION);
    setGameHistory([]);
  };

  // CPU自動操作のための副作用
  useEffect(() => {
    const processCpuTurn = async () => {
      if (gamePhase === GamePhase.GAME_ENDED || isProcessingCpu) return;

      let shouldProcessCpu = false;
      let currentPlayer: PlayerNumber | null = null;

      if (gamePhase === GamePhase.DEFENDER_SELECTION) {
        // 電気仕掛け側の番
        const electricSetter = getElectricSetter(gameState.currentTurn);
        shouldProcessCpu = (electricSetter === PlayerNumber.PLAYER1 && isPlayer1Cpu) ||
                          (electricSetter === PlayerNumber.PLAYER2 && isPlayer2Cpu);
        currentPlayer = electricSetter;
      } else if (gamePhase === GamePhase.ATTACKER_SELECTION) {
        // 椅子選択側の番
        const chairSelector = getChairSelector(gameState.currentTurn);
        shouldProcessCpu = (chairSelector === PlayerNumber.PLAYER1 && isPlayer1Cpu) ||
                          (chairSelector === PlayerNumber.PLAYER2 && isPlayer2Cpu);
        currentPlayer = chairSelector;
      }

      if (shouldProcessCpu && currentPlayer !== null) {
        setIsProcessingCpu(true);
        try {
          const cpuChoice = await getCpuChoice(gameState, currentPlayer);
          if (cpuChoice !== null) {
            // 少し遅延を入れて人間らしく見せる
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (gamePhase === GamePhase.DEFENDER_SELECTION) {
              handleDefenderChoice(cpuChoice);
            } else {
              handleAttackerChoice(cpuChoice);
            }
          }
        } catch (error) {
          console.error('CPU選択エラー:', error);
        } finally {
          setIsProcessingCpu(false);
        }
      }
    };

    processCpuTurn();
  }, [gamePhase, gameState, isPlayer1Cpu, isPlayer2Cpu, isProcessingCpu]);

  return (
    <div className="app">
      <h1>電気椅子ゲーム</h1>

      <ScoreTable
        gameHistory={gameHistory}
        player1Score={gameState.player1Score}
        player2Score={gameState.player2Score}
      />

      <div className="game-main-section">
        <StrategyDisplay
          gameState={gameState}
          isVisible={isStrategyVisible}
          onToggleVisibility={setIsStrategyVisible}
        />
        
        <div className="right-section">
          <div
            className={`phase-info ${
              gamePhase !== GamePhase.GAME_ENDED
                ? gamePhase === GamePhase.DEFENDER_SELECTION
                  ? `player${electricSetter}-bg`
                  : `player${chairSelector}-bg`
                : ""
            }`}
          >
            {gamePhase === GamePhase.GAME_ENDED ? (
              <div className="game-result">
                <h3>ゲーム終了</h3>
                <p>
                  {gameState.gameStatus === GameStatus.DRAW
                    ? "引き分け"
                    : `プレイヤー${gameState.winner}の勝利`}
                </p>
              </div>
            ) : (
              <>
                <h3>
                  プレイヤー
                  {gamePhase === GamePhase.DEFENDER_SELECTION
                    ? electricSetter
                    : chairSelector}
                  （
                  {gamePhase === GamePhase.DEFENDER_SELECTION
                    ? "電気仕掛け側"
                    : "椅子選択側"}
                  ）の椅子選択
                </h3>
              </>
            )}
          </div>

          <GameBoard
          chairsRemaining={gameState.chairsRemaining}
          availableChairs={availableChairs}
          onChairSelect={
            gamePhase === GamePhase.DEFENDER_SELECTION
              ? handleDefenderChoice
              : gamePhase === GamePhase.ATTACKER_SELECTION
              ? handleAttackerChoice
              : undefined
          }
          selectedChair={
            gamePhase === GamePhase.DEFENDER_SELECTION
              ? defenderChoice
              : gamePhase === GamePhase.ATTACKER_SELECTION
              ? attackerChoice
              : null
          }
          isSelectionMode={
            gamePhase === GamePhase.DEFENDER_SELECTION ||
            gamePhase === GamePhase.ATTACKER_SELECTION
          }
        />
        </div>
      </div>

      <div className="controls">
        <button onClick={resetGame} className="reset-btn">
          新しいゲーム
        </button>
        <CpuSettings
          isPlayer1Cpu={isPlayer1Cpu}
          isPlayer2Cpu={isPlayer2Cpu}
          onTogglePlayer1={setIsPlayer1Cpu}
          onTogglePlayer2={setIsPlayer2Cpu}
        />
      </div>
    </div>
  );
};

export default App;
