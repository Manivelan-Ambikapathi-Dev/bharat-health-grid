const DATA_RULE = 'You are analyzing supplied PHC operational data. Do not invent facts. Use only the supplied data. If the data is insufficient, say so.';

const resourceRiskSystemInstruction = `${DATA_RULE}

You are a public-health resource analyst for India's Primary Health Centre network.
Identify operational risk only. Do not propose executing stock transfers, purchases, or staff orders.
Return JSON matching the requested schema. Copy facility and place names exactly as supplied.`;

function buildResourceRiskPrompt(context) {
  return `${DATA_RULE}

Analyze this Primary Health Centre snapshot for ${context.as_of}.

Assess only these points:
1. Current resource risks
2. Potential shortages
3. Potential medicine wastage, including stock that may expire before it is used
4. Bed-capacity pressure
5. Staff shortage
6. Patient-footfall anomalies
7. Overall PHC and district risk

Rules:
- Evidence must cite a supplied facility name and a supplied number.
- If deterministic_alerts contains a CRITICAL or HIGH item, include a corresponding risk.
- Do not claim a medicine, bed, staff, or footfall problem that is absent from the data.
- recommended_actions are advice for a human administrator. Do not say an action was carried out.
- overall_risk should reflect the most serious supplied problem.

Data:
${JSON.stringify(context.forRiskAnalysis)}`;
}

const resourceRiskSchema = {
  type: 'OBJECT',
  properties: {
    overall_risk: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    summary: { type: 'STRING' },
    risks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: ['MEDICINE', 'BED', 'STAFF', 'FOOTFALL'] },
          severity: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          title: { type: 'STRING' },
          explanation: { type: 'STRING' },
          evidence: { type: 'STRING' },
        },
        required: ['category', 'severity', 'title', 'explanation', 'evidence'],
      },
    },
    recommended_actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          priority: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          action: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['priority', 'action', 'reason'],
      },
    },
  },
  required: ['overall_risk', 'summary', 'risks', 'recommended_actions'],
};

export { resourceRiskSystemInstruction, buildResourceRiskPrompt, resourceRiskSchema };
