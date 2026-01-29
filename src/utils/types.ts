export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface FibonacciLevel {
  level: number;
  price: number;
  label: string;
}

export interface SwingPoint {
  time: number;
  price: number;
  index: number;
  type: 'high' | 'low';
}

export interface SupportResistanceZone {
  price: number;
  strength: number;
  type: 'support' | 'resistance';
}

export interface CandlestickPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'indecision' | 'continuation';
  time: number;
  confidence: number;
}

export interface TrendInfo {
  direction: 'bullish' | 'bearish' | 'sideways';
  strength: number;
}

export interface TradingSignal {
  type: 'BUY' | 'SELL';
  time: number;
  price: number;
  confidence: number;
  reasons: string[];
  fibLevel?: number;
  pattern?: string;
}

export type Timeframe = 'M1' | 'M5' | 'M15' | '1H';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  '1H': 3600,
};
