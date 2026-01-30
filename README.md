# Deriv Advanced Technical Analysis Platform

A sophisticated real-time technical analysis platform for Deriv markets featuring multi-timeframe analysis, Fibonacci retracements, candlestick pattern detection, and automated signal generation.

## 🚀 Features

### 📊 Multi-Timeframe Analysis
- **4 Synchronized Charts**: M1, M5, M15, and 1H timeframes displayed simultaneously
- **1H Chart**: Primary trend identification and overall market direction
- **M15 & M5 Charts**: Market structure confirmation, momentum, and key support/resistance zones
- **M1 Chart**: Precise entry and exit timing

### 📐 Fibonacci Retracement
- Automatic detection of significant swing highs and lows
- Dynamic Fibonacci levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%
- **Golden Zone Highlighting**: Special emphasis on 38.2%, 50%, and 61.8% levels
- Visual Fibonacci level overlay on charts
- Real-time retracement calculations

### 🕯️ Candlestick Pattern Detection
**Bullish Patterns:**
- Hammer
- Inverted Hammer
- Bullish Engulfing
- Morning Star
- Piercing Line

**Bearish Patterns:**
- Shooting Star
- Hanging Man
- Bearish Engulfing
- Evening Star
- Dark Cloud Cover

**Indecision Patterns:**
- Doji
- Spinning Top

### 📈 Technical Analysis
- **Trend Analysis**: EMA-based trend detection (EMA 20, EMA 50)
- **Support & Resistance**: Automated zone identification using pivot points
- **Momentum Detection**: RSI and price action momentum analysis
- **Volatility Measurement**: Average True Range (ATR) calculation

### 🎯 Automated Signal Generation

**BUY Signal Conditions:**
- 1H bullish trend confirmed
- Price retraces to 38.2%, 50%, or 61.8% Fibonacci level
- Price aligns with support zone
- Bullish candlestick pattern detected
- Bullish momentum confirmation

**SELL Signal Conditions:**
- 1H bearish trend confirmed
- Price retraces to 38.2%, 50%, or 61.8% Fibonacci level
- Price aligns with resistance zone
- Bearish candlestick pattern detected
- Bearish momentum confirmation

### 📊 Signal Confidence Scoring
- Multi-factor confidence calculation
- Only signals with 65%+ confidence are displayed
- Clear reasoning for each signal
- Real-time signal updates

## 🛠️ Technology Stack

- **Framework**: Next.js 16 with React 19
- **Language**: TypeScript
- **Charting**: Lightweight Charts by TradingView
- **Styling**: Tailwind CSS
- **Real-time Data**: Deriv WebSocket API

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🏗️ Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main dashboard with 4-chart layout
│   ├── layout.tsx            # App layout
│   └── globals.css           # Global styles
├── components/
│   ├── MultiTimeframeChart.tsx   # Enhanced chart component
│   └── CandlestickChart.tsx      # Legacy single chart
└── utils/
    ├── types.ts                  # TypeScript interfaces
    ├── fibonacci.ts              # Fibonacci calculations
    ├── candlestickPatterns.ts    # Pattern detection algorithms
    ├── technicalAnalysis.ts      # Trend, S/R, RSI, ATR
    └── signalGenerator.ts        # Signal generation logic
```

## 📖 How It Works

1. **Data Collection**: Real-time candlestick data is fetched via Deriv WebSocket for all 4 timeframes
2. **Trend Analysis**: The 1H chart determines the overall market direction using EMA analysis
3. **Structure Confirmation**: M15 and M5 charts validate the trend and identify key levels
4. **Pattern Detection**: All timeframes are scanned for candlestick patterns
5. **Fibonacci Analysis**: Recent swing points are identified and Fibonacci levels are calculated
6. **Signal Generation**: When all conditions align (trend + Fibonacci + pattern + momentum), a BUY/SELL signal is generated
7. **Visual Display**: Signals, patterns, and levels are displayed on all charts with confidence scores

## 🎨 Visual Features

- **Dark Theme**: Professional trading interface
- **Color-Coded Signals**: Green for BUY, Red for SELL
- **Pattern Markers**: Visual indicators for detected patterns
- **Fibonacci Lines**: Golden zone levels highlighted in amber
- **Support/Resistance**: Semi-transparent horizontal zones
- **Trend Indicators**: Emoji-based trend direction display
- **Real-time Updates**: Live market data and analysis

## 📊 Signal Display

When a high-probability trading opportunity is detected:
- Large, prominent signal display with type (BUY/SELL)
- Confidence percentage (65-100%)
- Entry price
- Detailed reasoning breakdown
- Contributing factors (Fibonacci level, pattern, momentum, etc.)

## 🔧 Configuration

Edit the symbol in `page.tsx`:
```typescript
symbol="R_50"  // Change to any Deriv symbol
```

## 🚀 Build for Production

```bash
npm run build
npm start
```

## 📝 License

MIT

## 🙏 Credits

- **Charts**: [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) by TradingView
- **Market Data**: [Deriv API](https://api.deriv.com/)
- **Framework**: [Next.js](https://nextjs.org/)

---

**Note**: This is a technical analysis tool for educational purposes. Always conduct your own research and risk management before trading.
