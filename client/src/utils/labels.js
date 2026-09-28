const SEVERITY_COLOR = {
  CRITICAL: 'red',
  HIGH: 'volcano',
  MEDIUM: 'gold',
  LOW: 'blue',
};

const STOCK_COLOR = {
  CRITICAL: 'red',
  LOW: 'orange',
  EXCESS: 'purple',
  OUT_OF_STOCK: 'magenta',
  HEALTHY: 'green',
};

const ALERT_MARK = {
  MEDICINE_STOCK_OUT: '🔴',
  LOW_STOCK: '🟠',
  NEAR_EXPIRY: '⚠️',
  HIGH_BED_OCCUPANCY: '🛏️',
  STAFF_SHORTAGE: '👨‍⚕️',
  FOOTFALL_SPIKE: '📈',
};

const STATUS_STYLE = {
  critical: { color: '#fff', background: '#cf1322', borderColor: '#cf1322' },
  attention: { color: '#613400', background: '#ffe58f', borderColor: '#d4b106' },
  normal: { color: '#135200', background: '#d9f7be', borderColor: '#389e0d' },
};

export { SEVERITY_COLOR, STOCK_COLOR, ALERT_MARK, STATUS_STYLE };
