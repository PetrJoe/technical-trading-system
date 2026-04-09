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
    </div>
  );
};

export default Dashboard;
