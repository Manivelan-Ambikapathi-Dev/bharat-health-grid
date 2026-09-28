import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Descriptions, Progress, Row, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
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
import { getPhcSummary } from '../services/api.js';
import { formatDate, formatDecimal, formatNumber, shortPhcName } from '../utils/format.js';
import { ALERT_MARK, SEVERITY_COLOR, STOCK_COLOR } from '../utils/labels.js';

const ATTENDANCE_COLOR = {
  Present: 'green',
  Absent: 'red',
  Leave: 'gold',
};

function chartLabel(isoDate) {
  return formatDate(isoDate).replace(/\s+\d{4}$/, '');
}

function PhcDetailView({ phcId, alerts }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    setSummary(null);
    getPhcSummary(phcId)
      .then((data) => {
        if (!ignore) {
          setSummary(data);
        }
      })
      .catch((requestError) => {
        if (!ignore) {
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
  }, [phcId]);

  const phcAlerts = useMemo(() => {
    if (!summary?.phc) {
      return [];
    }
    return alerts.filter((alert) => alert.phc === summary.phc.name && alert.district === summary.phc.district);
  }, [alerts, summary]);

  const footfallRows = useMemo(() => {
    const rows = summary?.recent_footfall || [];
    return [...rows]
      .sort((left, right) => String(left.date).localeCompare(String(right.date)))
      .map((row) => ({
        label: chartLabel(row.date),
        date: formatDate(row.date),
        total: row.total_patients,
        emergency: row.emergency_patients,
        outpatient: row.outpatient_patients,
      }));
  }, [summary]);

  if (loading) {
    return (
      <div className="page-loading">
        <Spin size="large" />
        <p>Loading PHC detail</p>
      </div>
    );
  }

  if (error) {
    return <Alert type="error" showIcon title={error} />;
  }

  if (!summary?.phc) {
    return <Alert type="info" showIcon title="No PHC detail is available." />;
  }

  const { phc, medicine_stock: medicine, beds, personnel, attendance } = summary;
  const attendanceByName = new Map((attendance?.records || []).map((record) => [record.personnel, record.status]));
  const latest = footfallRows[footfallRows.length - 1];

  const medicineColumns = [
    { title: 'Medicine', dataIndex: 'medicine', key: 'medicine' },
    { title: 'Batch', dataIndex: 'batch_number', key: 'batch_number' },
    {
      title: 'Current quantity',
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Daily usage',
      dataIndex: 'daily_average_usage',
      key: 'daily_average_usage',
      align: 'right',
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Stock days',
      dataIndex: 'stock_days',
      key: 'stock_days',
      align: 'right',
      defaultSortOrder: 'ascend',
      sorter: (left, right) => (left.stock_days ?? -1) - (right.stock_days ?? -1),
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Status',
      dataIndex: 'stock_status',
      key: 'stock_status',
      render: (value) => <Tag color={STOCK_COLOR[value] || 'default'}>{value}</Tag>,
    },
    {
      title: 'Expiry',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      render: (value) => formatDate(value),
    },
  ];

  const alertColumns = [
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
  ];

  return (
    <div className="dashboard">
      <Typography.Title level={3} className="level-title">{shortPhcName(phc.name)}</Typography.Title>
      <Card className="section-card" title="PHC information">
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
          <Descriptions.Item label="Name">{phc.name}</Descriptions.Item>
          <Descriptions.Item label="PHC code">{phc.phc_code}</Descriptions.Item>
          <Descriptions.Item label="District">{phc.district}</Descriptions.Item>
          <Descriptions.Item label="State">{phc.state}</Descriptions.Item>
          <Descriptions.Item label="Population covered">{formatNumber(phc.population_covered)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Tabs
        items={[
          {
            key: 'medicine',
            label: 'Medicine',
            children: (
              <Table
                rowKey="batch_number"
                columns={medicineColumns}
                dataSource={medicine?.items || []}
                size="middle"
                pagination={{ pageSize: 8, hideOnSinglePage: true }}
                scroll={{ x: 860 }}
                locale={{ emptyText: 'No medicine stock is recorded for this PHC.' }}
              />
            ),
          },
          {
            key: 'beds',
            label: 'Beds',
            children: beds ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}><Card><Statistic title="Total" value={beds.total_beds} /></Card></Col>
                <Col xs={24} sm={12} lg={6}><Card><Statistic title="Occupied" value={beds.occupied_beds} /></Card></Col>
                <Col xs={24} sm={12} lg={6}><Card><Statistic title="Available" value={beds.available_beds} /></Card></Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <div className="metric-label">Occupancy</div>
                    <Progress
                      percent={Number(beds.occupancy_percentage) || 0}
                      strokeColor={Number(beds.occupancy_percentage) >= 80 ? '#cf1322' : '#0f766e'}
                      format={(percent) => `${formatDecimal(percent)}%`}
                    />
                  </Card>
                </Col>
              </Row>
            ) : <div className="empty-note">No bed record is available for this PHC.</div>,
          },
          {
            key: 'personnel',
            label: 'Personnel',
            children: (
              <>
                <Typography.Paragraph type="secondary">
                  Attendance on {formatDate(attendance?.date)}.
                </Typography.Paragraph>
                <Table
                  rowKey={(record) => `${record.role}-${record.name}`}
                  size="middle"
                  pagination={false}
                  dataSource={personnel?.members || []}
                  locale={{ emptyText: 'No personnel are recorded for this PHC.' }}
                  columns={[
                    { title: 'Name', dataIndex: 'name', key: 'name' },
                    { title: 'Role', dataIndex: 'role', key: 'role' },
                    {
                      title: 'Attendance status',
                      key: 'attendance',
                      render: (_, record) => {
                        const status = attendanceByName.get(record.name) || '—';
                        return <Tag color={ATTENDANCE_COLOR[status] || 'default'}>{status}</Tag>;
                      },
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'footfall',
            label: 'Patient footfall',
            children: footfallRows.length === 0 ? (
              <div className="empty-note">No recent footfall is available for this PHC.</div>
            ) : (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}><Card><Statistic title="Total patients" value={latest.total} formatter={formatNumber} /></Card></Col>
                  <Col xs={24} sm={8}><Card><Statistic title="Emergency patients" value={latest.emergency} formatter={formatNumber} /></Card></Col>
                  <Col xs={24} sm={8}><Card><Statistic title="Outpatient patients" value={latest.outpatient} formatter={formatNumber} /></Card></Col>
                </Row>
                <Typography.Paragraph type="secondary" className="panel-lead">
                  Latest day in this recent trend: {latest.date}.
                </Typography.Paragraph>
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={footfallRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="#e6eeec" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value, name) => [formatNumber(value), name]} />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Total patients" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="outpatient" name="Outpatient patients" stroke="#0369a1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="emergency" name="Emergency patients" stroke="#b45309" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ),
          },
          {
            key: 'alerts',
            label: `Alerts (${phcAlerts.length})`,
            children: (
              <Table
                rowKey={(record) => `${record.type}|${record.title}|${record.message}`}
                columns={alertColumns}
                dataSource={phcAlerts}
                size="middle"
                pagination={false}
                locale={{ emptyText: 'No alerts are recorded for this PHC.' }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

export default PhcDetailView;
