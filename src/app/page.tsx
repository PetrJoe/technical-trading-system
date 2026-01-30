'use client';

import { useState, useCallback } from 'react';
import MultiTimeframeChart from '@/components/MultiTimeframeChart';
import { Candle, TradingSignal } from '@/utils/types';
import { generateTradingSignals } from '@/utils/signalGenerator';

export default function Home() {
  const [candlesM1, setCandlesM1] = useState<Candle[]>([]);
  const [candlesM5, setCandlesM5] = useState<Candle[]>([]);
  const [candlesM15, setCandlesM15] = useState<Candle[]>([]);
  const [candles1H, setCandles1H] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [latestSignal, setLatestSignal] = useState<TradingSignal | null>(null);

  const handleDataUpdate = useCallback(
    (timeframe: string, candles: Candle[]) => {
      // Update candle data for each timeframe
      if (timeframe === 'M1') setCandlesM1(candles);
      else if (timeframe === 'M5') setCandlesM5(candles);
      else if (timeframe === 'M15') setCandlesM15(candles);
      else if (timeframe === '1H') setCandles1H(candles);

      // Generate signals when we have data from all timeframes
      if (
        candlesM1.length > 20 &&
        candlesM5.length > 20 &&
        candlesM15.length > 20 &&
        candles1H.length > 50
      ) {
        const newSignals = generateTradingSignals(
          candlesM1,
          candlesM5,
          candlesM15,
          candles1H,
          null // Fibonacci levels are calculated internally
        );

        if (newSignals.length > 0) {
          const latest = newSignals[newSignals.length - 1];
          // Only update if it's a new signal
          if (!latestSignal || latest.time !== latestSignal.time) {
            setLatestSignal(latest);
            setSignals(newSignals);
          }
        }
      }
    },
    [candlesM1, candlesM5, candlesM15, candles1H, latestSignal]
  );

  return (
    <main className="h-screen bg-[#020617] p-2 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-2 px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg border border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            {latestSignal && (
              <div
                className={`px-6 py-3 rounded-lg border-2 ${
                  latestSignal.type === 'BUY'
                    ? 'bg-emerald-500/20 border-emerald-500'
                    : 'bg-red-500/20 border-red-500'
                }`}
              >
                <div className="text-center">
                  <div
                    className={`text-2xl font-black ${
                      latestSignal.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {latestSignal.type}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    Confidence: {(latestSignal.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    @ {latestSignal.price.toFixed(4)}
                  </div>
                </div>
              </div>
            )}
            
            {/* Trade Management */}
            {latestSignal && (
              <div className="flex flex-col gap-2">
                 <div className="px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-slate-400">TP</span>
                    <span className="text-sm font-mono text-emerald-400">{latestSignal.takeProfit.toFixed(4)}</span>
                 </div>
                 <div className="px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-slate-400">SL</span>
                    <span className="text-sm font-mono text-red-400">{latestSignal.stopLoss.toFixed(4)}</span>
                 </div>
                 <div className="text-[10px] text-slate-500 text-right">
                    R:R {latestSignal.riskRewardRatio}
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Signal Details */}
        {latestSignal && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="text-xs text-slate-400 mb-1 font-semibold">
              Signal Reasons:
            </div>
            <div className="flex flex-wrap gap-2">
              {latestSignal.reasons.map((reason, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10px] border border-slate-700"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4-Chart Grid */}
      <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0">
        {/* Top Left - M1 Chart (Entry Timing) */}
        <div className="w-full h-full">
          <MultiTimeframeChart
            symbol="R_50"
            timeframe="M1"
            title="M1 - Entry/Exit Timing"
            onDataUpdate={(candles) => handleDataUpdate('M1', candles)}
            signals={signals}
          />
        </div>

        {/* Top Right - M5 Chart */}
        <div className="w-full h-full">
          <MultiTimeframeChart
            symbol="R_50"
            timeframe="M5"
            title="M5 - Momentum & Confirmation"
            onDataUpdate={(candles) => handleDataUpdate('M5', candles)}
            signals={signals}
          />
        </div>

        {/* Bottom Left - M15 Chart */}
        <div className="w-full h-full">
          <MultiTimeframeChart
            symbol="R_50"
            timeframe="M15"
            title="M15 - Market Structure"
            onDataUpdate={(candles) => handleDataUpdate('M15', candles)}
            signals={signals}
          />
        </div>

        {/* Bottom Right - 1H Chart (Primary Trend) */}
        <div className="w-full h-full">
          <MultiTimeframeChart
            symbol="R_50"
            timeframe="1H"
            title="1H - Primary Trend"
            onDataUpdate={(candles) => handleDataUpdate('1H', candles)}
            signals={signals}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-2 px-4 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <div>
            <span className="text-amber-400">◆</span> Fibonacci Levels: 38.2%, 50%,
            61.8% (Golden Zone)
          </div>
          <div>
            <span className="text-emerald-400">●</span> Bullish Patterns |{' '}
            <span className="text-red-400">●</span> Bearish Patterns
          </div>
          <div>
            <span className="text-slate-400">━</span> Support/Resistance Zones
          </div>
        </div>
      </div>
    </main>
  );
}
