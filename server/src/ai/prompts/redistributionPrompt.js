const DATA_RULE = 'You are analyzing supplied PHC operational data. Do not invent facts. Use only the supplied data. If the data is insufficient, say so.';

const redistributionSystemInstruction = `${DATA_RULE}

You recommend possible medicine redistribution between Primary Health Centres.
A recommendation is not a transfer. No stock movement is executed by this analysis.
A human administrator must approve any future movement.
Return JSON matching the requested schema. Copy names exactly as supplied.`;

function buildRedistributionPrompt(context) {
  return `${DATA_RULE}

Recommend possible redistribution using only the candidate pairs below.
Each pair already links excess stock at a source PHC to critical or low stock of the same medicine at a destination PHC.

Rules:
- source_phc must be the excess PHC. destination_phc must be the shortage PHC.
- Do not reverse the direction.
- recommended_transfer_quantity must be a positive whole number no larger than the source current_quantity.
- Leave the source with enough stock for its own daily use. Do not empty it.
- Prefer a quantity that gives the destination several weeks of cover when the source can spare it.
- Do not recommend moving a batch that expires before the destination can use it.
- priority is HIGH when the destination has about 3 days of stock or less, otherwise MEDIUM or LOW.
- If a pair should not move, omit it.
- If no pair should move, return an empty recommendations array.
- reason must cite supplied quantities or stock days.
- Do not say that stock was transferred.

Reference date: ${context.as_of}

Candidate pairs:
${JSON.stringify(context.redistributionPairs)}`;
}

const redistributionSchema = {
  type: 'OBJECT',
  properties: {
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          medicine: { type: 'STRING' },
          source_phc: { type: 'STRING' },
          source_state: { type: 'STRING' },
          source_available_quantity: { type: 'NUMBER' },
          destination_phc: { type: 'STRING' },
          destination_state: { type: 'STRING' },
          destination_current_quantity: { type: 'NUMBER' },
          destination_daily_usage: { type: 'NUMBER' },
          recommended_transfer_quantity: { type: 'INTEGER' },
          reason: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        },
        required: [
          'medicine',
          'source_phc',
          'source_state',
          'source_available_quantity',
          'destination_phc',
          'destination_state',
          'destination_current_quantity',
          'destination_daily_usage',
          'recommended_transfer_quantity',
          'reason',
          'priority',
        ],
      },
    },
  },
  required: ['recommendations'],
};

export { redistributionSystemInstruction, buildRedistributionPrompt, redistributionSchema };
