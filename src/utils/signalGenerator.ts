import { Candle, TradingSignal, FibonacciLevel } from './types';
import { isAtKeyFibZone } from './fibonacci';
import { 
  analyzeTrendBias, 
  findSupportResistanceZones, 
  isPriceNearZone, 
  detectMomentum, 
  calculateRSI, 
  calculateATR, 
  calculateEMA 
} from './technicalAnalysis';

/**
 * Generate trading signals based on AI-driven top-down multi-timeframe analysis
 * Strategy: H1 Trend/Zone -> M15 Setup -> M5 Confirmation
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
    candlesM1.length < 50 ||
    candlesM5.length < 50 ||
    candlesM15.length < 50 ||
    candles1H.length < 200 // Need 200 for H1 EMA200
  ) {
    return signals;
  }

  const currentPrice = candlesM1[candlesM1.length - 1].close;
  const currentTime = candlesM1[candlesM1.length - 1].time;

  // --- STEP 1: H1 Timeframe (Trend Bias & Major Zones) ---
  const h1TrendBias = analyzeTrendBias(candles1H);
  
  // Identify H1 Zones
  const h1Zones = findSupportResistanceZones(candles1H, 100);
  const nearH1Zone = isPriceNearZone(currentPrice, h1Zones, 0.003); // 0.3% tolerance

  // If Range, we generally wait, unless at extremes? 
  // Requirement says: "Only allow trades in trend direction."
  // So if Range, NO TRADE (or WAIT).

  // --- STEP 2: M15 Timeframe (Setup Detection) ---
  // RSI (14)
  const m15RSI = calculateRSI(candlesM15, 14);
  // Previous RSI for "turns up/down" check
  const m15RSIPrev = calculateRSI(candlesM15.slice(0, -1), 14);

  let m15Setup: 'VALID' | 'WAIT' | 'INVALID' = 'INVALID';
  
  if (h1TrendBias === 'bullish') {
    // Bullish Setup: RSI pulls back to 40-50 then turns up
    if (m15RSI && m15RSIPrev) {
        // Check if RSI was in 40-50 zone recently or is currently
        const rsiInZone = m15RSI >= 40 && m15RSI <= 55; // Expanded slightly
        
        if (rsiInZone || (m15RSI > 50 && m15RSIPrev <= 50)) {
            m15Setup = 'VALID';
        } else {
            m15Setup = 'WAIT';
        }
    }
  } else if (h1TrendBias === 'bearish') {
    // Bearish Setup: RSI rallies to 50-60 then turns down
    if (m15RSI && m15RSIPrev) {
        const rsiInZone = m15RSI >= 45 && m15RSI <= 60;
        
        if (rsiInZone || (m15RSI < 50 && m15RSIPrev >= 50)) {
            m15Setup = 'VALID';
        } else {
            m15Setup = 'WAIT';
        }
    }
  }

  // Check for retracement into H1 key zone
  // Note: nearH1Zone is calculated on currentPrice (M1) but relative to H1 zones
  const validZoneRetracement = nearH1Zone && (
    (h1TrendBias === 'bullish' && nearH1Zone.type === 'support') ||
    (h1TrendBias === 'bearish' && nearH1Zone.type === 'resistance')
  );

  // --- STEP 3: M5 Timeframe (Trade Confirmation) ---
  const m5EMA9 = calculateEMA(candlesM5, 9);
  const m5EMA21 = calculateEMA(candlesM5, 21);
  const m5EMA9Prev = calculateEMA(candlesM5.slice(0, -1), 9);
  const m5EMA21Prev = calculateEMA(candlesM5.slice(0, -1), 21);

  let m5Confirmation: 'BUY BIAS' | 'SELL BIAS' | 'NO CONFIRMATION' = 'NO CONFIRMATION';

  if (m5EMA9 && m5EMA21 && m5EMA9Prev && m5EMA21Prev) {
      const bullishCross = m5EMA9Prev <= m5EMA21Prev && m5EMA9 > m5EMA21;
      const bearishCross = m5EMA9Prev >= m5EMA21Prev && m5EMA9 < m5EMA21;
      const bullishAligned = m5EMA9 > m5EMA21;
      const bearishAligned = m5EMA9 < m5EMA21;

      if (h1TrendBias === 'bullish') {
          if (bullishCross || (bullishAligned && detectMomentum(candlesM5) === 'bullish')) {
              m5Confirmation = 'BUY BIAS';
          }
      } else if (h1TrendBias === 'bearish') {
          if (bearishCross || (bearishAligned && detectMomentum(candlesM5) === 'bearish')) {
              m5Confirmation = 'SELL BIAS';
          }
      }
  }

  // --- STEP 4: Generate Signal ---
  
  // Calculate ATR for SL/TP
  const atrM15 = calculateATR(candlesM15, 14) || 0.0010;

  // Initialize reasons array
  const reasons: string[] = [];
  let confidence = 0;

  // Logic: 
  // BUY: H1 Trend Bullish + (M15 Valid OR Zone Support) + M5 Buy Bias
  // SELL: H1 Trend Bearish + (M15 Valid OR Zone Resistance) + M5 Sell Bias
  
  let signalType: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';

  if (h1TrendBias === 'bullish') {
      reasons.push('H1 Trend: Bullish');
      confidence += 0.3;

      if (validZoneRetracement) {
          reasons.push(`H1 Support: ${nearH1Zone!.price.toFixed(4)}`);
          confidence += 0.2;
      }

      if (m15Setup === 'VALID') {
          reasons.push('M15 Setup: Valid (RSI Pullback)');
          confidence += 0.2;
      }

      if (m5Confirmation === 'BUY BIAS') {
          reasons.push('M5 Confirmation: EMA 9/21 Cross/Aligned');
          confidence += 0.3;
      }

      // Check Fibs
      if (fibLevels) {
          const fibCheck = isAtKeyFibZone(currentPrice, fibLevels);
          if (fibCheck) {
              reasons.push(`Fib Level: ${fibCheck.level.level}%`);
              confidence += 0.1;
          }
      }

      // Final Decision
      if (confidence >= 0.7 && m5Confirmation === 'BUY BIAS') {
          signalType = 'BUY';
      }
  } else if (h1TrendBias === 'bearish') {
      reasons.push('H1 Trend: Bearish');
      confidence += 0.3;

      if (validZoneRetracement) {
          reasons.push(`H1 Resistance: ${nearH1Zone!.price.toFixed(4)}`);
          confidence += 0.2;
      }

      if (m15Setup === 'VALID') {
          reasons.push('M15 Setup: Valid (RSI Pullback)');
          confidence += 0.2;
      }

      if (m5Confirmation === 'SELL BIAS') {
          reasons.push('M5 Confirmation: EMA 9/21 Cross/Aligned');
          confidence += 0.3;
      }

      // Check Fibs
       if (fibLevels) {
          const fibCheck = isAtKeyFibZone(currentPrice, fibLevels);
          if (fibCheck) {
              reasons.push(`Fib Level: ${fibCheck.level.level}%`);
              confidence += 0.1;
          }
      }

      if (confidence >= 0.7 && m5Confirmation === 'SELL BIAS') {
          signalType = 'SELL';
      }
  } else {
      reasons.push('H1 Trend: Range/Sideways');
      confidence = 0.5; // Neutral
  }

  // If we are waiting, provide context why
  if (signalType === 'WAIT') {
      if (h1TrendBias !== 'range') {
          if (m15Setup !== 'VALID' && !nearH1Zone) reasons.push('Waiting for M15 Setup or Zone');
          if (m5Confirmation === 'NO CONFIRMATION') reasons.push('Waiting for M5 Confirmation');
      }
  }

  const stopLoss = signalType === 'BUY' 
      ? currentPrice - (1.5 * atrM15) 
      : currentPrice + (1.5 * atrM15);
      
  const takeProfit = signalType === 'BUY'
      ? currentPrice + (3.0 * atrM15)
      : currentPrice - (3.0 * atrM15);

  // Return the signal (always return one "current status" signal)
  signals.push({
      type: signalType,
      time: currentTime,
      price: currentPrice,
      confidence: Math.min(confidence, 1),
      reasons,
      stopLoss,
      takeProfit,
      riskRewardRatio: 2.0
  });

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
  if (signal.type === 'BUY') return '#10b981';
  if (signal.type === 'SELL') return '#ef4444';
  return '#64748b'; // Slate for WAIT
}
