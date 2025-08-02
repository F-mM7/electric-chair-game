#!/usr/bin/env node
import { AnalysisEngine } from "../analysis/analysisEngine";
import { AnalysisConfigManager } from "../config/analysisConfig";

/**
 * コマンドライン解析スクリプト
 * 使用例:
 *   npm run analyze              # 1000盤面を解析
 *   npm run analyze -- --num 500    # 500盤面を解析
 *   npm run analyze -- --init       # 解析の初期化
 *   npm run analyze -- --status     # 進行状況を表示
 *   npm run analyze -- --clear      # 全解析結果を削除
 */

interface AnalysisOptions {
  num?: number;
  init?: boolean;
  status?: boolean;
  clear?: boolean;
  help?: boolean;
  drawValue?: number;
  config?: boolean;
}

function parseArgs(): AnalysisOptions {
  const args = process.argv.slice(2);
  const options: AnalysisOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--num":
      case "-n":
        options.num = parseInt(args[++i]) || 1000;
        break;
      case "--init":
      case "-i":
        options.init = true;
        break;
      case "--status":
      case "-s":
        options.status = true;
        break;
      case "--clear":
      case "-c":
        options.clear = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--draw-value":
      case "-d":
        options.drawValue = parseFloat(args[++i]) || 0.0;
        break;
      case "--config":
        options.config = true;
        break;
    }
  }

  return options;
}

function displayHelp() {
  console.log(`
電気椅子ゲーム戦略解析スクリプト

使用方法:
  npm run analyze [オプション]

オプション:
  --num, -n <数値>        解析する盤面数 (デフォルト: 1000)
  --init, -i              解析の初期化（全到達可能状態を生成）
  --status, -s            解析進行状況を表示
  --clear, -c             全解析結果を削除
  --draw-value, -d <数値> 引き分け時のプレイヤー1目線得点 (設定ファイルをオーバーライド)
  --config                現在の設定を表示
  --help, -h              このヘルプを表示

例:
  npm run analyze                    # 1000盤面を解析
  npm run analyze -- --num 500      # 500盤面を解析
  npm run analyze -- --init         # 初期化
  npm run analyze -- --status       # 状況確認
  `);
}

async function main() {
  console.log("🎯 Electric Chair Game Strategy Analyzer");
  console.log("=".repeat(50));

  const options = parseArgs();

  if (options.help) {
    displayHelp();
    return;
  }

  const configManager = AnalysisConfigManager.getInstance();

  // オーバーライド設定を適用
  const engineConfig: any = {};
  if (options.drawValue !== undefined) {
    engineConfig.drawValue = options.drawValue;
    console.log(`🔧 Overriding draw value from config: ${options.drawValue}`);
  }

  const engine = new AnalysisEngine(engineConfig);

  try {
    if (options.config) {
      configManager.displayConfig();
      return;
    }
    if (options.clear) {
      console.log("🧹 Clearing all analysis results...");
      engine.clearAllResults();
      console.log("✅ All results cleared");
      return;
    }

    if (options.init) {
      console.log("🔄 Initializing analysis...");
      await engine.initializeAnalysis();
      console.log("✅ Initialization complete");
      return;
    }

    if (options.status) {
      engine.displayProgress();
      return;
    }

    // デフォルト: 解析実行
    const numToAnalyze = options.num || 1000;
    console.log(`🔄 Starting analysis of ${numToAnalyze} states...`);

    const startTime = Date.now();
    let totalProcessed = 0;
    let batchCount = 0;

    // スクリプト開始時に処理対象ターンの戦略を事前ロード
    await engine.preloadStrategiesForCurrentAnalysis();

    while (totalProcessed < numToAnalyze) {
      const remaining = numToAnalyze - totalProcessed;
      const batchSize = Math.min(remaining, 500); // バッチサイズを制限

      console.log(
        `\n📦 Batch ${++batchCount}: Processing ${batchSize} states...`
      );

      const batchStartTime = Date.now();
      const processed = await engine.analyzeBatch(batchSize);

      if (processed === 0) {
        console.log("🎉 Analysis complete - all states processed!");
        break;
      }

      totalProcessed += processed;

      // バッチごとの処理速度を計算
      const batchElapsed = (Date.now() - batchStartTime) / 1000;
      const batchRate = processed / batchElapsed;

      // 残り時間の推定
      const remainingStates = numToAnalyze - totalProcessed;
      const estimatedSecondsRemaining = remainingStates / batchRate;
      const estimatedMinutesRemaining = Math.ceil(
        estimatedSecondsRemaining / 60
      );

      console.log(`⏱️  Progress: ${totalProcessed}/${numToAnalyze}`);
      console.log(`   Batch rate: ${batchRate.toFixed(1)} states/sec`);
      console.log(
        `   Estimated time remaining: ${estimatedMinutesRemaining} minutes`
      );

      // メモリクリーンアップ
      if (batchCount % 100 === 0) {
        engine.clearCache();
        if (global.gc) {
          global.gc();
        }
        console.log(`🧹 Memory cleanup performed (batch ${batchCount})`);
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    const finalRate = totalProcessed / totalTime;

    console.log("\n🎉 Analysis Summary:");
    console.log(`   Processed: ${totalProcessed} states`);
    console.log(`   Time: ${totalTime.toFixed(1)}s`);
    console.log(`   Rate: ${finalRate.toFixed(1)} states/sec`);

    // 最終状況表示
    console.log("\n📊 Final Status:");
    engine.displayProgress();
  } catch (error) {
    console.error("❌ Analysis failed:", error);
    process.exit(1);
  }
}

// エラーハンドリング
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// メイン実行
main().catch(console.error);
