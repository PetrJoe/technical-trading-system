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

    const [granularity, setGranularity] = useState(60); // Default 1m

    const timeframes = [
        { label: '1m', value: 60 },
        { label: '5m', value: 300 },
        { label: '15m', value: 900 },
        { label: '1h', value: 3600 },
        { label: '1d', value: 86400 },
    ];

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

        const socket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
        socketRef.current = socket;

        socket.onopen = () => {
            socket.send(JSON.stringify({
                ticks_history: symbol,
                subscribe: 1,
                end: 'latest',
                style: 'candles',
                granularity: granularity,
                count: 100
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
                    if (allCandles.length > 200) allCandles.shift();
                }
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
    }, [symbol, granularity]);

    return (
        <div className="relative w-full h-full group bg-[#0f172a]">
            {/* Timeframe Picker */}
            <div className="absolute top-4 left-4 z-50 flex gap-1 p-1 bg-slate-800/40 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                {timeframes.map((tf) => (
                    <button
                        key={tf.value}
                        onClick={() => setGranularity(tf.value)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${granularity === tf.value
                            ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tf.label}
                    </button>
                ))}
            </div>

            <div ref={chartContainerRef} className="w-full h-full" />
        </div>
    );
};

export default CandlestickChart;
