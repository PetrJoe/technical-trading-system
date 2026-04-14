'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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
  const [candlesM3, setCandlesM3] = useState<Candle[]>([]);
  const [candlesM5, setCandlesM5] = useState<Candle[]>([]);
  const [candlesM15, setCandlesM15] = useState<Candle[]>([]);
  const [strategy, setStrategy] = useState<'standard' | 'scalping'>('scalping');
  const [activeTrade, setActiveTrade] = useState<TradingSignal | null>(null);

  // --- STANDARD STRATEGY LOGIC ---

  // 1. M15 Trend Analysis (highest timeframe in current layout)
  const trendAnalysis = useMemo(() => {
    // Always calculate zones for scalping support
    if (candlesM15.length < 50) return { bias: 'range' as const, zones: [] };
    
    const bias = detectMarketStructure(candlesM15);
    const zones = findSupportResistanceZones(candlesM15, 100);
    
    return { bias, zones };
  }, [candlesM15]);

  // 2. M5 Setup Analysis
  const m5Setup = useMemo(() => {
    if (strategy !== 'standard') return false;
    return detectSetupZone(candlesM5, trendAnalysis.bias, trendAnalysis.zones);
  }, [candlesM5, trendAnalysis, strategy]);

  // 3. M3 Confirmation Analysis
  const m3Confirmation = useMemo(() => {
    if (strategy !== 'standard') return false;
    return detectConfirmation(candlesM3, trendAnalysis.bias, m5Setup);
  }, [candlesM3, trendAnalysis.bias, m5Setup, strategy]);

  // 4. M1 Entry Trigger
  const m1Entry = useMemo(() => {
    if (strategy !== 'standard') return null;
    return detectEntryTrigger(candlesM1, trendAnalysis.bias, m3Confirmation);
  }, [candlesM1, trendAnalysis.bias, m3Confirmation, strategy]);

  // --- SCALPING STRATEGY LOGIC ---

  // 0. Calculate Zones (M5 + M15) for Scalping
  const scalpZones = useMemo(() => {
    // Only calculate if we have data
    const zonesM5 = candlesM5.length >= 20 ? findSupportResistanceZones(candlesM5, 100, 3) : [];
    const zonesM15 = candlesM15.length >= 20 ? findSupportResistanceZones(candlesM15, 100, 3) : [];
    
    return [...zonesM5, ...zonesM15];
  }, [candlesM5, candlesM15]);

  // 1. M5 Trend (Scalp)
  const m5ScalpTrend = useMemo(() => {
    if (strategy !== 'scalping') return 'range';
    return detectM5ScalpTrend(candlesM5);
  }, [candlesM5, strategy]);

  // 2. M5 Zone (Scalp)
  const m5ScalpZone = useMemo(() => {
    if (strategy !== 'scalping') return false;
    return detectM5ScalpZone(candlesM5, m5ScalpTrend, scalpZones);
  }, [candlesM5, m5ScalpTrend, strategy, scalpZones]);

  // 3. M1 Entry (Scalp)
  const m1ScalpEntry = useMemo(() => {
    if (strategy !== 'scalping') return null;
    return detectM1ScalpEntry(candlesM1, m5ScalpTrend, scalpZones, candlesM5);
  }, [candlesM1, m5ScalpTrend, scalpZones, strategy, candlesM5]);

  // Determine Overall Status & Signal (Potential New Signal)
  const potentialSignal = useMemo(() => {
    return strategy === 'standard' ? m1Entry : m1ScalpEntry;
  }, [strategy, m1Entry, m1ScalpEntry]);

  // Manage Active Trade Lifecycle
  useEffect(() => {
    // 1. If we have a new potential signal and no active trade, take the trade
    if (potentialSignal && !activeTrade) {
      setActiveTrade(potentialSignal);
    }

    // 2. If we have an active trade, check if TP or SL is hit
    if (activeTrade && candlesM1.length > 0) {
      const currentPrice = candlesM1[candlesM1.length - 1].close;
      
      // Check for Exit
      let exitTriggered = false;
      
      if (activeTrade.type === 'BUY') {
        if (currentPrice >= activeTrade.takeProfit) exitTriggered = true; // TP Hit
        if (currentPrice <= activeTrade.stopLoss) exitTriggered = true;   // SL Hit
      } else {
        // SELL
        if (currentPrice <= activeTrade.takeProfit) exitTriggered = true; // TP Hit
        if (currentPrice >= activeTrade.stopLoss) exitTriggered = true;   // SL Hit
      }

      if (exitTriggered) {
        setActiveTrade(null); // Reset trade, start scanning again
      }
    }
  }, [potentialSignal, activeTrade, candlesM1]);

  // Reset active trade if strategy changes
  useEffect(() => {
    setActiveTrade(null);
  }, [strategy]);
  
  const status = useMemo(() => {
    // If there is an active trade, we are in ENTRY mode until it closes
    if (activeTrade) return 'ENTRY';
    
    // Otherwise show normal scanning status
    if (strategy === 'standard') {
      if (m3Confirmation) return 'CONFIRMATION';
      if (m5Setup) return 'SETUP';
      return 'SCANNING';
    } else {
      // Scalping Status Mapping
      if (m5ScalpZone) return 'SETUP'; // In Zone = Setup/Ready
      if (m5ScalpTrend !== 'range') return 'SCANNING'; // Have trend, looking for zone
      return 'SCANNING';
    }
  }, [strategy, activeTrade, m3Confirmation, m5Setup, m5ScalpZone, m5ScalpTrend]);

  const handleDataUpdate = useCallback(
    (timeframe: string, candles: Candle[]) => {
      // Update candle data for each timeframe
      if (timeframe === 'M1') setCandlesM1(candles);
      else if (timeframe === 'M3') setCandlesM3(candles);
      else if (timeframe === 'M5') setCandlesM5(candles);
      else if (timeframe === 'M15') setCandlesM15(candles);
    },
    []
  );

  return (
    <main className="main-layout">
      {/* Dashboard Bar */}
      <Dashboard
        status={status}
        signal={activeTrade}
        strategy={strategy}
        onStrategyChange={setStrategy}
        currentPrice={candlesM1.length > 0 ? candlesM1[candlesM1.length - 1].close : undefined}
        trend={strategy === 'standard' ? trendAnalysis.bias : m5ScalpTrend}
      />

      {/* 4-Chart Grid */}
      <div className="chart-grid">
        {/* Top Left - M1 Chart (Entry Timing) */}
        <div className="chart-wrapper">
          <MultiTimeframeChart 
            timeframe="M1" 
            title="1 MINUTE (ENTRY)"
            onDataUpdate={(data) => handleDataUpdate('M1', data)}
            extraZones={strategy === 'scalping' ? scalpZones : undefined}
          />
        </div>

        {/* Top Right - M3 Chart (Confirmation) */}
        <div className="chart-wrapper">
          <MultiTimeframeChart 
            timeframe="M3" 
            title="3 MINUTE (CONFIRMATION)"
            onDataUpdate={(data) => handleDataUpdate('M3', data)}
          />
        </div>

        {/* Bottom Left - M5 Chart (Setup) */}
        <div className="chart-wrapper">
          <MultiTimeframeChart 
            timeframe="M5" 
            title="5 MINUTE (SETUP)"
            onDataUpdate={(data) => handleDataUpdate('M5', data)}
          />
        </div>

        {/* Bottom Right - M15 Chart (Trend) */}
        <div className="chart-wrapper">
          <MultiTimeframeChart 
            timeframe="M15" 
            title="15 MINUTE (TREND)"
            onDataUpdate={(data) => handleDataUpdate('M15', data)}
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
