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
  symbol = 'R_75',
  timeframe,
  title,
  onDataUpdate,
  signals = [],
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const fibLinesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const srLinesRef = useRef<any[]>([]);

  const [trendInfo, setTrendInfo] = useState<string>('');
  const [fibInfo, setFibInfo] = useState<string>('');

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
    let markers: any[] = [];

    const drawFibonacci = (fibData: {
      levels: FibonacciLevel[];
      startPoint: any;
      endPoint: any;
    }) => {
      // Clear existing Fibonacci lines
      fibLinesRef.current.forEach((line) => {
        if (line) chartRef.current?.removeSeries(line);
      });
      fibLinesRef.current = [];

      const { levels, startPoint, endPoint } = fibData;

      // Draw Fibonacci levels
      const keyLevels = [38.2, 50, 61.8];
      levels.forEach((level) => {
        const isKeyLevel = keyLevels.includes(level.level);
        const color = isKeyLevel ? '#fbbf24' : '#6b7280';
        const lineWidth = isKeyLevel ? 2 : 1;

        const fibLine = chartRef.current!.addSeries(LineSeries, {
          color,
          lineWidth,
          lineStyle: 2,
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
      srLinesRef.current.forEach((line) => seriesRef.current?.removePriceLine(line));
      srLinesRef.current = [];

      const zones = findSupportResistanceZones(candles, 50);

      zones.slice(0, 3).forEach((zone) => {
        const color = zone.type === 'support' ? '#34d39955' : '#f8717155';
        const priceLine = (seriesRef.current as any)!.createPriceLine({
          price: zone.price,
          color,
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: zone.type === 'support' ? 'S' : 'R',
        });
        srLinesRef.current.push(priceLine);
      });
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

      // Draw S/R zones
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

      markers = [...patternMarkers];

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

      if (seriesRef.current && markers.length > 0) {
        (seriesRef.current as any).setMarkers(markers);
      }

      // Notify parent
      if (onDataUpdate) {
        onDataUpdate(candles);
      }
    };

    const socket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
    socketRef.current = socket;

    socket.onopen = () => {
      const granularity = GRANULARITY_MAP[timeframe];
      socket.send(
        JSON.stringify({
          ticks_history: symbol,
          subscribe: 1,
          end: 'latest',
          style: 'candles',
          granularity,
          count: timeframe === '1H' ? 100 : 200,
        })
      );
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
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
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [symbol, timeframe, signals, onDataUpdate]);

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
