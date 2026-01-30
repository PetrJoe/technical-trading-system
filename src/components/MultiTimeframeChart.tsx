'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import { Candle, Timeframe, FibonacciLevel, TradingSignal } from '@/utils/types';
import { getRecentFibonacci } from '@/utils/fibonacci';
import { analyzeTrend, findSupportResistanceZones } from '@/utils/technicalAnalysis';
import { detectCandlestickPatterns } from '@/utils/candlestickPatterns';
import WebSocketService from '@/services/WebSocketService';

interface MultiTimeframeChartProps {
  symbol?: string;
  timeframe: Timeframe;
  title: string;
  onDataUpdate?: (candles: Candle[]) => void;
  signals?: TradingSignal[];
}

const GRANULARITY_MAP: Record<Timeframe, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  '1H': 3600,
};

const MultiTimeframeChart: React.FC<MultiTimeframeChartProps> = ({
  symbol = 'R_50',
  timeframe,
  title,
  onDataUpdate,
  signals = [],
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const fibLinesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const srLinesRef = useRef<any[]>([]);
  const patternsRef = useRef<any[]>([]); // Store latest patterns
  
  // Refs for props to avoid effect re-runs
  const latestSignals = useRef(signals);
  const latestOnDataUpdate = useRef(onDataUpdate);

  useEffect(() => {
    latestSignals.current = signals;
    latestOnDataUpdate.current = onDataUpdate;
    
    // Update markers whenever signals change
    drawMarkers();
  }, [signals, onDataUpdate]);

  const [trendInfo, setTrendInfo] = useState<string>('');
  const [fibInfo, setFibInfo] = useState<string>('');

  const drawMarkers = () => {
    if (!seriesRef.current) return;

    let markers = [...patternsRef.current];
    const signals = latestSignals.current;

    // Add signal markers
    if (signals.length > 0) {
      const signalMarkers = signals.map((signal) => ({
        time: signal.time as any,
        position: (signal.type === 'BUY' ? 'belowBar' : 'aboveBar') as any,
        color: signal.type === 'BUY' ? '#10b981' : '#ef4444',
        shape: (signal.type === 'BUY' ? 'arrowUp' : 'arrowDown') as any,
        text: `${signal.type} ${(signal.confidence * 100).toFixed(0)}%`,
        size: 2,
      }));
      markers = [...markers, ...signalMarkers];
    }

    try {
      (seriesRef.current as any).setMarkers(markers);
    } catch (e) {
      console.error('Error setting markers:', e);
    }
    
    // Draw SL/TP lines
    // Clear previous SL/TP lines that might be in srLinesRef (we need a better way to manage these if mixed)
    // For now, let's assume srLinesRef handles all price lines and we clear them in drawSupportResistance.
    // However, drawSupportResistance is called in updateAnalysis.
    // If we call drawMarkers separately, we might need to manage SL/TP lines separately or re-draw all lines.
    // Simpler approach: Let updateAnalysis handle everything, but trigger it? No, updateAnalysis needs candles.
    
    // Given the complexity, let's keep SL/TP drawing inside updateAnalysis for now, 
    // or move it to a shared helper if we want instant updates on signal change.
    // But since signals usually come from onDataUpdate -> parent -> signals prop, 
    // the flow is: Data -> Parent -> Signals -> Chart.
    // So when signals change, we SHOULD re-draw SL/TP.
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: '#020617' }, textColor: '#94a3b8' },
      grid: {
        vertLines: { color: '#0f172a' },
        horzLines: { color: '#0f172a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: timeframe === 'M1',
        borderVisible: false,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        },
      },
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
        },
      },
      rightPriceScale: {
        borderVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    let allCandles: Candle[] = [];

    const drawFibonacci = (fibData: {
      levels: FibonacciLevel[];
      startPoint: any;
      endPoint: any;
    }) => {
      // Clear existing Fibonacci lines
      fibLinesRef.current.forEach((line) => {
        if (line && chartRef.current) {
            try {
                chartRef.current.removeSeries(line);
            } catch (e) {
                console.warn('Error removing fib series:', e);
            }
        }
      });
      fibLinesRef.current = [];

      const { levels, startPoint, endPoint } = fibData;

      // Draw Fibonacci levels
      const keyLevels = [38.2, 50, 61.8];
      levels.forEach((level) => {
        if (!chartRef.current) return;
        const isKeyLevel = keyLevels.includes(level.level);
        const color = isKeyLevel ? '#fbbf24' : '#6b7280';
        const lineWidth = isKeyLevel ? 2 : 1;

        const fibLine = chartRef.current.addSeries(LineSeries, {
          color,
          lineWidth,
          lineStyle: 0,
          lastValueVisible: false,
          priceLineVisible: false,
        });

        fibLine.setData([
          { time: startPoint.time as any, value: level.price },
          { time: endPoint.time as any, value: level.price },
          { time: allCandles[allCandles.length - 1].time as any, value: level.price },
        ]);

        fibLinesRef.current.push(fibLine);
      });

      // Update info
      const keyLevelPrices = levels
        .filter((l) => keyLevels.includes(l.level))
        .map((l) => `${l.label}: ${l.price.toFixed(4)}`)
        .join(' | ');
      setFibInfo(keyLevelPrices);
    };

    const drawSupportResistance = (candles: Candle[]) => {
      // Clear existing S/R lines
      srLinesRef.current.forEach((line) => {
          if (seriesRef.current) {
              try {
                  seriesRef.current.removePriceLine(line);
              } catch (e) {
                  console.warn('Error removing price line:', e);
              }
          }
      });
      srLinesRef.current = [];

      const zones = findSupportResistanceZones(candles, 50);

      if (seriesRef.current) {
        zones.slice(0, 3).forEach((zone) => {
            const color = zone.type === 'support' ? '#34d39955' : '#f8717155';
            const priceLine = seriesRef.current!.createPriceLine({
            price: zone.price,
            color,
            lineWidth: 2,
            lineStyle: 1,
            axisLabelVisible: true,
            title: zone.type === 'support' ? 'S' : 'R',
            });
            srLinesRef.current.push(priceLine);
        });
      }
      
      // Draw SL/TP lines here too since we cleared srLinesRef
      const signals = latestSignals.current;
      if (signals.length > 0 && seriesRef.current) {
        const latestSignal = signals[signals.length - 1];
        // Only show SL/TP for recent signals (within last 10 candles)
        const signalAge = candles.length > 0 ? candles[candles.length - 1].time - latestSignal.time : 10000;
        
        if (signalAge < 3600) { 
            const tpLine = seriesRef.current.createPriceLine({
                price: latestSignal.takeProfit,
                color: '#10b981',
                lineWidth: 1,
                lineStyle: 0,
                axisLabelVisible: true,
                title: 'TP',
            });
            srLinesRef.current.push(tpLine);

            const slLine = seriesRef.current.createPriceLine({
                price: latestSignal.stopLoss,
                color: '#ef4444',
                lineWidth: 1,
                lineStyle: 0,
                axisLabelVisible: true,
                title: 'SL',
            });
            srLinesRef.current.push(slLine);
        }
      }
    };

    const updateAnalysis = (candles: Candle[]) => {
      if (candles.length < 20) return;

      // Analyze trend
      const trend = analyzeTrend(candles);
      const trendEmoji =
        trend.direction === 'bullish'
          ? '📈'
          : trend.direction === 'bearish'
          ? '📉'
          : '➡️';
      setTrendInfo(
        `${trendEmoji} ${trend.direction.toUpperCase()} (${(trend.strength * 100).toFixed(0)}%)`
      );

      // Draw Fibonacci for 1H and M15
      if (timeframe === '1H' || timeframe === 'M15') {
        const trend = analyzeTrend(candles);
        const fibData = getRecentFibonacci(candles, trend.direction);
        if (fibData) {
          drawFibonacci(fibData);
        }
      }

      // Draw S/R zones and SL/TP
      drawSupportResistance(candles);

      // Detect patterns
      const patterns = detectCandlestickPatterns(candles, 5);
      const patternMarkers = patterns
        .filter((p) => p.confidence >= 0.7)
        .slice(-5)
        .map((p) => ({
          time: p.time as any,
          position: (p.type === 'bullish' ? 'belowBar' : 'aboveBar') as any,
          color: p.type === 'bullish' ? '#10b981' : '#ef4444',
          shape: 'circle' as any,
          text: p.name,
        }));
      
      patternsRef.current = patternMarkers;
      drawMarkers();

      // Notify parent
      if (latestOnDataUpdate.current) {
        latestOnDataUpdate.current(candles);
      }
    };

    const handleDataMessage = (data: any) => {
      if (!series) return;

      if (data.msg_type === 'candles') {
        allCandles = data.candles.map((c: any) => ({
          time: Number(c.epoch),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
        }));
        series.setData(allCandles as any);
        updateAnalysis(allCandles);
      } else if (data.msg_type === 'ohlc') {
        const o = data.ohlc;
        const newCandle: Candle = {
          time: Number(o.open_time),
          open: parseFloat(o.open),
          high: parseFloat(o.high),
          low: parseFloat(o.low),
          close: parseFloat(o.close),
        };
        
        series.update(newCandle as any);
        
        const lastIdx = allCandles.findIndex((c) => c.time === newCandle.time);
        if (lastIdx !== -1) {
          allCandles[lastIdx] = newCandle;
        } else {
          allCandles.push(newCandle);
          if (allCandles.length > 300) allCandles.shift();
        }
        
        updateAnalysis(allCandles);
      }
    };

    const wsService = WebSocketService.getInstance();
    const granularity = GRANULARITY_MAP[timeframe];
    
    wsService.subscribe(symbol, timeframe, granularity, handleDataMessage);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      wsService.unsubscribe(symbol, granularity, handleDataMessage);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [symbol, timeframe]);

  return (
    <div className="relative w-full h-full bg-[#020617] border border-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-white/10">
            <span className="text-xs font-bold text-slate-200 tracking-wide">
              {title}
            </span>
          </div>
          {trendInfo && (
            <div className="px-3 py-1 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-white/10">
              <span className="text-[10px] font-medium text-slate-300">
                {trendInfo}
              </span>
            </div>
          )}
        </div>
        {fibInfo && (
          <div className="px-3 py-1 bg-amber-500/10 backdrop-blur-sm rounded-lg border border-amber-500/30 max-w-xs">
            <span className="text-[9px] font-medium text-amber-200">
              Fib: {fibInfo}
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};

export default MultiTimeframeChart;
