'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { ChevronDown, BarChart2 } from 'lucide-react';

interface CandlestickChartProps {
    symbol?: string;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ symbol = 'R_75' }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
    const [showDropdown, setShowDropdown] = useState(false);

    // Refs for indicators to manage their lifecycle
    const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const fibLinesRef = useRef<any[]>([]);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { color: '#0f172a' }, textColor: '#e5e7eb' },
            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            timeScale: { timeVisible: true, secondsVisible: true },
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e', downColor: '#ef4444', borderVisible: false,
            wickUpColor: '#22c55e', wickDownColor: '#ef4444',
        });

        chartRef.current = chart;
        seriesRef.current = series;

        let allCandles: any[] = [];
        const markers: any[] = [];

        const calculateSMA = (data: any[], period: number) => {
            if (data.length < period) return [];
            return data.slice(period - 1).map((_, idx) => {
                const subset = data.slice(idx, idx + period);
                const sum = subset.reduce((a, b) => a + b.close, 0);
                return { time: data[idx + period - 1].time, value: sum / period };
            });
        };

        const calculateRSI = (data: any[], period: number) => {
            if (data.length <= period) return [];
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) {
                const diff = data[i].close - data[i - 1].close;
                if (diff >= 0) gains += diff; else losses -= diff;
            }
            let avgGain = gains / period, avgLoss = losses / period;
            const rsi = [{ time: data[period].time, value: 100 - (100 / (1 + avgGain / (avgLoss || 1))) }];
            for (let i = period + 1; i < data.length; i++) {
                const diff = data[i].close - data[i - 1].close;
                avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
                avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
                rsi.push({ time: data[i].time, value: 100 - (100 / (1 + avgGain / (avgLoss || 1))) });
            }
            return rsi;
        };

        const detectSwingPoints = (data: any[]) => {
            if (data.length < 20) return null;
            let swingHigh = data[0].high, swingLow = data[0].low;
            data.forEach(d => {
                if (d.high > swingHigh) swingHigh = d.high;
                if (d.low < swingLow) swingLow = d.low;
            });
            return { high: swingHigh, low: swingLow };
        };

        const updateAnalysis = (data: any[]) => {
            if (!chartRef.current || !seriesRef.current) return;

            // Update SMA
            if (activeIndicators.has('SMA')) {
                if (!smaSeriesRef.current) {
                    smaSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, title: 'SMA 20' });
                }
                smaSeriesRef.current.setData(calculateSMA(data, 20));
            } else if (smaSeriesRef.current) {
                chartRef.current.removeSeries(smaSeriesRef.current);
                smaSeriesRef.current = null;
            }

            // Update Fibonacci
            if (activeIndicators.has('Fibonacci')) {
                const swings = detectSwingPoints(data);
                if (swings) {
                    const diff = swings.high - swings.low;
                    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
                    const colors = ['#94a3b8', '#38bdf8', '#818cf8', '#fbbf24', '#f87171', '#c084fc', '#94a3b8'];
                    fibLinesRef.current.forEach(l => seriesRef.current?.removePriceLine(l));
                    fibLinesRef.current = levels.map((l, i) => seriesRef.current!.createPriceLine({
                        price: swings.high - (diff * l), color: colors[i], lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `Fib ${l}`
                    }));
                }
            } else {
                fibLinesRef.current.forEach(l => seriesRef.current?.removePriceLine(l));
                fibLinesRef.current = [];
            }

            // Update RSI (simplified display on main pane to avoid complex pane management in basic setup)
            if (activeIndicators.has('RSI')) {
                if (!rsiSeriesRef.current) {
                    rsiSeriesRef.current = chartRef.current.addSeries(LineSeries, { color: '#c084fc', lineWidth: 2, title: 'RSI 14' });
                }
                rsiSeriesRef.current.setData(calculateRSI(data, 14));
            } else if (rsiSeriesRef.current) {
                chartRef.current.removeSeries(rsiSeriesRef.current);
                rsiSeriesRef.current = null;
            }
        };

        const socket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
        socketRef.current = socket;
        socket.onopen = () => socket.send(JSON.stringify({ ticks_history: symbol, subscribe: 1, end: 'latest', style: 'candles', granularity: 60, count: 100 }));
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.msg_type === "candles") {
                allCandles = data.candles.map((c: any) => ({ time: Number(c.epoch) as any, open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low), close: parseFloat(c.close) }));
                series.setData(allCandles);
                updateAnalysis(allCandles);
            } else if (data.msg_type === "ohlc") {
                const o = data.ohlc;
                const newCandle = { time: Number(o.open_time) as any, open: parseFloat(o.open), high: parseFloat(o.high), low: parseFloat(o.low), close: parseFloat(o.close) };
                series.update(newCandle);
                const lastIdx = allCandles.findIndex(c => c.time === newCandle.time);
                if (lastIdx !== -1) allCandles[lastIdx] = newCandle; else { allCandles.push(newCandle); if (allCandles.length > 200) allCandles.shift(); }
                updateAnalysis(allCandles);
            }
        };

        const handleResize = () => chart.applyOptions({ width: chartContainerRef.current!.clientWidth, height: chartContainerRef.current!.clientHeight });
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); socket.close(); chart.remove(); };
    }, [symbol, activeIndicators]);

    const toggleIndicator = (name: string) => {
        const next = new Set(activeIndicators);
        if (next.has(name)) next.delete(name); else next.add(name);
        setActiveIndicators(next);
    };

    return (
        <div className="relative w-full h-full group">
            <div className="absolute top-4 right-4 z-50">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-slate-600 transition-all shadow-xl"
                >
                    <BarChart2 size={18} />
                    <span className="font-medium">Indicators</span>
                    <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                    <div className="absolute top-full mt-2 right-0 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {['Fibonacci', 'SMA', 'RSI'].map((name) => (
                            <button
                                key={name}
                                onClick={() => toggleIndicator(name)}
                                className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors"
                            >
                                <span className={activeIndicators.has(name) ? 'text-blue-400 font-medium' : 'text-slate-300'}>{name}</span>
                                {activeIndicators.has(name) && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div ref={chartContainerRef} className="w-full h-full" />
        </div>
    );
};

export default CandlestickChart;
