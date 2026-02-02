You are implementing a multi-timeframe trading signal system using pure price action (no indicators unless explicitly added).

Timeframes used:

* H1 → trend bias & market structure
* M15 → setup zone (pullback, consolidation, key level)
* M5 → confirmation (structure break or candle pattern)
* M1 → precise entry trigger

---

### 🧠 Core Concepts to Implement

#### 1. Market Structure (H1)

Define trend:

Uptrend if:

* consecutive Higher Highs (HH)
* consecutive Higher Lows (HL)

Downtrend if:

* consecutive Lower Highs (LH)
* consecutive Lower Lows (LL)

Store:

* recent swing highs/lows
* trend direction

Only allow trades in trend direction.

---

#### 2. Setup Zone (M15)

Detect when price reaches:

In uptrend:

* previous H1 higher low
* support zone
* consolidation range low

In downtrend:

* previous H1 lower high
* resistance zone
* consolidation range high

Mark zone as “active setup”.

---

#### 3. Confirmation (M5)

Wait for one of the following inside setup zone:

STRUCTURE BREAK:

* Uptrend → break above recent minor lower high
* Downtrend → break below recent minor higher low

OR

CANDLE SIGNAL:

* Pin bar rejecting zone
* Engulfing candle in trend direction
* Inside bar breakout in trend direction

When confirmation occurs → allow entry.

---

#### 4. Entry Trigger (M1)

Enter trade when:

Option A:

* Micro pullback after M5 structure break

Option B:

* Break of confirmation candle high/low

Stop Loss:

* Beyond recent M1 swing
  OR
* Beyond M5 confirmation structure

Take Profit:

* Next H1 swing high/low
  OR
* Risk:Reward minimum 1:2

---

### 🧩 Required Functions (suggested)

Implement functions such as:

* detect_market_structure(timeframe)
* get_trend_direction(H1)
* identify_swing_points(timeframe)
* detect_pullback_zone(M15, H1_structure)
* detect_candle_patterns(M5)
* detect_structure_break(M5)
* trigger_entry(M1)
* calculate_stop_loss()
* calculate_take_profit()

---

### 🚦 Signal Output Format

Return structured signal object:

Example:

{
"bias": "bullish",
"setup_zone": true,
"confirmation": "structure_break",
"entry": {
"type": "buy",
"price": 1.2345,
"stop_loss": 1.2320,
"take_profit": 1.2400
},
"timeframes_used": ["H1","M15","M5","M1"]
}

---

### ⚠️ Filters to Include

* Do not trade if H1 trend unclear (range/chop)
* Ignore weak breakouts (wick only, no close)
* One active trade per direction

---

### 🎯 Goal

Create a deterministic, rule-based signal generator that:

* Uses H1 for bias
* M15 for location
* M5 for confirmation
* M1 for execution

No indicators required unless added later.
