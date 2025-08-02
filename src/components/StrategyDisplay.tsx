import React, { useEffect, useState } from "react";
import { GameState } from "../types/game";
import { OptimalStrategy } from "../types/analysis";
import { encodeGameStateHash } from "../utils/stateHash";
import { getStaticStrategyAPI } from "../api/staticStrategyAPI";
import { mockStrategyAPI } from "../api/mockStrategyAPI";
import "./StrategyDisplay.css";

interface StrategyDisplayProps {
  gameState: GameState;
  isVisible?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
}

const StrategyDisplay: React.FC<StrategyDisplayProps> = ({
  gameState,
  isVisible = false,
  onToggleVisibility,
}) => {
  const [strategy, setStrategy] = useState<OptimalStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    const fetchStrategy = async () => {
      setLoading(true);
      setError(null);

      try {
        const hash = encodeGameStateHash(gameState);
        const hexHash =
          "0x" + (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
        console.log("Current game state hash:", hexHash, `(${hash})`);
        console.log("Current turn:", gameState.currentTurn);
        const api = getStaticStrategyAPI();
        const result = await api.getStrategy(hash);

        if (result) {
          setStrategy(result);
          setIsMockData(false);
        } else {
          // 実データが無い場合はモックデータを表示（デモ用）
          const mockResult = await mockStrategyAPI.getStrategy(hash);
          if (mockResult) {
            setStrategy(mockResult);
            setIsMockData(true);
          } else {
            setError("この状態の戦略はまだ解析されていません");
          }
        }
      } catch (err) {
        // エラー時もモックデータを試行（デモ用）
        try {
          const hash = encodeGameStateHash(gameState);
          const mockResult = await mockStrategyAPI.getStrategy(hash);
          if (mockResult) {
            setStrategy(mockResult);
            setIsMockData(true);
          } else {
            setError("戦略の取得に失敗しました");
          }
        } catch (mockErr) {
          setError("戦略の取得に失敗しました");
          console.error("Strategy fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    if (gameState.gameStatus === "IN_PROGRESS") {
      fetchStrategy();
    }
  }, [gameState]);

  if (loading) {
    return <div className="strategy-display loading">戦略を読み込み中...</div>;
  }

  if (error) {
    return <div className="strategy-display error">{error}</div>;
  }

  if (!strategy || !strategy.isCalculated) {
    return null;
  }

  // 利用可能な椅子のインデックスを取得
  const availableChairs = gameState.chairsRemaining
    .map((remaining, index) => (remaining ? index + 1 : null))
    .filter((chair) => chair !== null) as number[];

  // 両プレイヤーの確率データを準備
  const renderPlayerStrategy = (
    playerNumber: 1 | 2,
    probabilities: number[]
  ) => (
    <div className="player-strategy">
      {availableChairs.map((chairNumber) => {
        const probability = probabilities[chairNumber - 1];
        return (
          <div key={chairNumber} className="probability-item">
            <span className="chair-label">{chairNumber}</span>
            <div className="probability-bar-container">
              <div
                className={`probability-bar player${playerNumber}`}
                style={{
                  width: `${(probability / Math.max(...probabilities)) * 100}%`,
                }}
              />
              <span className="probability-value">
                {(probability * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="strategy-display">
      <div className="strategy-header">
        <h3>最適戦略 {isMockData && "（デモデータ）"}</h3>
        <button
          className="toggle-strategy-btn"
          onClick={() => onToggleVisibility?.(!isVisible)}
        >
          {isVisible ? "戦略を隠す" : "戦略を表示"}
        </button>
      </div>

      {isVisible && (
        <>
          {isMockData && (
            <div className="mock-data-warning">
              ⚠️
              この戦略データはデモ用です。実際の解析が完了すると正確な最適戦略が表示されます。
            </div>
          )}
          <div className="state-info">
            <div className="win-rates">
              <div className="win-rate-visualization">
                <div
                  className="win-rate-bar player1-bar"
                  style={{
                    width: `${(strategy.expectedValue / 2 + 0.5) * 100}%`,
                  }}
                />
                <div className="win-rate-percentages">
                  <span className="player1-percentage">
                    {((strategy.expectedValue / 2 + 0.5) * 100).toFixed(1)}%
                  </span>
                  <span className="player2-percentage">
                    {((0.5 - strategy.expectedValue / 2) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="strategies-container">
            {renderPlayerStrategy(1, strategy.player1Probabilities)}
            {renderPlayerStrategy(2, strategy.player2Probabilities)}
          </div>
        </>
      )}
    </div>
  );
};

export default StrategyDisplay;
