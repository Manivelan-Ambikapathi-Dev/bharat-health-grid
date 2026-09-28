# Bharat Health Grid database

MySQL schema and sample data for India's Primary Health Centre (PHC) network. The script creates the `bharat_health_grid` database, the healthcare tables below, and realistic seed data. Demo logins are added afterwards by `seed_users.sql`.

The stock, bed, and attendance figures are a snapshot for **26 September 2026**. Patient visits run for the 30 days ending on that date.

## Purpose

The database gives the hackathon a shared operational picture across states:

- which PHC sits in which district and state
- medicine batches on hand, including shortages, excess, and near-expiry stock
- current bed occupancy
- who works at each PHC and whether they attended
- daily patient footfall for later forecasting

## Tables

| Table | Grain | What it stores |
| --- | --- | --- |
| `states` | one row per state | State name and two-letter code |
| `districts` | one row per district | District name and its state |
| `phcs` | one row per PHC | Facility code, coordinates, population covered, and status |
| `medicines` | one row per medicine | Name, generic name, category, unit, and reorder level |
| `medicine_stock` | one row per PHC, medicine, and batch | Quantity received, quantity left, daily use, dates, and supplier |
| `beds` | one current row per PHC | Total, occupied, and available beds |
| `personnel` | one row per staff member | Name, role, specialization, and employment status |
| `personnel_attendance` | one row per person per day | Present, Absent, or Leave, with check-in and check-out when present |
| `patient_footfall` | one row per PHC per day | Total, emergency, and outpatient visits |
| `users` | one row per demo login | Username, password hash, role, and state, district, or PHC scope |

Seed size:

| Table | Rows |
| --- | ---: |
| `states` | 6 |
| `districts` | 18 |
| `phcs` | 20 |
| `medicines` | 12 |
| `medicine_stock` | 241 |
| `beds` | 20 |
| `personnel` | 120 |
| `personnel_attendance` | 1,200 |
| `patient_footfall` | 600 |

## Relationships

```text
states
  └── districts
        └── phcs
              ├── medicine_stock ── medicines
              ├── beds
              ├── personnel
              │     └── personnel_attendance
              └── patient_footfall
```

- A district belongs to one state. A PHC belongs to one district.
- A stock row belongs to one PHC, one medicine, and one batch. The same medicine can have more than one batch at a PHC.
- Bed counts are the current position for that PHC, not a history.
- A staff member belongs to one PHC. An attendance row belongs to that person, that same PHC, and one date. The foreign key rejects a row that names a different PHC.
- A footfall row belongs to one PHC and one date. Emergency and outpatient visits add up to the total. Occupied and available beds add up to the total beds.

## Situations in the sample

These are ordinary rows, marked here so a later demo can find them.

| Situation | Where to look |
| --- | --- |
| Low stock and high daily use | `TN-CBE-SUL`, paracetamol batch `PARA-TN-CBE-SUL-2606` (150 tablets, 80 used per day) |
| Excess of the same medicine | `TN-TNJ-PTK`, paracetamol batch `PARA-TN-TNJ-PTK-2603` (7,600 tablets, 16 used per day) |
| Near expiry | `KL-KKD-BAL`, insulin batch `INS-KL-KKD-BAL-2604`, expires 25 October 2026 |
| Rising patient load | Pune district: Mulshi, Baramati, and Junnar, 28 August 2026 through 26 September 2026. Baramati also spikes on 16 September 2026 |
| High bed occupancy | `OD-GNJ-DIG`, 5 of 6 beds occupied |
| Staff absence | `RJ-JAI-BAS`: medical officer Mahesh Sharma is on leave for all 10 attendance days; nurse Sunita Yadav and health worker Bhanwar Lal miss several of those days |

Other batches include a finished paracetamol batch at Sulur, low amoxicillin at Sinnar, low cetirizine at Gokak, a short ORS position at Melur and at Digapahandi, excess albendazole at Nanjangud, and near-expiry azithromycin at Anekal. Most remaining batches are healthy.

## Create and load the database

Requires MySQL 8 or MariaDB 10.2 or newer. The script uses InnoDB, `utf8mb4`, foreign keys, and checked constraints.

From the `bharat-health-grid` directory:

```bash
mysql -u root -p < database/schema.sql
```

On this machine, with XAMPP's MariaDB client:

```bash
C:\xampp\mysql\bin\mysql.exe -u root < database/schema.sql
```

`schema.sql` drops `bharat_health_grid` if it already exists, creates it, builds the tables, and inserts the healthcare seed. Running it again replaces the database. Load demo logins after that, without reloading the healthcare data:

```bash
mysql -u root -p < database/seed_users.sql
```

```bash
C:\xampp\mysql\bin\mysql.exe -u root < database/seed_users.sql
```

`seed_users.sql` creates `users` if needed and inserts four demo accounts. The shared demo password is `BHG@12345`. The file stores only a bcrypt hash.

To inspect it:

```sql
USE bharat_health_grid;
SHOW TABLES;
```

## Assumptions

- State codes are the usual two-letter abbreviations (`TN`, `KL`, `KA`, `MH`, `RJ`, `OD`), not census numeric codes.
- Each state has three sample districts, not a complete district list. Facility coordinates are town or block centres in those districts.
- Phalodi and Salumber are not used as district names, because both became separate districts. Osian stands in for Jodhpur district, and Mavli for Udaipur district.
- Suppliers are the state medical supply corporations.
- `daily_average_usage` is the current consumption rate for that batch. A finished batch uses `0` so it is not treated as active demand.
- Attendance covers 17 September 2026 through 26 September 2026. Check-in and check-out are stored only when status is `Present`.
- All sample PHCs are `active`.
