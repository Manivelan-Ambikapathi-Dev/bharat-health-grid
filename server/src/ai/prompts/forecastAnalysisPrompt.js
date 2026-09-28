const DATA_RULE = 'You are analyzing supplied PHC operational data. Do not invent facts. Use only the supplied data. If the data is insufficient, say so.';

const forecastAnalysisSystemInstruction = `${DATA_RULE}

You are Bharat Health Grid's operational intelligence assistant.
Analyze the supplied forecast data only.
Do not invent numbers.
Do not modify database records.
Do not execute transfers.
Return JSON matching the requested schema.
Copy PHC and medicine names exactly as supplied.
priority_actions are advice for a human. Do not say an action was carried out.
If an action is about patient demand rather than a medicine, set medicine to an empty string.`;

function buildForecastAnalysisPrompt(forecastData) {
  return `${DATA_RULE}

You are Bharat Health Grid's operational intelligence assistant.

Analyze the supplied forecast data only.

Identify:
1. Most urgent projected medicine stock-out risks.
2. PHCs with rising demand.
3. Potential operational pressure over the next 7 days.
4. Recommended human actions.

Do not invent numbers.
Do not modify database records.
Do not execute transfers.
Return structured JSON.

Rules:
- overall_risk should reflect the most serious supplied forecast risk.
- If a medicine forecast has risk CRITICAL or HIGH, mention that PHC and medicine in priority_actions.
- A positive trend_percent means demand is rising. Do not call demand rising when trend_percent is missing, zero, or negative.
- recommended_action must require human approval. Do not say stock was moved.

Forecast data:
${JSON.stringify(forecastData)}`;
}

const forecastAnalysisSchema = {
  type: 'OBJECT',
  properties: {
    overall_risk: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    summary: { type: 'STRING' },
    priority_actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          priority: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          phc: { type: 'STRING' },
          medicine: { type: 'STRING' },
          reason: { type: 'STRING' },
          recommended_action: { type: 'STRING' },
        },
        required: ['priority', 'phc', 'medicine', 'reason', 'recommended_action'],
      },
    },
  },
  required: ['overall_risk', 'summary', 'priority_actions'],
};

export { forecastAnalysisSystemInstruction, buildForecastAnalysisPrompt, forecastAnalysisSchema };
