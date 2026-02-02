import React from 'react';
import './Dashboard.css';

interface DashboardProps {
  h1Bias: 'BULLISH' | 'BEARISH' | 'RANGE';
  m15Status: 'VALID' | 'WAIT' | 'INVALID';
  m5Confirmation: 'BUY BIAS' | 'SELL BIAS' | 'NO CONFIRMATION';
  m1Trigger: 'BUY' | 'SELL' | 'WAIT';
}

const Dashboard: React.FC<DashboardProps> = ({
  h1Bias,
  m15Status,
  m5Confirmation,
  m1Trigger,
}) => {
  let finalStatus = 'SCANNING MARKET';
  let statusType = 'scanning';
  let statusIcon = '🔍';
  
  if (m15Status === 'VALID' && m5Confirmation !== 'NO CONFIRMATION') {
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

      {/* 3. Trade Management (TP/SL) - REMOVED */}
      <div className="waiting-box">
          <div className="pulse-dot"></div>
          <span className="waiting-text">MARKET ANALYSIS ACTIVE</span>
      </div>
    </div>
  );
};

export default Dashboard;
