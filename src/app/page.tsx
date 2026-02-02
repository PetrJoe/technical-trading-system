'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Candle } from '@/utils/types';
import { analyzeH1, analyzeM15, analyzeM5, analyzeM1 } from '@/utils/technicalAnalysis';
import Dashboard from '@/components/Dashboard';
import './Home.css';

const MultiTimeframeChart = dynamic(() => import('@/components/MultiTimeframeChart'), {
  ssr: false,
  loading: () => <div className="chart-loading" />
});

export default function Home() {
  const [candlesM1, setCandlesM1] = useState<Candle[]>([]);
  const [candlesM5, setCandlesM5] = useState<Candle[]>([]);
  const [candlesM15, setCandlesM15] = useState<Candle[]>([]);
  const [candles1H, setCandles1H] = useState<Candle[]>([]);

  // Memoized Analysis Results
  const h1Analysis = useMemo(() => {
    if (candles1H.length < 50) return { bias: 'RANGE' as const, zones: [] };
    return analyzeH1(candles1H);
  }, [candles1H]);

  const m15Analysis = useMemo(() => {
    if (candlesM15.length < 50) return { status: 'WAIT' as const };
    return analyzeM15(candlesM15, h1Analysis.bias, h1Analysis.zones);
  }, [candlesM15, h1Analysis]);

  const m5Analysis = useMemo(() => {
    if (candlesM5.length < 20) return { confirmation: 'NO CONFIRMATION' as const };
    return analyzeM5(candlesM5, h1Analysis.bias);
  }, [candlesM5, h1Analysis.bias]);

  const m1Analysis = useMemo(() => {
    if (candlesM1.length < 10) return { trigger: 'WAIT' as const };
    return analyzeM1(candlesM1, m5Analysis.confirmation);
  }, [candlesM1, m5Analysis.confirmation]);

  const handleDataUpdate = useCallback(
    (timeframe: string, candles: Candle[]) => {
      // Update candle data for each timeframe
      if (timeframe === 'M1') setCandlesM1(candles);
      else if (timeframe === 'M5') setCandlesM5(candles);
      else if (timeframe === 'M15') setCandlesM15(candles);
      else if (timeframe === '1H') setCandles1H(candles);

      // Use the latest data for signal generation (including the update we just received)
      const currentM1 = timeframe === 'M1' ? candles : candlesM1;
      const currentM5 = timeframe === 'M5' ? candles : candlesM5;
      const currentM15 = timeframe === 'M15' ? candles : candlesM15;
      const current1H = timeframe === '1H' ? candles : candles1H;
    },
    [candlesM1, candlesM5, candlesM15, candles1H]
  );

  return (
    <main className="main-layout">
      {/* Dashboard Bar */}
      <Dashboard
        h1Bias={h1Analysis.bias}
        m15Status={m15Analysis.status}
        m5Confirmation={m5Analysis.confirmation}
        m1Trigger={m1Analysis.trigger}
      />

      {/* 4-Chart Grid */}
      <div className="chart-grid">
        {/* Top Left - M1 Chart (Entry Timing) */}
        <div className="chart-wrapper">
          <MultiTimeframeChart 
            timeframe="M1" 
            title="1 MINUTE (ENTRY)"
            onDataUpdate={(data) => handleDataUpdate('M1', data)}
          />
        </div>

        {/* Top Right - M5 Chart (Confirmation) */}
        <div className="chart-wrapper">
          <MultiTimeframeChart 
            timeframe="M5" 
            title="5 MINUTE (CONFIRMATION)"
            onDataUpdate={(data) => handleDataUpdate('M5', data)}
          />
        </div>

        {/* Bottom Left - M15 Chart (Setup) */}
        <div className="chart-wrapper">
          <MultiTimeframeChart 
            timeframe="M15" 
            title="15 MINUTE (SETUP)"
            onDataUpdate={(data) => handleDataUpdate('M15', data)}
          />
        </div>

        {/* Bottom Right - 1H Chart (Trend) */}
        <div className="chart-wrapper">
          <MultiTimeframeChart 
            timeframe="1H" 
            title="1 HOUR (TREND)"
            onDataUpdate={(data) => handleDataUpdate('1H', data)}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="footer-info">
        <div className="footer-content">
          <div className="legend-item">
            <span className="legend-marker marker-amber">◆</span> Fibonacci Levels: 38.2%, 50%,
            61.8% (Golden Zone)
          </div>
          <div className="legend-item">
            <span className="legend-marker marker-emerald">●</span> Bullish Patterns |{' '}
            <span className="legend-marker marker-red">●</span> Bearish Patterns
          </div>
          <div className="legend-item">
            <span className="legend-marker marker-slate">━</span> Support/Resistance Zones
          </div>
        </div>
      </div>
    </main>
  );
}
