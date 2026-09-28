function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatDecimal(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
}

function formatDate(isoDate) {
  if (!isoDate) {
    return '—';
  }
  const [year, month, day] = String(isoDate).split('-').map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shortPhcName(name) {
  return String(name || '').replace(/^Government PHC,\s*/i, '');
}

export { formatNumber, formatDecimal, formatDate, shortPhcName };
