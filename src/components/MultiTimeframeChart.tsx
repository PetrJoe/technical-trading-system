'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  SeriesMarker,
  Time,
  createSeriesMarkers,
  ISeriesMarkersPluginApi,
  IPriceLine,
} from 'lightweight-charts';
import { Candle, Timeframe, FibonacciLevel, SwingPoint, WebSocketMessage } from '@/utils/types';
import { getRecentFibonacci } from '@/utils/fibonacci';
import { analyzeTrend, findSupportResistanceZones } from '@/utils/technicalAnalysis';
import { detectCandlestickPatterns } from '@/utils/candlestickPatterns';
import WebSocketService from '@/services/WebSocketService';
import './Chart.css';

interface MultiTimeframeChartProps {
  symbol?: string;
  timeframe: Timeframe;
  title: string;
  onDataUpdate?: (candles: Candle[]) => void;
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
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const seriesMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const srLinesRef = useRef<IPriceLine[]>([]);
  const patternsRef = useRef<SeriesMarker<Time>[]>([]); // Store latest patterns
  
  // Refs for props to avoid effect re-runs
  const latestOnDataUpdate = useRef(onDataUpdate);

  useEffect(() => {
    latestOnDataUpdate.current = onDataUpdate;
  }, [onDataUpdate]);

  const [trendInfo, setTrendInfo] = useState<string>('');
  const [fibInfo, setFibInfo] = useState<string>('');

  const drawMarkers = () => {
    if (!seriesRef.current) return;

    let markers = [...patternsRef.current];

    try {
      if (seriesMarkersRef.current) {
        seriesMarkersRef.current.setMarkers(markers);
      }
    } catch (e) {
      console.error('Error setting markers:', e);
    }
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
        rightOffset: 50,
        barSpacing: 10,
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
    seriesMarkersRef.current = createSeriesMarkers(series, []);

    let allCandles: Candle[] = [];

    const drawFibonacci = (fibData: {
      levels: FibonacciLevel[];
      startPoint: SwingPoint;
      endPoint: SwingPoint;
    }) => {
      const { levels } = fibData;

      // Draw Fibonacci levels
      const keyLevels = [38.2, 50, 61.8];
      
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
            lineStyle: 0,
            axisLabelVisible: true,
            title: zone.type === 'support' ? 'S' : 'R',
            });
            srLinesRef.current.push(priceLine);
        });
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

      // Draw Fibonacci for all timeframes
      const trendForFib = analyzeTrend(candles);
      const fibData = getRecentFibonacci(candles, trendForFib.direction);
      if (fibData) {
        drawFibonacci(fibData);
      }

      // Draw S/R zones
      drawSupportResistance(candles);

      // Detect patterns
      const patterns = detectCandlestickPatterns(candles, 5);
      const patternMarkers: SeriesMarker<Time>[] = patterns
        .filter((p) => p.confidence >= 0.7)
        .slice(-5)
        .map((p) => ({
          time: p.time as Time,
          position: (p.type === 'bullish' ? 'belowBar' : 'aboveBar'),
          color: p.type === 'bullish' ? '#10b981' : '#ef4444',
          shape: 'circle',
          text: p.name,
        }));
      
      patternsRef.current = patternMarkers;
      drawMarkers();

      // Notify parent
      if (latestOnDataUpdate.current) {
        latestOnDataUpdate.current(candles);
      }
    };

    const handleDataMessage = (data: WebSocketMessage) => {
      if (!series) return;

      if (data.msg_type === 'candles' && data.candles) {
        allCandles = data.candles.map((c) => ({
          time: Number(c.epoch),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
        }));
        series.setData(allCandles as any);
        updateAnalysis(allCandles);
      } else if (data.msg_type === 'ohlc' && data.ohlc) {
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
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      wsService.unsubscribe(symbol, granularity, handleDataMessage);
      chart.remove();
    };
  }, [timeframe, symbol]); // Re-run if timeframe or symbol changes

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2 className="chart-title">{title}</h2>
        <div className="chart-info">
          <span>{trendInfo}</span>
          {fibInfo && <span className="fib-info">{fibInfo}</span>}
        </div>
      </div>
      <div ref={chartContainerRef} className="chart-area" />
    </div>
  );
};

export default MultiTimeframeChart;
