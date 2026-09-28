import { useState } from 'react';
import { Alert, Button, Card, Modal, Spin, Table, Tag, Typography } from 'antd';
import { approveRedistribution, findRedistribution } from '../services/api.js';
import { formatNumber, shortPhcName } from '../utils/format.js';
import { SEVERITY_COLOR } from '../utils/labels.js';

function RedistributionPanel({ canApprove = false, reviewOnly = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [approvals, setApprovals] = useState({});
  const [approvalError, setApprovalError] = useState('');
  const [pending, setPending] = useState(null);

  async function onFind() {
    setLoading(true);
    setError('');
    try {
      const data = await findRedistribution();
      setResult(data);
    } catch (requestError) {
      setResult(null);
      setError(requestError.message || 'Gemini is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onApprove(record) {
    const key = `${record.medicine}-${record.source_phc}-${record.destination_phc}`;
    setApprovalError('');
    setApprovals((current) => ({ ...current, [key]: { loading: true } }));
    try {
      const data = await approveRedistribution(record);
      setApprovals((current) => ({ ...current, [key]: { loading: false, data } }));
    } catch (requestError) {
      setApprovals((current) => ({ ...current, [key]: { loading: false } }));
      setApprovalError(requestError.message || 'Approval was not accepted.');
    }
  }

  const columns = [
    { title: 'Medicine', dataIndex: 'medicine', key: 'medicine' },
    {
      title: 'Source PHC',
      dataIndex: 'source_phc',
      key: 'source_phc',
      render: (value) => shortPhcName(value),
    },
    { title: 'Source state', dataIndex: 'source_state', key: 'source_state' },
    {
      title: 'Destination PHC',
      dataIndex: 'destination_phc',
      key: 'destination_phc',
      render: (value) => shortPhcName(value),
    },
    { title: 'Destination state', dataIndex: 'destination_state', key: 'destination_state' },
    {
      title: 'Destination stock',
      dataIndex: 'destination_current_quantity',
      key: 'destination_current_quantity',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Transfer quantity',
      dataIndex: 'recommended_transfer_quantity',
      key: 'recommended_transfer_quantity',
      align: 'right',
      render: (value) => formatNumber(value),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (value) => <Tag color={SEVERITY_COLOR[value] || 'blue'}>{value}</Tag>,
    },
    { title: 'AI reason', dataIndex: 'reason', key: 'reason' },
  ];

  if (canApprove) {
    columns.push({
      title: 'Approval',
      key: 'approval',
      render: (_, record) => {
        const key = `${record.medicine}-${record.source_phc}-${record.destination_phc}`;
        const approval = approvals[key];
        if (approval?.data) {
          return <Tag color="green">Approved — not executed</Tag>;
        }
        return (
          <Button size="small" loading={approval?.loading} onClick={() => setPending(record)}>
            Approve Transfer
          </Button>
        );
      },
    });
  }

  return (
    <Card
      className="section-card"
      title="Resource Redistribution"
      extra={(
        <Button type="primary" onClick={onFind} loading={loading}>
          Find Redistribution Opportunities
        </Button>
      )}
    >
      <p className="card-subtitle">AI-assisted recommendations for balancing critical resource shortages.</p>
      <Alert
        type="warning"
        showIcon
        title="AI Recommendations — Human approval required"
        description={reviewOnly
          ? 'You can review recommendations for your district. Cross-district transfers cannot be approved in this role, and no stock is moved.'
          : 'These are suggestions only. Approval records a human decision and does not transfer or change any stock.'}
      />
      <Typography.Paragraph type="secondary" className="panel-lead">
        Gemini looks for the same medicine in excess at one PHC and running short at another.
      </Typography.Paragraph>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {approvalError ? <Alert type="error" showIcon title={approvalError} /> : null}
      {loading ? (
        <div className="panel-loading"><Spin /> Gemini is comparing medicine stocks</div>
      ) : null}
      {result?.warning ? <Alert type="info" showIcon title={result.warning} /> : null}
      {result ? (
        <Table
          className="result-table"
          rowKey={(record) => `${record.medicine}-${record.source_phc}-${record.destination_phc}`}
          columns={columns}
          dataSource={result.recommendations || []}
          pagination={false}
          size="middle"
          scroll={{ x: 980 }}
          locale={{ emptyText: 'No redistribution opportunity was found.' }}
        />
      ) : null}
      {result ? (
        <Typography.Paragraph type="secondary" className="status-note">
          {Object.values(approvals).some((item) => item.data)
            ? 'Approved for demonstration only. transfers executed: false. No stock was changed.'
            : 'No transfer has been executed.'}
        </Typography.Paragraph>
      ) : null}
      <Modal
        open={Boolean(pending)}
        title="Approve Resource Transfer?"
        okText="Approve Transfer"
        cancelText="Cancel"
        confirmLoading={pending ? approvals[`${pending.medicine}-${pending.source_phc}-${pending.destination_phc}`]?.loading : false}
        onCancel={() => setPending(null)}
        onOk={async () => {
          const record = pending;
          await onApprove(record);
          setPending(null);
        }}
      >
        {pending ? (
          <div className="profile-meta">
            <div><span>Medicine</span><strong>{pending.medicine}</strong></div>
            <div><span>From</span><strong>{shortPhcName(pending.source_phc)}</strong></div>
            <div><span>To</span><strong>{shortPhcName(pending.destination_phc)}</strong></div>
            <div><span>Quantity</span><strong>{formatNumber(pending.recommended_transfer_quantity)} units</strong></div>
            <p>Approval records a human decision. No stock is moved.</p>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

export default RedistributionPanel;
