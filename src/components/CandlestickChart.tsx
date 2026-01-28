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

    const GRANULARITY = 60; // Fixed 1m

    // Refs for indicators
    const resistanceLinesRef = useRef<ISeriesApi<'Line'>[]>([]);
    const supportLinesRef = useRef<ISeriesApi<'Line'>[]>([]);
    const fastEMARef = useRef<ISeriesApi<'Line'> | null>(null);
    const slowEMARef = useRef<ISeriesApi<'Line'> | null>(null);
    const srLinesRef = useRef<any[]>([]); // To store price lines

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { color: '#020617' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: '#0f172a' }, horzLines: { color: '#0f172a' } },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            timeScale: {
                timeVisible: true,
                secondsVisible: true,
                borderVisible: false,
            },
            rightPriceScale: {
                borderVisible: false,
            },
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981', downColor: '#ef4444', borderVisible: false,
            wickUpColor: '#10b981', wickDownColor: '#ef4444',
        });

        // Add EMA Series
        const fastEMA = chart.addSeries(LineSeries, { color: '#fcd34d', lineWidth: 2, title: 'EMA 9', lastValueVisible: false, priceLineVisible: false });
        const slowEMA = chart.addSeries(LineSeries, { color: '#818cf8', lineWidth: 2, title: 'EMA 21', lastValueVisible: false, priceLineVisible: false });

        chartRef.current = chart;
        seriesRef.current = series;
        fastEMARef.current = fastEMA;
        slowEMARef.current = slowEMA;

        let allCandles: any[] = [];
        let markers: any[] = [];

        const calculateEMA = (data: any[], period: number) => {
            const k = 2 / (period + 1);
            let emaData = [];
            let prevEMA = data[0].close;

            for (let i = 0; i < data.length; i++) {
                const currentEMA = (data[i].close - prevEMA) * k + prevEMA;
                emaData.push({ time: data[i].time, value: currentEMA });
                prevEMA = currentEMA;
            }
            return emaData;
        };

        const findPivots = (data: any[]) => {
            const pivotHighs: any[] = [];
            const pivotLows: any[] = [];
            const window = 5;

            for (let i = window; i < data.length - window; i++) {
                const current = data[i];
                let isHigh = true, isLow = true;
                for (let j = 1; j <= window; j++) {
                    if (data[i - j].high >= current.high || data[i + j].high > current.high) isHigh = false;
                    if (data[i - j].low <= current.low || data[i + j].low < current.low) isLow = false;
                }
                if (isHigh) pivotHighs.push({ ...current, index: i });
                if (isLow) pivotLows.push({ ...current, index: i });
            }
            return { pivotHighs, pivotLows };
        };

        const updateAnalysis = (data: any[]) => {
            if (!chartRef.current || data.length < 22) return;

            // 1. Moving Averages
            const ema9 = calculateEMA(data, 9);
            const ema21 = calculateEMA(data, 21);
            fastEMARef.current?.setData(ema9);
            slowEMARef.current?.setData(ema21);

            // 2. Trendlines & S/R
            const { pivotHighs, pivotLows } = findPivots(data);

            // Trendlines cleanup & logic
            resistanceLinesRef.current.forEach(l => chartRef.current?.removeSeries(l));
            supportLinesRef.current.forEach(l => chartRef.current?.removeSeries(l));
            resistanceLinesRef.current = [];
            supportLinesRef.current = [];

            let trendData: any = null;
            if (pivotHighs.length >= 2) {
                const p1 = pivotHighs[pivotHighs.length - 2];
                const p2 = pivotHighs[pivotHighs.length - 1];
                const line = chartRef.current.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
                const slope = (p2.high - p1.high) / (p2.index - p1.index);
                const trendPoints = data.slice(p1.index).map((d, i) => ({ time: d.time, value: p1.high + slope * (p1.index + i - p1.index) }));
                line.setData(trendPoints);
                resistanceLinesRef.current.push(line);
                trendData = { type: 'resistance', slope, p2, trendPoints };
            }
            if (pivotLows.length >= 2) {
                const p1 = pivotLows[pivotLows.length - 2];
                const p2 = pivotLows[pivotLows.length - 1];
                const line = chartRef.current.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
                const slope = (p2.low - p1.low) / (p2.index - p1.index);
                const trendPoints = data.slice(p1.index).map((d, i) => ({ time: d.time, value: p1.low + slope * (p1.index + i - p1.index) }));
                line.setData(trendPoints);
                supportLinesRef.current.push(line);
                if (!trendData) trendData = { type: 'support', slope, p2, trendPoints };
            }

            // 3. Horizontal Support & Resistance
            // Clear old price lines
            srLinesRef.current.forEach(l => seriesRef.current?.removePriceLine(l));
            srLinesRef.current = [];

            if (pivotHighs.length > 0) {
                const lastHigh = pivotHighs[pivotHighs.length - 1];
                const pl = (seriesRef.current as any).createPriceLine({
                    price: lastHigh.high, color: '#f8717188', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'RESISTANCE'
                });
                srLinesRef.current.push(pl);
            }
            if (pivotLows.length > 0) {
                const lastLow = pivotLows[pivotLows.length - 1];
                const pl = (seriesRef.current as any).createPriceLine({
                    price: lastLow.low, color: '#34d39988', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'SUPPORT'
                });
                srLinesRef.current.push(pl);
            }

            return { trendData, ema9, ema21 };
        };

        const checkSignals = (newCandle: any, analysis: any) => {
            if (!analysis || !analysis.ema9 || !analysis.ema21) return;

            const lastIdx = analysis.ema9.length - 1;
            if (lastIdx < 1) return;

            const currFast = analysis.ema9[lastIdx].value;
            const prevFast = analysis.ema9[lastIdx - 1].value;
            const currSlow = analysis.ema21[lastIdx].value;
            const prevSlow = analysis.ema21[lastIdx - 1].value;

            const lastMarker = markers[markers.length - 1];
            const timeDiff = lastMarker ? (newCandle.time - lastMarker.time) : 1000000;

            if (timeDiff >= GRANULARITY) {
                // EMA Crossover Signal
                if (prevFast <= prevSlow && currFast > currSlow) {
                    markers.push({ time: newCandle.time, position: 'belowBar', color: '#fcd34d', shape: 'arrowUp', text: 'EMA BUY' });
                    (seriesRef.current as any).setMarkers([...markers]);
                } else if (prevFast >= prevSlow && currFast < currSlow) {
                    markers.push({ time: newCandle.time, position: 'aboveBar', color: '#818cf8', shape: 'arrowDown', text: 'EMA SELL' });
                    (seriesRef.current as any).setMarkers([...markers]);
                }

                // Trendline Break Signal (Secondary)
                const trendData = analysis.trendData;
                if (trendData && trendData.trendPoints) {
                    const lastTrend = trendData.trendPoints[trendData.trendPoints.length - 1];
                    if (trendData.type === 'resistance' && newCandle.close > lastTrend.value) {
                        markers.push({ time: newCandle.time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'BREAKOUT' });
                        (seriesRef.current as any).setMarkers([...markers]);
                    } else if (trendData.type === 'support' && newCandle.close < lastTrend.value) {
                        markers.push({ time: newCandle.time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'BREAKDOWN' });
                        (seriesRef.current as any).setMarkers([...markers]);
                    }
                }
            }
        };

        const socket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
        socketRef.current = socket;

        socket.onopen = () => {
            socket.send(JSON.stringify({
                ticks_history: symbol,
                subscribe: 1,
                end: 'latest',
                style: 'candles',
                granularity: GRANULARITY,
                count: 200
            }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.msg_type === "candles") {
                allCandles = data.candles.map((c: any) => ({
                    time: Number(c.epoch) as any,
                    open: parseFloat(c.open),
                    high: parseFloat(c.high),
                    low: parseFloat(c.low),
                    close: parseFloat(c.close)
                }));
                series.setData(allCandles);
                updateAnalysis(allCandles);
            } else if (data.msg_type === "ohlc") {
                const o = data.ohlc;
                const newCandle = {
                    time: Number(o.open_time) as any,
                    open: parseFloat(o.open),
                    high: parseFloat(o.high),
                    low: parseFloat(o.low),
                    close: parseFloat(o.close)
                };
                series.update(newCandle);
                const lastIdx = allCandles.findIndex(c => c.time === newCandle.time);
                if (lastIdx !== -1) allCandles[lastIdx] = newCandle;
                else {
                    allCandles.push(newCandle);
                    if (allCandles.length > 300) allCandles.shift();
                }
                const analysis = updateAnalysis(allCandles);
                checkSignals(newCandle, analysis);
            }
        };

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            socket.close();
            chart.remove();
        };
    }, [symbol]);

    return (
        <div className="relative w-full h-full group bg-[#020617] overflow-hidden flex flex-col">
            {/* Simplified Header */}
            <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-center pointer-events-none">
                <div className="px-4 py-2 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] sm:text-xs font-black text-slate-200 uppercase tracking-[0.2em]">{symbol} • LIVE • M1</span>
                    </div>
                </div>
            </div>

            <div ref={chartContainerRef} className="flex-1 w-full h-full" />

            {/* Visual Decorative Blur */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        </div>
    );
};

export default CandlestickChart;
