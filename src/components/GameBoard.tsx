import React from "react";
import "../styles/GameBoard.css";

interface GameBoardProps {
  chairsRemaining: boolean[];
  availableChairs: number[];
  onChairSelect?: (chairNumber: number) => void;
  selectedChair?: number | null;
  isSelectionMode?: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({
  chairsRemaining,
  availableChairs,
  onChairSelect,
  selectedChair,
  isSelectionMode = false,
}) => {
  const handleChairClick = (chairNumber: number) => {
    if (
      isSelectionMode &&
      availableChairs.includes(chairNumber) &&
      onChairSelect
    ) {
      onChairSelect(chairNumber);
    }
  };

  return (
    <div className="game-board">
      <div className="chairs-grid">
        {chairsRemaining.map((remaining, index) => {
          const chairNumber = index + 1;
          const isAvailable = availableChairs.includes(chairNumber);
          const isSelected = selectedChair === chairNumber;
          const isClickable = isSelectionMode && isAvailable;

          return (
            <div
              key={chairNumber}
              className={`chair ${remaining ? "remaining" : "removed"} ${
                isAvailable ? "available" : ""
              } ${isSelected ? "selected" : ""} ${
                isClickable ? "clickable" : ""
              }`}
              onClick={() => handleChairClick(chairNumber)}
              style={{ cursor: isClickable ? "pointer" : "default" }}
            >
              <span className="chair-number">{chairNumber}</span>
              {!remaining && <span className="removed-text">撤去済み</span>}
              {isSelected && <span className="selected-text">選択中</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameBoard;
