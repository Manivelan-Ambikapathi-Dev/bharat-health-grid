import { Col, Row } from 'antd';
import { formatNumber } from '../utils/format.js';
import Icon from './ui/Icons.jsx';

function KpiCards({ totalPhcs, totalPatients, availableBeds, criticalAlerts }) {
  const cards = [
    { title: 'Total PHCs', value: totalPhcs, context: 'Facilities in view', icon: 'building' },
    { title: 'Patient Visits', value: totalPatients, context: 'Recorded footfall', icon: 'visits' },
    { title: 'Available Beds', value: availableBeds, context: 'Unoccupied capacity', icon: 'beds' },
    {
      title: 'Critical Alerts',
      value: criticalAlerts,
      context: criticalAlerts > 0 ? 'Needs attention' : 'No critical alerts',
      icon: 'alert',
      critical: criticalAlerts > 0,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col key={card.title} xs={24} sm={12} xl={6}>
          <article className={`stat-card${card.critical ? ' accent-critical' : ''}`}>
            <div className="stat-icon"><Icon name={card.icon} /></div>
            <div>
              <div className="stat-label">{card.title}</div>
              <div className="stat-value">{formatNumber(card.value)}</div>
              <div className="stat-context">{card.context}</div>
            </div>
          </article>
        </Col>
      ))}
    </Row>
  );
}

export default KpiCards;
