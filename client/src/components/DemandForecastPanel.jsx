import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Row, Select, Spin, Statistic, Table, Tag, Typography } from 'antd';
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
import {
  analyzeForecast,
  getDemandForecast,
  getFootfall,
  getForecastAlerts,
  getMedicineForecast,
} from '../services/api.js';
import { formatDate, formatDecimal, formatNumber, shortPhcName } from '../utils/format.js';
import { SEVERITY_COLOR } from '../utils/labels.js';

const RISK_COLOR = {
  CRITICAL: 'red',
  HIGH: 'volcano',
  MEDIUM: 'gold',
  LOW: 'blue',
  HEALTHY: 'green',
};

function chartLabel(isoDate) {
  return formatDate(isoDate).replace(/\s+\d{4}$/, '');
}

function addDays(isoDate, count) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function inState(row, selectedState) {
  return !selectedState || selectedState === 'all' || row.state === selectedState;
}

function RiskTag({ risk }) {
  return <Tag color={RISK_COLOR[risk] || 'default'}>{risk}</Tag>;
}

function trendText(phc) {
  const trend = phc?.historical?.trend_percent;
  if (trend === null || trend === undefined) {
    return 'Insufficient history to judge demand direction.';
  }
  if (trend > 0) {
    return `Rising demand. Recent 7-day visits are ${formatDecimal(trend)}% above the previous 7 days.`;
  }
  if (trend < 0) {
    return `Falling demand. Recent 7-day visits are ${formatDecimal(Math.abs(trend))}% below the previous 7 days.`;
  }
  return 'Stable demand. Recent 7-day visits match the previous 7 days.';
}

function DemandForecastPanel({ selectedState = 'all', refreshKey = 0 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demand, setDemand] = useState(null);
  const [medicine, setMedicine] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [phcId, setPhcId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    Promise.all([getDemandForecast(), getMedicineForecast(), getForecastAlerts()])
      .then(([demandData, medicineData, alertRows]) => {
        if (ignore) {
          return;
        }
        setDemand(demandData);
        setMedicine(medicineData);
        setAlerts(Array.isArray(alertRows) ? alertRows : []);
      })
      .catch((requestError) => {
        if (!ignore) {
          setDemand(null);
          setMedicine(null);
          setAlerts([]);
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
  }, [refreshKey]);

  const phcForecasts = useMemo(
    () => (demand?.phcs || []).filter((row) => inState(row, selectedState)),
    [demand, selectedState],
  );
  const medicineRows = useMemo(
    () => (medicine?.forecasts || []).filter((row) => inState(row, selectedState)),
    [medicine, selectedState],
  );
  const alertRows = useMemo(
    () => alerts.filter((row) => inState(row, selectedState)),
    [alerts, selectedState],
  );
  const criticalCount = medicineRows.filter((row) => row.risk === 'CRITICAL').length;
  const highCount = medicineRows.filter((row) => row.risk === 'HIGH').length;
  const risingCount = phcForecasts.filter((row) => (row.historical?.trend_percent ?? 0) > 0).length;
  const selectedForecast = phcForecasts.find((row) => row.phc_id === phcId) || null;

  useEffect(() => {
    if (!phcForecasts.length) {
      setPhcId(null);
      return;
    }
    setPhcId((current) => {
      if (current && phcForecasts.some((row) => row.phc_id === current)) {
        return current;
      }
      const baramati = phcForecasts.find((row) => row.phc_name.includes('Baramati'));
      return (baramati || phcForecasts[0]).phc_id;
    });
  }, [phcForecasts]);

  useEffect(() => {
    if (!phcId) {
      setHistory([]);
      return undefined;
    }
    let ignore = false;
    setHistoryLoading(true);
    getFootfall(phcId)
      .then((rows) => {
        if (!ignore) {
          setHistory(Array.isArray(rows) ? rows : []);
        }
      })
      .catch(() => {
        if (!ignore) {
          setHistory([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setHistoryLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [phcId, refreshKey]);

  const chartRows = useMemo(() => {
    const past = [...history]
      .sort((left, right) => String(left.date).localeCompare(String(right.date)))
      .slice(-30)
      .map((row) => ({
        label: chartLabel(row.date),
        fullDate: formatDate(row.date),
        historical: row.total_patients,
        forecast: null,
      }));
    const lastDate = [...history].sort((left, right) => String(left.date).localeCompare(String(right.date))).at(-1)?.date;
    const daily = selectedForecast?.forecast?.average_daily_visits;
    if (!lastDate || daily === null || daily === undefined) {
      return past;
    }
    return [
      ...past,
      ...Array.from({ length: 7 }, (_, index) => {
        const iso = addDays(lastDate, index + 1);
        return {
          label: chartLabel(iso),
          fullDate: formatDate(iso),
          historical: null,
          forecast: daily,
        };
      }),
    ];
  }, [history, selectedForecast]);

  const medicineColumns = [
    {
      title: 'PHC',
      dataIndex: 'phc_name',
      key: 'phc_name',
      render: (value) => shortPhcName(value),
    },
    { title: 'State', dataIndex: 'state', key: 'state' },
    { title: 'District', dataIndex: 'district', key: 'district' },
    { title: 'Medicine', dataIndex: 'medicine_name', key: 'medicine_name' },
    {
      title: 'Current Stock',
      dataIndex: 'current_stock',
      key: 'current_stock',
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Daily Usage',
      dataIndex: 'daily_usage',
      key: 'daily_usage',
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Stock Days',
      dataIndex: 'current_stock_days',
      key: 'current_stock_days',
      render: (value) => (value === null ? '—' : formatDecimal(value)),
    },
    {
      title: 'Projected Stock-out',
      dataIndex: 'projected_stock_out_days',
      key: 'projected_stock_out_days',
      render: (value) => (value === null ? '—' : `${formatDecimal(value)} days`),
    },
    {
      title: 'Risk',
      dataIndex: 'risk',
      key: 'risk',
      render: (value) => <RiskTag risk={value} />,
    },
    { title: 'Recommendation', dataIndex: 'recommendation', key: 'recommendation' },
  ];

  const alertColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (value) => <Tag color={SEVERITY_COLOR[value] || 'default'}>{value}</Tag>,
    },
    { title: 'Type', dataIndex: 'alert_type', key: 'alert_type' },
    { title: 'Message', dataIndex: 'message', key: 'message' },
    {
      title: 'PHC',
      dataIndex: 'phc_name',
      key: 'phc_name',
      render: (value) => shortPhcName(value),
    },
    { title: 'District', dataIndex: 'district', key: 'district' },
    { title: 'State', dataIndex: 'state', key: 'state' },
    {
      title: 'Medicine',
      dataIndex: 'medicine_name',
      key: 'medicine_name',
      render: (value) => value || '—',
    },
  ];

  async function onAnalyze() {
    const forecastData = [
      ...medicineRows.filter((row) => row.risk !== 'HEALTHY').map((row) => ({
        record_type: 'medicine_forecast',
        phc_name: row.phc_name,
        state: row.state,
        district: row.district,
        medicine_name: row.medicine_name,
        current_stock: row.current_stock,
        daily_usage: row.daily_usage,
        current_stock_days: row.current_stock_days,
        projected_stock_7_days: row.projected_stock_7_days,
        projected_stock_out_days: row.projected_stock_out_days,
        risk: row.risk,
        recommendation: row.recommendation,
      })),
      ...phcForecasts.map((row) => ({
        record_type: 'footfall_forecast',
        phc_name: row.phc_name,
        state: row.state,
        district: row.district,
        recent_7_day_average: row.historical.recent_7_day_average,
        previous_7_day_average: row.historical.previous_7_day_average,
        trend_percent: row.historical.trend_percent,
        next_7_day_visits: row.forecast.next_7_day_visits,
        average_daily_visits: row.forecast.average_daily_visits,
      })),
    ];
    if (forecastData.length === 0) {
      setAnalysis(null);
      setAnalysisError('No forecast data is available.');
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const data = await analyzeForecast(forecastData);
      setAnalysis(data);
    } catch (requestError) {
      setAnalysis(null);
      setAnalysisError(requestError.message || 'Gemini is temporarily unavailable. Please try again.');
    } finally {
      setAnalysisLoading(false);
    }
  }

  return (
    <Card className="section-card" title="7-Day Demand Forecast">
      <Typography.Paragraph className="panel-lead">
        Demand and stock-out dates are calculated from recorded visits and current medicine stock. This does not change stock records.
      </Typography.Paragraph>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {loading ? (
        <div className="panel-loading"><Spin /> Loading the 7-day forecast</div>
      ) : null}
      {!loading && !error ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <Card className="kpi-card">
                <Statistic title="Forecast horizon" value={`${demand?.forecast_days ?? 7} days`} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card className="kpi-card">
                <Statistic
                  title="Critical forecast risks"
                  value={criticalCount}
                  formatter={(value) => formatNumber(value)}
                  styles={criticalCount > 0 ? { content: { color: '#cf1322' } } : undefined}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card className="kpi-card">
                <Statistic title="High forecast risks" value={highCount} formatter={(value) => formatNumber(value)} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card className="kpi-card">
                <Statistic title="PHCs with rising demand" value={risingCount} formatter={(value) => formatNumber(value)} />
              </Card>
            </Col>
          </Row>

          <div className="forecast-block">
            <Typography.Title level={5}>Medicine forecast</Typography.Title>
            <Table
              rowKey={(row) => `${row.phc_id}-${row.medicine_id}`}
              columns={medicineColumns}
              dataSource={medicineRows}
              size="middle"
              pagination={{ pageSize: 6, showSizeChanger: false }}
              scroll={{ x: 1100 }}
              locale={{ emptyText: 'No medicine forecast is available.' }}
            />
          </div>

          <div className="forecast-block">
            <Typography.Title level={5}>Footfall forecast</Typography.Title>
            <div className="tag-row">
              <label htmlFor="forecast-phc">PHC</label>
              <Select
                id="forecast-phc"
                className="phc-select"
                aria-label="Select a PHC to view its footfall forecast"
                value={phcId}
                onChange={setPhcId}
                options={phcForecasts.map((row) => ({
                  value: row.phc_id,
                  label: `${shortPhcName(row.phc_name)}, ${row.district}`,
                }))}
                disabled={!phcForecasts.length}
              />
            </div>
            <Typography.Paragraph className="chart-caption">
              {selectedForecast ? `${shortPhcName(selectedForecast.phc_name)}: ${trendText(selectedForecast)}` : 'Select a PHC to see its demand trend.'}
              {' '}
              The solid line is recorded visits. The dashed line is the forecast daily demand for the next 7 days.
            </Typography.Paragraph>
            {historyLoading ? <div className="panel-loading"><Spin /> Loading visit history</div> : null}
            <div className="chart-frame" role="img" aria-label="Historical visits and forecast visits">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6eeec" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }
                      const point = payload[0].payload;
                      return (
                        <div className="chart-tooltip">
                          <div>{point.fullDate}</div>
                          {point.historical !== null ? <div>Historical visits: {formatNumber(point.historical)}</div> : null}
                          {point.forecast !== null ? <div>Forecast visits: {formatDecimal(point.forecast)}</div> : null}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="historical" name="Historical visits" stroke="#0f766e" strokeWidth={2} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" name="Forecast visits" stroke="#b45309" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="forecast-block">
            <Typography.Title level={5}>Forecast alerts</Typography.Title>
            <Table
              rowKey={(row) => `${row.alert_type}|${row.phc_id}|${row.medicine_name || ''}|${row.message}`}
              columns={alertColumns}
              dataSource={alertRows}
              size="middle"
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 980 }}
              locale={{ emptyText: 'No forecast alerts for this view.' }}
            />
          </div>

          <div className="forecast-block">
            <Typography.Title level={5}>AI-assisted operational analysis</Typography.Title>
            <Typography.Paragraph className="panel-lead">
              Human approval is required before any real-world action.
            </Typography.Paragraph>
            <Button type="primary" onClick={onAnalyze} loading={analysisLoading} aria-label="Analyze forecast with Gemini">
              Analyze Forecast with Gemini
            </Button>
            {analysisError ? <Alert className="forecast-alert" type="error" showIcon title={analysisError} /> : null}
            {analysisLoading ? (
              <div className="panel-loading"><Spin /> Gemini is reading the forecast</div>
            ) : null}
            {analysis ? (
              <div className="ai-result">
                <div className="risk-heading">
                  <span>Overall risk</span>
                  <Tag color={SEVERITY_COLOR[analysis.overall_risk] || 'default'}>{analysis.overall_risk}</Tag>
                </div>
                <Typography.Paragraph>{analysis.summary}</Typography.Paragraph>
                <Typography.Title level={5}>Priority actions</Typography.Title>
                {(analysis.priority_actions || []).length === 0 ? (
                  <div className="empty-note">No priority actions were returned.</div>
                ) : analysis.priority_actions.map((item) => (
                  <div className="risk-item" key={`${item.phc}-${item.medicine}-${item.recommended_action}`}>
                    <div className="inline-tags">
                      <Tag color={SEVERITY_COLOR[item.priority] || 'blue'}>{item.priority}</Tag>
                      <strong>{shortPhcName(item.phc)}</strong>
                      {item.medicine ? <span>{item.medicine}</span> : null}
                    </div>
                    <div>{item.recommended_action}</div>
                    <div className="stack-detail">{item.reason}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </Card>
  );
}

export default DemandForecastPanel;
