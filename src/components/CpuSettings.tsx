import React from "react";
import { PlayerNumber } from "../types/game";

interface CpuSettingsProps {
  isPlayer1Cpu: boolean;
  isPlayer2Cpu: boolean;
  onTogglePlayer1: (isCpu: boolean) => void;
  onTogglePlayer2: (isCpu: boolean) => void;
}

const CpuSettings: React.FC<CpuSettingsProps> = ({
  isPlayer1Cpu,
  isPlayer2Cpu,
  onTogglePlayer1,
  onTogglePlayer2,
}) => {
  return (
    <div className="cpu-settings">
      <h3>CPU設定</h3>
      <div className="cpu-toggle-container">
        <label className="cpu-toggle">
          <input
            type="checkbox"
            checked={isPlayer1Cpu}
            onChange={(e) => onTogglePlayer1(e.target.checked)}
          />
          <span>プレイヤー1をCPUにする</span>
        </label>
        <label className="cpu-toggle">
          <input
            type="checkbox"
            checked={isPlayer2Cpu}
            onChange={(e) => onTogglePlayer2(e.target.checked)}
          />
          <span>プレイヤー2をCPUにする</span>
        </label>
      </div>
    </div>
  );
};

export default CpuSettings;