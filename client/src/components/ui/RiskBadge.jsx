const TONE = {
  OUT_OF_STOCK: 'critical',
  CRITICAL: 'critical',
  HIGH: 'high',
  LOW: 'warning',
  MEDIUM: 'warning',
  EXCESS: 'excess',
  HEALTHY: 'healthy',
  NORMAL: 'healthy',
  SHORTAGE: 'critical',
  AVAILABLE: 'healthy',
};

function RiskBadge({ value }) {
  if (!value) {
    return null;
  }
  const tone = TONE[value] || 'neutral';
  return <span className={`risk-badge tone-${tone}`}>{String(value).replaceAll('_', ' ')}</span>;
}

export default RiskBadge;
