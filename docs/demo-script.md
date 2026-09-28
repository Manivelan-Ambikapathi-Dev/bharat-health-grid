# Bharat Health Grid — demo script

AI-Powered Federated Health Resource Intelligence for India

About four minutes. Open the India dashboard at http://localhost:5173 before you start. Keep the API running.

### 0:00–0:30 — Problem

Primary Health Centres often see shortages only after the shelf is already empty. Stock, beds, staff, and patient visits sit in separate records, so a district cannot tell which facility will run out next or which neighbour has surplus. Bharat Health Grid is an operational intelligence layer for that network: one path from India to the PHC, with forecasts and explanations a person can check.

### 0:30–1:00 — National Dashboard

Stay on India. Point to the four national figures:

- 20 PHCs
- 20,802 visits
- 80 available beds
- 2 critical alerts

These come from the database, not from hardcoded cards. Mention the National PHC Map beside them: green is Normal, yellow is Attention, and red is Critical, and each marker also carries that word.

### 1:00–1:40 — Drill-down

Open Tamil Nadu, then Coimbatore, then Sulur.

On Sulur, open the medicine tab and show Paracetamol batch `PARA-TN-CBE-SUL-2606`:

- 150 stock
- 80 daily usage
- 1.9 stock days
- CRITICAL

Say that this is the live stock rule: quantity divided by daily use. Then use the breadcrumb to return to India.

### 1:40–2:20 — Forecast

Scroll to Demand Forecast & Early Warnings.

Explain that the server, not Gemini, calculated this from the latest 30 days of visits and from current stock. The horizon is 7 days. Sulur Paracetamol is still critical, at about 1.9 days. The footfall chart defaults to Baramati and separates recorded visits from the forecast line. A rising recent week is labelled in words, not only by colour.

### 2:20–3:00 — Emergency Simulation

Open Emergency Response Simulation. The scenario is Acute Respiratory Outbreak. Select +50%. The horizon is 7 days.

Show medicine pressure: Sulur Paracetamol moves to 120 simulated daily use and 1.25 stock days, still CRITICAL. Then show bed pressure: extra visits are converted at 5%, and projected occupancy cannot pass the real number of beds. Read the banner: this is a simulation, and no database record was changed.

### 3:00–3:40 — Redistribution + Gemini

In the same panel, show the redistribution opportunity:

Pattukkottai → Sulur, Paracetamol

The source still has surplus. The suggested quantity is a recommendation. The status is awaiting human approval, and no transfer has been executed.

Click Analyze Emergency with Gemini. When the reply appears, read the overall risk and one priority action. Say that Gemini only explains the simulation you just calculated. If Gemini is briefly busy, say so and continue. The numbers on screen do not depend on the model.

### 3:40–4:00 — Scale

Close on the hierarchy. The same screens work from India to a state, a district, and a PHC. The seed covers 6 states, 18 districts, and 20 PHCs so the demo stays small, and the API is already shaped as State → District → PHC so more states can be added without a new dashboard. Operational action still waits for a person.
