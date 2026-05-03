# Sales Insights Implementation Summary

## Overview

Refactored the Sales Insights API to leverage the rich `historicalKpiSummary` data structure, which provides detailed category-level analytics including revenue, quantity sold, and transaction counts per category.

## Key Changes

### 1. Three-Tier Data Source Strategy

**Before**: Two-tier (today vs historical)
**After**: Three-tier routing based on date:

| Date | Data Source | Field | Benefits |
|------|-------------|-------|----------|
| **Today** | `key-seat.realtimeTelemetry` | `kpiSummary` | Live data, but limited (no categories, no grossProfit) |
| **Yesterday** | `key-seat.historicalKpiSummary` | `yesterday` | Fast cached access with full category breakdown |
| **Older** | `seat-telemetry-history.historicalKpiSummary` | `yesterday` | Historical snapshots with full category breakdown |

### 2. Rich Category Analytics

The `historicalKpiSummary.yesterday` (and other periods) contains:

```typescript
{
  totalSales: number,
  transactionCount: number,
  averageTransactionValue: number,
  grossProfit: number,
  marginPercentage: number,
  categories: [
    {
      categoryId: string,
      categoryName: string,
      totalRevenue: number,        // Sales for this category
      totalQuantitySold: number,   // Items sold
      transactionCount: number     // Transactions including this category
    }
  ]
}
```

### 3. Service Method Architecture

```
getSalesInsights(userDocumentId, targetDate)
  ├─ isToday? → getTodaySalesInsights()
  │              └─ Aggregates: realtimeTelemetry.kpiSummary
  │                 Returns: Basic KPIs (no categories)
  │
  ├─ isYesterday? → getYesterdaySalesInsights()
  │                  └─ Aggregates: historicalKpiSummary.yesterday
  │                     Returns: Full KPIs + category breakdown
  │
  └─ isOlder? → getHistoricalSalesInsights()
                 └─ Aggregates: seat-telemetry-history.historicalKpiSummary.yesterday
                    Returns: Full KPIs + category breakdown
```

## Implementation Details

### getTodaySalesInsights()
- **Query**: Active seats with `realtimeTelemetry`
- **Populate**: `realtimeTelemetry.kpiSummary`, `lastOrder`, `expenses`
- **Aggregation**: Sum `totalSales`, `transactionCount` across seats
- **Limitations**: No `grossProfit`, `marginPercentage`, or `categories`
- **Use Case**: Real-time dashboard showing current day performance

### getYesterdaySalesInsights()
- **Query**: Active seats with `historicalKpiSummary`
- **Populate**: `historicalKpiSummary.yesterday.categories`
- **Aggregation**: 
  - Sum KPIs across seats
  - Merge categories by `categoryId`, sum their metrics
- **Benefits**: Fast (no snapshot query), complete data
- **Use Case**: Yesterday's performance review with category insights

### getHistoricalSalesInsights()
- **Query**: Daily snapshots for target date
- **Populate**: `historicalKpiSummary` (component auto-populates nested data)
- **Aggregation**: Same as yesterday, but from snapshots
- **Note**: Snapshot's `historicalKpiSummary.yesterday` contains the day before snapshot was created
- **Use Case**: Historical analysis, trend reports, date range comparisons

## Category Aggregation Logic

```typescript
// Map to merge categories across multiple seats
const categoryMap = new Map<categoryId, {
  categoryId,
  categoryName,
  totalRevenue,      // Sum across seats
  totalQuantitySold, // Sum across seats
  transactionCount   // Sum across seats
}>();

// For each seat's categories
for (const category of seat.historicalKpiSummary.yesterday.categories) {
  if (categoryMap.has(category.categoryId)) {
    // Merge with existing
    existing.totalRevenue += category.totalRevenue;
    existing.totalQuantitySold += category.totalQuantitySold;
    existing.transactionCount += category.transactionCount;
  } else {
    // Add new category
    categoryMap.set(category.categoryId, { ...category });
  }
}

// Convert to sorted array (by revenue)
const categories = Array.from(categoryMap.values())
  .sort((a, b) => b.totalRevenue - a.totalRevenue);
```

## Response Structure Comparison

### Today (Realtime)
```json
{
  "dataSource": "realtime",
  "insights": {
    "totalSales": 15420.50,
    "transactionCount": 87,
    "averageTransactionValue": 177.25,
    "grossProfit": 0,           // ❌ Not available
    "marginPercentage": 0,      // ❌ Not available
    "categories": []            // ❌ Not available
  }
}
```

### Yesterday/Historical (Cached/Snapshots)
```json
{
  "dataSource": "cached-yesterday",
  "insights": {
    "totalSales": 18750.00,
    "transactionCount": 102,
    "averageTransactionValue": 183.82,
    "grossProfit": 5625.00,     // ✅ Available
    "marginPercentage": 30.00,  // ✅ Available
    "categories": [             // ✅ Full breakdown
      {
        "categoryId": "cat-001",
        "categoryName": "Beverages",
        "totalRevenue": 8500.00,
        "totalQuantitySold": 450,
        "transactionCount": 85
      }
    ],
    "topCategories": [...]      // ✅ Top 5
  }
}
```

## Performance Characteristics

| Data Source | Query Complexity | Response Time | Data Completeness |
|-------------|------------------|---------------|-------------------|
| Realtime | Low (1 query) | ~50-100ms | Basic |
| Yesterday | Low (1 query) | ~50-100ms | Complete |
| Historical | Medium (2 queries) | ~100-200ms | Complete |

## Use Cases

### Mobile App Dashboard
```typescript
// Show today's live performance
const today = await getSalesInsights();
// Limited data, but real-time

// Show yesterday's complete analysis
const yesterday = await getSalesInsights('2026-05-01');
// Full category breakdown, fast access
```

### Analytics Reports
```typescript
// Compare last 7 days
const insights = await Promise.all(
  last7Days.map(date => getSalesInsights(date))
);

// Each historical day includes:
// - Total sales, transactions, profit
// - Category performance breakdown
// - Top performing categories
```

### Category Performance Tracking
```typescript
const insights = await getSalesInsights('2026-05-01');

// Identify best sellers
const topCategory = insights.data.insights.topCategories[0];
console.log(`Best: ${topCategory.categoryName} - $${topCategory.totalRevenue}`);

// Calculate category contribution
insights.data.insights.categories.forEach(cat => {
  const contribution = (cat.totalRevenue / insights.data.insights.totalSales) * 100;
  console.log(`${cat.categoryName}: ${contribution.toFixed(1)}%`);
});
```

## Data Flow Diagram

```
Mobile App Request
      ↓
GET /api/key-seats/sales-insights?date=2026-05-01
      ↓
Controller: getSalesInsights()
      ↓
Service: Determine date type
      ↓
   ┌──┴──┬──────────┐
   ↓     ↓          ↓
 Today Yesterday  Older
   ↓     ↓          ↓
   │     │          │
   │     │    Query snapshots
   │     │    (seat-telemetry-history)
   │     │          ↓
   │     │    Extract historicalKpiSummary.yesterday
   │     │          ↓
   │     Query seats
   │     (key-seat)
   │          ↓
   │    Extract historicalKpiSummary.yesterday
   │          ↓
   Query seats
   (key-seat)
      ↓
Extract realtimeTelemetry.kpiSummary
      ↓
   ┌──┴──┬──────────┐
   ↓     ↓          ↓
Aggregate categories
   ↓     ↓          ↓
   └──┬──┴──────────┘
      ↓
Response with insights
```

## Migration Notes

### Breaking Changes
None - this is a new endpoint

### Backward Compatibility
- Existing endpoints unchanged
- New endpoint follows same auth pattern
- Response structure is additive (categories field added)

### Testing Recommendations
1. Test today's insights (should return realtime data, no categories)
2. Test yesterday's insights (should return cached data with categories)
3. Test historical insights (should query snapshots with categories)
4. Test with multiple seats (verify aggregation)
5. Test with missing data (verify graceful handling)

## Future Enhancements

1. **Date Range Queries**: Support `?startDate=X&endDate=Y` for multi-day aggregation
2. **Category Filtering**: Support `?categoryId=X` to filter specific categories
3. **Seat-Level Breakdown**: Add `?includeSeatBreakdown=true` for per-seat details
4. **Caching**: Add Redis caching for frequently accessed historical dates
5. **Comparison Mode**: Add `?compare=true` to include previous period comparison

## Related Files

- Service: `src/api/key-seat/services/key-seat.ts`
- Controller: `src/api/key-seat/controllers/key-seat.ts`
- Routes: `src/api/key-seat/routes/01-custom-routes.ts`
- Schema: `src/components/telemetry/historical-kpi-summary.json`
- Schema: `src/components/telemetry/period-kpi.json`
- Schema: `src/components/telemetry/category-performance.json`
- Documentation: `SALES_INSIGHTS_API.md`
