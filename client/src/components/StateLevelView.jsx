import { Button, Card, Col, Progress, Row, Statistic, Table, Typography } from 'antd';
import { formatDecimal, formatNumber } from '../utils/format.js';
import { deriveResourceStatus } from '../utils/stateStatus.js';
import { buildDistrictRows } from '../utils/hierarchy.js';
import StatusTag from './StatusTag.jsx';

function StateLevelView({ stateName, summary, alerts, phcs, beds, stock, footfall, footfallReady, onDistrictSelect }) {
  const stateRow = summary.find((row) => row.state === stateName);
  const stateAlerts = alerts.filter((alert) => alert.state === stateName);
  const criticalMedicineAlerts = stateAlerts.filter((alert) => (
    alert.severity === 'CRITICAL' && (alert.type === 'MEDICINE_STOCK_OUT' || alert.type === 'LOW_STOCK' || alert.type === 'NEAR_EXPIRY')
  )).length;
  const staffShortageAlerts = stateAlerts.filter((alert) => alert.type === 'STAFF_SHORTAGE').length;
  const status = stateRow
    ? deriveResourceStatus(stateAlerts, stateRow.critical_stock_count, stateRow.low_stock_count)
    : 'normal';
  const districts = buildDistrictRows({
    stateName,
    phcs,
    beds,
    stock,
    alerts,
    footfall: footfallReady ? footfall : [],
  });

  const columns = [
    {
      title: 'District',
      dataIndex: 'district',
      key: 'district',
      render: (district) => (
        <Button type="link" className="row-link" onClick={(event) => { event.stopPropagation(); onDistrictSelect(district); }}>
          {district}
        </Button>
      ),
    },
    {
      title: 'PHCs',
      dataIndex: 'phcCount',
      key: 'phcCount',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Patient Footfall',
      dataIndex: 'footfall',
      key: 'footfall',
      align: 'right',
      render: (value) => (footfallReady ? formatNumber(value) : '—'),
    },
    {
      title: 'Available Beds',
      dataIndex: 'availableBeds',
      key: 'availableBeds',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Bed Occupancy',
      dataIndex: 'occupancy',
      key: 'occupancy',
      width: 160,
      render: (value) => (
        <Progress
          percent={Number(value) || 0}
          size="small"
          strokeColor={Number(value) >= 80 ? '#cf1322' : '#0f766e'}
          format={(percent) => `${percent}%`}
        />
      ),
    },
    {
      title: 'Critical Alerts',
      dataIndex: 'criticalAlerts',
      key: 'criticalAlerts',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value) => <StatusTag status={value} />,
    },
  ];

  if (!stateRow) {
    return <Card>No summary is available for {stateName}.</Card>;
  }

  return (
    <div className="dashboard">
      <Typography.Title level={3} className="level-title">{stateName}</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="Total PHCs" value={stateRow.total_phcs} formatter={formatNumber} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="Total patient footfall" value={stateRow.total_patients} formatter={formatNumber} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="Total available beds" value={stateRow.available_beds} formatter={formatNumber} /></Card></Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card">
            <div className="metric-label">Bed occupancy</div>
            <Progress
              percent={Number(stateRow.occupancy_percentage) || 0}
              strokeColor={Number(stateRow.occupancy_percentage) >= 80 ? '#cf1322' : '#0f766e'}
              format={(percent) => `${formatDecimal(percent)}%`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="Critical medicine alerts" value={criticalMedicineAlerts} formatter={formatNumber} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="Staff shortage alerts" value={staffShortageAlerts} formatter={formatNumber} /></Card></Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card">
            <div className="metric-label">Overall resource status</div>
            <StatusTag status={status} />
          </Card>
        </Col>
      </Row>
      <Card className="section-card" title="Districts">
        <Table
          rowKey="district"
          columns={columns}
          dataSource={districts}
          pagination={false}
          size="middle"
          scroll={{ x: 760 }}
          locale={{ emptyText: 'No districts are available for this state.' }}
          onRow={(record) => ({
            onClick: () => onDistrictSelect(record.district),
            className: 'clickable-row',
          })}
        />
        <Typography.Paragraph type="secondary" className="status-note">
          Select a district to open its PHCs. Status uses the same rule as the national view: critical alert or critical medicine stock, then high or medium alerts or low stock.
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

export default StateLevelView;
