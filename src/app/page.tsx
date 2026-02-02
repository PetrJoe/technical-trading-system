'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Candle, SupportResistanceZone, TradingSignal } from '@/utils/types';
import { findSupportResistanceZones } from '@/utils/technicalAnalysis';
import { 
  detectMarketStructure, 
  detectSetupZone, 
  detectConfirmation, 
  detectEntryTrigger,
  detectM5ScalpTrend,
  detectM5ScalpZone,
  detectM1ScalpEntry
} from '@/utils/tradingLogic';
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
  const [strategy, setStrategy] = useState<'standard' | 'scalping'>('standard');

  // --- STANDARD STRATEGY LOGIC ---

  // 1. H1 Trend Analysis
  const h1Analysis = useMemo(() => {
    if (strategy !== 'standard') return { bias: 'range' as const, zones: [] };
    if (candles1H.length < 50) return { bias: 'range' as const, zones: [] };
    
    const bias = detectMarketStructure(candles1H);
    const zones = findSupportResistanceZones(candles1H, 100);
    
    return { bias, zones };
  }, [candles1H, strategy]);

  // 2. M15 Setup Analysis
  const m15Setup = useMemo(() => {
    if (strategy !== 'standard') return false;
    return detectSetupZone(candlesM15, h1Analysis.bias, h1Analysis.zones);
  }, [candlesM15, h1Analysis, strategy]);

  // 3. M5 Confirmation Analysis
  const m5Confirmation = useMemo(() => {
    if (strategy !== 'standard') return false;
    return detectConfirmation(candlesM5, h1Analysis.bias, m15Setup);
  }, [candlesM5, h1Analysis.bias, m15Setup, strategy]);

  // 4. M1 Entry Trigger
  const m1Entry = useMemo(() => {
    if (strategy !== 'standard') return null;
    return detectEntryTrigger(candlesM1, h1Analysis.bias, m5Confirmation);
  }, [candlesM1, h1Analysis.bias, m5Confirmation, strategy]);

  // --- SCALPING STRATEGY LOGIC ---

  // 1. M5 Trend (Scalp)
  const m5ScalpTrend = useMemo(() => {
    if (strategy !== 'scalping') return 'range';
    return detectM5ScalpTrend(candlesM5);
  }, [candlesM5, strategy]);

  // 2. M5 Zone (Scalp)
  const m5ScalpZone = useMemo(() => {
    if (strategy !== 'scalping') return false;
    return detectM5ScalpZone(candlesM5, m5ScalpTrend);
  }, [candlesM5, m5ScalpTrend, strategy]);

  // 3. M1 Entry (Scalp)
  const m1ScalpEntry = useMemo(() => {
    if (strategy !== 'scalping') return null;
    return detectM1ScalpEntry(candlesM1, m5ScalpTrend, m5ScalpZone);
  }, [candlesM1, m5ScalpTrend, m5ScalpZone, strategy]);

  // Determine Overall Status & Signal
  const currentSignal = useMemo(() => {
    return strategy === 'standard' ? m1Entry : m1ScalpEntry;
  }, [strategy, m1Entry, m1ScalpEntry]);
  
  const status = useMemo(() => {
    if (currentSignal) return 'ENTRY';
    
    if (strategy === 'standard') {
      if (m5Confirmation) return 'CONFIRMATION';
      if (m15Setup) return 'SETUP';
      return 'SCANNING';
    } else {
      // Scalping Status Mapping
      if (m5ScalpZone) return 'SETUP'; // In Zone = Setup/Ready
      if (m5ScalpTrend !== 'range') return 'SCANNING'; // Have trend, looking for zone
      return 'SCANNING';
    }
  }, [strategy, currentSignal, m5Confirmation, m15Setup, m5ScalpZone, m5ScalpTrend]);

  const handleDataUpdate = useCallback(
    (timeframe: string, candles: Candle[]) => {
      // Update candle data for each timeframe
      if (timeframe === 'M1') setCandlesM1(candles);
      else if (timeframe === 'M5') setCandlesM5(candles);
      else if (timeframe === 'M15') setCandlesM15(candles);
      else if (timeframe === '1H') setCandles1H(candles);
    },
    []
  );

  return (
    <main className="main-layout">
      {/* Dashboard Bar */}
      <Dashboard
        status={status}
        signal={currentSignal}
        strategy={strategy}
        onStrategyChange={setStrategy}
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
