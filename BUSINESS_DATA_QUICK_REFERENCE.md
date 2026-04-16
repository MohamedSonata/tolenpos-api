# Business Data Quick Reference

## 🎯 Quick Overview

The POS telemetry system now supports sending business data (orders, KPIs, expenses) to the backend for real-time monitoring by store owners.

## 📦 What's New

Three new optional fields in telemetry:

| Field | Type | Description |
|-------|------|-------------|
| `lastOrder` | `LastOrderData \| null` | Most recent order details |
| `kpiSummary` | `KPISummaryData \| null` | Today's sales metrics |
| `expenses` | `ExpenseData[]` | Last 10 expenses from today |

## 🔧 Implementation Checklist

### Backend (✅ Complete)
- [x] TypeScript interfaces defined
- [x] Handler accepts business data
- [x] Data stored in key-seat.telemetry
- [x] Historical snapshots created
- [x] Mobile apps receive updates
- [x] Logging and monitoring added
- [x] Documentation created

### POS App (⚠️ To Implement)
- [ ] Create BusinessDataCollector service
- [ ] Implement collectLastOrder()
- [ ] Implement collectKPISummary()
- [ ] Implement collectExpenses()
- [ ] Update telemetry collection
- [ ] Add error handling
- [ ] Test with backend

### Mobile App (⚠️ To Update)
- [ ] Update UI to display business data
- [ ] Handle null values gracefully
- [ ] Add KPI visualizations
- [ ] Add expense tracking views
- [ ] Test real-time updates

## 📝 Data Structures

### LastOrderData
```typescript
{
  receiptNumber: string;
  total: number;
  itemCount: number;
  paymentMethod: "card" | "cash" | "mobile";
  status: "completed" | "pending" | "cancelled";
  createdAt: string;  // ISO 8601
  items?: OrderItem[];
  customer?: CustomerInfo;
}
```

### KPISummaryData
```typescript
{
  totalSales: number;
  transactionCount: number;
  averageTransactionValue: number;
  period: string;  // "today"
  lastUpdated: string;  // ISO 8601
}
```

### ExpenseData
```typescript
{
  id: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod: "card" | "cash";
  expenseDate: string;  // ISO 8601
  isUrgent: boolean;
}
```

## 💻 Code Snippets

### Collect Business Data
```typescript
// Collect all business data
const [lastOrder, kpiSummary, expenses] = await Promise.all([
  orderRepository.findMostRecent(),
  calculateTodayKPIs(),
  expenseRepository.findTodayExpenses(10)
]);
```

### Send Telemetry
```typescript
socket.emit('seat:update', {
  telemetry: {
    networkStatus: "online",
    lastSyncTime: new Date().toISOString(),
    lastOrder,      // Can be null
    kpiSummary,     // Can be null
    expenses,       // Can be []
    // ... other fields
  }
});
```

### Handle Errors
```typescript
try {
  telemetry.lastOrder = await collectLastOrder();
} catch (error) {
  console.error('Failed to collect lastOrder:', error);
  telemetry.lastOrder = null;  // Graceful degradation
}
```

## 🧪 Testing

### Using test-pos-app.html
1. Open `test-pos-app.html` in browser
2. Configure connection (license key, user ID, machine UUID)
3. Click "Connect to Server"
4. Click "Send Telemetry Update" (includes business data)
5. Click "Send Random Telemetry" for realistic test data

### Verify in Strapi
1. Open Strapi admin panel
2. Navigate to Key-Seats collection
3. View seat's telemetry field
4. Check for `lastOrder`, `kpiSummary`, `expenses`

## 📊 Example Payload

```json
{
  "telemetry": {
    "networkStatus": "online",
    "lastSyncTime": "2024-01-15T10:30:45.123Z",
    "lastOrder": {
      "receiptNumber": "RCP-2024-001234",
      "total": 125.50,
      "itemCount": 3,
      "paymentMethod": "card",
      "status": "completed",
      "createdAt": "2024-01-15T10:25:30.000Z"
    },
    "kpiSummary": {
      "totalSales": 3450.75,
      "transactionCount": 42,
      "averageTransactionValue": 82.16,
      "period": "today",
      "lastUpdated": "2024-01-15T10:30:45.123Z"
    },
    "expenses": [
      {
        "id": "exp-001",
        "title": "Office Supplies",
        "amount": 125.00,
        "category": "Supplies",
        "paymentMethod": "card",
        "expenseDate": "2024-01-15T09:00:00.000Z",
        "isUrgent": false
      }
    ]
  }
}
```

## ⚠️ Important Notes

### Null Handling
- `lastOrder`: Set to `null` if no orders exist
- `kpiSummary`: Set to `null` if no sales data
- `expenses`: Set to `[]` (empty array) if no expenses

### Update Triggers
Send telemetry updates:
- After each transaction completes
- After expense creation
- Every 30-60 seconds (automatic)
- On network reconnection

### Performance
- Use `Promise.all()` for parallel data collection
- Implement individual error handling per field
- Consider caching KPIs if calculations are expensive
- Limit expenses to 10 most recent

## 🔗 Related Documentation

| Document | Purpose |
|----------|---------|
| [TELEMETRY_DATA_STRUCTURE.md](./TELEMETRY_DATA_STRUCTURE.md) | Complete field specifications |
| [BUSINESS_DATA_IMPLEMENTATION_SUMMARY.md](./BUSINESS_DATA_IMPLEMENTATION_SUMMARY.md) | Detailed implementation guide |
| [POS_INTEGRATION_GUIDE.md](./POS_INTEGRATION_GUIDE.md) | Full POS integration documentation |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Testing procedures |

## 🚀 Next Steps

### For POS Development
1. Review [BUSINESS_DATA_IMPLEMENTATION_SUMMARY.md](./BUSINESS_DATA_IMPLEMENTATION_SUMMARY.md)
2. Implement BusinessDataCollector service
3. Update telemetry collection to include business data
4. Test with test-pos-app.html
5. Deploy to production

### For Mobile Development
1. Review [TELEMETRY_DATA_STRUCTURE.md](./TELEMETRY_DATA_STRUCTURE.md)
2. Update UI components to display business data
3. Add null checks for optional fields
4. Test with real-time updates
5. Deploy to production

## 📞 Support

If you encounter issues:
1. Check backend logs for business data presence
2. Verify telemetry payload structure
3. Test with test-pos-app.html
4. Review error handling implementation
5. Check network connectivity

## ✅ Validation Checklist

Before deploying:
- [ ] Business data collection implemented
- [ ] Error handling for each field
- [ ] Null values handled correctly
- [ ] Telemetry sends successfully
- [ ] Backend logs show business data
- [ ] Mobile app displays data correctly
- [ ] Historical snapshots created
- [ ] Performance is acceptable
