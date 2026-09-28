import { Tag } from 'antd';
import { STATUS_LABEL } from '../utils/stateStatus.js';

function StatusTag({ status }) {
  const tone = status === 'critical' ? 'critical' : status === 'attention' ? 'warning' : 'healthy';
  return <Tag className={`status-badge tone-${tone}`} bordered={false}>{STATUS_LABEL[status] || status}</Tag>;
}

export default StatusTag;
