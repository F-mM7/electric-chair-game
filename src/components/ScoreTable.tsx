import React from "react";
import { GameHistory, PlayerNumber, MAX_TURNS } from "../types/game";
import "../styles/ScoreTable.css";

interface ScoreTableProps {
  gameHistory: GameHistory;
  player1Score: number;
  player2Score: number;
}

const ScoreTable: React.FC<ScoreTableProps> = ({
  gameHistory,
  player1Score,
  player2Score,
}) => {
  // ラウンド数を計算（MAX_TURNS=16なので8ラウンド）
  const maxRounds = Math.ceil(MAX_TURNS / 2);

  // ラウンドごとの得点情報を整理
  const roundData: {
    [round: number]: {
      [player: number]: {
        points: number;
        electricShock: boolean;
        chairNumber: number;
      } | null;
    };
  } = {};

  // GameHistoryからラウンドごとのデータを構築
  gameHistory.forEach((entry) => {
    if (!roundData[entry.round]) {
      roundData[entry.round] = {};
    }
    roundData[entry.round][entry.player] = {
      points: entry.points,
      electricShock: entry.electricShock,
      chairNumber: entry.chairNumber,
    };
  });

  // ラウンド番号のヘッダーを生成（1-8 + Σ）
  const roundHeaders = Array.from({ length: maxRounds }, (_, i) => i + 1);

  // プレイヤーごとの行データを生成
  const getPlayerRowData = (player: PlayerNumber) => {
    return roundHeaders.map((round) => {
      const roundEntry = roundData[round];
      const playerEntry = roundEntry?.[player];

      if (!playerEntry) {
        return null; // このラウンドでは何も起きていない
      }

      if (playerEntry.electricShock) {
        return "⚡"; // 電気ショック
      }

      return playerEntry.chairNumber; // 選択した椅子番号を表示
    });
  };

  return (
    <div className="score-table-container">
      <table className="score-table">
        <thead>
          <tr>
            <th className="player-header"></th>
            {roundHeaders.map((round) => (
              <th key={round} className="round-header">
                {round}
              </th>
            ))}
            <th className="sum-header">Σ</th>
          </tr>
        </thead>
        <tbody>
          <tr className="player1-row">
            <td className="player-label">プレイヤー1</td>
            {getPlayerRowData(PlayerNumber.PLAYER1).map((data, index) => (
              <td key={index} className="score-cell">
                {data !== null ? data : ""}
              </td>
            ))}
            <td className="sum-cell">{player1Score}</td>
          </tr>
          <tr className="player2-row">
            <td className="player-label">プレイヤー2</td>
            {getPlayerRowData(PlayerNumber.PLAYER2).map((data, index) => (
              <td key={index} className="score-cell">
                {data !== null ? data : ""}
              </td>
            ))}
            <td className="sum-cell">{player2Score}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ScoreTable;
