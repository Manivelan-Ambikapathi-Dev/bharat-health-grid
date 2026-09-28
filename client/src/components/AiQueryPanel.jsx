import { useState } from 'react';
import { Alert, Button, Card, Input, Spin, Tag, Typography } from 'antd';
import { askQuestion } from '../services/api.js';

const EXAMPLES = [
  'Which PHCs are currently at risk?',
  'Which medicines may run out soon?',
  'Which medicines are nearing expiry?',
  'Which districts have high bed occupancy?',
];

function AiQueryPanel() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function onAsk(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (trimmed.length < 3) {
      setError('Enter a question first.');
      return;
    }
    setQuestion(trimmed);
    setLoading(true);
    setError('');
    try {
      const data = await askQuestion(trimmed);
      setResult(data);
    } catch (requestError) {
      setResult(null);
      setError(requestError.message || 'Gemini is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="section-card" title="Ask Bharat Health Grid AI">
      <Typography.Paragraph type="secondary">
        Ask about the supplied PHC data. Answers stay inside that dataset.
      </Typography.Paragraph>
      <div className="example-row">
        {EXAMPLES.map((example) => (
          <Button key={example} size="small" onClick={() => onAsk(example)} disabled={loading}>
            {example}
          </Button>
        ))}
      </div>
      <div className="query-row">
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onPressEnter={() => onAsk()}
          placeholder="What would you like to know?"
          maxLength={1000}
          disabled={loading}
        />
        <Button type="primary" onClick={() => onAsk()} loading={loading}>
          Ask
        </Button>
      </div>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {loading ? (
        <div className="panel-loading"><Spin /> Gemini is answering from the PHC dataset</div>
      ) : null}
      {result ? (
        <div className="ai-result">
          <Typography.Paragraph>{result.answer}</Typography.Paragraph>
          {(result.warnings || []).map((warning) => (
            <Alert key={warning} type="warning" showIcon title={warning} className="query-warning" />
          ))}
          <Typography.Title level={5}>Supporting data</Typography.Title>
          {(result.supporting_data || []).length === 0 ? (
            <div className="empty-note">No supporting facts were returned.</div>
          ) : (
            <ul className="fact-list">
              {result.supporting_data.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          )}
          <div className="tag-row">
            <span>PHCs</span>
            {(result.relevant_phcs || []).length === 0 ? <Tag>None named</Tag> : result.relevant_phcs.map((name) => (
              <Tag key={name} color="cyan">{name}</Tag>
            ))}
          </div>
          <div className="tag-row">
            <span>Districts</span>
            {(result.relevant_districts || []).length === 0 ? <Tag>None named</Tag> : result.relevant_districts.map((name) => (
              <Tag key={name}>{name}</Tag>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export default AiQueryPanel;
