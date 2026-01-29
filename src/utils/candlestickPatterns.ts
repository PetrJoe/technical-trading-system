import { Candle, CandlestickPattern } from './types';

/**
 * Bullish Patterns Detection
 */

// Hammer: Small body at top, long lower shadow (2x body), minimal upper shadow
export function isHammer(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const range = candle.high - candle.low;

  return (
    body < range * 0.3 &&
    lowerShadow > body * 2 &&
    upperShadow < body * 0.5
  );
}

// Inverted Hammer: Small body at bottom, long upper shadow
export function isInvertedHammer(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const range = candle.high - candle.low;

  return (
    body < range * 0.3 &&
    upperShadow > body * 2 &&
    lowerShadow < body * 0.5
  );
}

// Bullish Engulfing: Second candle completely engulfs first bearish candle
export function isBullishEngulfing(prev: Candle, current: Candle): boolean {
  const prevBearish = prev.close < prev.open;
  const currentBullish = current.close > current.open;

  return (
    prevBearish &&
    currentBullish &&
    current.open < prev.close &&
    current.close > prev.open
  );
}

// Morning Star: 3-candle pattern (bearish, small, bullish)
export function isMorningStar(c1: Candle, c2: Candle, c3: Candle): boolean {
  const c1Bearish = c1.close < c1.open;
  const c2SmallBody = Math.abs(c2.close - c2.open) < Math.abs(c1.close - c1.open) * 0.5;
  const c3Bullish = c3.close > c3.open;
  const c3CloseAboveC1Mid = c3.close > (c1.open + c1.close) / 2;

  return c1Bearish && c2SmallBody && c3Bullish && c3CloseAboveC1Mid;
}

// Piercing Line: Bearish followed by bullish that closes above midpoint
export function isPiercingLine(prev: Candle, current: Candle): boolean {
  const prevBearish = prev.close < prev.open;
  const currentBullish = current.close > current.open;
  const midpoint = (prev.open + prev.close) / 2;

  return (
    prevBearish &&
    currentBullish &&
    current.open < prev.close &&
    current.close > midpoint &&
    current.close < prev.open
  );
}

/**
 * Bearish Patterns Detection
 */

// Shooting Star: Small body at bottom, long upper shadow
export function isShootingStar(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const range = candle.high - candle.low;

  return (
    body < range * 0.3 &&
    upperShadow > body * 2 &&
    lowerShadow < body * 0.5
  );
}

// Hanging Man: Similar to hammer but appears after uptrend
export function isHangingMan(candle: Candle): boolean {
  return isHammer(candle); // Visual pattern is same, context differs
}

// Bearish Engulfing
export function isBearishEngulfing(prev: Candle, current: Candle): boolean {
  const prevBullish = prev.close > prev.open;
  const currentBearish = current.close < current.open;

  return (
    prevBullish &&
    currentBearish &&
    current.open > prev.close &&
    current.close < prev.open
  );
}

// Evening Star: 3-candle pattern (bullish, small, bearish)
export function isEveningStar(c1: Candle, c2: Candle, c3: Candle): boolean {
  const c1Bullish = c1.close > c1.open;
  const c2SmallBody = Math.abs(c2.close - c2.open) < Math.abs(c1.close - c1.open) * 0.5;
  const c3Bearish = c3.close < c3.open;
  const c3CloseBelowC1Mid = c3.close < (c1.open + c1.close) / 2;

  return c1Bullish && c2SmallBody && c3Bearish && c3CloseBelowC1Mid;
}

// Dark Cloud Cover
export function isDarkCloudCover(prev: Candle, current: Candle): boolean {
  const prevBullish = prev.close > prev.open;
  const currentBearish = current.close < current.open;
  const midpoint = (prev.open + prev.close) / 2;

  return (
    prevBullish &&
    currentBearish &&
    current.open > prev.close &&
    current.close < midpoint &&
    current.close > prev.open
  );
}

/**
 * Indecision Patterns
 */

// Doji: Open and close are very close
export function isDoji(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  return body < range * 0.1;
}

// Spinning Top: Small body, equal shadows
export function isSpinningTop(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
  const upperShadow = candle.high - Math.max(candle.open, candle.close);
  const range = candle.high - candle.low;

  return (
    body < range * 0.3 &&
    lowerShadow > body &&
    upperShadow > body
  );
}

/**
 * Main pattern detection function
 */
export function detectCandlestickPatterns(
  candles: Candle[],
  lookbackPeriod: number = 10
): CandlestickPattern[] {
  if (candles.length < 3) return [];

  const patterns: CandlestickPattern[] = [];
  const startIdx = Math.max(0, candles.length - lookbackPeriod);

  for (let i = startIdx; i < candles.length; i++) {
    const current = candles[i];
    const prev = i > 0 ? candles[i - 1] : null;
    const prev2 = i > 1 ? candles[i - 2] : null;

    // Single candle patterns
    if (isHammer(current)) {
      patterns.push({
        name: 'Hammer',
        type: 'bullish',
        time: current.time,
        confidence: 0.7,
      });
    }

    if (isInvertedHammer(current)) {
      patterns.push({
        name: 'Inverted Hammer',
        type: 'bullish',
        time: current.time,
        confidence: 0.65,
      });
    }

    if (isShootingStar(current)) {
      patterns.push({
        name: 'Shooting Star',
        type: 'bearish',
        time: current.time,
        confidence: 0.7,
      });
    }

    if (isDoji(current)) {
      patterns.push({
        name: 'Doji',
        type: 'indecision',
        time: current.time,
        confidence: 0.6,
      });
    }

    if (isSpinningTop(current)) {
      patterns.push({
        name: 'Spinning Top',
        type: 'indecision',
        time: current.time,
        confidence: 0.5,
      });
    }

    // Two candle patterns
    if (prev) {
      if (isBullishEngulfing(prev, current)) {
        patterns.push({
          name: 'Bullish Engulfing',
          type: 'bullish',
          time: current.time,
          confidence: 0.85,
        });
      }

      if (isBearishEngulfing(prev, current)) {
        patterns.push({
          name: 'Bearish Engulfing',
          type: 'bearish',
          time: current.time,
          confidence: 0.85,
        });
      }

      if (isPiercingLine(prev, current)) {
        patterns.push({
          name: 'Piercing Line',
          type: 'bullish',
          time: current.time,
          confidence: 0.75,
        });
      }

      if (isDarkCloudCover(prev, current)) {
        patterns.push({
          name: 'Dark Cloud Cover',
          type: 'bearish',
          time: current.time,
          confidence: 0.75,
        });
      }
    }

    // Three candle patterns
    if (prev && prev2) {
      if (isMorningStar(prev2, prev, current)) {
        patterns.push({
          name: 'Morning Star',
          type: 'bullish',
          time: current.time,
          confidence: 0.9,
        });
      }

      if (isEveningStar(prev2, prev, current)) {
        patterns.push({
          name: 'Evening Star',
          type: 'bearish',
          time: current.time,
          confidence: 0.9,
        });
      }
    }
  }

  return patterns;
}

/**
 * Get the most recent significant pattern
 */
export function getRecentSignificantPattern(
  patterns: CandlestickPattern[]
): CandlestickPattern | null {
  if (patterns.length === 0) return null;

  // Filter out indecision patterns and sort by confidence
  const significantPatterns = patterns
    .filter((p) => p.type !== 'indecision' && p.confidence >= 0.7)
    .sort((a, b) => b.time - a.time);

  return significantPatterns[0] || null;
}
