# Customer Mobile App Integration Guide

## Overview

This guide explains how to build a customer-facing mobile app that connects to POS devices via the backend server.

---

## Architecture

```
Customer App → Backend Server → POS Device
     ↓              ↓               ↓
  Socket.IO    Socket.IO       Socket.IO
  (no auth)    (routing)       (authenticated)
```

### Key Concepts

1. **No Authentication Required**: Customers connect using only a `publicSeatId`
2. **Business-Type-Specific UI**: Different flows for restaurant vs retail
3. **Real-Time Communication**: All queries use Socket.IO for instant responses
4. **Targeted Responses**: Each customer only receives their own query results

---

## Phase 1: Setup & Dependencies

### Install Required Packages

```bash
npm install socket.io-client
npm install @capacitor-community/barcode-scanner  # For retail/pharmacy
npm install react-qr-reader  # For QR code scanning
```

### Project Structure

```
src/
├── services/
│   ├── socket.service.ts       # Socket.IO connection management
│   └── seat.service.ts         # Seat info API calls
├── screens/
│   ├── QRScanScreen.tsx        # Scan seat QR code
│   ├── ConnectScreen.tsx       # Connect to seat
│   ├── MenuScreen.tsx          # Restaurant/cafe menu browsing
│   └── BarcodeScanScreen.tsx   # Retail/pharmacy product scanning
├── types/
│   └── seat.types.ts           # TypeScript interfaces
└── utils/
    └── deeplink.handler.ts     # Handle myapp://connect?seat=XXX
```

---

## Phase 2: Socket.IO Service

### File: `src/services/socket.service.ts`

```typescript
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private serverUrl = 'https://api.example.com';

  /**
   * Connect to server as customer (no authentication)
   */
  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(this.serverUrl, {
      query: { clientType: 'customer' },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupEventListeners();
    return this.socket;
  }

  /**
   * Connect to a specific seat
   */
  connectToSeat(publicSeatId: string): Promise<SeatConnectionResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('customer:connect', { publicSeatId });

      this.socket.once('customer:connect:success', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
    });
  }

  /**
   * Request menu categories (restaurant/cafe)
   */
  requestMenuCategories(): Promise<MenuCategoriesResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('customer:menu:categories', {});

      this.socket.once('customer:menu:categories:data', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error('Failed to fetch categories'));
        }
      });

      this.socket.once('customer:timeout', () => {
        reject(new Error('Request timeout'));
      });

      setTimeout(() => reject(new Error('Timeout')), 10000);
    });
  }

  /**
   * Request products by category (restaurant/cafe)
   */
  requestMenuProducts(categoryId: string): Promise<MenuProductsResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('customer:menu:products', { categoryId });

      this.socket.once('customer:menu:products:data', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error('Failed to fetch products'));
        }
      });

      this.socket.once('customer:timeout', () => {
        reject(new Error('Request timeout'));
      });

      setTimeout(() => reject(new Error('Timeout')), 10000);
    });
  }

  /**
   * Scan product barcode (retail/pharmacy)
   */
  scanProduct(barcode: string): Promise<ProductScanResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('customer:product:scan', { barcode });

      this.socket.once('customer:product:data', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error('Failed to scan product'));
        }
      });

      this.socket.once('customer:timeout', () => {
        reject(new Error('Request timeout'));
      });

      setTimeout(() => reject(new Error('Timeout')), 10000);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Setup global event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
    });

    this.socket.on('customer:error', (error) => {
      console.error('[Socket] Error:', error.error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    });
  }

  /**
   * Get socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

export default new SocketService();
```

---

## Phase 3: Seat Info Service

### File: `src/services/seat.service.ts`

```typescript
class SeatService {
  private apiUrl = 'https://api.example.com/api';

  /**
   * Get seat information by public ID (REST API call)
   */
  async getSeatInfo(publicSeatId: string): Promise<SeatInfo> {
    const response = await fetch(`${this.apiUrl}/key-seats/public/${publicSeatId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch seat info');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Seat not found');
    }

    return data.seat;
  }
}

export default new SeatService();
```

---

## Phase 4: TypeScript Interfaces

### File: `src/types/seat.types.ts`

```typescript
export interface SeatInfo {
  publicSeatId: string;
  businessName: string;
  businessType: 'restaurant' | 'retail' | 'cafe' | 'pharmacy' | 'other';
  isOnline: boolean;
  canConnect: boolean;
  currentConnections: number;
  maxConnections: number;
  features: {
    allowMenuBrowsing: boolean;
    allowBarcodeScanning: boolean;
    allowCustomerOrdering: boolean;
  };
}

export interface SeatConnectionResponse {
  success: boolean;
  seat?: {
    publicSeatId: string;
    businessName: string;
    businessType: string;
    features: {
      allowMenuBrowsing: boolean;
      allowBarcodeScanning: boolean;
      allowCustomerOrdering: boolean;
    };
  };
  error?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
}

export interface MenuProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface ProductInfo {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  stock: number;
  isAvailable: boolean;
}

export interface MenuCategoriesResponse {
  success: boolean;
  requestId: string;
  categories: MenuCategory[];
}

export interface MenuProductsResponse {
  success: boolean;
  requestId: string;
  categoryId: string;
  products: MenuProduct[];
}

export interface ProductScanResponse {
  success: boolean;
  requestId: string;
  barcode: string;
  found: boolean;
  product?: ProductInfo;
  message?: string;
}
```

---

## Phase 5: QR Code Scan Screen

### File: `src/screens/QRScanScreen.tsx`

```typescript
import React, { useState } from 'react';
import { QrReader } from 'react-qr-reader';
import { useNavigation } from '@react-navigation/native';

export default function QRScanScreen() {
  const navigation = useNavigation();
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: any) => {
    if (result) {
      try {
        // Parse deep link: myapp://connect?seat=REST42A
        const url = new URL(result.text);
        const publicSeatId = url.searchParams.get('seat');

        if (publicSeatId) {
          // Navigate to connect screen
          navigation.navigate('Connect', { publicSeatId });
        } else {
          setError('Invalid QR code');
        }
      } catch (err) {
        setError('Invalid QR code format');
      }
    }
  };

  const handleError = (err: any) => {
    console.error('QR scan error:', err);
    setError('Camera error. Please check permissions.');
  };

  return (
    <div className="qr-scan-screen">
      <h1>Scan QR Code</h1>
      <p>Point your camera at the QR code on the table or counter</p>

      <QrReader
        onResult={handleScan}
        onError={handleError}
        constraints={{ facingMode: 'environment' }}
        style={{ width: '100%' }}
      />

      {error && (
        <div className="error-message">{error}</div>
      )}

      <button onClick={() => navigation.navigate('ManualEntry')}>
        Enter Seat ID Manually
      </button>
    </div>
  );
}
```

---

## Phase 6: Connect Screen

### File: `src/screens/ConnectScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import socketService from '../services/socket.service';
import seatService from '../services/seat.service';
import { SeatInfo } from '../types/seat.types';

export default function ConnectScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { publicSeatId } = route.params as { publicSeatId: string };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);

  useEffect(() => {
    connectToSeat();
  }, []);

  const connectToSeat = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Check seat availability (REST API)
      const info = await seatService.getSeatInfo(publicSeatId);
      setSeatInfo(info);

      if (!info.isOnline) {
        setError('POS device is currently offline. Please try again later.');
        setLoading(false);
        return;
      }

      if (!info.canConnect) {
        setError('Maximum connections reached. Please try again later.');
        setLoading(false);
        return;
      }

      // 2. Connect via Socket.IO
      socketService.connect();
      const response = await socketService.connectToSeat(publicSeatId);

      if (response.success && response.seat) {
        // Navigate based on business type
        if (response.seat.businessType === 'restaurant' || response.seat.businessType === 'cafe') {
          navigation.navigate('Menu', { seat: response.seat });
        } else {
          navigation.navigate('BarcodeScanner', { seat: response.seat });
        }
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connect-screen">
      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Connecting to {publicSeatId}...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <h2>Connection Failed</h2>
          <p>{error}</p>
          <button onClick={connectToSeat}>Try Again</button>
          <button onClick={() => navigation.goBack()}>Go Back</button>
        </div>
      )}

      {seatInfo && !loading && !error && (
        <div className="seat-info">
          <h2>{seatInfo.businessName}</h2>
          <p>Type: {seatInfo.businessType}</p>
          <p>Status: {seatInfo.isOnline ? 'Online' : 'Offline'}</p>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 7: Menu Screen (Restaurant/Cafe)

### File: `src/screens/MenuScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import socketService from '../services/socket.service';
import { MenuCategory, MenuProduct } from '../types/seat.types';

export default function MenuScreen() {
  const route = useRoute();
  const { seat } = route.params as any;

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await socketService.requestMenuCategories();
      setCategories(response.categories);
    } catch (err: any) {
      console.error('Error loading categories:', err);
      setError(err.message || 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (categoryId: string) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedCategory(categoryId);

      const response = await socketService.requestMenuProducts(categoryId);
      setProducts(response.products);
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="menu-screen">
      <header>
        <h1>{seat.businessName}</h1>
        <p>Menu</p>
      </header>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      {!selectedCategory && (
        <div className="categories">
          <h2>Categories</h2>
          <div className="category-grid">
            {categories.map(category => (
              <div
                key={category.id}
                className="category-card"
                onClick={() => loadProducts(category.id)}
              >
                {category.imageUrl && (
                  <img src={category.imageUrl} alt={category.name} />
                )}
                <h3>{category.name}</h3>
                {category.description && <p>{category.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedCategory && (
        <div className="products">
          <button onClick={() => setSelectedCategory(null)}>
            ← Back to Categories
          </button>
          <h2>Products</h2>
          <div className="product-list">
            {products.map(product => (
              <div key={product.id} className="product-card">
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} />
                )}
                <div className="product-info">
                  <h3>{product.name}</h3>
                  {product.description && <p>{product.description}</p>}
                  <div className="product-price">${product.price.toFixed(2)}</div>
                  {!product.isAvailable && (
                    <span className="unavailable">Out of Stock</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 8: Barcode Scanner Screen (Retail/Pharmacy)

### File: `src/screens/BarcodeScanScreen.tsx`

```typescript
import React, { useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import socketService from '../services/socket.service';
import { ProductInfo } from '../types/seat.types';

export default function BarcodeScanScreen() {
  const route = useRoute();
  const { seat } = route.params as any;

  const [scanning, setScanning] = useState(false);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScan = async () => {
    try {
      setScanning(true);
      setError(null);
      setProduct(null);

      // Request camera permission
      const status = await BarcodeScanner.checkPermission({ force: true });

      if (!status.granted) {
        setError('Camera permission denied');
        setScanning(false);
        return;
      }

      // Make background transparent
      document.body.classList.add('scanner-active');
      BarcodeScanner.hideBackground();

      // Start scanning
      const result = await BarcodeScanner.startScan();

      if (result.hasContent) {
        // Query POS for product info
        const response = await socketService.scanProduct(result.content);

        if (response.found && response.product) {
          setProduct(response.product);
        } else {
          setError('Product not found');
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err.message || 'Scan failed');
    } finally {
      setScanning(false);
      document.body.classList.remove('scanner-active');
      BarcodeScanner.showBackground();
      BarcodeScanner.stopScan();
    }
  };

  const stopScan = () => {
    setScanning(false);
    BarcodeScanner.stopScan();
    BarcodeScanner.showBackground();
    document.body.classList.remove('scanner-active');
  };

  return (
    <div className="barcode-scan-screen">
      <header>
        <h1>{seat.businessName}</h1>
        <p>Scan Product Barcode</p>
      </header>

      {!scanning && !product && (
        <div className="scan-prompt">
          <button className="scan-button" onClick={startScan}>
            Start Scanning
          </button>
          <p>Point your camera at a product barcode</p>
        </div>
      )}

      {scanning && (
        <div className="scanning">
          <div className="scanner-overlay">
            <div className="scanner-frame" />
            <p>Scanning...</p>
            <button onClick={stopScan}>Cancel</button>
          </div>
        </div>
      )}

      {product && (
        <div className="product-result">
          {product.imageUrl && (
            <img src={product.imageUrl} alt={product.name} />
          )}
          <h2>{product.name}</h2>
          {product.description && <p>{product.description}</p>}
          <div className="price">${product.price.toFixed(2)}</div>
          <div className="stock">
            {product.isAvailable ? (
              <span className="in-stock">In Stock ({product.stock})</span>
            ) : (
              <span className="out-of-stock">Out of Stock</span>
            )}
          </div>
          <button onClick={() => { setProduct(null); startScan(); }}>
            Scan Another Product
          </button>
        </div>
      )}

      {error && (
        <div className="error">
          <p>{error}</p>
          <button onClick={() => { setError(null); startScan(); }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 9: Deep Link Handler

### File: `src/utils/deeplink.handler.ts`

```typescript
import { Linking } from 'react-native';

export function setupDeepLinkHandler(navigation: any) {
  // Handle initial URL (app opened from deep link)
  Linking.getInitialURL().then(url => {
    if (url) {
      handleDeepLink(url, navigation);
    }
  });

  // Handle URL when app is already open
  Linking.addEventListener('url', (event) => {
    handleDeepLink(event.url, navigation);
  });
}

function handleDeepLink(url: string, navigation: any) {
  try {
    // Parse: myapp://connect?seat=REST42A
    const urlObj = new URL(url);
    
    if (urlObj.pathname === '/connect' || urlObj.host === 'connect') {
      const publicSeatId = urlObj.searchParams.get('seat');
      
      if (publicSeatId) {
        navigation.navigate('Connect', { publicSeatId });
      }
    }
  } catch (error) {
    console.error('Deep link parsing error:', error);
  }
}
```

---

## Testing Checklist

- [ ] QR code scanning works
- [ ] Manual seat ID entry works
- [ ] Connection to seat succeeds
- [ ] Menu categories load (restaurant/cafe)
- [ ] Products load by category (restaurant/cafe)
- [ ] Barcode scanning works (retail/pharmacy)
- [ ] Product info displays correctly
- [ ] Error handling works (offline POS, invalid seat ID)
- [ ] Disconnection handled gracefully
- [ ] Deep links work (myapp://connect?seat=XXX)

---

## Summary

The customer mobile app:

1. **Scans QR code** or enters seat ID manually
2. **Connects via Socket.IO** (no authentication)
3. **Shows appropriate UI** based on business type
4. **Queries POS in real-time** for menu/products
5. **Receives targeted responses** (not broadcast to all customers)

All communication is real-time via Socket.IO for instant results.
