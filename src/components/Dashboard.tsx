import React from 'react';
import './Dashboard.css';

interface DashboardProps {
  h1Bias: 'BULLISH' | 'BEARISH' | 'RANGE';
}

const Dashboard: React.FC<DashboardProps> = ({
  h1Bias,
}) => {
  const getBadgeType = (bias: string) => {
    if (bias === 'BULLISH') return 'bullish';
    if (bias === 'BEARISH') return 'bearish';
    return 'neutral';
  };

  return (
    <div className="dashboard-container">
      
      {/* 1. Main Status Box */}
      <div className="status-box scanning">
        <div className="status-header">
            <span className="status-icon">📊</span>
            <div className="status-text scanning">
            MARKET OVERVIEW
            </div>
        </div>
      </div>

      {/* 2. Analysis Grid (H1 Trend Only) */}
      <div className="analysis-grid">
        <div className="analysis-card">
            <div className="card-header">
                <span className="card-label">H1 TREND</span>
                <span className={`card-badge ${getBadgeType(h1Bias)}`}>
                    {h1Bias}
                </span>
            </div>
            {/* Visual Progress Bar */}
            <div className="progress-bar-container">
                <div 
                    className="progress-bar"
                    style={{
                        width: '100%',
                        backgroundColor: getBadgeType(h1Bias) === 'bullish' ? '#34d399' : 
                                       getBadgeType(h1Bias) === 'bearish' ? '#f87171' : '#334155',
                    }}
                />
            </div>
        </div>
      </div>

      {/* 3. Info Box */}
      <div className="waiting-box">
          <div className="pulse-dot"></div>
          <span className="waiting-text">MONITORING PRICE ACTION</span>
      </div>
    </div>
  );
};

export default Dashboard;
