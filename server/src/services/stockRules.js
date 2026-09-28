// Shared stock rules for list, summary, and alert queries.
// OUT_OF_STOCK: nothing left
// CRITICAL: 3 days of supply or less
// LOW: more than 3 days and up to 7 days
// EXCESS: more than 180 days of supply, or stock with no current use
// HEALTHY: everything else
// Zero daily use does not divide; stock_days is null.

const stockDaysSql = `CASE
  WHEN ms.daily_average_usage = 0 THEN NULL
  ELSE ROUND(ms.current_quantity / ms.daily_average_usage, 1)
END`;

const stockStatusSql = `CASE
  WHEN ms.current_quantity = 0 THEN 'OUT_OF_STOCK'
  WHEN ms.daily_average_usage = 0 THEN 'EXCESS'
  WHEN (ms.current_quantity / ms.daily_average_usage) <= 3 THEN 'CRITICAL'
  WHEN (ms.current_quantity / ms.daily_average_usage) <= 7 THEN 'LOW'
  WHEN (ms.current_quantity / ms.daily_average_usage) > 180 THEN 'EXCESS'
  ELSE 'HEALTHY'
END`;

export { stockDaysSql, stockStatusSql };
