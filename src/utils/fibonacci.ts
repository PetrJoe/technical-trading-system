import { Candle, FibonacciLevel, SwingPoint } from './types';

const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * Find significant swing highs and lows
 */
export function findSwingPoints(
  candles: Candle[],
  leftBars: number = 5,
  rightBars: number = 5
): { swingHighs: SwingPoint[]; swingLows: SwingPoint[] } {
  const swingHighs: SwingPoint[] = [];
  const swingLows: SwingPoint[] = [];

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const current = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    // Check if current is higher/lower than surrounding bars
    for (let j = 1; j <= leftBars; j++) {
      if (candles[i - j].high >= current.high) isSwingHigh = false;
      if (candles[i - j].low <= current.low) isSwingLow = false;
    }
    for (let j = 1; j <= rightBars; j++) {
      if (candles[i + j].high > current.high) isSwingHigh = false;
      if (candles[i + j].low < current.low) isSwingLow = false;
    }

    if (isSwingHigh) {
      swingHighs.push({
        time: current.time,
        price: current.high,
        index: i,
        type: 'high',
      });
    }
    if (isSwingLow) {
      swingLows.push({
        time: current.time,
        price: current.low,
        index: i,
        type: 'low',
      });
    }
  }

  return { swingHighs, swingLows };
}

/**
 * Calculate Fibonacci retracement levels
 * For uptrend: from swing low to swing high
 * For downtrend: from swing high to swing low
 */
export function calculateFibonacciLevels(
  startPoint: SwingPoint,
  endPoint: SwingPoint,
  isUptrend: boolean
): FibonacciLevel[] {
  const diff = endPoint.price - startPoint.price;
  const levels: FibonacciLevel[] = [];

  FIBONACCI_LEVELS.forEach((level) => {
    const price = isUptrend
      ? endPoint.price - diff * level
      : startPoint.price + diff * level;

    levels.push({
      level: level * 100,
      price,
      label: `${(level * 100).toFixed(1)}%`,
    });
  });

  return levels;
}

/**
 * Get the most recent Fibonacci retracement
 */
export function getRecentFibonacci(
  candles: Candle[],
  trend: 'bullish' | 'bearish' | 'sideways'
): { levels: FibonacciLevel[]; startPoint: SwingPoint; endPoint: SwingPoint } | null {
  if (candles.length < 20 || trend === 'sideways') return null;

  const { swingHighs, swingLows } = findSwingPoints(candles);

  if (trend === 'bullish' && swingLows.length >= 2 && swingHighs.length >= 1) {
    // Find the most recent significant swing low and high
    const recentHigh = swingHighs[swingHighs.length - 1];
    const recentLow = swingLows
      .filter((low) => low.index < recentHigh.index)
      .pop();

    if (recentLow) {
      const levels = calculateFibonacciLevels(recentLow, recentHigh, true);
      return { levels, startPoint: recentLow, endPoint: recentHigh };
    }
  } else if (trend === 'bearish' && swingHighs.length >= 2 && swingLows.length >= 1) {
    // Find the most recent significant swing high and low
    const recentLow = swingLows[swingLows.length - 1];
    const recentHigh = swingHighs
      .filter((high) => high.index < recentLow.index)
      .pop();

    if (recentHigh) {
      const levels = calculateFibonacciLevels(recentHigh, recentLow, false);
      return { levels, startPoint: recentHigh, endPoint: recentLow };
    }
  }

  return null;
}

/**
 * Check if price is near a Fibonacci level
 */
export function isPriceNearFibLevel(
  price: number,
  fibLevels: FibonacciLevel[],
  tolerance: number = 0.001 // 0.1%
): FibonacciLevel | null {
  for (const level of fibLevels) {
    const diff = Math.abs(price - level.price) / level.price;
    if (diff <= tolerance) {
      return level;
    }
  }
  return null;
}

/**
 * Check if price is at key Fibonacci retracement zone (38.2%, 50%, 61.8%)
 */
export function isAtKeyFibZone(
  price: number,
  fibLevels: FibonacciLevel[],
  tolerance: number = 0.002
): { level: FibonacciLevel; isKeyZone: boolean } | null {
  const keyLevels = [38.2, 50, 61.8];
  
  for (const level of fibLevels) {
    if (keyLevels.includes(level.level)) {
      const diff = Math.abs(price - level.price) / level.price;
      if (diff <= tolerance) {
        return { level, isKeyZone: true };
      }
    }
  }
  
  return null;
}
