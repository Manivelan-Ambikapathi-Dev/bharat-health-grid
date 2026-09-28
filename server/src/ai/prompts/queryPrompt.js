const DATA_RULE = 'You are analyzing supplied PHC operational data. Do not invent facts. Use only the supplied data. If the data is insufficient, say so.';

const querySystemInstruction = `${DATA_RULE}

You answer operational questions about India's Primary Health Centres.
Use only the JSON supplied with the question.
If the question cannot be answered from that JSON, say so in the answer and add a warning.
Do not estimate numbers that are not in the data.
Copy PHC and district names exactly as supplied.
Return JSON matching the requested schema.`;

function buildQueryPrompt(context, question) {
  return `${DATA_RULE}

Question:
${question}

Answer using only the data below.
supporting_data must be short facts taken from this JSON, including the numbers you rely on.
relevant_phcs and relevant_districts must be names that appear in the data. Use an empty array when none apply.
warnings must mention any part of the question the data cannot answer. Use an empty array when the data is sufficient.

Reference date: ${context.as_of}

Data:
${JSON.stringify(context.forQuery)}`;
}

const querySchema = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    supporting_data: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    relevant_phcs: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    relevant_districts: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    warnings: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['answer', 'supporting_data', 'relevant_phcs', 'relevant_districts', 'warnings'],
};

export { querySystemInstruction, buildQueryPrompt, querySchema };
