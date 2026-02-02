import React from 'react';
import { TradingSignal } from '@/utils/types';
import './Dashboard.css';

interface DashboardProps {
  status: 'SCANNING' | 'SETUP' | 'CONFIRMATION' | 'ENTRY';
  signal?: TradingSignal | null;
  strategy: 'standard' | 'scalping';
  onStrategyChange: (s: 'standard' | 'scalping') => void;
  currentPrice?: number;
  trend?: 'bullish' | 'bearish' | 'range';
}

const Dashboard: React.FC<DashboardProps> = ({
  status,
  signal,
  strategy,
  onStrategyChange,
  currentPrice,
  trend
}) => {
  const getStatusColor = (s: string) => {
    switch (s) {
        case 'ENTRY': return '#10b981'; // Green
        case 'CONFIRMATION': return '#f59e0b'; // Amber
        case 'SETUP': return '#3b82f6'; // Blue
        default: return '#64748b'; // Slate
    }
  };

  const getProjectedLevels = () => {
    if (!currentPrice || !trend || trend === 'range') return null;
    
    // Determine pip size based on price (standard vs JPY/Indices)
    const pipSize = currentPrice < 50 ? 0.0001 : 0.01;
    const tpPips = 10;
    const slPips = 5;
    
    if (trend === 'bullish') {
      return {
        tp: (currentPrice + (tpPips * pipSize)).toFixed(5),
        sl: (currentPrice - (slPips * pipSize)).toFixed(5)
      };
    } else {
      // Bearish
      return {
        tp: (currentPrice - (tpPips * pipSize)).toFixed(5),
        sl: (currentPrice + (slPips * pipSize)).toFixed(5)
      };
    }
  };

  const projected = !signal && strategy === 'scalping' ? getProjectedLevels() : null;

  return (
    <div className="dashboard-container">
      
      {/* 1. Main Status Box */}
      <div className="status-box" style={{ borderColor: getStatusColor(status) }}>
        <div className="status-header">
            <span className="status-icon">
                {status === 'ENTRY' ? '🚀' : status === 'CONFIRMATION' ? '⚠️' : status === 'SETUP' ? '👀' : '📊'}
            </span>
            <div className="status-text" style={{ color: getStatusColor(status) }}>
                {status === 'ENTRY' ? 'TRADE ENTRY TRIGGERED' : 
                 status === 'CONFIRMATION' ? 'AWAITING CONFIRMATION' : 
                 status === 'SETUP' ? 'SETUP DETECTED' : 'SCANNING MARKETS'}
            </div>
        </div>
        
        <div className="signal-details">
            <div className="signal-row">
                <span className="label">ENTRY:</span> 
                <span className="value">{signal ? signal.price.toFixed(5) : currentPrice ? currentPrice.toFixed(5) : '---'}</span>
                {signal && (
                    <span className={`type-tag ${signal.type === 'BUY' ? 'bullish' : 'bearish'}`}>
                        {signal.type}
                    </span>
                )}
                {!signal && trend && trend !== 'range' && (
                    <span className={`type-tag ${trend === 'bullish' ? 'bullish' : 'bearish'}`}>
                        {trend.toUpperCase()} BIAS
                    </span>
                )}
            </div>
            <div className="signal-row">
                <span className="label">TP:</span> 
                <span className="value">
                  {signal 
                    ? signal.takeProfit.toFixed(5) 
                    : projected ? projected.tp : '---'
                  }
                </span>
            </div>
            <div className="signal-row">
                <span className="label">SL:</span> 
                <span className="value">
                  {signal 
                    ? signal.stopLoss.toFixed(5) 
                    : projected ? projected.sl : '---'
                  }
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
