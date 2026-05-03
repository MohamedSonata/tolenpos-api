# Sales Insights API

## Overview

The Sales Insights API provides date-based sales analytics with rich category-level details by intelligently routing between different data sources based on the requested date:
- **Today**: Real-time telemetry data
- **Yesterday**: Cached historical KPI summary
- **Older dates**: Historical snapshots

## Endpoint

```
GET /api/key-seats/sales-insights?date=YYYY-MM-DD
```

**Authentication**: Required (JWT Bearer token)

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `date` | string | No | Today | Target date in ISO format (YYYY-MM-DD) |

## Data Source Routing

### Today's Date
- **Data Source**: `key-seat.realtimeTelemetry`
- **Aggregation**: Sums KPI data across all active seats
- **Response Field**: `dataSource: "realtime"`
- **Limitations**: No category breakdown, no grossProfit/margin (realtime data doesn't include these)

### Yesterday's Date
- **Data Source**: `key-seat.historicalKpiSummary.yesterday`
- **Aggregation**: Sums cached yesterday data across all active seats
- **Response Field**: `dataSource: "cached-yesterday"`
- **Benefits**: Fast access, includes category breakdown with detailed metrics

### Older Dates (2+ days ago)
- **Data Source**: `seat-telemetry-history.historicalKpiSummary.yesterday`
- **Aggregation**: Queries daily snapshots for target date, sums across all user's seats
- **Response Field**: `dataSource: "historical"`
- **Benefits**: Full historical data with category breakdown

## Response Structure

### Today's Response (Realtime)
```typescript
{
  success: true,
  data: {
    date: "2026-05-02",
    isToday: true,
    dataSource: "realtime",
    seatsCount: 5,
    insights: {
      totalSales: 15420.50,
      transactionCount: 87,
      averageTransactionValue: 177.25,
      grossProfit: 0,                    // Not available in realtime
      marginPercentage: 0,               // Not available in realtime
      totalExpenses: 1250.00,
      netProfit: 14170.50,
      profitMargin: 91.89,
      lastOrders: [...],                 // Top 10 recent orders
      expenses: [...],                   // All expenses
      expensesByCategory: {...},
      categories: []                     // Not available in realtime
    }
  }
}
```

### Yesterday's Response (Cached)
```typescript
{
  success: true,
  data: {
    date: "2026-05-01",
    isToday: false,
    dataSource: "cached-yesterday",
    seatsCount: 5,
    insights: {
      totalSales: 18750.00,
      transactionCount: 102,
      averageTransactionValue: 183.82,
      grossProfit: 5625.00,              // Available from historicalKpiSummary
      marginPercentage: 30.00,           // Available from historicalKpiSummary
      categories: [                      // Full category breakdown
        {
          categoryId: "cat-001",
          categoryName: "Beverages",
          totalRevenue: 8500.00,
          totalQuantitySold: 450,
          transactionCount: 85
        },
        {
          categoryId: "cat-002",
          categoryName: "Food",
          totalRevenue: 7200.00,
          totalQuantitySold: 320,
          transactionCount: 78
        },
        {
          categoryId: "cat-003",
          categoryName: "Snacks",
          totalRevenue: 3050.00,
          totalQuantitySold: 180,
          transactionCount: 62
        }
      ],
      topCategories: [...]               // Top 5 categories by revenue
    }
  }
}
```

### Historical Response (Older Dates)
```typescript
{
  success: true,
  data: {
    date: "2026-04-28",
    isToday: false,
    dataSource: "historical",
    seatsCount: 5,
    snapshotsFound: 4,                   // Number of snapshots found
    insights: {
      totalSales: 16200.00,
      transactionCount: 95,
      averageTransactionValue: 170.53,
      grossProfit: 4860.00,
      marginPercentage: 30.00,
      categories: [                      // Full category breakdown
        {
          categoryId: "cat-001",
          categoryName: "Beverages",
          totalRevenue: 7500.00,
          totalQuantitySold: 420,
          transactionCount: 80
        }
      ],
      topCategories: [...]               // Top 5 categories by revenue
    }
  }
}
```

## Category Insights

The `categories` array provides detailed performance metrics for each product category:

| Field | Type | Description |
|-------|------|-------------|
| `categoryId` | string | Unique category identifier |
| `categoryName` | string | Display name of the category |
| `totalRevenue` | number | Total sales revenue for this category |
| `totalQuantitySold` | number | Total number of items sold |
| `transactionCount` | number | Number of transactions including this category |

**Use Cases**:
- Identify best-selling categories
- Track category performance over time
- Optimize inventory based on sales velocity
- Analyze customer preferences

## Error Responses

### No Data Available
```json
{
  "success": true,
  "data": {
    "date": "2026-05-01",
    "isToday": false,
    "dataSource": "historical",
    "insights": null,
    "seatsCount": 5,
    "snapshotsFound": 0,
    "message": "No snapshots found for this date"
  }
}
```

### Invalid Date Format
```json
{
  "error": {
    "status": 400,
    "message": "Invalid date format. Use YYYY-MM-DD"
  }
}
```

## Usage Examples

### Get Today's Sales Insights
```bash
curl -X GET "https://api.example.com/api/key-seats/sales-insights" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Yesterday's Sales Insights (with categories)
```bash
curl -X GET "https://api.example.com/api/key-seats/sales-insights?date=2026-05-01" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Historical Sales Insights
```bash
curl -X GET "https://api.example.com/api/key-seats/sales-insights?date=2026-04-28" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript/TypeScript Example
```typescript
async function getSalesInsights(date?: string) {
  const url = new URL('/api/key-seats/sales-insights', 'https://api.example.com');
  
  if (date) {
    url.searchParams.set('date', date);
  }
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
}

// Today's insights (realtime, no categories)
const todayInsights = await getSalesInsights();

// Yesterday's insights (cached, with categories)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayInsights = await getSalesInsights(yesterday.toISOString().split('T')[0]);

// Last week's insights (historical, with categories)
const lastWeek = new Date();
lastWeek.setDate(lastWeek.getDate() - 7);
const lastWeekInsights = await getSalesInsights(lastWeek.toISOString().split('T')[0]);
```

## Implementation Details

### Service Methods

#### `getSalesInsights(userDocumentId, targetDate)`
Main router that determines data source based on date:
- Today → `getTodaySalesInsights()`
- Yesterday → `getYesterdaySalesInsights()`
- Older → `getHistoricalSalesInsights()`

#### `getTodaySalesInsights(userDocumentId)`
Aggregates from `key-seat.realtimeTelemetry` (limited data, no categories)

#### `getYesterdaySalesInsights(userDocumentId)`
Aggregates from `key-seat.historicalKpiSummary.yesterday` (fast, includes categories)

#### `getHistoricalSalesInsights(userDocumentId, targetDate)`
Queries `seat-telemetry-history.historicalKpiSummary.yesterday` for specific date

### Data Flow

```
Request → Controller → Service
                         ↓
                    Date Check
                    ↙    ↓    ↘
              Today  Yesterday  Older
               ↓        ↓        ↓
    realtimeTelemetry  historicalKpiSummary  seat-telemetry-history
               ↓        ↓        ↓
           Aggregate  Aggregate  Aggregate
               ↓        ↓        ↓
            Response ← Response ← Response
```

## Performance Considerations

- **Today**: Fast (single query to active seats)
- **Yesterday**: Fastest (cached data in key-seat records)
- **Historical**: Moderate (queries snapshots with date filter)

## Data Availability Notes

- **Realtime Data**: Always available for active seats
- **Yesterday Data**: Available after POS sends historicalKpiSummary update
- **Historical Data**: Depends on daily snapshot cron job (runs at 23:55 local time per seat)

## Related Endpoints

- `GET /api/key-seats/my-seats` - Get all user's seats with minimal telemetry
- `GET /api/key-seats/aggregated-kpi` - Get aggregated historical KPI (yesterday, thisWeek, thisMonth)
- `GET /api/key-seats/:documentId/telemetry/latest` - Get latest snapshot for a specific seat
