import { Candle, SupportResistanceZone, TrendInfo } from './types';

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(candles: Candle[], period: number): number | null {
  if (candles.length < period) return null;
  const sum = candles.slice(-period).reduce((acc, c) => acc + c.close, 0);
  return sum / period;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(
  candles: Candle[],
  period: number,
  prevEMA?: number
): number | null {
  if (candles.length === 0) return null;
  
  const multiplier = 2 / (period + 1);
  const currentPrice = candles[candles.length - 1].close;

  if (prevEMA === undefined) {
    // Calculate initial SMA as first EMA
    return calculateSMA(candles, period);
  }

  return (currentPrice - prevEMA) * multiplier + prevEMA;
}

/**
 * Determine overall market trend using multiple EMAs
 */
export function analyzeTrend(candles: Candle[]): TrendInfo {
  if (candles.length < 50) {
    return { direction: 'sideways', strength: 0 };
  }

  const ema20 = calculateEMA(candles, 20);
  const ema50 = calculateEMA(candles, 50);
  const currentPrice = candles[candles.length - 1].close;

  if (!ema20 || !ema50) {
    return { direction: 'sideways', strength: 0 };
  }

  // Determine trend direction
  let direction: 'bullish' | 'bearish' | 'sideways' = 'sideways';
  let strength = 0;

  if (currentPrice > ema20 && ema20 > ema50) {
    direction = 'bullish';
    const priceAboveEma = ((currentPrice - ema20) / ema20) * 100;
    const emaSpread = ((ema20 - ema50) / ema50) * 100;
    strength = Math.min((priceAboveEma + emaSpread) / 2, 10) / 10;
  } else if (currentPrice < ema20 && ema20 < ema50) {
    direction = 'bearish';
    const priceBelowEma = ((ema20 - currentPrice) / ema20) * 100;
    const emaSpread = ((ema50 - ema20) / ema50) * 100;
    strength = Math.min((priceBelowEma + emaSpread) / 2, 10) / 10;
  } else {
    // Sideways or transitioning
    direction = 'sideways';
    strength = 0.3;
  }

  return { direction, strength };
}

/**
 * Find support and resistance zones using pivot points
 */
export function findSupportResistanceZones(
  candles: Candle[],
  lookback: number = 50
): SupportResistanceZone[] {
  if (candles.length < 20) return [];

  const zones: SupportResistanceZone[] = [];
  const recentCandles = candles.slice(-lookback);

  // Find pivot highs and lows
  const pivots: { price: number; type: 'support' | 'resistance' }[] = [];

  for (let i = 5; i < recentCandles.length - 5; i++) {
    const current = recentCandles[i];
    let isHigh = true;
    let isLow = true;

    // Check surrounding candles
    for (let j = 1; j <= 5; j++) {
      if (
        recentCandles[i - j].high >= current.high ||
        recentCandles[i + j].high > current.high
      ) {
        isHigh = false;
      }
      if (
        recentCandles[i - j].low <= current.low ||
        recentCandles[i + j].low < current.low
      ) {
        isLow = false;
      }
    }

    if (isHigh) {
      pivots.push({ price: current.high, type: 'resistance' });
    }
    if (isLow) {
      pivots.push({ price: current.low, type: 'support' });
    }
  }

  // Cluster nearby pivots into zones
  const tolerance = 0.002; // 0.2% tolerance for clustering

  pivots.forEach((pivot) => {
    const existingZone = zones.find(
      (zone) =>
        zone.type === pivot.type &&
        Math.abs(zone.price - pivot.price) / pivot.price < tolerance
    );

    if (existingZone) {
      existingZone.strength += 1;
      existingZone.price = (existingZone.price + pivot.price) / 2; // Average the price
    } else {
      zones.push({
        price: pivot.price,
        strength: 1,
        type: pivot.type,
      });
    }
  });

  // Sort by strength and return top zones
  return zones
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);
}

/**
 * Check if price is near a support or resistance zone
 */
export function isPriceNearZone(
  price: number,
  zones: SupportResistanceZone[],
  tolerance: number = 0.002
): SupportResistanceZone | null {
  for (const zone of zones) {
    const diff = Math.abs(price - zone.price) / zone.price;
    if (diff <= tolerance) {
      return zone;
    }
  }
  return null;
}

/**
 * Calculate Average True Range (volatility measure)
 */
export function calculateATR(candles: Candle[], period: number = 14): number | null {
  if (candles.length < period + 1) return null;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );

    trueRanges.push(tr);
  }

  const recentTRs = trueRanges.slice(-period);
  return recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(candles: Candle[], period: number = 14): number | null {
  if (candles.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // Calculate initial average gain and loss
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RSI using smoothed averages
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Detect momentum (bullish/bearish)
 */
export function detectMomentum(candles: Candle[]): 'bullish' | 'bearish' | 'neutral' {
  if (candles.length < 20) return 'neutral';

  const rsi = calculateRSI(candles);
  const trend = analyzeTrend(candles);
  const recentCandles = candles.slice(-5);
  
  // Count bullish vs bearish candles
  const bullishCount = recentCandles.filter(c => c.close > c.open).length;
  const bearishCount = recentCandles.filter(c => c.close < c.open).length;

  if (trend.direction === 'bullish' && rsi && rsi < 70 && bullishCount > bearishCount) {
    return 'bullish';
  } else if (trend.direction === 'bearish' && rsi && rsi > 30 && bearishCount > bullishCount) {
    return 'bearish';
  }

  return 'neutral';
}
