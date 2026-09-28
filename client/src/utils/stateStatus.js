function deriveResourceStatus(alerts, criticalStockCount = 0, lowStockCount = 0) {
  const hasCriticalAlert = alerts.some((alert) => alert.severity === 'CRITICAL');
  const hasAttentionAlert = alerts.some(
    (alert) => alert.severity === 'HIGH' || alert.severity === 'MEDIUM',
  );

  if (hasCriticalAlert || criticalStockCount > 0) {
    return 'critical';
  }
  if (hasAttentionAlert || lowStockCount > 0) {
    return 'attention';
  }
  return 'normal';
}

function deriveStateStatus(summaryRow, stateAlerts) {
  return deriveResourceStatus(
    stateAlerts,
    summaryRow.critical_stock_count,
    summaryRow.low_stock_count,
  );
}

const STATUS_LABEL = {
  critical: 'Critical',
  attention: 'Attention',
  normal: 'Healthy',
};

const STATUS_COLOR = {
  critical: 'red',
  attention: 'gold',
  normal: 'green',
};

export { deriveResourceStatus, deriveStateStatus, STATUS_LABEL, STATUS_COLOR };
