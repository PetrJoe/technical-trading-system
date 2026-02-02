# 📋 Enhanced Multi-Timeframe Trading AI Instruction (With Indicators & Signals)

## 🎯 Objective

Enable top-down market analysis across H1, M15, M5, and M1 timeframes using price action, structure, and relevant indicators to generate high-probability BUY or SELL signals.

---

## ⏱ H1 Timeframe — Trend Bias & Major Zones

- Use EMA 50 & EMA 200 to determine trend bias:
    - Bullish: EMA 50 > EMA 200 and price above both
    - Bearish: EMA 50 < EMA 200 and price below both
- Optionally use RSI (14) for momentum confirmation.
- Identify market structure (HH/HL or LH/LL), major support/resistance, supply/demand zones, and previous highs/lows.
- Output: Trend Bias (BULLISH / BEARISH / RANGE). Only allow trades in trend direction.

---

## ⏱ M15 Timeframe — Setup Detection

- Use EMA 20 & EMA 50 for pullback validation in trend direction.
- RSI (14): Bullish setup if RSI pulls back to 40–50 then turns up; bearish if 50–60 then turns down.
- Detect retracement into H1 key zone, consolidation, minor structure shift in H1 bias direction, and EMA confluence.
- Output: Setup Status (VALID / WAIT / INVALID).

---

## ⏱ M5 Timeframe — Trade Confirmation

- Use EMA 9 & EMA 21 for momentum confirmation (crosses in trend direction).
- Volume (if available): Rising volume on breakout strengthens confirmation.
- Look for break of minor structure, impulse move in H1 direction, EMA cross with momentum, and rejection from setup zone.
- Output: Confirmation (BUY BIAS / SELL BIAS / NO CONFIRMATION).

---

## ⏱ M1 Timeframe — Precision Entry (Optional)

- Use EMA 9 & EMA 21 for fine-tuning entry.
- Look for micro break & retest, small consolidation breakout, and rejection candle aligned with M5 signal.

---

## 📐 Trade Signal Generation Logic

- BUY Signal: H1 trend = Bullish, price at H1 support/demand, M15 setup = VALID, M5 confirmation = BUY BIAS.
- SELL Signal: H1 trend = Bearish, price at H1 resistance/supply, M15 setup = VALID, M5 confirmation = SELL BIAS.
- NO TRADE: H1 trend unclear, M15 setup invalid, or no M5 confirmation.

---

## 📉 Risk & Trade Management Rules

- Risk per trade: 0.5% – 1%
- Stop loss: Beyond recent structure on M5 or M1
- Take profit: Next H1 key level or fixed RR (minimum 1:2)

---

## 📊 Chart Display Requirements

- H1: Trend direction label, key zones marked
- M15: Setup zone highlighted
- M5: Entry confirmation point
- Final overlay text: 🟢 BUY, 🔴 SELL, ⚪ WAIT

---

## 🧠 Priority Logic

- Prioritize: 1) Market structure, 2) H1 bias & zones, 3) Multi-timeframe alignment, 4) Indicators as confirmation only.
- Indicators must never override price structure.

---

## 🔁 Consistency Boosters

- Require minimum 2-candle alignment (M5 & M1) before firing signal.
- Add ATR-based filter: skip if ATR(14) on M5 < 0.3 × 20-period average (avoids chop).
- Time filter: signals only between 06:00–18:00 server time (avoids low-liquidity).
- Confluence count ≥ 3 (e.g., structure + EMA + RSI) to upgrade WAIT → VALID.

---

## 📌 Always-On Vertical Dashboard (top-left, pinned)


style all the content on the page with css and make them look professional and modern with a dark theme and a modern font like inter font family and a modern font size like 16px 