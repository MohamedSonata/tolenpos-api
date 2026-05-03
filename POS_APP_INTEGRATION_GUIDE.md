# POS App Integration Guide - Customer App Feature

## Overview

This guide explains what changes the POS application needs to implement to support customer-facing mobile app connections.

---

## Phase 1: Update License Activation Request

### What Changed

The POS app must now send `businessName` and `businessType` during license activation.

### Implementation

```typescript
// POS App: License activation request
const activationPayload = {
  licenseKey: encryptedLicenseKey,
  machineUUID: deviceUUID,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  telemetry: {
    os: 'Windows',
    appVersion: '1.0.0',
    hostname: 'POS-DEVICE-001',
    // NEW FIELDS REQUIRED:
    businessName: 'Joe\'s Pizza',
    businessType: 'restaurant' // Options: restaurant | retail | cafe | pharmacy | other
  }
};

const response = await fetch('https://api.example.com/api/licenses/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(activationPayload)
});

const result = await response.json();

// NEW: Response now includes publicSeatId
console.log('Public Seat ID:', result.data.seat.publicSeatId); // e.g., "REST42A"
console.log('Business Name:', result.data.seat.businessName);
console.log('Business Type:', result.data.seat.businessType);
console.log('Customer App Enabled:', result.data.seat.allowCustomerApp);
```

### Business Type Options

| Type | Description | Customer App Behavior |
|------|-------------|----------------------|
| `restaurant` | Full-service restaurant | Menu browsing with categories |
| `cafe` | Coffee shop, bakery | Menu browsing with categories |
| `retail` | General retail store | Barcode scanning for products |
| `pharmacy` | Pharmacy, drugstore | Barcode scanning for products |
| `other` | Other business types | Default behavior |

### UI Prompt for Business Info

Add a setup screen during first activation:

```typescript
// Example UI flow
async function setupBusiness() {
  const businessName = await promptUser('Enter your business name:');
  const businessType = await promptUser('Select business type:', [
    'restaurant',
    'retail',
    'cafe',
    'pharmacy',
    'other'
  ]);

  // Save to local config
  await saveConfig({ businessName, businessType });
  
  // Use in activation
  return { businessName, businessType };
}
```

---

## Phase 2: Display Public Seat ID

### What Changed

After activation, the POS receives a `publicSeatId` that customers use to connect.

### Implementation

#### 1. Store Public Seat ID

```typescript
// After successful activation
const { publicSeatId, businessName, allowCustomerApp } = result.data.seat;

// Save to local storage/config
await saveConfig({
  publicSeatId,
  businessName,
  allowCustomerApp
});
```

#### 2. Display QR Code

Install QR code library:
```bash
npm install qrcode
```

Generate and display QR code:
```typescript
import QRCode from 'qrcode';

async function displayCustomerQRCode(publicSeatId: string) {
  // Generate deep link for customer app
  const deepLink = `myapp://connect?seat=${publicSeatId}`;
  
  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(deepLink, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  // Display in UI
  document.getElementById('customer-qr').src = qrCodeDataUrl;
  document.getElementById('seat-id-text').textContent = publicSeatId;
}
```

#### 3. UI Layout Example

```html
<!-- Customer Connection Section -->
<div class="customer-connection-panel">
  <h3>Customer App Connection</h3>
  
  <div class="qr-code-container">
    <img id="customer-qr" alt="Scan to connect" />
  </div>
  
  <div class="seat-id-display">
    <label>Seat ID:</label>
    <span id="seat-id-text" class="seat-id">REST42A</span>
  </div>
  
  <div class="connection-status">
    <span id="customer-count">0</span> customers connected
  </div>
  
  <button onclick="printQRCode()">Print QR Code</button>
</div>
```

---

## Phase 3: Listen for Customer Query Events

### What Changed

The POS must now respond to customer queries via Socket.IO events.

### Socket.IO Event Handlers

#### 1. Menu Categories Request (Restaurant/Cafe)

```typescript
socket.on('pos:menu:categories:request', async (request) => {
  const { customerId, requestId } = request;

  console.log('[POS] Customer requesting menu categories:', customerId);

  try {
    // Fetch categories from local database
    const categories = await db.query(`
      SELECT id, name, description, image_url, sort_order
      FROM categories
      WHERE is_active = true
      ORDER BY sort_order ASC
    `);

    // Respond with categories
    socket.emit('pos:menu:categories:response', {
      customerId,
      requestId,
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        imageUrl: cat.image_url,
        sortOrder: cat.sort_order
      }))
    });

    console.log('[POS] Sent', categories.length, 'categories to customer');
  } catch (error) {
    console.error('[POS] Error fetching categories:', error);
  }
});
```

#### 2. Menu Products Request (Restaurant/Cafe)

```typescript
socket.on('pos:menu:products:request', async (request) => {
  const { customerId, requestId, categoryId } = request;

  console.log('[POS] Customer requesting products for category:', categoryId);

  try {
    // Fetch products for the category
    const products = await db.query(`
      SELECT id, name, description, price, image_url, stock
      FROM products
      WHERE category_id = ? AND is_active = true
      ORDER BY name ASC
    `, [categoryId]);

    // Respond with products
    socket.emit('pos:menu:products:response', {
      customerId,
      requestId,
      categoryId,
      products: products.map(prod => ({
        id: prod.id,
        name: prod.name,
        description: prod.description,
        price: prod.price,
        imageUrl: prod.image_url,
        isAvailable: prod.stock > 0
      }))
    });

    console.log('[POS] Sent', products.length, 'products to customer');
  } catch (error) {
    console.error('[POS] Error fetching products:', error);
  }
});
```

#### 3. Product Scan Request (Retail/Pharmacy)

```typescript
socket.on('pos:product:scan:request', async (request) => {
  const { customerId, requestId, barcode } = request;

  console.log('[POS] Customer scanning barcode:', barcode);

  try {
    // Lookup product by barcode
    const product = await db.queryOne(`
      SELECT id, name, description, price, image_url, stock, barcode
      FROM products
      WHERE barcode = ? AND is_active = true
    `, [barcode]);

    // Respond with product info
    socket.emit('pos:product:scan:response', {
      customerId,
      requestId,
      barcode,
      found: !!product,
      product: product ? {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.image_url,
        stock: product.stock,
        isAvailable: product.stock > 0
      } : null
    });

    if (product) {
      console.log('[POS] Product found:', product.name);
    } else {
      console.log('[POS] Product not found for barcode:', barcode);
    }
  } catch (error) {
    console.error('[POS] Error scanning product:', error);
  }
});
```

---

## Phase 4: Track Customer Connections

### Implementation

```typescript
let connectedCustomers = 0;

// Listen for customer connection updates from server
socket.on('seat:customer:connected', (data) => {
  const { publicSeatId, currentConnections, maxConnections, timestamp } = data;
  
  connectedCustomers = currentConnections;
  updateCustomerCountUI(connectedCustomers, maxConnections);
  
  console.log('[POS] Customer connected:', {
    publicSeatId,
    currentConnections,
    maxConnections,
    timestamp
  });
  
  // Optional: Show notification
  showNotification(`Customer connected (${currentConnections}/${maxConnections})`, 'info');
});

socket.on('seat:customer:disconnected', (data) => {
  const { publicSeatId, currentConnections, connectionDurationSeconds, timestamp } = data;
  
  connectedCustomers = currentConnections;
  updateCustomerCountUI(connectedCustomers);
  
  console.log('[POS] Customer disconnected:', {
    publicSeatId,
    currentConnections,
    connectionDurationSeconds,
    timestamp
  });
  
  // Optional: Show notification
  showNotification(`Customer disconnected (${currentConnections} remaining)`, 'info');
});

function updateCustomerCountUI(count: number, max?: number) {
  const countElement = document.getElementById('customer-count');
  countElement.textContent = max ? `${count}/${max}` : count.toString();
  
  // Optional: Add visual indicator
  if (count > 0) {
    countElement.classList.add('has-customers');
  } else {
    countElement.classList.remove('has-customers');
  }
}
```

### Event Payloads

#### `seat:customer:connected`
```typescript
{
  publicSeatId: string;        // e.g., "REST42A"
  currentConnections: number;  // Current number of connected customers
  maxConnections: number;      // Maximum allowed connections
  timestamp: string;           // ISO 8601 timestamp
}
```

#### `seat:customer:disconnected`
```typescript
{
  publicSeatId: string;              // e.g., "REST42A"
  currentConnections: number;        // Remaining connected customers
  connectionDurationSeconds: number; // How long the customer was connected
  timestamp: string;                 // ISO 8601 timestamp
}
```

### UI Example with Connection Status

```html
<!-- Customer Connection Section -->
<div class="customer-connection-panel">
  <h3>Customer App Connection</h3>
  
  <div class="qr-code-container">
    <img id="customer-qr" alt="Scan to connect" />
  </div>
  
  <div class="seat-id-display">
    <label>Seat ID:</label>
    <span id="seat-id-text" class="seat-id">REST42A</span>
  </div>
  
  <div class="connection-status">
    <span id="customer-count" class="count">0</span> customers connected
    <span class="status-indicator" id="status-indicator"></span>
  </div>
  
  <button onclick="printQRCode()">Print QR Code</button>
</div>

<style>
.count.has-customers {
  color: #28a745;
  font-weight: bold;
}

.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #dc3545;
  margin-left: 8px;
}

.count.has-customers + .status-indicator {
  background-color: #28a745;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
```

---

## Phase 5: Settings & Configuration

### Add Customer App Settings

```typescript
// Settings UI
interface CustomerAppSettings {
  enabled: boolean;
  businessName: string;
  businessType: 'restaurant' | 'retail' | 'cafe' | 'pharmacy' | 'other';
  publicSeatId: string;
  showQRCode: boolean;
  autoAcceptOrders: boolean; // Future feature
}

// Load settings
async function loadCustomerAppSettings(): Promise<CustomerAppSettings> {
  const config = await loadConfig();
  return {
    enabled: config.allowCustomerApp || false,
    businessName: config.businessName || '',
    businessType: config.businessType || 'retail',
    publicSeatId: config.publicSeatId || '',
    showQRCode: true,
    autoAcceptOrders: false
  };
}

// Settings UI component
function renderCustomerAppSettings(settings: CustomerAppSettings) {
  return `
    <div class="settings-section">
      <h3>Customer App</h3>
      
      <div class="setting-item">
        <label>Status:</label>
        <span class="${settings.enabled ? 'enabled' : 'disabled'}">
          ${settings.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      
      <div class="setting-item">
        <label>Business Name:</label>
        <input type="text" value="${settings.businessName}" readonly />
      </div>
      
      <div class="setting-item">
        <label>Business Type:</label>
        <span>${settings.businessType}</span>
      </div>
      
      <div class="setting-item">
        <label>Public Seat ID:</label>
        <span class="seat-id">${settings.publicSeatId}</span>
        <button onclick="copyToClipboard('${settings.publicSeatId}')">Copy</button>
      </div>
      
      <div class="setting-item">
        <label>Show QR Code:</label>
        <input type="checkbox" ${settings.showQRCode ? 'checked' : ''} 
               onchange="toggleQRCodeDisplay(this.checked)" />
      </div>
    </div>
  `;
}
```

---

## Phase 6: Print QR Code

### Implementation

```typescript
async function printQRCode() {
  const config = await loadConfig();
  const { publicSeatId, businessName } = config;

  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(`myapp://connect?seat=${publicSeatId}`, {
    width: 400,
    margin: 3
  });

  // Create print window
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Customer Connection QR Code</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 40px;
        }
        h1 { font-size: 24px; margin-bottom: 10px; }
        .seat-id { font-size: 32px; font-weight: bold; margin: 20px 0; }
        img { max-width: 400px; }
        .instructions { margin-top: 20px; font-size: 14px; color: #666; }
      </style>
    </head>
    <body>
      <h1>${businessName}</h1>
      <div class="seat-id">Seat ID: ${publicSeatId}</div>
      <img src="${qrCodeDataUrl}" alt="QR Code" />
      <div class="instructions">
        Scan this QR code with the customer app to connect
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  
  // Auto-print after a short delay
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}
```

---

## Phase 7: Error Handling

### Implementation

```typescript
// Handle Socket.IO errors
socket.on('error', (error) => {
  console.error('[POS] Socket.IO error:', error);
  showNotification('Connection error. Customer app may not work.', 'error');
});

socket.on('disconnect', () => {
  console.warn('[POS] Disconnected from server');
  showNotification('Disconnected. Customer app unavailable.', 'warning');
});

socket.on('reconnect', () => {
  console.log('[POS] Reconnected to server');
  showNotification('Reconnected. Customer app available.', 'success');
});

// Handle customer query errors
function handleCustomerQueryError(customerId: string, requestId: string, error: Error) {
  console.error('[POS] Error handling customer query:', error);
  
  // Send error response to customer
  socket.emit('pos:query:error', {
    customerId,
    requestId,
    error: 'Failed to process request'
  });
}
```

---

## Testing Checklist

### Before Deployment

- [ ] Business name and type prompted during setup
- [ ] Public seat ID received and stored after activation
- [ ] QR code displays correctly
- [ ] Menu categories request handler working
- [ ] Menu products request handler working
- [ ] Barcode scan request handler working
- [ ] Customer connection count updates
- [ ] QR code prints correctly
- [ ] Settings page shows customer app status

### Test Scenarios

1. **Activation Flow**
   - Activate license with business info
   - Verify public seat ID received
   - Verify QR code generated

2. **Restaurant/Cafe Flow**
   - Customer requests categories
   - POS responds with categories
   - Customer requests products
   - POS responds with products

3. **Retail/Pharmacy Flow**
   - Customer scans barcode
   - POS looks up product
   - POS responds with product info

4. **Connection Tracking**
   - Customer connects
   - Connection count increases
   - Customer disconnects
   - Connection count decreases

---

## Troubleshooting

### QR Code Not Displaying

```typescript
// Check if publicSeatId exists
if (!config.publicSeatId) {
  console.error('No public seat ID available');
  showNotification('Customer app not configured. Please reactivate license.', 'error');
  return;
}
```

### Customer Queries Not Received

```typescript
// Verify Socket.IO connection
if (!socket.connected) {
  console.error('Socket.IO not connected');
  showNotification('Not connected to server. Customer app unavailable.', 'error');
  return;
}

// Check event listeners registered
console.log('Registered event listeners:', socket.eventNames());
```

### Database Query Errors

```typescript
// Add error handling to all database queries
try {
  const products = await db.query(/* ... */);
} catch (error) {
  console.error('Database error:', error);
  // Send error response to customer
  socket.emit('pos:query:error', {
    customerId,
    requestId,
    error: 'Database error'
  });
}
```

---

## Summary

The POS app needs these changes:

1. **Activation**: Send `businessName` and `businessType`
2. **Display**: Show `publicSeatId` and QR code
3. **Events**: Listen for and respond to customer queries
4. **UI**: Add customer app settings and status display
5. **Print**: Support QR code printing for table tents/receipts

All changes are backward compatible - existing POS functionality remains unchanged.
