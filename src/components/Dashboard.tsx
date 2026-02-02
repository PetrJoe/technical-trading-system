import React from 'react';
import { TradingSignal } from '@/utils/types';
import './Dashboard.css';

interface DashboardProps {
  h1Bias: 'BULLISH' | 'BEARISH' | 'RANGE';
  m15Status: 'VALID' | 'WAIT' | 'INVALID';
  m5Confirmation: 'BUY BIAS' | 'SELL BIAS' | 'NO CONFIRMATION';
  m1Trigger: 'BUY' | 'SELL' | 'WAIT';
  currentSignal: TradingSignal | null;
}

const Dashboard: React.FC<DashboardProps> = ({
  h1Bias,
  m15Status,
  m5Confirmation,
  m1Trigger,
  currentSignal,
}) => {
  let finalStatus = 'SCANNING MARKET';
  let statusType = 'scanning';
  let statusIcon = '🔍';
  
  if (currentSignal) {
    if (currentSignal.type === 'BUY') {
      finalStatus = 'BUY SIGNAL ACTIVE';
      statusType = 'buy';
      statusIcon = '🚀';
    } else {
      finalStatus = 'SELL SIGNAL ACTIVE';
      statusType = 'sell';
      statusIcon = '🔻';
    }
  } else if (m15Status === 'VALID' && m5Confirmation !== 'NO CONFIRMATION') {
    finalStatus = 'POTENTIAL SETUP';
    statusType = 'potential';
    statusIcon = '⚠️';
  }

  const getBadgeType = (bias: string) => {
    if (bias === 'BULLISH' || bias === 'VALID' || bias === 'BUY BIAS' || bias === 'BUY') 
      return 'bullish';
    if (bias === 'BEARISH' || bias === 'INVALID' || bias === 'SELL BIAS' || bias === 'SELL') 
      return 'bearish';
    return 'neutral';
  };

  return (
    <div className="dashboard-container">
      
      {/* 1. Main Status Box */}
      <div className={`status-box ${statusType}`}>
        <div className="status-header">
            <span className="status-icon">{statusIcon}</span>
            <div className={`status-text ${statusType}`}>
            {finalStatus}
            </div>
        </div>
        
        {currentSignal && (
          <div className="signal-details">
            <div className="detail-row">
               <span>Confidence</span>
               <span className={`detail-value ${statusType}`}>{(currentSignal.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="detail-row">
               <span>Entry</span>
               <span className="detail-value price">{currentSignal.price.toFixed(4)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Analysis Grid (H1 -> M1) */}
      <div className="analysis-grid">
        {[
            { label: 'H1 TREND', val: h1Bias, display: h1Bias.substring(0, 4) },
            { label: 'M15 SETUP', val: m15Status, display: m15Status },
            { label: 'M5 CONF', val: m5Confirmation, display: m5Confirmation === 'BUY BIAS' ? 'BUY' : m5Confirmation === 'SELL BIAS' ? 'SELL' : 'NO' },
            { label: 'M1 TRIG', val: m1Trigger, display: m1Trigger }
        ].map((item, idx) => (
            <div key={idx} className="analysis-card">
                <div className="card-header">
                    <span className="card-label">{item.label}</span>
                    <span className={`card-badge ${getBadgeType(item.val)}`}>
                        {item.display}
                    </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="progress-bar-container">
                    <div 
                        className="progress-bar"
                        style={{
                            width: item.val === 'WAIT' || item.val === 'NO CONFIRMATION' ? '0%' : '100%',
                            backgroundColor: getBadgeType(item.val) === 'bullish' ? '#34d399' : 
                                           getBadgeType(item.val) === 'bearish' ? '#f87171' : '#334155',
                            opacity: item.val === 'WAIT' || item.val === 'NO CONFIRMATION' ? 0.3 : 1
                        }}
                    />
                </div>
            </div>
        ))}
      </div>

      {/* 3. Trade Management (TP/SL) */}
      {currentSignal ? (
        <div className={`trade-management ${currentSignal.type === 'BUY' ? 'buy' : 'sell'}`}>
           <div className="trade-column">
              <span className="trade-label">Take Profit</span>
              <span className="trade-value tp">{currentSignal.takeProfit.toFixed(4)}</span>
           </div>
           <div className="trade-divider"></div>
           <div className="trade-column">
              <span className="trade-label">Stop Loss</span>
              <span className="trade-value sl">{currentSignal.stopLoss.toFixed(4)}</span>
           </div>
           <div className="trade-divider"></div>
           <div className="trade-column risk-column">
              <span className="trade-label trade-label-risk">Risk:Reward</span>
              <span className="trade-value rr">1:{currentSignal.riskRewardRatio.toFixed(1)}</span>
           </div>
        </div>
      ) : (
        <div className="waiting-box">
           <div className="pulse-dot"></div>
           <span className="waiting-text">WAITING FOR SIGNAL...</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
