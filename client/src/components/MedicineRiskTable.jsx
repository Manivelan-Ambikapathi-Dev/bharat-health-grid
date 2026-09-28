import { useMemo, useState } from 'react';
import { Card, Segmented, Table } from 'antd';
import { formatDate, formatDecimal, formatNumber, shortPhcName } from '../utils/format.js';
import RiskBadge from './ui/RiskBadge.jsx';

const FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'Low', value: 'LOW' },
  { label: 'Excess', value: 'EXCESS' },
  { label: 'Out of Stock', value: 'OUT_OF_STOCK' },
];

const STATUS_RANK = {
  OUT_OF_STOCK: 0,
  CRITICAL: 1,
  LOW: 2,
  HIGH: 3,
  MEDIUM: 4,
  EXCESS: 5,
  HEALTHY: 6,
};

function worstStatus(batches) {
  return batches.reduce((worst, row) => (
    (STATUS_RANK[row.stock_status] ?? 9) < (STATUS_RANK[worst] ?? 9) ? row.stock_status : worst
  ), batches[0]?.stock_status);
}

function MedicineRiskTable({ stock }) {
  const [filter, setFilter] = useState('ALL');

  const groups = useMemo(() => {
    const buckets = new Map();
    stock.forEach((row) => {
      const key = `${row.phc_id}|${row.medicine}`;
      const current = buckets.get(key) || [];
      current.push(row);
      buckets.set(key, current);
    });
    return [...buckets.values()].map((batches) => {
      const first = batches[0];
      const quantity = batches.reduce((sum, row) => sum + Number(row.current_quantity || 0), 0);
      const usage = batches.reduce((sum, row) => sum + Number(row.daily_average_usage || 0), 0);
      return {
        key: `${first.phc_id}-${first.medicine}`,
        medicine: first.medicine,
        phc: first.phc,
        district: first.district,
        state: first.state,
        current_quantity: quantity,
        daily_average_usage: usage,
        stock_days: usage > 0 ? quantity / usage : null,
        stock_status: worstStatus(batches),
        batches,
      };
    });
  }, [stock]);

  const rows = useMemo(() => {
    if (filter === 'ALL') {
      return groups;
    }
    return groups.filter((group) => group.batches.some((batch) => batch.stock_status === filter));
  }, [filter, groups]);

  const columns = [
    {
      title: 'Status',
      dataIndex: 'stock_status',
      key: 'stock_status',
      width: 150,
      render: (value) => <RiskBadge value={value} />,
    },
    { title: 'Medicine', dataIndex: 'medicine', key: 'medicine' },
    { title: 'PHC', dataIndex: 'phc', key: 'phc', render: (value) => shortPhcName(value) },
    { title: 'District', dataIndex: 'district', key: 'district' },
    { title: 'State', dataIndex: 'state', key: 'state' },
    {
      title: 'Current Stock',
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Daily Usage',
      dataIndex: 'daily_average_usage',
      key: 'daily_average_usage',
      align: 'right',
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Stock Days',
      dataIndex: 'stock_days',
      key: 'stock_days',
      align: 'right',
      sorter: (left, right) => (left.stock_days ?? -1) - (right.stock_days ?? -1),
      render: (value) => formatDecimal(value),
    },
    {
      title: 'Risk',
      key: 'risk',
      render: (_, record) => (
        <span>
          <RiskBadge value={record.stock_status} />
          {record.batches.length > 1 ? ` ${record.batches.length} batches` : ''}
        </span>
      ),
    },
  ];

  const batchColumns = [
    { title: 'Batch', dataIndex: 'batch_number', key: 'batch_number' },
    { title: 'Quantity', dataIndex: 'current_quantity', align: 'right', render: (value) => formatNumber(value) },
    { title: 'Daily Usage', dataIndex: 'daily_average_usage', align: 'right', render: (value) => formatDecimal(value) },
    { title: 'Expiry', dataIndex: 'expiry_date', render: (value) => formatDate(value) },
    { title: 'Status', dataIndex: 'stock_status', render: (value) => <RiskBadge value={value} /> },
  ];

  return (
    <Card className="section-card" title="Medicine Supply Risk">
      <p className="card-subtitle">Stock availability and projected depletion across PHCs. Expand a row to see every batch.</p>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      <Table
        style={{ marginTop: 16 }}
        rowKey="key"
        columns={columns}
        dataSource={rows}
        size="middle"
        pagination={{ pageSize: 8 }}
        scroll={{ x: 1100 }}
        locale={{
          emptyText: filter === 'CRITICAL'
            ? 'No critical medicine risks detected'
            : 'No medicine stock matches this view.',
        }}
        expandable={{
          expandedRowRender: (record) => (
            <Table
              rowKey={(batch) => `${batch.phc_id}-${batch.batch_number}`}
              columns={batchColumns}
              dataSource={record.batches}
              pagination={false}
              size="small"
            />
          ),
        }}
      />
    </Card>
  );
}

export default MedicineRiskTable;
