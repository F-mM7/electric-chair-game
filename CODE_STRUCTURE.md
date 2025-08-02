# コード構成ドキュメント

## プロジェクト概要
電気椅子ゲームの戦略解析とWebアプリケーション実装プロジェクト

## ディレクトリ構成

### `/src/` - メインソースコード

#### `/src/components/` - Reactコンポーネント
- `GameBoard.tsx` - ゲーム盤面の表示・椅子クリック操作
- `GameInfo.tsx` - 現在のゲーム状態表示（ターン、点数、電流回数）
- `ScoreTable.tsx` - スコア履歴の表格表示
- `StrategyDisplay.tsx` - 最適戦略の表示・切り替え機能
- 関連CSS: `StrategyDisplay.css`, `AnalysisProgress.css`

#### `/src/utils/` - コアロジック
- `gameLogic.ts` - ゲームのメインロジック（ターン処理、勝利判定）
- `stateHash.ts` - 32ビット状態ハッシュ化システム（エンコード/デコード）
- `stateTransition.ts` - 状態遷移生成（次の可能な状態を計算）
- `analysisProgress.ts` - 解析進捗管理
- `analysisStorage.ts` - 解析結果の保存・読み込み
- `chunkedAnalysisStorage.ts` - チャンク単位での解析結果管理
- `optimalStrategy.ts` - 最適戦略計算（Fictitious Play実装）
- `optimalStrategyWithStorage.ts` - ストレージ連携の最適戦略計算
- `hashLoader.ts` - ハッシュデータの読み込み
- `nashEquilibriumSolver.ts` - Nash均衡解法

#### `/src/types/` - TypeScript型定義
- `game.ts` - ゲーム関連の型（GameState, PlayerChoice等）
- `analysis.ts` - 解析関連の型（StateValue, AnalysisResult等）

#### `/src/analysis/` - 戦略解析エンジン
- `analysisEngine.ts` - メイン解析エンジン（状態価値計算、混合戦略計算）

#### `/src/scripts/` - コマンドラインツール
- `analyze.ts` - 状態解析実行スクリプト（`npm run analyze`で実行）
- `calculate-hash.ts` - ハッシュ値計算ツール
- `checkInitialHash.ts` - 初期状態ハッシュ検証
- `debug-strategy.ts` - 戦略デバッグツール
- `debugInitialStrategy.ts` - 初期戦略デバッグ
- `displayState.ts` - 状態表示ツール
- `generateHashes.ts` - ハッシュ生成スクリプト

#### `/src/api/` - API連携
- `strategyAPI.ts` - 戦略API のインターフェース
- `strategyAPIClient.ts` - API クライアント実装
- `staticStrategyAPI.ts` - 静的戦略データAPI
- `mockStrategyAPI.ts` - モック戦略API（テスト用）

#### `/src/styles/` - CSS スタイル
- `GameBoard.css` - ゲーム盤面スタイル
- `GameInfo.css` - ゲーム情報表示スタイル
- `PlayerSelection.css` - プレイヤー選択UIスタイル
- `ScoreTable.css` - スコア表格スタイル
- `TurnResult.css` - ターン結果表示スタイル

### `/generated-hashes/` - 生成されたハッシュデータ
- `turn-X.json` - 各ターンのハッシュデータファイル

### `/analysis-results/` - 解析結果
- `progress.json` - 解析進捗状況
- `turn-X/` - 各ターンの解析結果ディレクトリ
  - `strategies.json` - 最適戦略データ

## 重要な技術的概念

### 状態ハッシュ化システム（32ビット）
```
bit 28-31: ターン数 (4ビット) - 最上位
bit 16-27: 椅子残存状態 (12ビットマスク)
bit 10-15: プレイヤー1点数 (6ビット)
bit 4-9:   プレイヤー2点数 (6ビット) 
bit 2-3:   プレイヤー1電流回数 (2ビット)
bit 0-1:   プレイヤー2電流回数 (2ビット)
```

### 状態遷移システム
- `stateTransition.ts`で実装
- 各状態から到達可能な次状態を計算
- ゲームルールに従った遷移のみ生成

### 解析システム
- ゼロサム完全情報ゲームとして解析
- Nash均衡解を混合戦略で計算
- Fictitious Playアルゴリズムを使用

## 主要なファイルの役割

| ファイル | 役割 | 重要度 |
|---------|------|--------|
| `gameLogic.ts` | ゲーム進行の中核ロジック | ★★★ |
| `stateHash.ts` | 効率的な状態管理 | ★★★ |
| `analysisEngine.ts` | 戦略解析の中核 | ★★★ |
| `stateTransition.ts` | 状態空間探索 | ★★★ |
| `GameBoard.tsx` | UI/UX の中核 | ★★☆ |
| `analyze.ts` | バッチ処理実行 | ★★☆ |

## 実行コマンド

```bash
# 開発サーバー起動
npm run dev

# ハッシュ生成（事前に必要）
npm run generate-hashes

# 解析実行
npm run analyze

# 解析進捗確認  
npm run analyze -- --status

# ビルド
npm run build

# TypeScriptコンパイル
npm run tsc
```

## 重要なバグ修正履歴

1. **shallow copy バグ** (`gameLogic.ts`):
   - 問題: `chairsRemaining`配列の浅いコピーにより、複数遷移で同じ配列を参照
   - 修正: `chairsRemaining: [...gameState.chairsRemaining]`で深いコピー実装

2. **ゲームルール修正**:
   - 勝利条件: `>=40点` → `==40点`
   - 電流回数: `>=3回` → `==3回`

3. **ESModule エラー修正**:
   - `require.main === module`チェックを削除

4. **UI表示用とロジック用の関数分離** (2025年8月1日):
   - プレイヤー1: 椅子選択側（攻撃）、電気を避ける役割
   - プレイヤー2: 電気仕掛け側（防御）、電気を仕掛ける役割
   - `getCurrentAttacker()`, `getCurrentDefender()` - 解析データ互換用
   - `getChairSelector()`, `getElectricSetter()` - UI表示用

5. **ゲーム終了時UI改善** (2025年8月1日):
   - 専用終了コンポーネントを削除
   - インストラクション部分に結果表示
   - リセットボタンを常時表示