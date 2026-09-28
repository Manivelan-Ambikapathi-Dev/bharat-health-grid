import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Select, Spin } from 'antd';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getFootfall } from '../services/api.js';
import { formatDate, formatDecimal, formatNumber, shortPhcName } from '../utils/format.js';

function chartLabel(isoDate) {
  const formatted = formatDate(isoDate);
  return formatted.replace(/\s+\d{4}$/, '');
}

function FootfallTrendChart({ phcs, refreshKey }) {
  const [phcId, setPhcId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!phcs.length) {
      setPhcId(null);
      return;
    }
    setPhcId((current) => {
      if (current && phcs.some((phc) => phc.id === current)) {
        return current;
      }
      const baramati = phcs.find((phc) => phc.name.includes('Baramati'));
      return (baramati || phcs[0]).id;
    });
  }, [phcs]);

  useEffect(() => {
    if (!phcId) {
      setRows([]);
      return undefined;
    }

    let ignore = false;
    setLoading(true);
    setError('');
    getFootfall(phcId)
      .then((data) => {
        if (!ignore) {
          setRows(Array.isArray(data) ? data : []);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setRows([]);
          setError(requestError.message || 'The health grid API is unavailable.');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [phcId, refreshKey]);

  const chartRows = useMemo(
    () => [...rows]
      .sort((left, right) => String(left.date).localeCompare(String(right.date)))
      .map((row) => ({
        label: chartLabel(row.date),
        date: formatDate(row.date),
        total: row.total_patients,
        emergency: row.emergency_patients,
        outpatient: row.outpatient_patients,
      })),
    [rows],
  );

  const peakNote = useMemo(() => {
    if (chartRows.length < 2) {
      return '';
    }
    const peak = chartRows.reduce((best, row) => (row.total > best.total ? row : best), chartRows[0]);
    const others = chartRows.filter((row) => row !== peak);
    const baseline = others.reduce((sum, row) => sum + row.total, 0) / others.length;
    if (baseline > 0 && peak.total >= baseline * 1.8) {
      return `Highest day ${peak.date}: ${formatNumber(peak.total)} patients, well above the usual daily level.`;
    }
    return '';
  }, [chartRows]);

  const selected = phcs.find((phc) => phc.id === phcId);
  const recentAverage = chartRows.length
    ? chartRows.slice(-7).reduce((sum, row) => sum + row.total, 0) / Math.min(7, chartRows.length)
    : null;
  const previousWindow = chartRows.slice(-14, -7);
  const previousAverage = previousWindow.length
    ? previousWindow.reduce((sum, row) => sum + row.total, 0) / previousWindow.length
    : null;
  const trendPercent = recentAverage !== null && previousAverage
    ? ((recentAverage - previousAverage) / previousAverage) * 100
    : null;

  return (
    <Card
      className="section-card"
      title="Patient Demand Trend"
      extra={(
        <Select
          className="phc-select"
          placeholder="Select a PHC"
          value={phcId}
          onChange={setPhcId}
          options={phcs.map((phc) => ({
            value: phc.id,
            label: `${shortPhcName(phc.name)} · ${phc.district}`,
          }))}
          showSearch
          optionFilterProp="label"
          aria-label="PHC"
        />
      )}
    >
      <p className="card-subtitle">Recent patient visits and demand movement across PHCs.</p>
      {selected ? (
        <div className="chart-caption">{selected.name}, {selected.district}, {selected.state}</div>
      ) : null}
      {recentAverage !== null ? (
        <div className="metric-strip">
          <div className="metric-chip"><span>Recent 7-day average</span><strong>{formatDecimal(recentAverage)}</strong></div>
          <div className="metric-chip"><span>Previous 7-day average</span><strong>{previousAverage === null ? '—' : formatDecimal(previousAverage)}</strong></div>
          <div className="metric-chip">
            <span>Trend</span>
            <strong className={trendPercent > 0 ? 'trend-up' : trendPercent < 0 ? 'trend-down' : 'trend-flat'}>
              {trendPercent === null ? '—' : `${trendPercent > 0 ? '↑' : trendPercent < 0 ? '↓' : ''}${formatDecimal(Math.abs(trendPercent))}%`}
            </strong>
          </div>
        </div>
      ) : null}
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {loading ? (
        <div className="panel-loading"><Spin /> Loading footfall</div>
      ) : null}
      {!loading && !error && chartRows.length === 0 ? (
        <div className="empty-note">No footfall records are available for this PHC.</div>
      ) : null}
      {!loading && chartRows.length > 0 ? (
        <>
          {peakNote ? <Alert className="peak-note" type="warning" showIcon title={peakNote} /> : null}
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" minTickGap={24} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value, name) => [formatNumber(value), name]}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.date || _label}
                />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total patients" stroke="#0F2747" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="outpatient" name="Outpatient patients" stroke="#0369a1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="emergency" name="Emergency patients" stroke="#b45309" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </Card>
  );
}

export default FootfallTrendChart;
