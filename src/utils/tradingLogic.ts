import { Candle, SupportResistanceZone, TradingSignal } from './types';
import { findSupportResistanceZones, calculateEMA } from './technicalAnalysis';

// --- Helper Functions ---

/**
 * Identify Swing Points (Highs and Lows)
 */
interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
  time: number;
}

export function identifySwingPoints(candles: Candle[], left: number = 2, right: number = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < left + right + 1) return swings;

  for (let i = left; i < candles.length - right; i++) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= left; j++) {
      if (candles[i - j].high >= current.high) isHigh = false;
      if (candles[i - j].low <= current.low) isLow = false;
    }

    for (let j = 1; j <= right; j++) {
      if (candles[i + j].high > current.high) isHigh = false;
      if (candles[i + j].low < current.low) isLow = false;
    }

    if (isHigh) swings.push({ index: i, price: current.high, type: 'high', time: current.time });
    if (isLow) swings.push({ index: i, price: current.low, type: 'low', time: current.time });
  }

  return swings;
}

function getAverageBodySize(candles: Candle[], count: number = 20): number {
  if (candles.length === 0) return 0;
  const recent = candles.slice(-count);
  const sum = recent.reduce((acc, c) => acc + Math.abs(c.close - c.open), 0);
  return sum / recent.length;
}

function isImpulseCandle(candle: Candle, avgBodySize: number, type: 'bullish' | 'bearish'): boolean {
  const bodySize = Math.abs(candle.close - candle.open);
  const isLarge = bodySize > 1.2 * avgBodySize; // 1.2x average
  
  if (type === 'bullish') {
    return isLarge && candle.close > candle.open && (candle.close - candle.low) > 0.7 * (candle.high - candle.low); // Strong close
  } else {
    return isLarge && candle.close < candle.open && (candle.high - candle.close) > 0.7 * (candle.high - candle.low); // Strong close down
  }
}

function hasRejectionWick(candle: Candle, type: 'bullish' | 'bearish'): boolean {
  const range = candle.high - candle.low;
  if (range === 0) return false;
  
  if (type === 'bullish') {
    // Long lower wick (rejection of lows)
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    return lowerWick > 0.5 * range;
  } else {
    // Long upper wick (rejection of highs)
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    return upperWick > 0.5 * range;
  }
}

function isStrongClose(candle: Candle, type: 'bullish' | 'bearish'): boolean {
  const range = candle.high - candle.low;
  if (range === 0) return false;

  if (type === 'bullish') {
    // Close in top 30%
    return (candle.close - candle.low) > 0.7 * range;
  } else {
    // Close in bottom 30%
    return (candle.high - candle.close) > 0.7 * range;
  }
}

// --- STANDARD STRATEGY (H1/M15/M5/M1) ---

export function detectMarketStructure(candles: Candle[]): 'bullish' | 'bearish' | 'range' {
  if (candles.length < 50) return 'range';

  const swings = identifySwingPoints(candles, 3, 3);
  if (swings.length < 4) return 'range';

  const recentSwings = swings.slice(-4);
  const highs = recentSwings.filter(s => s.type === 'high');
  const lows = recentSwings.filter(s => s.type === 'low');
  
  if (highs.length < 2 || lows.length < 2) return 'range';

  const lastHigh = highs[highs.length - 1];
  const prevHigh = highs[highs.length - 2];
  const lastLow = lows[lows.length - 1];
  const prevLow = lows[lows.length - 2];
  const currentPrice = candles[candles.length - 1].close;

  // Bullish Criteria
  const isUptrend = lastHigh.price > prevHigh.price && lastLow.price > prevLow.price;
  
  // Check for big rejection wicks against trend (Bearish wicks in uptrend)
  const lastCandle = candles[candles.length - 1];
  const bearishRejection = hasRejectionWick(lastCandle, 'bearish');

  // Check key support
  const zones = findSupportResistanceZones(candles, 100);
  const aboveSupport = zones.some(z => z.type === 'support' && currentPrice > z.price);

  if (isUptrend && !bearishRejection && aboveSupport) {
    return 'bullish';
  }

  // Bearish Criteria (Symmetrical)
  const isDowntrend = lastHigh.price < prevHigh.price && lastLow.price < prevLow.price;
  const bullishRejection = hasRejectionWick(lastCandle, 'bullish');
  const belowResistance = zones.some(z => z.type === 'resistance' && currentPrice < z.price);

  if (isDowntrend && !bullishRejection && belowResistance) {
    return 'bearish';
  }

  return 'range';
}

export function detectSetupZone(
  candles: Candle[],
  h1Bias: 'bullish' | 'bearish' | 'range',
  h1Zones: SupportResistanceZone[]
): boolean {
  if (candles.length < 20 || h1Bias === 'range') return false;

  const currentPrice = candles[candles.length - 1].close;
  const avgBody = getAverageBodySize(candles);

  // 1. Look for Impulse in last 10 candles
  const recentCandles = candles.slice(-10);
  const hasImpulse = recentCandles.some(c => isImpulseCandle(c, avgBody, h1Bias as 'bullish' | 'bearish'));

  if (!hasImpulse) return false;

  // 2. Check for Pullback/Consolidation
  if (h1Bias === 'bullish') {
    const recentHigh = Math.max(...recentCandles.map(c => c.high));
    const isPullback = currentPrice < recentHigh * 0.999;

    const nearSupport = h1Zones.some(z => 
      z.type === 'support' && 
      Math.abs(currentPrice - z.price) / currentPrice < 0.002
    );

    return isPullback && nearSupport;
  } 
  
  if (h1Bias === 'bearish') {
    const recentLow = Math.min(...recentCandles.map(c => c.low));
    const isPullback = currentPrice > recentLow * 1.001;

    const nearResistance = h1Zones.some(z => 
      z.type === 'resistance' && 
      Math.abs(currentPrice - z.price) / currentPrice < 0.002
    );

    return isPullback && nearResistance;
  }

  return false;
}

export function detectConfirmation(
  candles: Candle[],
  h1Bias: 'bullish' | 'bearish' | 'range',
  isSetupActive: boolean
): boolean {
  if (!isSetupActive || candles.length < 10) return false;

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  const isRejection = hasRejectionWick(lastCandle, h1Bias as 'bullish' | 'bearish');

  const isBullishEngulfing = 
    h1Bias === 'bullish' &&
    prevCandle.close < prevCandle.open &&
    lastCandle.close > lastCandle.open &&
    lastCandle.close > prevCandle.open &&
    lastCandle.open < prevCandle.close;

  const isBearishEngulfing = 
    h1Bias === 'bearish' &&
    prevCandle.close > prevCandle.open &&
    lastCandle.close < lastCandle.open &&
    lastCandle.close < prevCandle.open &&
    lastCandle.open > prevCandle.close;

  const swings = identifySwingPoints(candles, 2, 2);
  let hasStructure = false;

  if (swings.length >= 2) {
    const lastSwing = swings[swings.length - 1];
    const prevSwing = swings[swings.length - 2];

    if (h1Bias === 'bullish') {
      const lows = swings.filter(s => s.type === 'low');
      if (lows.length >= 2) {
        const lastL = lows[lows.length - 1];
        const prevL = lows[lows.length - 2];
        if (lastL.price > prevL.price) hasStructure = true;
      }
    } else {
      const highs = swings.filter(s => s.type === 'high');
      if (highs.length >= 2) {
        const lastH = highs[highs.length - 1];
        const prevH = highs[highs.length - 2];
        if (lastH.price < prevH.price) hasStructure = true;
      }
    }
  }

  if (h1Bias === 'bullish') {
    return (isRejection || isBullishEngulfing) && hasStructure;
  } else {
    return (isRejection || isBearishEngulfing) && hasStructure;
  }
}

export function detectEntryTrigger(
  candles: Candle[],
  h1Bias: 'bullish' | 'bearish' | 'range',
  isConfirmationActive: boolean
): TradingSignal | null {
  if (!isConfirmationActive || candles.length < 10) return null;

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  
  if (!isStrongClose(lastCandle, h1Bias as 'bullish' | 'bearish')) return null;

  const swings = identifySwingPoints(candles, 2, 2);
  let breakout = false;
  let entryPrice = lastCandle.close;
  let stopLoss = 0;

  if (h1Bias === 'bullish') {
    const highs = swings.filter(s => s.type === 'high');
    if (highs.length > 0) {
      const recentHigh = highs[highs.length - 1].price;
      if (lastCandle.close > recentHigh) {
        breakout = true;
        const lows = swings.filter(s => s.type === 'low');
        const recentLow = lows.length > 0 ? lows[lows.length - 1].price : Math.min(...candles.slice(-10).map(c => c.low));
        stopLoss = recentLow - (lastCandle.high - lastCandle.low) * 0.5;
      }
    }
  } else {
    const lows = swings.filter(s => s.type === 'low');
    if (lows.length > 0) {
      const recentLow = lows[lows.length - 1].price;
      if (lastCandle.close < recentLow) {
        breakout = true;
        const highs = swings.filter(s => s.type === 'high');
        const recentHigh = highs.length > 0 ? highs[highs.length - 1].price : Math.max(...candles.slice(-10).map(c => c.high));
        stopLoss = recentHigh + (lastCandle.high - lastCandle.low) * 0.5;
      }
    }
  }

  const isEngulfing = 
    (h1Bias === 'bullish' && lastCandle.close > prevCandle.open && prevCandle.close < prevCandle.open) ||
    (h1Bias === 'bearish' && lastCandle.close < prevCandle.open && prevCandle.close > prevCandle.open);

  if (breakout || isEngulfing) {
    const risk = Math.abs(entryPrice - stopLoss);
    const takeProfit = h1Bias === 'bullish' 
      ? entryPrice + (risk * 2) 
      : entryPrice - (risk * 2);

    return {
      type: h1Bias === 'bullish' ? 'BUY' : 'SELL',
      price: entryPrice,
      time: lastCandle.time,
      stopLoss,
      takeProfit,
      reason: breakout ? 'Break of Micro Structure' : 'Engulfing Trigger'
    };
  }

  return null;
}

// --- SCALPING STRATEGY (M5/M1) ---

/**
 * 1. M5 Trend (Scalp Mode)
 * Identify recent Break of Structure (BOS) + EMA alignment
 */
export function detectM5ScalpTrend(candles: Candle[]): 'bullish' | 'bearish' | 'range' {
  if (candles.length < 50) return 'range';

  // 1. Check EMA 20
  const ema20 = calculateEMA(candles, 20);
  if (!ema20) return 'range';
  const lastClose = candles[candles.length - 1].close;

  // 2. Check Recent Structure (Last 2 swings)
  const swings = identifySwingPoints(candles, 3, 3);
  if (swings.length < 2) return 'range';

  const lastHigh = swings.filter(s => s.type === 'high').pop();
  const lastLow = swings.filter(s => s.type === 'low').pop();

  if (!lastHigh || !lastLow) return 'range';

  // Bullish: Price > EMA20 and we broke a recent high (or holding HL)
  if (lastClose > ema20) {
    // Ideally we want to see higher highs, but for scalping, momentum > EMA is key
    return 'bullish';
  }

  // Bearish: Price < EMA20
  if (lastClose < ema20) {
    return 'bearish';
  }

  return 'range';
}

/**
 * 2. M5 Zone (Scalp Mode)
 * Price must be pulling back to the EMA 20 or a recent broken level
 */
export function detectM5ScalpZone(
  candles: Candle[], 
  trend: 'bullish' | 'bearish' | 'range'
): boolean {
  if (trend === 'range' || candles.length < 20) return false;

  const currentPrice = candles[candles.length - 1].close;
  const ema20 = calculateEMA(candles, 20);
  if (!ema20) return false;

  // "Near" EMA logic (within 0.05% distance)
  const dist = Math.abs(currentPrice - ema20) / currentPrice;
  const isNearEMA = dist < 0.0005; 

  // Bullish: Price should be slightly above or testing EMA
  if (trend === 'bullish') {
    // Allow small dip below EMA for liquidity grab, but mostly above
    return isNearEMA || (currentPrice > ema20 && currentPrice < ema20 * 1.001);
  }

  // Bearish
  if (trend === 'bearish') {
    return isNearEMA || (currentPrice < ema20 && currentPrice > ema20 * 0.999);
  }

  return false;
}

/**
 * 3. M1 Entry (Scalp Mode)
 * Fractal Break: Wait for CHoCH (Change of Character)
 */
export function detectM1ScalpEntry(
  candles: Candle[],
  trend: 'bullish' | 'bearish' | 'range',
  isInZone: boolean
): TradingSignal | null {
  if (!isInZone || trend === 'range' || candles.length < 20) return null;

  const lastCandle = candles[candles.length - 1];
  const swings = identifySwingPoints(candles, 2, 2);

  let entrySignal: TradingSignal | null = null;

  if (trend === 'bullish') {
    // Look for Break of recent Minor High (CHoCH)
    // We need a recent Lower High to be broken
    const highs = swings.filter(s => s.type === 'high');
    if (highs.length > 0) {
      const lastSwingHigh = highs[highs.length - 1];
      
      // Check if we just broke it
      if (lastCandle.close > lastSwingHigh.price && lastCandle.close > lastCandle.open) {
         // Stop Loss below recent low
         const recentLow = Math.min(...candles.slice(-5).map(c => c.low));
         const stopLoss = recentLow - (lastCandle.high - lastCandle.low) * 0.2;
         const risk = lastCandle.close - stopLoss;
         
         entrySignal = {
           type: 'BUY',
           price: lastCandle.close,
           time: lastCandle.time,
           stopLoss: stopLoss,
           takeProfit: lastCandle.close + (risk * 3), // 1:3 RR for Scalping
           reason: 'M1 Fractal CHoCH'
         };
      }
    }
  } else if (trend === 'bearish') {
    // Look for Break of recent Minor Low
    const lows = swings.filter(s => s.type === 'low');
    if (lows.length > 0) {
      const lastSwingLow = lows[lows.length - 1];
      
      if (lastCandle.close < lastSwingLow.price && lastCandle.close < lastCandle.open) {
         const recentHigh = Math.max(...candles.slice(-5).map(c => c.high));
         const stopLoss = recentHigh + (lastCandle.high - lastCandle.low) * 0.2;
         const risk = stopLoss - lastCandle.close;

         entrySignal = {
           type: 'SELL',
           price: lastCandle.close,
           time: lastCandle.time,
           stopLoss: stopLoss,
           takeProfit: lastCandle.close - (risk * 3), // 1:3 RR
           reason: 'M1 Fractal CHoCH'
         };
      }
    }
  }

  return entrySignal;
}
