import { Candle, TradingSignal, FibonacciLevel } from './types';
import { isAtKeyFibZone } from './fibonacci';
import { detectCandlestickPatterns, getRecentSignificantPattern } from './candlestickPatterns';
import { analyzeTrend, findSupportResistanceZones, isPriceNearZone, detectMomentum } from './technicalAnalysis';

/**
 * Generate trading signals based on multi-timeframe analysis
 */
export function generateTradingSignals(
  candlesM1: Candle[],
  candlesM5: Candle[],
  candlesM15: Candle[],
  candles1H: Candle[],
  fibLevels: FibonacciLevel[] | null
): TradingSignal[] {
  const signals: TradingSignal[] = [];

  // Need sufficient data
  if (
    candlesM1.length < 20 ||
    candlesM5.length < 20 ||
    candlesM15.length < 20 ||
    candles1H.length < 50
  ) {
    return signals;
  }

  // 1. Determine overall trend from 1H chart
  const trend1H = analyzeTrend(candles1H);
  
  if (trend1H.direction === 'sideways') {
    return signals; // No clear trend, no signals
  }

  // 2. Get current price from M1
  const currentPrice = candlesM1[candlesM1.length - 1].close;
  const currentTime = candlesM1[candlesM1.length - 1].time;

  // 3. Analyze M15 and M5 for structure confirmation
  const trendM15 = analyzeTrend(candlesM15);
  const trendM5 = analyzeTrend(candlesM5);
  
  // Trends should align
  const trendsAlign =
    trend1H.direction === trendM15.direction ||
    trendM15.direction === 'sideways';

  if (!trendsAlign && trendM15.direction !== 'sideways') {
    return signals; // Conflicting trends
  }

  // 4. Check Fibonacci levels
  let fibConfirmation = false;
  let fibLevel: number | undefined;
  
  if (fibLevels) {
    const fibCheck = isAtKeyFibZone(currentPrice, fibLevels);
    if (fibCheck) {
      fibConfirmation = true;
      fibLevel = fibCheck.level.level;
    }
  }

  // 5. Check Support/Resistance zones
  const srZones = findSupportResistanceZones(candlesM15, 50);
  const nearZone = isPriceNearZone(currentPrice, srZones);

  // 6. Check candlestick patterns on M1 and M5
  const patternsM1 = detectCandlestickPatterns(candlesM1, 5);
  const patternsM5 = detectCandlestickPatterns(candlesM5, 3);
  
  const recentPatternM1 = getRecentSignificantPattern(patternsM1);
  const recentPatternM5 = getRecentSignificantPattern(patternsM5);

  // 7. Check momentum
  const momentumM5 = detectMomentum(candlesM5);
  const momentumM1 = detectMomentum(candlesM1);

  // --- BUY SIGNAL CONDITIONS ---
  if (trend1H.direction === 'bullish') {
    const reasons: string[] = [];
    let confidence = 0;

    // Required: 1H bullish trend
    reasons.push('1H Bullish Trend');
    confidence += 0.2;

    // Fibonacci retracement at key level
    if (fibConfirmation) {
      reasons.push(`Fibonacci ${fibLevel}% Retracement`);
      confidence += 0.25;
    }

    // Support zone
    if (nearZone && nearZone.type === 'support') {
      reasons.push(`Support Zone at ${nearZone.price.toFixed(4)}`);
      confidence += 0.15;
    }

    // Bullish candlestick pattern
    if (recentPatternM1 && recentPatternM1.type === 'bullish') {
      reasons.push(`${recentPatternM1.name} on M1`);
      confidence += recentPatternM1.confidence * 0.2;
    } else if (recentPatternM5 && recentPatternM5.type === 'bullish') {
      reasons.push(`${recentPatternM5.name} on M5`);
      confidence += recentPatternM5.confidence * 0.15;
    }

    // Momentum confirmation
    if (momentumM1 === 'bullish' || momentumM5 === 'bullish') {
      reasons.push('Bullish Momentum');
      confidence += 0.15;
    }

    // Generate BUY signal if confidence threshold met
    if (confidence >= 0.65 && reasons.length >= 3) {
      signals.push({
        type: 'BUY',
        time: currentTime,
        price: currentPrice,
        confidence: Math.min(confidence, 1),
        reasons,
        fibLevel,
        pattern: recentPatternM1?.name || recentPatternM5?.name,
      });
    }
  }

  // --- SELL SIGNAL CONDITIONS ---
  if (trend1H.direction === 'bearish') {
    const reasons: string[] = [];
    let confidence = 0;

    // Required: 1H bearish trend
    reasons.push('1H Bearish Trend');
    confidence += 0.2;

    // Fibonacci retracement at key level
    if (fibConfirmation) {
      reasons.push(`Fibonacci ${fibLevel}% Retracement`);
      confidence += 0.25;
    }

    // Resistance zone
    if (nearZone && nearZone.type === 'resistance') {
      reasons.push(`Resistance Zone at ${nearZone.price.toFixed(4)}`);
      confidence += 0.15;
    }

    // Bearish candlestick pattern
    if (recentPatternM1 && recentPatternM1.type === 'bearish') {
      reasons.push(`${recentPatternM1.name} on M1`);
      confidence += recentPatternM1.confidence * 0.2;
    } else if (recentPatternM5 && recentPatternM5.type === 'bearish') {
      reasons.push(`${recentPatternM5.name} on M5`);
      confidence += recentPatternM5.confidence * 0.15;
    }

    // Momentum confirmation
    if (momentumM1 === 'bearish' || momentumM5 === 'bearish') {
      reasons.push('Bearish Momentum');
      confidence += 0.15;
    }

    // Generate SELL signal if confidence threshold met
    if (confidence >= 0.65 && reasons.length >= 3) {
      signals.push({
        type: 'SELL',
        time: currentTime,
        price: currentPrice,
        confidence: Math.min(confidence, 1),
        reasons,
        fibLevel,
        pattern: recentPatternM1?.name || recentPatternM5?.name,
      });
    }
  }

  return signals;
}

/**
 * Format signal for display
 */
export function formatSignalText(signal: TradingSignal): string {
  const confidencePercent = (signal.confidence * 100).toFixed(0);
  return `${signal.type} @ ${signal.price.toFixed(4)} (${confidencePercent}%)`;
}

/**
 * Get signal color
 */
export function getSignalColor(signal: TradingSignal): string {
  return signal.type === 'BUY' ? '#10b981' : '#ef4444';
}
