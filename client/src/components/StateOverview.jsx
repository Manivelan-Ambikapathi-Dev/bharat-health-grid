import { Button, Card, Progress, Table, Typography } from 'antd';
import { formatNumber } from '../utils/format.js';
import { deriveStateStatus } from '../utils/stateStatus.js';
import StatusTag from './StatusTag.jsx';

function StateOverview({ summary, alerts, onStateSelect }) {
  const rows = summary.map((row) => {
    const stateAlerts = alerts.filter((alert) => alert.state === row.state);
    const status = deriveStateStatus(row, stateAlerts);
    return { ...row, status };
  });

  const columns = [
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state) => (
        onStateSelect ? (
          <Button type="link" className="row-link" onClick={(event) => { event.stopPropagation(); onStateSelect(state); }}>
            {state}
          </Button>
        ) : state
      ),
    },
    {
      title: 'PHCs',
      dataIndex: 'total_phcs',
      key: 'total_phcs',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Patient footfall',
      dataIndex: 'total_patients',
      key: 'total_patients',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Bed occupancy',
      dataIndex: 'occupancy_percentage',
      key: 'occupancy_percentage',
      width: 150,
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
      title: 'Critical medicine',
      dataIndex: 'critical_stock_count',
      key: 'critical_stock_count',
      width: 110,
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Overall status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <StatusTag status={status} />,
    },
  ];

  return (
    <Card className="section-card" title="National Health Overview">
      <p className="card-subtitle">State, PHC capacity, visits, occupancy, and overall status.</p>
      <Table
        rowKey="state"
        columns={columns}
        dataSource={rows}
        pagination={false}
        size="middle"
        scroll={{ x: 700 }}
        locale={{ emptyText: 'No state summary is available.' }}
        onRow={onStateSelect ? (record) => ({
          onClick: () => onStateSelect(record.state),
          className: 'clickable-row',
        }) : undefined}
      />
      <Typography.Paragraph type="secondary" className="status-note">
        Select a state to open its districts. Critical means a critical alert or a medicine batch in critical stock.
        Attention means a high or medium alert, or low stock. Normal means neither is present.
      </Typography.Paragraph>
    </Card>
  );
}

export default StateOverview;
