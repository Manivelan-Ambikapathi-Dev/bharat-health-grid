import { Button, Card, Col, Row, Statistic, Table, Typography } from 'antd';
import { formatNumber, shortPhcName } from '../utils/format.js';
import { buildPhcRows } from '../utils/hierarchy.js';
import StatusTag from './StatusTag.jsx';

function DistrictLevelView({
  stateName,
  districtName,
  phcs,
  beds,
  stock,
  alerts,
  footfall,
  footfallReady,
  onPhcSelect,
}) {
  const rows = buildPhcRows({
    stateName,
    districtName,
    phcs,
    beds,
    stock,
    alerts,
    footfall: footfallReady ? footfall : [],
  });
  const districtAlerts = alerts.filter((alert) => alert.state === stateName && alert.district === districtName);
  const highRisk = rows.filter((row) => row.status === 'critical');

  const columns = [
    {
      title: 'PHC',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <Button type="link" className="row-link" onClick={(event) => { event.stopPropagation(); onPhcSelect(record.id); }}>
          {shortPhcName(value)}
        </Button>
      ),
    },
    { title: 'PHC Code', dataIndex: 'phcCode', key: 'phcCode' },
    {
      title: 'Population Covered',
      dataIndex: 'population',
      key: 'population',
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
      title: 'Medicine Risk',
      dataIndex: 'medicineRisk',
      key: 'medicineRisk',
      render: (value) => <StatusTag status={value} />,
    },
    {
      title: 'Staff Status',
      dataIndex: 'staffStatus',
      key: 'staffStatus',
      render: (value) => <StatusTag status={value} />,
    },
    {
      title: 'Overall Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => <StatusTag status={value} />,
    },
  ];

  return (
    <div className="dashboard">
      <Typography.Title level={3} className="level-title">{districtName}</Typography.Title>
      <Typography.Paragraph type="secondary">{stateName}</Typography.Paragraph>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="PHCs" value={rows.length} formatter={formatNumber} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="Total patient footfall" value={footfallReady ? rows.reduce((sum, row) => sum + row.footfall, 0) : 0} formatter={(value) => (footfallReady ? formatNumber(value) : '—')} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="Available beds" value={rows.reduce((sum, row) => sum + row.availableBeds, 0)} formatter={formatNumber} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="kpi-card"><Statistic title="Critical alerts" value={districtAlerts.filter((alert) => alert.severity === 'CRITICAL').length} formatter={formatNumber} /></Card></Col>
      </Row>
      <Card className="section-card" title="High-risk PHCs">
        {highRisk.length === 0 ? (
          <div className="empty-note">No PHC in this district has a critical alert or critical medicine stock.</div>
        ) : (
          <div className="tag-row">
            {highRisk.map((row) => (
              <button key={row.id} type="button" className="phc-link" onClick={() => onPhcSelect(row.id)}>
                {shortPhcName(row.name)}
              </button>
            ))}
          </div>
        )}
        <Typography.Paragraph type="secondary" className="status-note">
          High-risk means the PHC has a critical alert or a medicine batch in critical stock.
        </Typography.Paragraph>
      </Card>
      <Card className="section-card" title="PHCs">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="middle"
          scroll={{ x: 980 }}
          locale={{ emptyText: 'No PHCs are available for this district.' }}
          onRow={(record) => ({
            onClick: () => onPhcSelect(record.id),
            className: 'clickable-row',
          })}
        />
      </Card>
    </div>
  );
}

export default DistrictLevelView;
