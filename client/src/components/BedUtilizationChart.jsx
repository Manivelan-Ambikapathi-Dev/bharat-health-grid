import { Card, Col, Progress, Row } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDecimal, formatNumber, shortPhcName } from '../utils/format.js';
import RiskBadge from './ui/RiskBadge.jsx';

function BedTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{row.phc}</strong>
      <div>{row.district}, {row.state}</div>
      <div>Total beds: {row.total}</div>
      <div>Occupied: {row.occupied}</div>
      <div>Available: {row.available}</div>
      <div>Occupancy: {formatDecimal(row.occupancy)}%</div>
    </div>
  );
}

function BedUtilizationChart({ beds }) {
  const chartRows = beds
    .map((row) => ({
      label: shortPhcName(row.phc),
      phc: row.phc,
      district: row.district,
      state: row.state,
      total: row.total_beds,
      occupied: row.occupied_beds,
      available: row.available_beds,
      occupancy: row.occupancy_percentage,
    }))
    .sort((left, right) => right.occupancy - left.occupancy);

  const highOccupancy = chartRows.filter((row) => row.occupancy >= 80);
  const totalBeds = chartRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const occupiedBeds = chartRows.reduce((sum, row) => sum + Number(row.occupied || 0), 0);
  const availableBeds = chartRows.reduce((sum, row) => sum + Number(row.available || 0), 0);
  const occupancy = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Card className="section-card" title="Bed Capacity">
          {chartRows.length === 0 ? (
            <div className="empty-note">No bed records are available for this view.</div>
          ) : (
            <>
              <div className="bed-ring">
                <Progress
                  type="circle"
                  percent={Number(occupancy.toFixed(1))}
                  size={88}
                  strokeColor={occupancy >= 80 ? '#DC2626' : '#0F766E'}
                />
                <div className="metric-strip" style={{ flex: 1, marginBottom: 0 }}>
                  <div className="metric-chip"><span>Available</span><strong>{formatNumber(availableBeds)}</strong></div>
                  <div className="metric-chip"><span>Occupied</span><strong>{formatNumber(occupiedBeds)}</strong></div>
                  <div className="metric-chip"><span>Total</span><strong>{formatNumber(totalBeds)}</strong></div>
                  <div className="metric-chip"><span>Occupancy</span><strong>{formatDecimal(occupancy)}%</strong></div>
                </div>
              </div>
              <div className="chart-caption">Each bar is one PHC. Occupied and available beds use the recorded bed configuration.</div>
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
                    <CartesianGrid stroke="#e6eeec" vertical={false} />
                    <XAxis dataKey="label" interval={0} angle={-35} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<BedTooltip />} />
                    <Legend />
                    <Bar dataKey="occupied" name="Occupied beds" stackId="beds" fill="#b45309" />
                    <Bar dataKey="available" name="Available beds" stackId="beds" fill="#0f766e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="section-card" title="High-occupancy PHCs">
          {highOccupancy.length === 0 ? (
            <div className="empty-note">No PHC in this view is at or above 80% occupancy.</div>
          ) : (
            <div>
              {highOccupancy.map((row) => (
                <div className="stack-item" key={row.phc}>
                  <div>
                    <div className="stack-title">{shortPhcName(row.phc)}</div>
                    <div className="stack-detail">{row.district}, {row.state} · {row.occupied} of {row.total} beds occupied</div>
                  </div>
                  <RiskBadge value={row.occupancy >= 90 ? 'CRITICAL' : 'HIGH'} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
}

export default BedUtilizationChart;
