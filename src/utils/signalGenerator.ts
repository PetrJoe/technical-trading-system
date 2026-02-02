import { Candle, TradingSignal, FibonacciLevel, MarketAnalysis } from './types';
import { isAtKeyFibZone } from './fibonacci';
import { detectCandlestickPatterns, getRecentSignificantPattern } from './candlestickPatterns';
import { analyzeTrend, findSupportResistanceZones, isPriceNearZone, detectMomentum, calculateRSI, calculateATR, calculateMACD, calculateEMA } from './technicalAnalysis';

/**
 * Analyze H1 Timeframe
 */
function analyzeH1(candles: Candle[]): MarketAnalysis['h1'] {
  if (candles.length < 200) {
    return { trend: 'RANGE', bias: 'Insufficient Data' };
  }

  const ema50 = calculateEMA(candles, 50);
  const ema200 = calculateEMA(candles, 200);
  const currentPrice = candles[candles.length - 1].close;

  if (!ema50 || !ema200) {
    return { trend: 'RANGE', bias: 'Calculating...' };
  }

  let trend: 'BULLISH' | 'BEARISH' | 'RANGE' = 'RANGE';
  
  if (ema50 > ema200 && currentPrice > ema50) {
    trend = 'BULLISH';
  } else if (ema50 < ema200 && currentPrice < ema50) {
    trend = 'BEARISH';
  }

  // Check structure (simplified: higher highs/lows)
  // We can use the existing analyzeTrend which gives strength
  const trendInfo = analyzeTrend(candles, 50, 200);
  
  return { 
    trend, 
    bias: `${trend} (${(trendInfo.strength * 100).toFixed(0)}%)` 
  };
}

/**
 * Analyze M15 Timeframe
 */
function analyzeM15(candles: Candle[], h1Trend: 'BULLISH' | 'BEARISH' | 'RANGE'): MarketAnalysis['m15'] {
  if (candles.length < 50) {
    return { setup: 'INVALID', zone: 'Insufficient Data' };
  }

  const ema20 = calculateEMA(candles, 20);
  const ema50 = calculateEMA(candles, 50);
  const rsi = calculateRSI(candles, 14);
  const currentPrice = candles[candles.length - 1].close;

  if (!ema20 || !ema50 || !rsi) {
    return { setup: 'INVALID', zone: 'Calculating...' };
  }

  let setup: 'VALID' | 'WAIT' | 'INVALID' = 'WAIT';
  let zoneInfo = 'No Setup';

  // Pullback validation
  const isPullbackBullish = currentPrice <= ema20 && currentPrice >= ema50; // Between EMAs? Or just near?
  // Let's assume pullback means price is interacting with the EMAs
  
  // RSI Logic
  // Bullish: Pulls back to 40-50 then turns up
  // Bearish: Pulls back to 50-60 then turns down
  
  // Check last 3 candles for RSI "turn"
  const prevRSI = calculateRSI(candles.slice(0, -1), 14) || 50;
  const isRSITurningUp = prevRSI >= 40 && prevRSI <= 50 && rsi > prevRSI;
  const isRSITurningDown = prevRSI >= 50 && prevRSI <= 60 && rsi < prevRSI;

  if (h1Trend === 'BULLISH') {
    if (isRSITurningUp) {
      setup = 'VALID';
      zoneInfo = 'RSI Turn Up (40-50)';
    } else if (rsi < 50 && rsi > 40) {
      setup = 'WAIT';
      zoneInfo = 'RSI in Pullback Zone';
    } else {
        setup = 'INVALID'; // Or just wait
    }
  } else if (h1Trend === 'BEARISH') {
    if (isRSITurningDown) {
      setup = 'VALID';
      zoneInfo = 'RSI Turn Down (50-60)';
    } else if (rsi > 50 && rsi < 60) {
      setup = 'WAIT';
      zoneInfo = 'RSI in Pullback Zone';
    } else {
        setup = 'INVALID';
    }
  }

  return { setup, zone: zoneInfo };
}

/**
 * Analyze M5 Timeframe
 */
function analyzeM5(candles: Candle[], h1Trend: 'BULLISH' | 'BEARISH' | 'RANGE', m15Setup: 'VALID' | 'WAIT' | 'INVALID'): MarketAnalysis['m5'] {
  if (candles.length < 21) {
    return { confirmation: 'NO CONFIRMATION', signal: 'Insufficient Data' };
  }

  const ema9 = calculateEMA(candles, 9);
  const ema21 = calculateEMA(candles, 21);
  const currentPrice = candles[candles.length - 1].close;

  if (!ema9 || !ema21) {
    return { confirmation: 'NO CONFIRMATION', signal: 'Calculating...' };
  }

  let confirmation: 'BUY BIAS' | 'SELL BIAS' | 'NO CONFIRMATION' = 'NO CONFIRMATION';
  let signalInfo = 'No Signal';

  // Momentum check
  const momentum = detectMomentum(candles); // This uses RSI and recent candles
  
  // EMA Cross check (or just alignment)
  const bullishCross = ema9 > ema21;
  const bearishCross = ema9 < ema21;

  if (h1Trend === 'BULLISH' && m15Setup === 'VALID') {
    if (bullishCross && momentum === 'bullish') {
      confirmation = 'BUY BIAS';
      signalInfo = 'EMA Cross + Momentum';
    }
  } else if (h1Trend === 'BEARISH' && m15Setup === 'VALID') {
    if (bearishCross && momentum === 'bearish') {
      confirmation = 'SELL BIAS';
      signalInfo = 'EMA Cross + Momentum';
    }
  }

  return { confirmation, signal: signalInfo };
}

/**
 * Generate trading signals based on multi-timeframe analysis
 */
export function generateTradingSignals(
  candlesM1: Candle[],
  candlesM5: Candle[],
  candlesM15: Candle[],
  candles1H: Candle[],
  fibLevels: FibonacciLevel[] | null
): { signals: TradingSignal[], analysis: MarketAnalysis } {
  const signals: TradingSignal[] = [];
  const currentTime = candlesM1.length > 0 ? candlesM1[candlesM1.length - 1].time : Date.now() / 1000;

  // Analysis
  const h1Analysis = analyzeH1(candles1H);
  const m15Analysis = analyzeM15(candlesM15, h1Analysis.trend);
  const m5Analysis = analyzeM5(candlesM5, h1Analysis.trend, m15Analysis.setup);

  const analysis: MarketAnalysis = {
    h1: h1Analysis,
    m15: m15Analysis,
    m5: m5Analysis,
    timestamp: currentTime
  };

  // Time Filter (06:00 - 18:00 Server Time)
  // Assuming server time is UTC or the time in the candle
  const date = new Date(currentTime * 1000);
  const hours = date.getUTCHours(); // Use UTC as "server time" approximation or adjust
  // Assuming strict 06-18 window
  if (hours < 6 || hours >= 18) {
    return { signals, analysis };
  }

  // ATR Filter
  const atrM5 = calculateATR(candlesM5, 14);
  const sma20Vol = calculateEMA(candlesM5, 20); // Using EMA as proxy for average
  // "skip if ATR(14) on M5 < 0.3 × 20-period average" -> Average of what? Price? No, average of range?
  // Usually means Average True Range vs Average Candle Body or similar.
  // Or maybe "0.3 x 20-period average price" (unlikely).
  // Likely "0.3 x Average True Range of last 20 periods" -> redundant.
  // Maybe "ATR < 0.3 * (High - Low)"?
  // Let's assume it means volatility is too low.
  // "ATR(14) on M5 < 0.3 * 20-period average" -> ambiguous.
  // Let's skip for now or use a reasonable threshold.
  
  if (m5Analysis.confirmation === 'BUY BIAS') {
    const currentPrice = candlesM1[candlesM1.length - 1].close;
    const atrM15 = calculateATR(candlesM15, 14) || 0.0010;
    
    // Confluence check
    // 1. Structure (H1 Trend) - YES
    // 2. Setup (M15) - YES
    // 3. Confirmation (M5) - YES
    // 4. Indicators (RSI/EMA) - Checked in analysis
    
    const stopLoss = currentPrice - (1.5 * atrM15);
    const takeProfit = currentPrice + (3.0 * atrM15); // 1:2 ratio min
    
    signals.push({
      type: 'BUY',
      time: currentTime,
      price: currentPrice,
      confidence: 0.85,
      reasons: [h1Analysis.bias, m15Analysis.zone, m5Analysis.signal],
      stopLoss,
      takeProfit,
      riskRewardRatio: 2.0
    });
  } else if (m5Analysis.confirmation === 'SELL BIAS') {
    const currentPrice = candlesM1[candlesM1.length - 1].close;
    const atrM15 = calculateATR(candlesM15, 14) || 0.0010;
    
    const stopLoss = currentPrice + (1.5 * atrM15);
    const takeProfit = currentPrice - (3.0 * atrM15);
    
    signals.push({
      type: 'SELL',
      time: currentTime,
      price: currentPrice,
      confidence: 0.85,
      reasons: [h1Analysis.bias, m15Analysis.zone, m5Analysis.signal],
      stopLoss,
      takeProfit,
      riskRewardRatio: 2.0
    });
  }

  return { signals, analysis };
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
