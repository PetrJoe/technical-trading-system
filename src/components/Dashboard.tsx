import React from 'react';
import { TradingSignal } from '@/utils/types';
import './Dashboard.css';

interface DashboardProps {
  status: 'SCANNING' | 'SETUP' | 'CONFIRMATION' | 'ENTRY';
  signal?: TradingSignal | null;
  strategy: 'standard' | 'scalping';
  onStrategyChange: (s: 'standard' | 'scalping') => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  status,
  signal,
  strategy,
  onStrategyChange
}) => {
  const getStatusColor = (s: string) => {
    switch (s) {
        case 'ENTRY': return '#10b981'; // Green
        case 'CONFIRMATION': return '#f59e0b'; // Amber
        case 'SETUP': return '#3b82f6'; // Blue
        default: return '#64748b'; // Slate
    }
  };

  return (
    <div className="dashboard-container">
      
      {/* Strategy Toggle */}
      <div className="strategy-toggle">
        <button 
          className={`strategy-btn ${strategy === 'standard' ? 'active' : ''}`}
          onClick={() => onStrategyChange('standard')}
        >
          Standard (Trend)
        </button>
        <button 
          className={`strategy-btn ${strategy === 'scalping' ? 'active' : ''}`}
          onClick={() => onStrategyChange('scalping')}
        >
          Scalping (M5/M1)
        </button>
      </div>

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
                <span className="value">{signal ? signal.price.toFixed(5) : '---'}</span>
                {signal && (
                    <span className={`type-tag ${signal.type === 'BUY' ? 'bullish' : 'bearish'}`}>
                        {signal.type}
                    </span>
                )}
            </div>
            <div className="signal-row">
                <span className="label">TP:</span> <span className="value">{signal ? signal.takeProfit.toFixed(5) : '---'}</span>
            </div>
            <div className="signal-row">
                <span className="label">SL:</span> <span className="value">{signal ? signal.stopLoss.toFixed(5) : '---'}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
