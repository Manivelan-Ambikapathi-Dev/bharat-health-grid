import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Progress, Row, Segmented, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { analyzeEmergency, runEmergencySimulation } from '../services/api.js';
import { formatDecimal, formatNumber, shortPhcName } from '../utils/format.js';
import { SEVERITY_COLOR } from '../utils/labels.js';

const DEMAND_OPTIONS = [
  { value: 10, label: '+10%' },
  { value: 25, label: '+25%' },
  { value: 50, label: '+50%' },
  { value: 100, label: '+100%' },
];

const RISK_COLOR = {
  CRITICAL: 'red',
  HIGH: 'volcano',
  MEDIUM: 'gold',
  HEALTHY: 'green',
  SHORTAGE: 'red',
  AVAILABLE: 'green',
};

function formatSimulation(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
}

function inState(row, selectedState) {
  return !selectedState || selectedState === 'all' || row.state === selectedState;
}

function RiskTag({ risk }) {
  return <Tag color={RISK_COLOR[risk] || 'default'}>{risk}</Tag>;
}

function occupancyProgress(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  const shown = Math.min(100, Math.max(0, value));
  return (
    <Progress
      percent={shown}
      size="small"
      format={() => `${formatDecimal(value)}%`}
      strokeColor={value >= 90 ? '#cf1322' : value >= 80 ? '#d4380d' : value >= 70 ? '#d4b106' : '#389e0d'}
    />
  );
}

function EmergencyResponsePanel({ selectedState = 'all', refreshKey = 0, onOpenPhc }) {
  const [demandIncrease, setDemandIncrease] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    setAnalysis(null);
    setAnalysisError('');
    runEmergencySimulation(demandIncrease)
      .then((data) => {
        if (!ignore) {
          setResult(data);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setResult(null);
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
  }, [demandIncrease, refreshKey]);

  const phcRows = useMemo(
    () => (result?.phcs || []).filter((row) => inState(row, selectedState)),
    [result, selectedState],
  );
  const medicineRows = useMemo(
    () => (result?.medicine_pressure || []).filter((row) => inState(row, selectedState)),
    [result, selectedState],
  );
  const bedRows = useMemo(
    () => (result?.bed_pressure || []).filter((row) => inState(row, selectedState)),
    [result, selectedState],
  );
  const transfers = useMemo(
    () => (result?.redistribution?.recommendations || []).filter((row) => (
      selectedState === 'all' || row.destination_state === selectedState || row.source_state === selectedState
    )),
    [result, selectedState],
  );
  const summary = useMemo(() => ({
    totalPhcs: phcRows.length,
    criticalPhcs: phcRows.filter((row) => row.emergency_status === 'CRITICAL').length,
    highRiskPhcs: phcRows.filter((row) => row.emergency_status === 'HIGH').length,
    medicinePressurePhcs: new Set(medicineRows.map((row) => row.phc_id)).size,
    bedPressurePhcs: phcRows.filter((row) => row.bed_risk !== 'HEALTHY').length,
  }), [medicineRows, phcRows]);

  const phcColumns = [
    {
      title: 'PHC',
      dataIndex: 'phc_name',
      key: 'phc_name',
      render: (_value, row) => (
        <Button
          type="link"
          className="row-link"
          onClick={() => onOpenPhc?.({ id: row.phc_id, state: row.state, district: row.district })}
        >
          {shortPhcName(row.phc_name)}
        </Button>
      ),
    },
    { title: 'State', dataIndex: 'state', key: 'state' },
    { title: 'District', dataIndex: 'district', key: 'district' },
    {
      title: 'Simulated Visits/Day',
      dataIndex: 'simulated_daily_visits',
      key: 'simulated_daily_visits',
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Medicine Risk',
      dataIndex: 'medicine_risk',
      key: 'medicine_risk',
      render: (value) => <RiskTag risk={value} />,
    },
    {
      title: 'Projected Bed Occupancy',
      dataIndex: 'projected_bed_occupancy',
      key: 'projected_bed_occupancy',
      width: 180,
      render: (value) => occupancyProgress(value),
    },
    {
      title: 'Staff Status',
      dataIndex: 'staff_status',
      key: 'staff_status',
      render: (value, row) => (
        <span>
          <RiskTag risk={value} />
          <span className="stack-detail">
            {` ${formatNumber(row.staff_attendance?.present)} present, ${formatNumber(row.staff_attendance?.absent)} absent, ${formatNumber(row.staff_attendance?.on_leave)} on leave`}
          </span>
        </span>
      ),
    },
    {
      title: 'Emergency Status',
      dataIndex: 'emergency_status',
      key: 'emergency_status',
      render: (value) => <RiskTag risk={value} />,
    },
    {
      title: 'Reason',
      dataIndex: 'reasons',
      key: 'reasons',
      render: (value) => (Array.isArray(value) ? value.join(' ') : '—'),
    },
  ];

  const medicineColumns = [
    {
      title: 'PHC',
      dataIndex: 'phc_name',
      key: 'phc_name',
      render: (value) => shortPhcName(value),
    },
    { title: 'Medicine', dataIndex: 'medicine_name', key: 'medicine_name' },
    {
      title: 'Current Stock',
      dataIndex: 'current_stock',
      key: 'current_stock',
      render: (value) => formatSimulation(value),
    },
    {
      title: 'Current Daily Usage',
      dataIndex: 'current_daily_usage',
      key: 'current_daily_usage',
      render: (value) => formatSimulation(value),
    },
    {
      title: 'Simulated Daily Usage',
      dataIndex: 'simulated_daily_usage',
      key: 'simulated_daily_usage',
      render: (value) => formatSimulation(value),
    },
    {
      title: 'Simulated Stock Days',
      dataIndex: 'simulated_stock_days',
      key: 'simulated_stock_days',
      render: (value) => formatSimulation(value),
    },
    {
      title: 'Risk',
      dataIndex: 'risk',
      key: 'risk',
      render: (value) => <RiskTag risk={value} />,
    },
  ];

  const bedColumns = [
    {
      title: 'PHC',
      dataIndex: 'phc_name',
      key: 'phc_name',
      render: (value) => shortPhcName(value),
    },
    {
      title: 'Current Occupancy',
      dataIndex: 'current_occupancy',
      key: 'current_occupancy',
      render: (value) => (value === null ? '—' : `${formatDecimal(value)}%`),
    },
    {
      title: 'Additional Visits',
      dataIndex: 'additional_visits',
      key: 'additional_visits',
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Additional Beds Needed',
      dataIndex: 'additional_beds_needed',
      key: 'additional_beds_needed',
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Projected Occupancy',
      dataIndex: 'projected_occupancy',
      key: 'projected_occupancy',
      render: (value) => occupancyProgress(value),
    },
    {
      title: 'Risk',
      dataIndex: 'risk',
      key: 'risk',
      render: (value) => <RiskTag risk={value} />,
    },
  ];

  async function onAnalyze() {
    if (!result) {
      setAnalysisError('Run the simulation before asking Gemini.');
      return;
    }
    const scenario = {
      name: result.scenario.name,
      demand_increase_percent: result.scenario.demandIncreasePercent,
      horizon_days: result.scenario.horizonDays,
    };
    const simulationData = [
      { record_type: 'scenario', ...scenario, database_modified: false },
      { record_type: 'summary', ...summary },
      ...phcRows.map((row) => ({
        record_type: 'phc',
        phc_name: row.phc_name,
        state: row.state,
        district: row.district,
        simulated_daily_visits: row.simulated_daily_visits,
        medicine_risk: row.medicine_risk,
        projected_bed_occupancy: row.projected_bed_occupancy,
        staff_status: row.staff_status,
        emergency_status: row.emergency_status,
        reasons: row.reasons,
      })),
      ...medicineRows.filter((row) => row.risk === 'CRITICAL' || row.risk === 'HIGH').map((row) => ({
        record_type: 'medicine_pressure',
        phc_name: row.phc_name,
        medicine_name: row.medicine_name,
        current_stock: row.current_stock,
        current_daily_usage: row.current_daily_usage,
        simulated_daily_usage: row.simulated_daily_usage,
        simulated_stock_days: row.simulated_stock_days,
        risk: row.risk,
      })),
      ...transfers.map((row) => ({ record_type: 'redistribution', ...row })),
    ];

    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const data = await analyzeEmergency(scenario, simulationData);
      setAnalysis(data);
    } catch (requestError) {
      setAnalysis(null);
      setAnalysisError(requestError.message || 'Gemini is temporarily unavailable. Please try again.');
    } finally {
      setAnalysisLoading(false);
    }
  }

  return (
    <Card className="section-card" title="Emergency Scenario Simulator">
      <span className="sim-banner">SIMULATION ONLY</span>
      <Alert
        type="info"
        showIcon
        title="No production resource changes are made by simulation."
      />
      <Typography.Paragraph className="panel-lead emergency-lead">
        Model PHC resource pressure under simulated demand increases.
        {' '}
        {result?.scenario?.description || 'The scenario is an acute respiratory outbreak.'}
      </Typography.Paragraph>
      <div className="tag-row">
        <span>Scenario: {result?.scenario?.name || 'Acute Respiratory Outbreak'}</span>
        <Segmented
          aria-label="Demand increase"
          value={demandIncrease}
          options={DEMAND_OPTIONS}
          onChange={setDemandIncrease}
        />
        <span>Simulation horizon: 7 days</span>
      </div>
      <Typography.Paragraph className="chart-caption">
        Bed assumption: 5% of additional patient visits over 7 days may require a bed. Projected occupancy cannot exceed the PHC&apos;s real bed total. Medicine use scales by the same demand increase.
      </Typography.Paragraph>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {loading ? <div className="panel-loading"><Spin /> Running the emergency simulation</div> : null}
      {!loading && result ? (
        <>
          <Alert type="success" showIcon title="Simulation only — no live operational data was changed." />
          <Row gutter={[16, 16]} className="forecast-block">
            <Col xs={24} sm={12} xl={8}>
              <Card className="kpi-card"><Statistic title="PHCs evaluated" value={summary.totalPhcs} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={8}>
              <Card className="kpi-card">
                <Statistic title="Critical PHCs" value={summary.criticalPhcs} styles={summary.criticalPhcs > 0 ? { content: { color: '#cf1322' } } : undefined} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={8}>
              <Card className="kpi-card"><Statistic title="High-risk PHCs" value={summary.highRiskPhcs} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={8}>
              <Card className="kpi-card"><Statistic title="PHCs under bed pressure" value={summary.bedPressurePhcs} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={8}>
              <Card className="kpi-card"><Statistic title="PHCs under medicine pressure" value={summary.medicinePressurePhcs} /></Card>
            </Col>
          </Row>

          <div className="forecast-block">
            <Typography.Title level={5}>Emergency risk</Typography.Title>
            <Table
              rowKey="phc_id"
              columns={phcColumns}
              dataSource={phcRows}
              size="middle"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 1200 }}
              locale={{ emptyText: 'No PHCs match this simulation view.' }}
            />
          </div>

          <div className="forecast-block">
            <Typography.Title level={5}>Medicine pressure</Typography.Title>
            <Table
              rowKey={(row) => `${row.phc_id}-${row.medicine_id}`}
              columns={medicineColumns}
              dataSource={medicineRows}
              size="middle"
              pagination={{ pageSize: 6, showSizeChanger: false }}
              scroll={{ x: 980 }}
              locale={{ emptyText: 'No medicine is under simulated pressure.' }}
            />
          </div>

          <div className="forecast-block">
            <Typography.Title level={5}>Bed pressure</Typography.Title>
            <Table
              rowKey="phc_id"
              columns={bedColumns}
              dataSource={bedRows}
              size="middle"
              pagination={{ pageSize: 6, showSizeChanger: false }}
              scroll={{ x: 860 }}
              locale={{ emptyText: 'No bed projection is available.' }}
            />
          </div>

          <div className="forecast-block">
            <Typography.Title level={5}>Potential redistribution opportunity</Typography.Title>
            <Typography.Paragraph className="panel-lead">
              Awaiting human approval. No transfer has been executed.
            </Typography.Paragraph>
            {transfers.length === 0 ? (
              <div className="empty-note">No excess stock matches a simulated critical shortage.</div>
            ) : transfers.map((row) => (
              <div className="risk-item" key={`${row.source_phc}-${row.destination_phc}-${row.medicine}`}>
                <div className="inline-tags">
                  <Tag color="purple">Awaiting human approval</Tag>
                  <strong>{row.medicine}</strong>
                </div>
                <div>Source: {row.source_phc}</div>
                <div>Destination: {row.destination_phc}</div>
                <div>Available source stock: {formatDecimal(row.source_available_stock)}</div>
                <div>
                  Destination simulated stock pressure: <RiskTag risk={row.destination_simulated_stock_pressure} />
                </div>
                <div>Recommended transfer: {formatNumber(row.recommended_transfer_quantity)}</div>
              </div>
            ))}
          </div>

          <div className="forecast-block">
            <Typography.Title level={5}>AI-assisted simulation analysis</Typography.Title>
            <Typography.Paragraph className="panel-lead">
              Human approval required before operational action.
            </Typography.Paragraph>
            <Button
              type="primary"
              onClick={onAnalyze}
              loading={analysisLoading}
              aria-label="Analyze emergency with Gemini"
            >
              Analyze Emergency with Gemini
            </Button>
            {analysisError ? <Alert className="forecast-alert" type="error" showIcon title={analysisError} /> : null}
            {analysisLoading ? <div className="panel-loading"><Spin /> Gemini is reading the simulation</div> : null}
            {analysis ? (
              <div className="ai-result">
                <div className="risk-heading">
                  <span>Overall risk</span>
                  <Tag color={SEVERITY_COLOR[analysis.overall_risk] || 'default'}>{analysis.overall_risk}</Tag>
                </div>
                <Typography.Paragraph>{analysis.summary}</Typography.Paragraph>
                <Typography.Title level={5}>Priority actions</Typography.Title>
                {(analysis.priority_actions || []).map((item) => (
                  <div className="risk-item" key={`${item.phc}-${item.recommended_action}`}>
                    <div className="inline-tags">
                      <Tag color={SEVERITY_COLOR[item.priority] || 'blue'}>{item.priority}</Tag>
                      <strong>{shortPhcName(item.phc)}</strong>
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

export default EmergencyResponsePanel;
