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
export function analyzeTrend(
  candles: Candle[],
  shortPeriod: number = 20,
  longPeriod: number = 50
): TrendInfo {
  if (candles.length < longPeriod) {
    return { direction: 'sideways', strength: 0 };
  }

  const emaShort = calculateEMA(candles, shortPeriod);
  const emaLong = calculateEMA(candles, longPeriod);
  const currentPrice = candles[candles.length - 1].close;

  if (!emaShort || !emaLong) {
    return { direction: 'sideways', strength: 0 };
  }

  // Determine trend direction
  let direction: 'bullish' | 'bearish' | 'sideways' = 'sideways';
  let strength = 0;

  if (currentPrice > emaShort && emaShort > emaLong) {
    direction = 'bullish';
    const priceAboveEma = ((currentPrice - emaShort) / emaShort) * 100;
    const emaSpread = ((emaShort - emaLong) / emaLong) * 100;
    strength = Math.min((priceAboveEma + emaSpread) / 2, 10) / 10;
  } else if (currentPrice < emaShort && emaShort < emaLong) {
    direction = 'bearish';
    const priceBelowEma = ((emaShort - currentPrice) / emaShort) * 100;
    const emaSpread = ((emaLong - emaShort) / emaLong) * 100;
    strength = Math.min((priceBelowEma + emaSpread) / 2, 10) / 10;
  } else {
    // Sideways or transitioning
    direction = 'sideways';
    strength = 0.3;
  }

  return { direction, strength };
}

/**
 * Analyze trend bias specifically for H1 strategy (EMA 50 & 200)
 */
export function analyzeTrendBias(candles: Candle[]): 'bullish' | 'bearish' | 'range' {
  if (candles.length < 200) return 'range';

  const ema50 = calculateEMA(candles, 50);
  const ema200 = calculateEMA(candles, 200);
  const currentPrice = candles[candles.length - 1].close;

  if (!ema50 || !ema200) return 'range';

  if (ema50 > ema200 && currentPrice > ema50 && currentPrice > ema200) {
    return 'bullish';
  } else if (ema50 < ema200 && currentPrice < ema50 && currentPrice < ema200) {
    return 'bearish';
  }
  
  return 'range';
}

/**
 * Find support and resistance zones using pivot points
 */
export function findSupportResistanceZones(
  candles: Candle[],
  lookback: number = 50,
  maxZones: number = 6
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

  // Enhance strength for round numbers
  zones.forEach(zone => {
    // Simple check: does the price look "round"?
    // We check if the price ends with 00 or 50 in its significant digits
    // Adjust precision based on price level roughly
    let priceStr = "";
    if (zone.price < 10) priceStr = zone.price.toFixed(4);
    else if (zone.price < 1000) priceStr = zone.price.toFixed(2);
    else priceStr = zone.price.toFixed(0);

    if (priceStr.endsWith('00') || priceStr.endsWith('50')) {
      zone.strength += 2; // Significant bonus for round numbers
    } else if (priceStr.endsWith('0')) {
      zone.strength += 1; // Smaller bonus
    }
  });

  // Sort by strength and return top zones
  return zones
    .sort((a, b) => b.strength - a.strength)
    .slice(0, maxZones);
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
 * Find recent swing high and low points
 */
export function findSwingPoints(candles: Candle[], lookback: number = 20) {
  if (candles.length < lookback) return null;
  
  const relevantCandles = candles.slice(-lookback);
  
  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  let highIndex = -1;
  let lowIndex = -1;

  relevantCandles.forEach((c, i) => {
    if (c.high > highestHigh) {
      highestHigh = c.high;
      highIndex = i;
    }
    if (c.low < lowestLow) {
      lowestLow = c.low;
      lowIndex = i;
    }
  });

  return {
    high: highestHigh,
    low: lowestLow,
    highIndex, // Relative to slice
    lowIndex   // Relative to slice
  };
}

/**
 * Calculate Fibonacci Retracement Levels
 */
export function calculateFibLevels(high: number, low: number, trend: 'bullish' | 'bearish') {
  const diff = high - low;
  
  if (trend === 'bullish') {
    // Retracing down from High. 0% is High, 100% is Low.
    // Entry Zone: 50% to 61.8% retracement
    return {
      level0: high,              // 0% (Target)
      level236: high - (diff * 0.236),
      level382: high - (diff * 0.382),
      level50: high - (diff * 0.5),
      level618: high - (diff * 0.618),
      level786: high - (diff * 0.786),
      level100: low,             // 100% (Stop/Invalidation)
      extension127: high + (diff * 0.27), // TP 1
      extension1618: high + (diff * 0.618) // TP 2
    };
  } else {
    // Retracing up from Low. 0% is Low, 100% is High.
    // Entry Zone: 50% to 61.8% retracement
    return {
      level0: low,               // 0% (Target)
      level236: low + (diff * 0.236),
      level382: low + (diff * 0.382),
      level50: low + (diff * 0.5),
      level618: low + (diff * 0.618),
      level786: low + (diff * 0.786),
      level100: high,            // 100% (Stop/Invalidation)
      extension127: low - (diff * 0.27),  // TP 1
      extension1618: low - (diff * 0.618) // TP 2
    };
  }
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
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } | null {
  if (candles.length < slowPeriod + signalPeriod) return null;

  const closePrices = candles.map((c) => c.close);

  // Helper for EMA array
  const calculateEMAArray = (values: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const emaArray: number[] = [];
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaArray.push(ema);

    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * k + ema;
      emaArray.push(ema);
    }
    return emaArray;
  };

  const fastEMA = calculateEMAArray(closePrices, fastPeriod);
  const slowEMA = calculateEMAArray(closePrices, slowPeriod);

  // Align EMAs
  const macdLine: number[] = [];
  const startIndex = slowPeriod - fastPeriod; // fastEMA is longer
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + startIndex] - slowEMA[i]);
  }

  // Calculate Signal Line (EMA of MACD Line)
  const signalLine = calculateEMAArray(macdLine, signalPeriod);

  // Get latest values
  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const currentHistogram = currentMACD - currentSignal;

  return {
    macd: currentMACD,
    signal: currentSignal,
    histogram: currentHistogram,
  };
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

/**
 * H1 Timeframe Analysis - Trend Bias
 */
export function analyzeH1(candles: Candle[]): {
  bias: 'BULLISH' | 'BEARISH' | 'RANGE';
  zones: SupportResistanceZone[];
} {
  if (candles.length < 200) return { bias: 'RANGE', zones: [] };

  const ema50 = calculateEMA(candles, 50);
  const ema200 = calculateEMA(candles, 200);
  const currentPrice = candles[candles.length - 1].close;
  
  // Find zones
  const zones = findSupportResistanceZones(candles, 100);

  if (!ema50 || !ema200) return { bias: 'RANGE', zones };

  let bias: 'BULLISH' | 'BEARISH' | 'RANGE' = 'RANGE';

  if (ema50 > ema200 && currentPrice > ema50 && currentPrice > ema200) {
    bias = 'BULLISH';
  } else if (ema50 < ema200 && currentPrice < ema50 && currentPrice < ema200) {
    bias = 'BEARISH';
  } else {
    bias = 'RANGE';
  }
  
  return { bias, zones };
}
