import { useState } from 'react';
import { Alert, Button, Card, Spin, Tag, Typography } from 'antd';
import { analyzeResourceRisk } from '../services/api.js';
import { SEVERITY_COLOR } from '../utils/labels.js';

function AiRiskPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function onAnalyze() {
    setLoading(true);
    setError('');
    try {
      const data = await analyzeResourceRisk();
      setResult(data);
    } catch (requestError) {
      setResult(null);
      setError(requestError.message || 'Gemini is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      className="section-card ai-card"
      title="AI Resource Intelligence"
      extra={(
        <Button type="primary" onClick={onAnalyze} loading={loading}>
          Analyze with Gemini
        </Button>
      )}
    >
      <div className="inline-tags">
        <span className="risk-badge tone-excess">Powered by Gemini</span>
      </div>
      <Typography.Paragraph type="secondary">
        Gemini reads the current operational dataset only after you ask. This does not change stock or staffing.
      </Typography.Paragraph>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {loading ? (
        <div className="panel-loading"><Spin /> Gemini is reading the PHC dataset</div>
      ) : null}
      {result ? (
        <div className="ai-result">
          <div className="risk-heading">
            <span>Overall risk</span>
            <Tag color={SEVERITY_COLOR[result.overall_risk] || 'default'}>{result.overall_risk}</Tag>
          </div>
          <Typography.Paragraph>{result.summary}</Typography.Paragraph>
          <Typography.Title level={5}>Critical risks</Typography.Title>
          {(result.risks || []).length === 0 ? (
            <div className="empty-note">No risk categories were returned.</div>
          ) : result.risks.map((risk) => (
            <div className="risk-item" key={`${risk.category}-${risk.title}`}>
              <div className="inline-tags">
                <Tag>{risk.category}</Tag>
                <Tag color={SEVERITY_COLOR[risk.severity] || 'default'}>{risk.severity}</Tag>
                <strong>{risk.title}</strong>
              </div>
              <div>{risk.explanation}</div>
              <div className="evidence">{risk.evidence}</div>
            </div>
          ))}
          <Typography.Title level={5}>Operational recommendations</Typography.Title>
          {(result.recommended_actions || []).length === 0 ? (
            <div className="empty-note">No actions were returned.</div>
          ) : result.recommended_actions.map((item) => (
            <div className="risk-item" key={item.action}>
              <div className="inline-tags">
                <Tag color={SEVERITY_COLOR[item.priority] || 'blue'}>{item.priority}</Tag>
                <strong>{item.action}</strong>
              </div>
              <div className="stack-detail">{item.reason}</div>
            </div>
          ))}
          <p className="ai-disclaimer">AI-generated operational analysis. Human approval required for resource actions.</p>
        </div>
      ) : null}
    </Card>
  );
}

export default AiRiskPanel;
