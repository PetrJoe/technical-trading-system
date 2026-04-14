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
  price: number;
  time: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
}

export type Timeframe = 'M1' | 'M3' | 'M5' | 'M15';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  M1: 60,
  M3: 180,
  M5: 300,
  M15: 900,
};

export interface WebSocketMessage {
  msg_type: string;
  echo_req?: {
    ticks_history?: string;
    granularity?: number;
    [key: string]: unknown;
  };
  ohlc?: {
    symbol: string;
    granularity: number;
    open_time: number | string;
    open: string;
    high: string;
    low: string;
    close: string;
  };
  candles?: Array<{
    epoch: number | string;
    open: string;
    high: string;
    low: string;
    close: string;
  }>;
  [key: string]: unknown;
}
