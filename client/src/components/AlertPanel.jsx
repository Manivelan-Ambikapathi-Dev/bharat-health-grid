import { useMemo, useState } from 'react';
import { Card, Segmented, Table, Tag } from 'antd';
import { ALERT_MARK, SEVERITY_COLOR } from '../utils/labels.js';

const FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

function AlertPanel({ alerts }) {
  const [severity, setSeverity] = useState('ALL');

  const rows = useMemo(
    () => (severity === 'ALL' ? alerts : alerts.filter((alert) => alert.severity === severity)),
    [alerts, severity],
  );

  const columns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (value) => <Tag color={SEVERITY_COLOR[value] || 'default'}>{value}</Tag>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => `${ALERT_MARK[record.type] || ''} ${title}`.trim(),
    },
    { title: 'Message', dataIndex: 'message', key: 'message' },
    { title: 'PHC', dataIndex: 'phc', key: 'phc' },
    { title: 'District', dataIndex: 'district', key: 'district' },
    { title: 'State', dataIndex: 'state', key: 'state' },
  ];

  return (
    <Card
      className="section-card"
      title="Alerts"
      extra={<Segmented options={FILTERS} value={severity} onChange={setSeverity} />}
    >
      <Table
        rowKey={(record) => `${record.type}|${record.phc}|${record.title}|${record.message}`}
        columns={columns}
        dataSource={rows}
        size="middle"
        pagination={{ pageSize: 6, hideOnSinglePage: true }}
        scroll={{ x: 980 }}
        locale={{ emptyText: 'No alerts match this view.' }}
      />
    </Card>
  );
}

export default AlertPanel;
