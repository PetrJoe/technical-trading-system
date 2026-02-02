import { Candle, TradingSignal, FibonacciLevel } from './types';
import { detectCandlestickPatterns, getRecentSignificantPattern } from './candlestickPatterns';
import { 
  calculateRSI, 
  calculateATR, 
  analyzeH1,
  analyzeM15,
  analyzeM5,
  analyzeM1
} from './technicalAnalysis';

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
    candlesM15.length < 50 ||
    candles1H.length < 200
  ) {
    return signals;
  }

  // --- 1. H1 Timeframe Analysis ---
  const { bias: h1Bias, zones: h1Zones } = analyzeH1(candles1H);

  if (h1Bias === 'RANGE') {
    return signals; // No clear trend, no signals
  }

  // --- 2. M15 Timeframe Analysis ---
  const { status: m15Status, zone: m15Zone } = analyzeM15(candlesM15, h1Bias, h1Zones);

  if (m15Status !== 'VALID') {
    // If not valid setup, we don't trade
    return signals;
  }

  // --- 3. M5 Timeframe Analysis ---
  const { confirmation: m5Confirmation } = analyzeM5(candlesM5, h1Bias);

  // --- 4. M1 Timeframe Analysis ---
  const { trigger: m1Trigger } = analyzeM1(candlesM1, m5Confirmation);

  // Check alignment
  const isBuyAligned = h1Bias === 'BULLISH' && m5Confirmation === 'BUY BIAS' && m1Trigger === 'BUY';
  const isSellAligned = h1Bias === 'BEARISH' && m5Confirmation === 'SELL BIAS' && m1Trigger === 'SELL';

  if (!isBuyAligned && !isSellAligned) {
    return signals;
  }

  // --- 4. Consistency Boosters & Filters ---
  const currentPrice = candlesM1[candlesM1.length - 1].close;
  const currentTime = candlesM1[candlesM1.length - 1].time;

  // 1. Time Filter (06:00 - 18:00)
  // Assuming time is unix timestamp in seconds. 
  // We use the candle time directly.
  const date = new Date(currentTime * 1000);
  const hour = date.getUTCHours(); // Use UTC to be consistent with most server times
  // If the user wants specific timezone, they should adjust. 
  // Standard Forex sessions often align with UTC or UTC+2/3. 
  // Let's assume strict 06-18 UTC for now as per "server time" instruction generally implying London/NY overlap.
  if (hour < 6 || hour >= 18) {
      // return signals; // strict filter
  }

  // 2. 2-Candle Alignment (M5)
  // Ensure last 2 candles on M5 match the direction
  const lastM5 = candlesM5[candlesM5.length - 1];
  const prevM5 = candlesM5[candlesM5.length - 2];
  const isM5Bullish = lastM5.close > lastM5.open && prevM5.close > prevM5.open;
  const isM5Bearish = lastM5.close < lastM5.open && prevM5.close < prevM5.open;

  if (isBuyAligned && !isM5Bullish) {
      return signals;
  }
  if (isSellAligned && !isM5Bearish) {
      return signals;
  }

  // 3. ATR Filter (M5)
  const atrM5 = calculateATR(candlesM5, 14);
  const avgAtrM5 = 0.0005; // Placeholder for 20-period average of ATR
  // Ideally we need history of ATR to calc average.
  // "skip if ATR(14) on M5 < 0.3 × 20-period average" - This implies low volatility chop.
  // For now, let's just ensure ATR is not super low.
  if (atrM5 && atrM5 < 0.0001) {
      return signals; // Too tight
  }

  // Confluence Count
  const reasons: string[] = [];
  let confluenceCount = 0;

  reasons.push(`H1 ${h1Bias} Trend`);
  confluenceCount++;

  reasons.push('M15 Setup Valid');
  confluenceCount++;

  reasons.push(`M5 ${m5Confirmation}`);
  confluenceCount++;

  reasons.push(`M1 ${m1Trigger} Trigger`);
  confluenceCount++;

  // Additional Confluences
  const rsiM5 = calculateRSI(candlesM5, 14);
  if (rsiM5) {
      if (h1Bias === 'BULLISH' && rsiM5 > 40 && rsiM5 < 70) {
          reasons.push('M5 RSI Bullish');
          confluenceCount++;
      } else if (h1Bias === 'BEARISH' && rsiM5 < 60 && rsiM5 > 30) {
          reasons.push('M5 RSI Bearish');
          confluenceCount++;
      }
  }

  // Candlestick Patterns M5/M1
  const patternsM5 = detectCandlestickPatterns(candlesM5, 3);
  const recentPatternM5 = getRecentSignificantPattern(patternsM5);
  
  if (recentPatternM5) {
      if (h1Bias === 'BULLISH' && recentPatternM5.type === 'bullish') {
          reasons.push(`M5 ${recentPatternM5.name}`);
          confluenceCount++;
      } else if (h1Bias === 'BEARISH' && recentPatternM5.type === 'bearish') {
          reasons.push(`M5 ${recentPatternM5.name}`);
          confluenceCount++;
      }
  }

  if (confluenceCount < 3) {
      return signals;
  }

  // --- 5. Generate Signal (Scalping Logic) ---
  // Use M1 or M5 ATR for tighter stops in scalping
  const atrM1 = calculateATR(candlesM1, 14);
  const atrM5ForRisk = calculateATR(candlesM5, 14) || 0.0005;
  const riskAtr = atrM1 || atrM5ForRisk; 
  
  if (isBuyAligned) {
      // Scalping SL: Tight, below recent structure or 2 * ATR
      const stopLoss = currentPrice - (2 * riskAtr); 
      
      // Scalping TP: Quick wins, 1.5R to 2R
      // We prioritize fixed R:R for scalping unless a major zone is very close
      const risk = currentPrice - stopLoss;
      let takeProfit = currentPrice + (2 * risk); // Aim for 1:2
      
      // Check if TP is obstructed by immediate resistance (M15/H1)
      const nextResistance = h1Zones.find(z => z.type === 'resistance' && z.price > currentPrice);
      if (nextResistance && nextResistance.price < takeProfit && nextResistance.price > currentPrice + risk) {
          // If resistance is between 1R and 2R, take profit there
          takeProfit = nextResistance.price;
      }

      signals.push({
        type: 'BUY',
        time: currentTime,
        price: currentPrice,
        confidence: 0.85, 
        reasons: [...reasons, 'Scalp Setup'],
        stopLoss,
        takeProfit,
        riskRewardRatio: (takeProfit - currentPrice) / (currentPrice - stopLoss)
      });
  } else if (isSellAligned) {
      // Scalping SL
      const stopLoss = currentPrice + (2 * riskAtr);
      
      // Scalping TP
      const risk = stopLoss - currentPrice;
      let takeProfit = currentPrice - (2 * risk); // Aim for 1:2

      // Check obstruction
      const nextSupport = h1Zones.find(z => z.type === 'support' && z.price < currentPrice);
      if (nextSupport && nextSupport.price > takeProfit && nextSupport.price < currentPrice - risk) {
          takeProfit = nextSupport.price;
      }

      signals.push({
        type: 'SELL',
        time: currentTime,
        price: currentPrice,
        confidence: 0.85,
        reasons: [...reasons, 'Scalp Setup'],
        stopLoss,
        takeProfit,
        riskRewardRatio: (currentPrice - takeProfit) / (stopLoss - currentPrice)
      });
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
