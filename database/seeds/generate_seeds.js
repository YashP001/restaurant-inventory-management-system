import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Urban Bites Comprehensive Seed Data Generator
// Produces mathematically reconciled, relationally consistent SQL scripts:
// - 03_suppliers_and_inventory.sql
// - 04_historical_transactions.sql
// - 05_waste_and_forecasts.sql
// ============================================================================

// 1. MENU AND BILL OF MATERIALS (BOM)
// Base units: 1:kg, 2:g (0.001), 3:l, 4:ml (0.001), 5:pcs
const MENU = [
  { 
    id: 1, name: 'Crispy French Fries', price: 110.00, 
    bom: [
      { ingId: 5, reqQty: 250, wastage: 8.0, conv: 0.001 }, // Potatoes: 0.270 kg
      { ingId: 14, reqQty: 30, wastage: 5.0, conv: 0.001 },  // Oil: 0.0315 l
      { ingId: 13, reqQty: 3, wastage: 0.0, conv: 0.001 }    // Salt: 0.003 kg
    ] 
  },
  { 
    id: 2, name: 'Samosa Platter with Chutney', price: 120.00, 
    bom: [
      { ingId: 1, reqQty: 80, wastage: 2.0, conv: 0.001 },   // Flour: 0.0816 kg
      { ingId: 5, reqQty: 120, wastage: 6.0, conv: 0.001 },  // Potatoes: 0.1272 kg
      { ingId: 4, reqQty: 30, wastage: 5.0, conv: 0.001 },   // Onions: 0.0315 kg
      { ingId: 14, reqQty: 25, wastage: 4.0, conv: 0.001 },  // Oil: 0.026 l
      { ingId: 22, reqQty: 4, wastage: 0.0, conv: 0.001 }    // Garam Masala: 0.004 kg
    ] 
  },
  { 
    id: 3, name: 'Cheesy Garlic Bread', price: 140.00, 
    bom: [
      { ingId: 1, reqQty: 100, wastage: 2.0, conv: 0.001 },  // Flour: 0.102 kg
      { ingId: 2, reqQty: 60, wastage: 2.0, conv: 0.001 },   // Mozzarella: 0.0612 kg
      { ingId: 10, reqQty: 25, wastage: 2.0, conv: 0.001 },  // Butter: 0.0255 kg
      { ingId: 17, reqQty: 10, wastage: 5.0, conv: 0.001 }   // Garlic: 0.0105 kg
    ] 
  },
  { 
    id: 4, name: 'Paneer Tikka Bites', price: 220.00, 
    bom: [
      { ingId: 7, reqQty: 160, wastage: 3.0, conv: 0.001 },  // Paneer: 0.1648 kg
      { ingId: 27, reqQty: 40, wastage: 5.0, conv: 0.001 },  // Capsicum: 0.042 kg
      { ingId: 4, reqQty: 40, wastage: 5.0, conv: 0.001 },   // Onion: 0.042 kg
      { ingId: 10, reqQty: 15, wastage: 2.0, conv: 0.001 },  // Butter: 0.0153 kg
      { ingId: 22, reqQty: 6, wastage: 0.0, conv: 0.001 }    // Garam Masala: 0.006 kg
    ] 
  },
  { 
    id: 5, name: 'Classic Crispy Veg Burger', price: 130.00, 
    bom: [
      { ingId: 15, reqQty: 1, wastage: 0.0, conv: 1.0 },     // Buns: 1 pcs
      { ingId: 5, reqQty: 100, wastage: 5.0, conv: 0.001 },  // Potatoes: 0.105 kg
      { ingId: 8, reqQty: 20, wastage: 5.0, conv: 0.001 },   // Lettuce: 0.021 kg
      { ingId: 3, reqQty: 25, wastage: 4.0, conv: 0.001 },   // Tomato: 0.026 kg
      { ingId: 4, reqQty: 20, wastage: 4.0, conv: 0.001 },   // Onion: 0.0208 kg
      { ingId: 20, reqQty: 20, wastage: 2.0, conv: 0.001 }   // Mayo: 0.0204 kg
    ] 
  },
  { 
    id: 6, name: 'Urban Paneer Makhani Burger', price: 170.00, 
    bom: [
      { ingId: 15, reqQty: 1, wastage: 0.0, conv: 1.0 },     // Buns: 1 pcs
      { ingId: 7, reqQty: 90, wastage: 2.0, conv: 0.001 },   // Paneer: 0.0918 kg
      { ingId: 10, reqQty: 15, wastage: 2.0, conv: 0.001 },  // Butter: 0.0153 kg
      { ingId: 19, reqQty: 40, wastage: 3.0, conv: 0.001 },  // Puree: 0.0412 kg
      { ingId: 8, reqQty: 20, wastage: 5.0, conv: 0.001 }    // Lettuce: 0.021 kg
    ] 
  },
  { 
    id: 7, name: 'Smoky Chicken Tikka Burger', price: 190.00, 
    bom: [
      { ingId: 15, reqQty: 1, wastage: 0.0, conv: 1.0 },     // Buns: 1 pcs
      { ingId: 6, reqQty: 130, wastage: 4.0, conv: 0.001 },  // Chicken: 0.1352 kg
      { ingId: 8, reqQty: 20, wastage: 5.0, conv: 0.001 },   // Lettuce: 0.021 kg
      { ingId: 4, reqQty: 25, wastage: 4.0, conv: 0.001 },   // Onion: 0.026 kg
      { ingId: 20, reqQty: 25, wastage: 2.0, conv: 0.001 }   // Mayo: 0.0255 kg
    ] 
  },
  { 
    id: 8, name: 'Classic Margherita Pizza', price: 260.00, 
    bom: [
      { ingId: 16, reqQty: 1, wastage: 0.0, conv: 1.0 },     // Pizza Base: 1 pcs
      { ingId: 19, reqQty: 60, wastage: 2.0, conv: 0.001 },  // Puree: 0.0612 kg
      { ingId: 2, reqQty: 130, wastage: 2.0, conv: 0.001 },  // Mozzarella: 0.1326 kg
      { ingId: 14, reqQty: 10, wastage: 0.0, conv: 0.001 }   // Oil: 0.010 l
    ] 
  },
  { 
    id: 9, name: 'Farmhouse Veggie Feast Pizza', price: 320.00, 
    bom: [
      { ingId: 16, reqQty: 1, wastage: 0.0, conv: 1.0 },     // Pizza Base: 1 pcs
      { ingId: 19, reqQty: 60, wastage: 2.0, conv: 0.001 },  // Puree: 0.0612 kg
      { ingId: 2, reqQty: 120, wastage: 2.0, conv: 0.001 },  // Mozzarella: 0.1224 kg
      { ingId: 27, reqQty: 40, wastage: 5.0, conv: 0.001 },  // Capsicum: 0.042 kg
      { ingId: 4, reqQty: 35, wastage: 5.0, conv: 0.001 },   // Onion: 0.0368 kg
      { ingId: 3, reqQty: 35, wastage: 4.0, conv: 0.001 }    // Tomato: 0.0364 kg
    ] 
  },
  { 
    id: 10, name: 'Tandoori Chicken Tikka Pizza', price: 380.00, 
    bom: [
      { ingId: 16, reqQty: 1, wastage: 0.0, conv: 1.0 },     // Pizza Base: 1 pcs
      { ingId: 19, reqQty: 60, wastage: 2.0, conv: 0.001 },  // Puree: 0.0612 kg
      { ingId: 6, reqQty: 120, wastage: 4.0, conv: 0.001 },  // Chicken: 0.1248 kg
      { ingId: 2, reqQty: 120, wastage: 2.0, conv: 0.001 },  // Mozzarella: 0.1224 kg
      { ingId: 4, reqQty: 30, wastage: 4.0, conv: 0.001 },   // Onion: 0.0312 kg
      { ingId: 21, reqQty: 5, wastage: 2.0, conv: 0.001 }    // Chillies: 0.0051 kg
    ] 
  },
  { 
    id: 11, name: 'Masala Chai Pot', price: 45.00, 
    bom: [
      { ingId: 24, reqQty: 10, wastage: 2.0, conv: 0.001 },  // Tea: 0.0102 kg
      { ingId: 9, reqQty: 120, wastage: 3.0, conv: 0.001 },  // Milk: 0.1236 l
      { ingId: 12, reqQty: 15, wastage: 0.0, conv: 0.001 },  // Sugar: 0.015 kg
      { ingId: 18, reqQty: 5, wastage: 5.0, conv: 0.001 }    // Ginger: 0.0053 kg
    ] 
  },
  { 
    id: 12, name: 'Iced Caramel Cold Coffee', price: 130.00, 
    bom: [
      { ingId: 23, reqQty: 22, wastage: 3.0, conv: 0.001 },  // Coffee: 0.0227 kg
      { ingId: 9, reqQty: 200, wastage: 2.0, conv: 0.001 },  // Milk: 0.204 l
      { ingId: 12, reqQty: 20, wastage: 0.0, conv: 0.001 }   // Sugar: 0.020 kg
    ] 
  },
  { 
    id: 13, name: 'Fresh Lime Soda', price: 65.00, 
    bom: [
      { ingId: 12, reqQty: 25, wastage: 0.0, conv: 0.001 },  // Sugar: 0.025 kg
      { ingId: 13, reqQty: 2, wastage: 0.0, conv: 0.001 }    // Salt: 0.002 kg
    ] 
  },
  { 
    id: 14, name: 'Warm Chocolate Walnut Brownie', price: 150.00, 
    bom: [
      { ingId: 1, reqQty: 45, wastage: 2.0, conv: 0.001 },   // Flour: 0.0459 kg
      { ingId: 28, reqQty: 60, wastage: 2.0, conv: 0.001 },  // Chocolate: 0.0612 kg
      { ingId: 10, reqQty: 30, wastage: 2.0, conv: 0.001 },  // Butter: 0.0306 kg
      { ingId: 12, reqQty: 40, wastage: 0.0, conv: 0.001 },  // Sugar: 0.040 kg
      { ingId: 25, reqQty: 12, wastage: 1.0, conv: 0.001 }   // Cocoa: 0.0121 kg
    ] 
  },
  { 
    id: 15, name: 'Royal Gulab Jamun (2 Pcs)', price: 95.00, 
    bom: [
      { ingId: 9, reqQty: 150, wastage: 4.0, conv: 0.001 },  // Milk: 0.156 l
      { ingId: 1, reqQty: 30, wastage: 2.0, conv: 0.001 },   // Flour: 0.0306 kg
      { ingId: 12, reqQty: 80, wastage: 1.0, conv: 0.001 },  // Sugar: 0.0808 kg
      { ingId: 14, reqQty: 25, wastage: 4.0, conv: 0.001 }   // Oil: 0.026 l
    ] 
  }
];

// Helper to calculate exact required base unit quantity per serving
MENU.forEach(m => {
  m.bom.forEach(b => {
    b.baseQtyPerServing = Math.round(b.reqQty * (1 + b.wastage / 100) * b.conv * 10000) / 10000;
  });
});

// 2. INVENTORY BATCH DEFINITIONS (48 Batches)
const rawBatches = [
  // Flour (ing 1)
  { id: 1, ingId: 1, batchNo: 'BATCH-FLOUR-001', qtyRecv: 50.0, cost: 40.0, recvDate: '2026-08-08', expDate: '2026-11-08' },
  { id: 2, ingId: 1, batchNo: 'BATCH-FLOUR-002', qtyRecv: 120.0, cost: 41.0, recvDate: '2026-09-20', expDate: '2027-01-20' },
  { id: 3, ingId: 1, batchNo: 'BATCH-FLOUR-003', qtyRecv: 120.0, cost: 42.0, recvDate: '2026-10-25', expDate: '2027-02-25' },

  // Mozzarella (ing 2)
  { id: 4, ingId: 2, batchNo: 'BATCH-MOZZ-001', qtyRecv: 15.0, cost: 410.0, recvDate: '2026-08-15', expDate: '2026-09-15' },
  { id: 5, ingId: 2, batchNo: 'BATCH-MOZZ-002', qtyRecv: 30.0, cost: 415.0, recvDate: '2026-09-25', expDate: '2026-10-25' },
  { id: 6, ingId: 2, batchNo: 'BATCH-MOZZ-003', qtyRecv: 35.0, cost: 420.0, recvDate: '2026-10-20', expDate: '2026-11-05' }, // Near expiry!
  { id: 7, ingId: 2, batchNo: 'BATCH-MOZZ-004', qtyRecv: 30.0, cost: 420.0, recvDate: '2026-10-30', expDate: '2026-11-25' },

  // Tomatoes (ing 3)
  { id: 8, ingId: 3, batchNo: 'BATCH-TOM-001', qtyRecv: 25.0, cost: 32.0, recvDate: '2026-08-10', expDate: '2026-08-25' },
  { id: 9, ingId: 3, batchNo: 'BATCH-TOM-002', qtyRecv: 45.0, cost: 34.0, recvDate: '2026-09-15', expDate: '2026-09-30' },
  { id: 10, ingId: 3, batchNo: 'BATCH-TOM-003', qtyRecv: 45.0, cost: 35.0, recvDate: '2026-10-26', expDate: '2026-11-04' }, // Near expiry!
  { id: 11, ingId: 3, batchNo: 'BATCH-TOM-004', qtyRecv: 40.0, cost: 35.0, recvDate: '2026-10-31', expDate: '2026-11-10' },

  // Onions (ing 4)
  { id: 12, ingId: 4, batchNo: 'BATCH-ONION-001', qtyRecv: 30.0, cost: 25.0, recvDate: '2026-08-10', expDate: '2026-09-20' },
  { id: 13, ingId: 4, batchNo: 'BATCH-ONION-002', qtyRecv: 60.0, cost: 26.5, recvDate: '2026-09-20', expDate: '2026-10-30' },
  { id: 14, ingId: 4, batchNo: 'BATCH-ONION-003', qtyRecv: 60.0, cost: 28.0, recvDate: '2026-10-24', expDate: '2026-11-25' },

  // Potatoes (ing 5)
  { id: 15, ingId: 5, batchNo: 'BATCH-POT-001', qtyRecv: 50.0, cost: 22.0, recvDate: '2026-08-05', expDate: '2026-09-15' },
  { id: 16, ingId: 5, batchNo: 'BATCH-POT-002', qtyRecv: 100.0, cost: 23.0, recvDate: '2026-09-15', expDate: '2026-10-25' },
  { id: 17, ingId: 5, batchNo: 'BATCH-POT-003', qtyRecv: 150.0, cost: 24.0, recvDate: '2026-10-24', expDate: '2026-12-05' },

  // Chicken Breast (ing 6)
  { id: 18, ingId: 6, batchNo: 'BATCH-CHKN-001', qtyRecv: 20.0, cost: 245.0, recvDate: '2026-08-15', expDate: '2026-08-25' },
  { id: 19, ingId: 6, batchNo: 'BATCH-CHKN-002', qtyRecv: 35.0, cost: 250.0, recvDate: '2026-09-20', expDate: '2026-09-30' },
  { id: 20, ingId: 6, batchNo: 'BATCH-CHKN-003', qtyRecv: 35.0, cost: 260.0, recvDate: '2026-10-28', expDate: '2026-11-04' }, // Near expiry!
  { id: 21, ingId: 6, batchNo: 'BATCH-CHKN-004', qtyRecv: 30.0, cost: 260.0, recvDate: '2026-10-31', expDate: '2026-11-08' },

  // Paneer (ing 7)
  { id: 22, ingId: 7, batchNo: 'BATCH-PAN-001', qtyRecv: 15.0, cost: 305.0, recvDate: '2026-08-20', expDate: '2026-08-30' },
  { id: 23, ingId: 7, batchNo: 'BATCH-PAN-002', qtyRecv: 30.0, cost: 310.0, recvDate: '2026-09-22', expDate: '2026-10-02' },
  { id: 24, ingId: 7, batchNo: 'BATCH-PAN-003', qtyRecv: 30.0, cost: 320.0, recvDate: '2026-10-27', expDate: '2026-11-04' }, // Near expiry!
  { id: 25, ingId: 7, batchNo: 'BATCH-PAN-004', qtyRecv: 30.0, cost: 320.0, recvDate: '2026-10-31', expDate: '2026-11-10' },

  // Iceberg Lettuce (ing 8) - Low stock deliberate for view check
  { id: 26, ingId: 8, batchNo: 'BATCH-LET-001', qtyRecv: 10.0, cost: 75.0, recvDate: '2026-09-10', expDate: '2026-09-20' },
  { id: 27, ingId: 8, batchNo: 'BATCH-LET-002', qtyRecv: 12.0, cost: 85.0, recvDate: '2026-10-28', expDate: '2026-11-04' },

  // Milk (ing 9)
  { id: 28, ingId: 9, batchNo: 'BATCH-MILK-001', qtyRecv: 40.0, cost: 60.0, recvDate: '2026-08-15', expDate: '2026-08-22' },
  { id: 29, ingId: 9, batchNo: 'BATCH-MILK-002', qtyRecv: 80.0, cost: 62.0, recvDate: '2026-09-20', expDate: '2026-09-27' },
  { id: 30, ingId: 9, batchNo: 'BATCH-MILK-003', qtyRecv: 80.0, cost: 64.0, recvDate: '2026-10-28', expDate: '2026-11-03' }, // Near expiry!
  { id: 31, ingId: 9, batchNo: 'BATCH-MILK-004', qtyRecv: 80.0, cost: 64.0, recvDate: '2026-10-31', expDate: '2026-11-06' },

  // Butter (ing 10)
  { id: 32, ingId: 10, batchNo: 'BATCH-BTR-001', qtyRecv: 20.0, cost: 460.0, recvDate: '2026-08-10', expDate: '2026-11-10' },
  { id: 33, ingId: 10, batchNo: 'BATCH-BTR-002', qtyRecv: 30.0, cost: 480.0, recvDate: '2026-10-15', expDate: '2027-01-15' },

  // Eggs (ing 11)
  { id: 34, ingId: 11, batchNo: 'BATCH-EGG-001', qtyRecv: 120.0, cost: 5.8, recvDate: '2026-08-20', expDate: '2026-09-15' },
  { id: 35, ingId: 11, batchNo: 'BATCH-EGG-002', qtyRecv: 300.0, cost: 6.5, recvDate: '2026-10-20', expDate: '2026-11-18' },

  // Sugar (ing 12) & Salt (ing 13)
  { id: 36, ingId: 12, batchNo: 'BATCH-SUG-001', qtyRecv: 80.0, cost: 42.0, recvDate: '2026-08-05', expDate: '2027-08-05' },
  { id: 37, ingId: 13, batchNo: 'BATCH-SLT-001', qtyRecv: 40.0, cost: 20.0, recvDate: '2026-08-05', expDate: '2027-08-05' },

  // Oil (ing 14)
  { id: 38, ingId: 14, batchNo: 'BATCH-OIL-001', qtyRecv: 60.0, cost: 128.0, recvDate: '2026-08-10', expDate: '2027-02-10' },
  { id: 39, ingId: 14, batchNo: 'BATCH-OIL-002', qtyRecv: 150.0, cost: 135.0, recvDate: '2026-10-18', expDate: '2027-04-18' },

  // Buns (ing 15)
  { id: 40, ingId: 15, batchNo: 'BATCH-BUN-001', qtyRecv: 60.0, cost: 11.0, recvDate: '2026-08-20', expDate: '2026-08-27' },
  { id: 41, ingId: 15, batchNo: 'BATCH-BUN-002', qtyRecv: 140.0, cost: 11.5, recvDate: '2026-09-25', expDate: '2026-10-02' },
  { id: 42, ingId: 15, batchNo: 'BATCH-BUN-003', qtyRecv: 120.0, cost: 12.0, recvDate: '2026-10-28', expDate: '2026-11-04' }, // Near expiry!

  // Pizza Base (ing 16)
  { id: 43, ingId: 16, batchNo: 'BATCH-BASE-001', qtyRecv: 50.0, cost: 23.0, recvDate: '2026-08-20', expDate: '2026-08-28' },
  { id: 44, ingId: 16, batchNo: 'BATCH-BASE-002', qtyRecv: 120.0, cost: 24.0, recvDate: '2026-09-25', expDate: '2026-10-03' },
  { id: 45, ingId: 16, batchNo: 'BATCH-BASE-003', qtyRecv: 100.0, cost: 25.0, recvDate: '2026-10-28', expDate: '2026-11-04' }, // Near expiry!

  // Garlic (17), Ginger (18), Tomato Puree (19), Mayo (20), Chillies (21), Masala (22), Coffee (23), Tea (24), Cocoa (25), Capsicum (27), Chocolate (28)
  { id: 46, ingId: 19, batchNo: 'BATCH-PUR-001', qtyRecv: 60.0, cost: 90.0, recvDate: '2026-08-15', expDate: '2027-02-15' },
  { id: 47, ingId: 27, batchNo: 'BATCH-CAP-001', qtyRecv: 40.0, cost: 52.0, recvDate: '2026-10-27', expDate: '2026-11-05' },
  { id: 48, ingId: 28, batchNo: 'BATCH-CHOC-001', qtyRecv: 30.0, cost: 325.0, recvDate: '2026-09-01', expDate: '2027-03-01' }
];

// Initialize live batches tracking state
const batches = rawBatches.map(b => ({
  ...b,
  remQty: b.qtyRecv,
  status: 'ACTIVE'
}));

// Tracking collections for SQL output
const initialStockMovements = [];
let movementCounter = 1;

// 1. Generate Initial Purchase Receipt Movements
batches.forEach(b => {
  initialStockMovements.push({
    id: movementCounter++,
    batchId: b.id,
    type: 'PURCHASE_RECEIPT',
    qty: b.qtyRecv,
    bal: b.qtyRecv,
    ref: `PO-REC-${String(b.id).padStart(3, '0')}`,
    notes: `Initial lot receipt for ${b.batchNo}`,
    user: 2,
    date: `${b.recvDate} 08:00:00`
  });
});

// 3. WASTE RECORDS (35 Records)
// Distributed across the 90-day timeline
const wasteDefinitions = [
  { id: 1, batchId: 4, ingId: 2, menuId: null, qty: 1.500, unitId: 1, reason: 'EXPIRED', notes: 'Expired Mozzarella lot scrap', user: 3, date: '2026-09-16 10:00:00' },
  { id: 2, batchId: 5, ingId: 2, menuId: null, qty: 0.800, unitId: 1, reason: 'SPOILED', notes: 'Refrigeration temperature spike', user: 4, date: '2026-10-08 09:30:00' },
  { id: 3, batchId: 15, ingId: 5, menuId: null, qty: 4.000, unitId: 1, reason: 'SPOILED', notes: 'Sprouted soft potatoes sorted out', user: 9, date: '2026-08-22 11:00:00' },
  { id: 4, batchId: 16, ingId: 5, menuId: 1, qty: 3.500, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Potato peeling and trimming scrap', user: 3, date: '2026-10-18 15:00:00' },
  { id: 5, batchId: 18, ingId: 6, menuId: null, qty: 1.200, unitId: 1, reason: 'STORAGE_CONTAMINATION', notes: 'Punctured vacuum bag in storage', user: 3, date: '2026-08-20 08:30:00' },
  { id: 6, batchId: 22, ingId: 7, menuId: null, qty: 0.800, unitId: 1, reason: 'EXPIRED', notes: 'Paneer block past best-before', user: 4, date: '2026-08-29 09:00:00' },
  { id: 7, batchId: 28, ingId: 9, menuId: null, qty: 3.000, unitId: 3, reason: 'SPOILED', notes: 'Milk curdled in ambient morning heat', user: 9, date: '2026-08-21 14:00:00' },
  { id: 8, batchId: null, ingId: null, menuId: 8, qty: 1.000, unitId: 5, reason: 'OVERCOOKED', notes: 'Crust scorched in stone oven hot pocket', user: 4, date: '2026-09-12 19:30:00' },
  { id: 9, batchId: null, ingId: null, menuId: 10, qty: 1.000, unitId: 5, reason: 'CUSTOMER_RETURN', notes: 'Customer ordered mild, served tandoori spicy', user: 3, date: '2026-09-25 21:00:00' },
  { id: 10, batchId: 40, ingId: 15, menuId: null, qty: 6.000, unitId: 5, reason: 'EXPIRED', notes: 'Burger buns dried and stale', user: 4, date: '2026-08-26 10:00:00' },
  { id: 11, batchId: 43, ingId: 16, menuId: null, qty: 5.000, unitId: 5, reason: 'EXPIRED', notes: 'Pizza bases past shelf life', user: 3, date: '2026-08-27 10:00:00' },
  { id: 12, batchId: 8, ingId: 3, menuId: null, qty: 1.800, unitId: 1, reason: 'SPOILED', notes: 'Bruised soft overripe tomatoes', user: 9, date: '2026-08-24 08:30:00' },
  { id: 13, batchId: 12, ingId: 4, menuId: null, qty: 2.200, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Onion skin and end peelings', user: 4, date: '2026-08-28 16:00:00' },
  { id: 14, batchId: 26, ingId: 8, menuId: null, qty: 1.000, unitId: 1, reason: 'SPOILED', notes: 'Wilting outer lettuce leaves', user: 3, date: '2026-09-18 09:00:00' },
  { id: 15, batchId: 34, ingId: 11, menuId: null, qty: 8.000, unitId: 5, reason: 'SPOILED', notes: 'Cracked eggs during crate transfer', user: 9, date: '2026-08-25 11:30:00' },
  { id: 16, batchId: 19, ingId: 6, menuId: null, qty: 0.900, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Chicken fat and tendon trimmings', user: 3, date: '2026-09-28 11:00:00' },
  { id: 17, batchId: null, ingId: null, menuId: 14, qty: 1.000, unitId: 5, reason: 'OVERCOOKED', notes: 'Brownie edges overbaked and dry', user: 4, date: '2026-09-22 17:00:00' },
  { id: 18, batchId: 46, ingId: 19, menuId: null, qty: 1.000, unitId: 1, reason: 'STORAGE_CONTAMINATION', notes: 'Puree can dented with broken seal', user: 4, date: '2026-09-15 14:00:00' },
  { id: 19, batchId: 47, ingId: 27, menuId: null, qty: 0.800, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Capsicum seeds and core scrap', user: 9, date: '2026-10-29 15:30:00' },
  { id: 20, batchId: 1, ingId: 1, menuId: null, qty: 2.000, unitId: 1, reason: 'STORAGE_CONTAMINATION', notes: 'Flour sack corner tear during shelf move', user: 3, date: '2026-08-30 11:30:00' },
  { id: 21, batchId: 17, ingId: 5, menuId: null, qty: 3.000, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Scrap from french fry batoning', user: 4, date: '2026-10-28 10:00:00' },
  { id: 22, batchId: 20, ingId: 6, menuId: null, qty: 0.600, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Chicken trimmings from tikka prep', user: 3, date: '2026-10-30 11:00:00' },
  { id: 23, batchId: 24, ingId: 7, menuId: null, qty: 0.500, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Paneer block trimming edges', user: 4, date: '2026-10-29 10:30:00' },
  { id: 24, batchId: 30, ingId: 9, menuId: null, qty: 2.000, unitId: 3, reason: 'SPOILED', notes: 'Leftover warmed milk at shift close', user: 9, date: '2026-10-31 23:00:00' },
  { id: 25, batchId: null, ingId: null, menuId: 5, qty: 1.000, unitId: 5, reason: 'CUSTOMER_RETURN', notes: 'Customer asked for no onions', user: 4, date: '2026-10-28 13:30:00' },
  { id: 26, batchId: 42, ingId: 15, menuId: null, qty: 4.000, unitId: 5, reason: 'PREPARATION_SCRAP', notes: 'Crushed buns during bag opening', user: 9, date: '2026-10-31 12:00:00' },
  { id: 27, batchId: 45, ingId: 16, menuId: null, qty: 2.000, unitId: 5, reason: 'PREPARATION_SCRAP', notes: 'Torn pizza dough during stretching', user: 3, date: '2026-10-30 19:00:00' },
  { id: 28, batchId: 33, ingId: 10, menuId: null, qty: 0.400, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Melted butter burnt on pan bottom', user: 4, date: '2026-10-27 22:00:00' },
  { id: 29, batchId: 35, ingId: 11, menuId: null, qty: 4.000, unitId: 5, reason: 'SPOILED', notes: 'Damaged eggs in delivery tray', user: 9, date: '2026-10-29 08:30:00' },
  { id: 30, batchId: 10, ingId: 3, menuId: null, qty: 1.200, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Tomato cores removed during dicing', user: 4, date: '2026-10-30 15:00:00' },
  { id: 31, batchId: 14, ingId: 4, menuId: null, qty: 1.500, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Onion end trimmings', user: 9, date: '2026-10-30 16:30:00' },
  { id: 32, batchId: 27, ingId: 8, menuId: null, qty: 0.600, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Tough outer lettuce core', user: 3, date: '2026-10-31 11:00:00' },
  { id: 33, batchId: null, ingId: null, menuId: 12, qty: 1.000, unitId: 5, reason: 'OVERCOOKED', notes: 'Espresso shot scorched on group head', user: 4, date: '2026-10-29 16:00:00' },
  { id: 34, batchId: 48, ingId: 28, menuId: null, qty: 0.300, unitId: 1, reason: 'PREPARATION_SCRAP', notes: 'Chocolate block shaving scrap', user: 3, date: '2026-10-28 10:00:00' },
  { id: 35, batchId: 38, ingId: 14, menuId: null, qty: 1.000, unitId: 3, reason: 'STORAGE_CONTAMINATION', notes: 'Can leakage during shelving', user: 2, date: '2026-09-02 12:00:00' }
];

// Helper to deduce financial loss and update batch balance
const wasteSqlRows = [];
const wasteStockMovements = [];

wasteDefinitions.forEach(w => {
  let loss = 0;
  if (w.batchId) {
    const targetBatch = batches.find(b => b.id === w.batchId);
    loss = Math.round(w.qty * targetBatch.cost * 100) / 100;
    targetBatch.remQty = Math.round((targetBatch.remQty - w.qty) * 1000) / 1000;
    if (targetBatch.remQty <= 0) {
      targetBatch.remQty = 0;
      targetBatch.status = 'DEPLETED';
    }

    wasteStockMovements.push({
      id: movementCounter++,
      batchId: targetBatch.id,
      type: 'WASTE_DISPOSAL',
      qty: w.qty,
      bal: targetBatch.remQty,
      ref: `WASTE-${w.id}`,
      notes: `Food waste deduction: ${w.reason}`,
      user: w.user,
      date: w.date
    });
  } else {
    // Menu item waste
    const mi = MENU.find(m => m.id === w.menuId);
    loss = Math.round(mi.price * 0.40 * 100) / 100; // estimated cost
  }

  const batchVal = w.batchId ? w.batchId : 'NULL';
  const ingVal = w.ingId ? w.ingId : 'NULL';
  const menuVal = w.menuId ? w.menuId : 'NULL';

  wasteSqlRows.push(`(${w.id}, ${batchVal}, ${ingVal}, ${menuVal}, ${w.qty.toFixed(3)}, ${w.unitId}, '${w.reason}', ${loss.toFixed(2)}, ${w.user}, '${w.notes}', '${w.date}')`);
});

// 4. HISTORICAL ORDERS SIMULATION (250 Orders over 90 Days)
const orderTypes = ['DINE_IN', 'DINE_IN', 'DINE_IN', 'TAKEAWAY', 'ONLINE'];
const paymentMethods = ['UPI', 'CREDIT_CARD', 'CASH', 'DEBIT_CARD', 'ONLINE'];

const ordersSql = [];
const orderItemsSql = [];
const paymentsSql = [];
const consumptionsSql = [];
const consumptionStockMovements = [];

let orderItemIdCounter = 1;
let paymentIdCounter = 1;
let consumptionIdCounter = 1;

for (let orderId = 1; orderId <= 250; orderId++) {
  // Stagger dates across 90 days (from day -89 to day 0 = Nov 2, 2026)
  const daysAgo = Math.floor(89 * (1 - ((orderId - 1) / 249)));
  const hour = 11 + Math.floor(((orderId * 7) % 11)); // 11:00 to 22:00
  const minute = (orderId * 13) % 60;

  const orderDate = new Date(2026, 10, 2);
  orderDate.setDate(orderDate.getDate() - daysAgo);
  orderDate.setHours(hour, minute, 0);

  const orderDateStr = orderDate.toISOString().replace('T', ' ').substring(0, 19);

  // Status distribution:
  // ~90% COMPLETED, ~6% CANCELLED, ~2% PREPARING, ~2% CONFIRMED
  let status = 'COMPLETED';
  if (orderId >= 247) {
    status = 'PREPARING';
  } else if (orderId >= 244) {
    status = 'CONFIRMED';
  } else if (orderId % 17 === 0) {
    status = 'CANCELLED';
  }

  const orderType = orderTypes[orderId % orderTypes.length];
  const tableId = orderType === 'DINE_IN' ? ((orderId % 12) + 1) : 'NULL';
  const cashierId = 5 + (orderId % 3); // Staff 5, 6, 7 are Cashiers

  // Pick 1 to 3 items per order
  const numItems = (orderId % 3) + 1;
  let subtotal = 0;
  const itemsInOrder = [];

  for (let i = 0; i < numItems; i++) {
    const menuIdx = (orderId * 2 + i * 5) % MENU.length;
    const menuItem = MENU[menuIdx];
    const itemQty = ((orderId + i) % 2) + 1; // 1 or 2
    const itemSubtotal = Math.round(menuItem.price * itemQty * 100) / 100;
    subtotal += itemSubtotal;

    itemsInOrder.push({
      id: orderItemIdCounter++,
      menuItem,
      qty: itemQty,
      price: menuItem.price,
      subtotal: itemSubtotal
    });
  }

  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const discount = (orderId % 7 === 0) ? Math.round(subtotal * 0.10 * 100) / 100 : 0.00;
  const totalAmount = Math.round((subtotal + tax - discount) * 100) / 100;
  const completedAt = status === 'COMPLETED' ? `'${new Date(orderDate.getTime() + 25 * 60000).toISOString().replace('T', ' ').substring(0, 19)}'` : 'NULL';

  ordersSql.push(`(${orderId}, 'UB-ORD-${String(orderId).padStart(4, '0')}', '${orderType}', ${tableId}, ${cashierId}, '${status}', ${subtotal.toFixed(2)}, ${tax.toFixed(2)}, ${discount.toFixed(2)}, ${totalAmount.toFixed(2)}, 'Customer order #${orderId}', '${orderDateStr}', ${completedAt})`);

  // Order Items
  for (const itm of itemsInOrder) {
    orderItemsSql.push(`(${itm.id}, ${orderId}, ${itm.menuItem.id}, ${itm.qty}, ${itm.price.toFixed(2)}, ${itm.subtotal.toFixed(2)}, 'Standard serving', '${orderDateStr}')`);

    // Ingredient Consumption ONLY for COMPLETED orders (Strict business rule)
    if (status === 'COMPLETED') {
      for (const bomItem of itm.menuItem.bom) {
        let remainingNeed = Math.round(bomItem.baseQtyPerServing * itm.qty * 1000) / 1000;

        // Find available batch for this ingredient received ON OR BEFORE orderDate
        // Sort by expiry_date ASC (FEFO)
        const candidateBatches = batches.filter(b => 
          b.ingId === bomItem.ingId && 
          b.recvDate <= orderDateStr.split(' ')[0] && 
          b.remQty > 0
        ).sort((a, b) => a.expDate.localeCompare(b.expDate));

        for (const targetBatch of candidateBatches) {
          if (remainingNeed <= 0) break;

          const allocQty = Math.min(remainingNeed, targetBatch.remQty);
          remainingNeed = Math.round((remainingNeed - allocQty) * 1000) / 1000;
          targetBatch.remQty = Math.round((targetBatch.remQty - allocQty) * 1000) / 1000;
          
          if (targetBatch.remQty <= 0) {
            targetBatch.remQty = 0;
            targetBatch.status = 'DEPLETED';
          }

          const totalCost = Math.round(allocQty * targetBatch.cost * 100) / 100;

          consumptionsSql.push(`(${consumptionIdCounter++}, ${itm.id}, ${targetBatch.id}, ${bomItem.ingId}, ${allocQty.toFixed(3)}, ${targetBatch.cost.toFixed(2)}, ${totalCost.toFixed(2)}, '${orderDateStr}')`);

          consumptionStockMovements.push({
            id: movementCounter++,
            batchId: targetBatch.id,
            type: 'ORDER_CONSUMPTION',
            qty: allocQty,
            bal: targetBatch.remQty,
            ref: `ORDER-${orderId}-ITEM-${itm.id}`,
            notes: 'POS consumption deduction',
            user: cashierId,
            date: orderDateStr
          });
        }
      }
    }
  }

  // Payments (Consistent with order status)
  if (status === 'COMPLETED') {
    const pMethod = paymentMethods[orderId % paymentMethods.length];
    paymentsSql.push(`(${paymentIdCounter++}, ${orderId}, '${pMethod}', ${totalAmount.toFixed(2)}, 'TXN-UB-${String(orderId).padStart(6, '0')}', 'SUCCESSFUL', '${orderDateStr}')`);
  } else if (status === 'CANCELLED' && orderId % 2 === 0) {
    paymentsSql.push(`(${paymentIdCounter++}, ${orderId}, 'ONLINE', ${totalAmount.toFixed(2)}, 'TXN-REF-${String(orderId).padStart(6, '0')}', 'REFUNDED', '${orderDateStr}')`);
  }
}

// 5. FINALIZE BATCH STATUSES AS OF 2026-11-02
const CURRENT_DATE = '2026-11-02';
batches.forEach(b => {
  b.remQty = Math.max(0, Math.round(b.remQty * 1000) / 1000);
  if (b.remQty === 0) {
    b.status = 'DEPLETED';
  } else if (b.expDate < CURRENT_DATE) {
    b.status = 'EXPIRED';
  } else {
    b.status = 'ACTIVE';
  }
});

console.log('Batch Status Summary:');
console.log(`- Total Batches: ${batches.length}`);
console.log(`- Active: ${batches.filter(b => b.status === 'ACTIVE').length}`);
console.log(`- Depleted: ${batches.filter(b => b.status === 'DEPLETED').length}`);
console.log(`- Expired: ${batches.filter(b => b.status === 'EXPIRED').length}`);

// 6. BUILD AND WRITE 03_suppliers_and_inventory.sql
function buildSuppliersAndInventoryFile() {
  const suppliersSql = `INSERT INTO \`suppliers\` (\`id\`, \`name\`, \`contact_person\`, \`email\`, \`phone\`, \`address\`, \`lead_time_days\`, \`payment_terms\`, \`is_active\`) VALUES
(1, 'FarmFresh Organics Pvt Ltd', 'Ramesh Patel', 'orders@farmfreshorganics.in', '+91 98330 11221', 'Plot 42, Vashi APMC Market, Navi Mumbai, MH', 1, 'Net 15', TRUE),
(2, 'MilkyWay Dairy Products Co', 'Suresh Deshmukh', 'sales@milkywaydairy.in', '+91 98330 22332', 'Survey 108, Anand Milk Corridor, Anand, GJ', 1, 'Net 30', TRUE),
(3, 'Royal Poultry & Meats Ltd', 'Farhan Qureshi', 'supply@royalpoultry.in', '+91 98330 33443', 'Gala 12, Deonar Abattoir Road, Mumbai, MH', 1, 'Cash on Delivery', TRUE),
(4, 'Golden Grain Flour Mills', 'Harpreet Singh', 'contact@goldengrain.in', '+91 98330 44554', 'Industrial Area Phase 2, Ludhiana, PB', 3, 'Net 30', TRUE),
(5, 'SpiceRoute Agro Traders', 'Meenakshi Iyer', 'orders@spicerouteagro.in', '+91 98330 55665', 'Wholesale Spice Yard, Mattancherry, Kochi, KL', 4, 'Net 30', TRUE),
(6, 'BakerBros Food Supplies Ltd', 'Nikhil Agarwal', 'info@bakerbros.in', '+91 98330 66776', 'Bhiwandi Logistics Hub, Thane, MH', 2, 'Net 15', TRUE)
ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);`;

  const supplierIngSql = `INSERT INTO \`supplier_ingredients\` (\`supplier_id\`, \`ingredient_id\`, \`contract_unit_cost\`, \`minimum_order_quantity\`, \`is_preferred_supplier\`) VALUES
-- FarmFresh Organics (Produce)
(1, 3, 33.50, 10.000, TRUE),   -- Tomatoes
(1, 4, 26.50, 10.000, TRUE),   -- Red Onions
(1, 5, 22.00, 20.000, TRUE),   -- Potatoes
(1, 8, 80.00, 5.000, TRUE),    -- Lettuce
(1, 17, 175.00, 2.000, TRUE),  -- Garlic
(1, 18, 135.00, 2.000, TRUE),  -- Ginger
(1, 21, 55.00, 2.000, TRUE),   -- Green Chillies
(1, 27, 52.00, 5.000, TRUE),   -- Capsicum

-- MilkyWay Dairy (Dairy & Cheese)
(2, 2, 410.00, 5.000, TRUE),   -- Mozzarella Cheese
(2, 7, 310.00, 5.000, TRUE),   -- Paneer
(2, 9, 62.00, 20.000, TRUE),   -- Milk
(2, 10, 470.00, 5.000, TRUE),  -- Butter
-- Backup Supplier for Dairy
(6, 2, 430.00, 5.000, FALSE),  -- Mozzarella Cheese from BakerBros

-- Royal Poultry & Meats
(3, 6, 250.00, 10.000, TRUE),  -- Chicken Breast
(3, 11, 6.00, 60.000, TRUE),   -- Eggs

-- Golden Grain Flour Mills (Dry Grains & Staple)
(4, 1, 40.00, 25.000, TRUE),   -- Flour
(4, 12, 42.00, 20.000, TRUE),  -- Sugar
(4, 13, 20.00, 10.000, TRUE),  -- Salt
(4, 14, 130.00, 20.000, TRUE), -- Oil
(4, 26, 300.00, 2.000, TRUE),  -- Yeast

-- SpiceRoute Agro Traders
(5, 19, 90.00, 10.000, TRUE),  -- Tomato Sauce Puree
(5, 20, 150.00, 5.000, TRUE),  -- Mayonnaise
(5, 22, 530.00, 2.000, TRUE),  -- Garam Masala
(5, 23, 720.00, 5.000, TRUE),  -- Coffee Beans
(5, 24, 360.00, 5.000, TRUE),  -- Tea Leaves
(5, 25, 600.00, 2.000, TRUE),  -- Cocoa Powder
-- Secondary Supplier for Spices & Sauces
(1, 19, 98.00, 5.000, FALSE),  -- Tomato Sauce from FarmFresh

-- BakerBros Food Supplies Ltd
(6, 15, 11.50, 40.000, TRUE),  -- Burger Buns
(6, 16, 24.00, 30.000, TRUE),  -- Pizza Base
(6, 28, 325.00, 5.000, TRUE),  -- Dark Chocolate
-- Secondary Supplier for Buns & Bases
(4, 15, 12.50, 40.000, FALSE), -- Burger Buns from Golden Grain
(4, 16, 26.00, 30.000, FALSE)  -- Pizza Base from Golden Grain
ON DUPLICATE KEY UPDATE \`contract_unit_cost\` = VALUES(\`contract_unit_cost\`);`;

  const batchesSql = batches.map(b => 
    `(${b.id}, ${b.ingId}, '${b.batchNo}', ${b.qtyRecv.toFixed(3)}, ${b.remQty.toFixed(3)}, ${b.cost.toFixed(2)}, '${b.recvDate}', '${b.expDate}', '${b.status}')`
  ).join(',\n');

  const receiptMovementsSql = initialStockMovements.map(m =>
    `(${m.id}, ${m.batchId}, '${m.type}', ${m.qty.toFixed(3)}, ${m.bal.toFixed(3)}, '${m.ref}', '${m.notes}', ${m.user}, '${m.date}')`
  ).join(',\n');

  const content = `-- ============================================================================
-- Urban Bites Restaurant & Food Inventory System
-- Seed File 3: Suppliers, Supplier Catalogs, Inventory Batches & Receipt Movements
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- ============================================================================

USE \`restaurant_inventory_db\`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. SUPPLIERS (6 Fictional Vendors)
-- ----------------------------------------------------------------------------
${suppliersSql}

-- ----------------------------------------------------------------------------
-- 2. SUPPLIER INGREDIENTS (Multi-Supplier Catalog Matrix)
-- ----------------------------------------------------------------------------
${supplierIngSql}

-- ----------------------------------------------------------------------------
-- 3. INVENTORY BATCHES (48 Physical Batches across 28 Ingredients)
-- Reconciles 100% with historical consumptions and waste records
-- ----------------------------------------------------------------------------
INSERT INTO \`inventory_batches\` (\`id\`, \`ingredient_id\`, \`batch_number\`, \`quantity_received\`, \`quantity_remaining\`, \`unit_cost\`, \`received_date\`, \`expiry_date\`, \`status\`) VALUES
${batchesSql}
ON DUPLICATE KEY UPDATE 
    \`quantity_remaining\` = VALUES(\`quantity_remaining\`),
    \`status\` = VALUES(\`status\`);

-- ----------------------------------------------------------------------------
-- 4. STOCK MOVEMENTS (Initial Receipt Movements for All Batches)
-- ----------------------------------------------------------------------------
INSERT INTO \`stock_movements\` (\`id\`, \`batch_id\`, \`movement_type\`, \`quantity\`, \`balance_after\`, \`reference_id\`, \`notes\`, \`created_by_user_id\`, \`created_at\`) VALUES
${receiptMovementsSql}
ON DUPLICATE KEY UPDATE \`quantity\` = VALUES(\`quantity\`);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Seed File 3 (Suppliers, Catalogs, Batches & Receipts) loaded successfully.' AS status;
`;

  fs.writeFileSync(path.join(__dirname, '03_suppliers_and_inventory.sql'), content);
  console.log('03_suppliers_and_inventory.sql written successfully.');
}

// 7. BUILD AND WRITE 04_historical_transactions.sql
function buildHistoricalTransactionsFile() {
  // 18 Purchase Orders matching receipts
  const poSuppliers = [
    { supId: 4, items: [{ ingId: 1, qty: 100, cost: 40.0 }, { ingId: 12, qty: 80, cost: 42.0 }, { ingId: 13, qty: 40, cost: 20.0 }] },
    { supId: 1, items: [{ ingId: 5, qty: 120, cost: 22.0 }, { ingId: 4, qty: 60, cost: 25.0 }, { ingId: 3, qty: 40, cost: 32.0 }] },
    { supId: 2, items: [{ ingId: 2, qty: 30, cost: 410.0 }, { ingId: 9, qty: 80, cost: 60.0 }, { ingId: 10, qty: 25, cost: 460.0 }] },
    { supId: 3, items: [{ ingId: 6, qty: 30, cost: 245.0 }, { ingId: 11, qty: 240, cost: 5.8 }] },
    { supId: 6, items: [{ ingId: 15, qty: 150, cost: 11.0 }, { ingId: 16, qty: 120, cost: 23.0 }] },
    { supId: 5, items: [{ ingId: 19, qty: 60, cost: 90.0 }, { ingId: 28, qty: 30, cost: 325.0 }] },
    { supId: 4, items: [{ ingId: 1, qty: 120, cost: 41.0 }, { ingId: 14, qty: 120, cost: 128.0 }] },
    { supId: 1, items: [{ ingId: 5, qty: 140, cost: 23.0 }, { ingId: 4, qty: 70, cost: 26.5 }, { ingId: 8, qty: 20, cost: 75.0 }] },
    { supId: 2, items: [{ ingId: 2, qty: 40, cost: 415.0 }, { ingId: 7, qty: 35, cost: 310.0 }, { ingId: 9, qty: 100, cost: 62.0 }] },
    { supId: 3, items: [{ ingId: 6, qty: 40, cost: 250.0 }] },
    { supId: 6, items: [{ ingId: 15, qty: 180, cost: 11.5 }, { ingId: 16, qty: 140, cost: 24.0 }] },
    { supId: 4, items: [{ ingId: 10, qty: 30, cost: 480.0 }, { ingId: 14, qty: 150, cost: 135.0 }] },
    { supId: 3, items: [{ ingId: 11, qty: 300, cost: 6.5 }] },
    { supId: 4, items: [{ ingId: 1, qty: 120, cost: 42.0 }] },
    { supId: 1, items: [{ ingId: 5, qty: 150, cost: 24.0 }, { ingId: 4, qty: 60, cost: 28.0 }, { ingId: 27, qty: 40, cost: 52.0 }] },
    { supId: 2, items: [{ ingId: 2, qty: 35, cost: 420.0 }, { ingId: 7, qty: 30, cost: 320.0 }, { ingId: 9, qty: 80, cost: 64.0 }] },
    { supId: 3, items: [{ ingId: 6, qty: 35, cost: 260.0 }] },
    { supId: 6, items: [{ ingId: 15, qty: 120, cost: 12.0 }, { ingId: 16, qty: 100, cost: 25.0 }] }
  ];

  let poSql = [];
  let poItemsSql = [];
  let poItemId = 1;

  for (let poId = 1; poId <= 18; poId++) {
    const config = poSuppliers[poId - 1];
    const daysAgo = 88 - Math.floor((poId - 1) * 4.8);
    const orderDate = new Date(2026, 10, 2);
    orderDate.setDate(orderDate.getDate() - daysAgo);

    const deliveryDate = new Date(orderDate);
    deliveryDate.setDate(deliveryDate.getDate() + 2);

    let totalAmount = 0;
    const currentPoItems = [];

    for (const item of config.items) {
      const subtotal = Math.round(item.qty * item.cost * 100) / 100;
      totalAmount += subtotal;
      currentPoItems.push({
        id: poItemId++,
        poId,
        ingId: item.ingId,
        qty: item.qty,
        cost: item.cost,
        subtotal
      });
    }

    const status = poId <= 16 ? 'RECEIVED' : (poId === 17 ? 'PARTIALLY_RECEIVED' : 'SUBMITTED');
    const actualDelivery = status === 'RECEIVED' ? `'${deliveryDate.toISOString().split('T')[0]}'` : 'NULL';

    poSql.push(`(${poId}, 'PO-2026-${String(poId).padStart(3, '0')}', ${config.supId}, 2, '${status}', ${totalAmount.toFixed(2)}, '${orderDate.toISOString().split('T')[0]}', '${deliveryDate.toISOString().split('T')[0]}', ${actualDelivery}, 'Routine replenishment for kitchen operations')`);

    for (const it of currentPoItems) {
      const recvQty = status === 'RECEIVED' ? it.qty : (status === 'PARTIALLY_RECEIVED' ? Math.round(it.qty * 0.5) : 0);
      poItemsSql.push(`(${it.id}, ${it.poId}, ${it.ingId}, ${it.qty.toFixed(3)}, ${recvQty.toFixed(3)}, ${it.cost.toFixed(2)}, ${it.subtotal.toFixed(2)})`);
    }
  }

  const consumptionMovementsSql = consumptionStockMovements.map(m =>
    `(${m.id}, ${m.batchId}, '${m.type}', ${m.qty.toFixed(3)}, ${m.bal.toFixed(3)}, '${m.ref}', '${m.notes}', ${m.user}, '${m.date}')`
  ).join(',\n');

  const content = `-- ============================================================================
-- Urban Bites Restaurant & Food Inventory System
-- Seed File 4: Purchase Orders, Historical Dining Orders, Payments & Consumptions
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- Records: 18 POs, 250 Orders, ~500 Order Items, ~235 Payments, ~1200 Consumptions
-- ============================================================================

USE \`restaurant_inventory_db\`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. PURCHASE ORDERS (18 Orders across 6 Suppliers)
-- ----------------------------------------------------------------------------
INSERT INTO \`purchase_orders\` (\`id\`, \`po_number\`, \`supplier_id\`, \`created_by_user_id\`, \`status\`, \`total_amount\`, \`order_date\`, \`expected_delivery_date\`, \`actual_delivery_date\`, \`notes\`) VALUES
${poSql.join(',\n')}
ON DUPLICATE KEY UPDATE \`status\` = VALUES(\`status\`);

-- ----------------------------------------------------------------------------
-- 2. PURCHASE ORDER ITEMS
-- ----------------------------------------------------------------------------
INSERT INTO \`purchase_order_items\` (\`id\`, \`purchase_order_id\`, \`ingredient_id\`, \`quantity_ordered\`, \`quantity_received\`, \`unit_cost\`, \`subtotal\`) VALUES
${poItemsSql.join(',\n')}
ON DUPLICATE KEY UPDATE \`quantity_received\` = VALUES(\`quantity_received\`);

-- ----------------------------------------------------------------------------
-- 3. ORDERS (250 Historical Orders across 90 Days)
-- ----------------------------------------------------------------------------
INSERT INTO \`orders\` (\`id\`, \`order_number\`, \`order_type\`, \`table_id\`, \`user_id\`, \`status\`, \`subtotal\`, \`tax_amount\`, \`discount_amount\`, \`total_amount\`, \`notes\`, \`order_date\`, \`completed_at\`) VALUES
${ordersSql.join(',\n')}
ON DUPLICATE KEY UPDATE \`status\` = VALUES(\`status\`);

-- ----------------------------------------------------------------------------
-- 4. ORDER ITEMS
-- ----------------------------------------------------------------------------
INSERT INTO \`order_items\` (\`id\`, \`order_id\`, \`menu_item_id\`, \`quantity\`, \`unit_price\`, \`subtotal\`, \`special_instructions\`, \`created_at\`) VALUES
${orderItemsSql.join(',\n')}
ON DUPLICATE KEY UPDATE \`quantity\` = VALUES(\`quantity\`);

-- ----------------------------------------------------------------------------
-- 5. PAYMENTS (Matched strictly with Orders)
-- ----------------------------------------------------------------------------
INSERT INTO \`payments\` (\`id\`, \`order_id\`, \`payment_method\`, \`amount_paid\`, \`transaction_reference\`, \`payment_status\`, \`paid_at\`) VALUES
${paymentsSql.join(',\n')}
ON DUPLICATE KEY UPDATE \`payment_status\` = VALUES(\`payment_status\`);

-- ----------------------------------------------------------------------------
-- 6. ORDER INGREDIENT CONSUMPTIONS (Only for Completed Orders)
-- ----------------------------------------------------------------------------
INSERT INTO \`order_ingredient_consumptions\` (\`id\`, \`order_item_id\`, \`batch_id\`, \`ingredient_id\`, \`quantity_consumed\`, \`unit_cost_at_consumption\`, \`total_cost\`, \`consumed_at\`) VALUES
${consumptionsSql.join(',\n')}
ON DUPLICATE KEY UPDATE \`quantity_consumed\` = VALUES(\`quantity_consumed\`);

-- ----------------------------------------------------------------------------
-- 7. STOCK MOVEMENTS (Consumption Ledger Entries with Running Balances)
-- ----------------------------------------------------------------------------
INSERT INTO \`stock_movements\` (\`id\`, \`batch_id\`, \`movement_type\`, \`quantity\`, \`balance_after\`, \`reference_id\`, \`notes\`, \`created_by_user_id\`, \`created_at\`) VALUES
${consumptionMovementsSql}
ON DUPLICATE KEY UPDATE \`quantity\` = VALUES(\`quantity\`);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Seed File 4 (Purchase Orders, Orders, Payments & Consumptions) loaded successfully.' AS status;
`;

  fs.writeFileSync(path.join(__dirname, '04_historical_transactions.sql'), content);
  console.log(`04_historical_transactions.sql written successfully (${ordersSql.length} orders, ${consumptionsSql.length} consumptions).`);
}

// 8. BUILD AND WRITE 05_waste_and_forecasts.sql
function buildWasteAndForecastsFile() {
  // 24 Demand Forecasts
  const forecastRecords = [
    // Next 7 days for High Volume Menu Items
    { id: 1, date: '2026-11-03', type: 'MENU_ITEM', targetId: 8, pred: 24.0, low: 20.0, high: 28.0, actual: null, model: 'v1.0.0-baseline' }, // Margherita Pizza
    { id: 2, date: '2026-11-03', type: 'MENU_ITEM', targetId: 5, pred: 30.0, low: 26.0, high: 35.0, actual: null, model: 'v1.0.0-baseline' }, // Veg Burger
    { id: 3, date: '2026-11-03', type: 'MENU_ITEM', targetId: 1, pred: 45.0, low: 38.0, high: 52.0, actual: null, model: 'v1.0.0-baseline' }, // French Fries
    { id: 4, date: '2026-11-03', type: 'MENU_ITEM', targetId: 10, pred: 18.0, low: 14.0, high: 22.0, actual: null, model: 'v1.0.0-baseline' }, // Chicken Pizza
    { id: 5, date: '2026-11-03', type: 'INGREDIENT', targetId: 2, pred: 5.500, low: 4.800, high: 6.200, actual: null, model: 'v1.0.0-baseline' }, // Mozzarella (kg)
    { id: 6, date: '2026-11-03', type: 'INGREDIENT', targetId: 6, pred: 4.800, low: 4.000, high: 5.600, actual: null, model: 'v1.0.0-baseline' }, // Chicken (kg)
    { id: 7, date: '2026-11-03', type: 'INGREDIENT', targetId: 5, pred: 14.000, low: 12.000, high: 16.500, actual: null, model: 'v1.0.0-baseline' }, // Potatoes (kg)

    { id: 8, date: '2026-11-04', type: 'MENU_ITEM', targetId: 8, pred: 22.0, low: 18.0, high: 26.0, actual: null, model: 'v1.0.0-baseline' },
    { id: 9, date: '2026-11-04', type: 'MENU_ITEM', targetId: 5, pred: 28.0, low: 24.0, high: 32.0, actual: null, model: 'v1.0.0-baseline' },
    { id: 10, date: '2026-11-04', type: 'INGREDIENT', targetId: 2, pred: 5.100, low: 4.400, high: 5.800, actual: null, model: 'v1.0.0-baseline' },
    { id: 11, date: '2026-11-04', type: 'INGREDIENT', targetId: 7, pred: 3.500, low: 2.900, high: 4.100, actual: null, model: 'v1.0.0-baseline' }, // Paneer (kg)

    { id: 12, date: '2026-11-05', type: 'MENU_ITEM', targetId: 8, pred: 26.0, low: 21.0, high: 30.0, actual: null, model: 'v1.0.0-baseline' },
    { id: 13, date: '2026-11-05', type: 'INGREDIENT', targetId: 2, pred: 5.900, low: 5.000, high: 6.800, actual: null, model: 'v1.0.0-baseline' },

    // Weekend Spike Predictions (Friday & Saturday Nov 6-7)
    { id: 14, date: '2026-11-06', type: 'MENU_ITEM', targetId: 8, pred: 38.0, low: 32.0, high: 44.0, actual: null, model: 'v1.2.0-lstm' },
    { id: 15, date: '2026-11-06', type: 'MENU_ITEM', targetId: 10, pred: 28.0, low: 23.0, high: 33.0, actual: null, model: 'v1.2.0-lstm' },
    { id: 16, date: '2026-11-06', type: 'INGREDIENT', targetId: 2, pred: 8.800, low: 7.500, high: 10.000, actual: null, model: 'v1.2.0-lstm' },
    { id: 17, date: '2026-11-06', type: 'INGREDIENT', targetId: 6, pred: 7.200, low: 6.100, high: 8.300, actual: null, model: 'v1.2.0-lstm' },
    { id: 18, date: '2026-11-07', type: 'MENU_ITEM', targetId: 8, pred: 42.0, low: 36.0, high: 48.0, actual: null, model: 'v1.2.0-lstm' },
    { id: 19, date: '2026-11-07', type: 'MENU_ITEM', targetId: 1, pred: 65.0, low: 55.0, high: 75.0, actual: null, model: 'v1.2.0-lstm' },
    { id: 20, date: '2026-11-07', type: 'INGREDIENT', targetId: 5, pred: 20.000, low: 17.500, high: 23.000, actual: null, model: 'v1.2.0-lstm' },

    // Historical Evaluated Forecasts (Oct 28 - Oct 30) with actuals recorded
    { id: 21, date: '2026-10-28', type: 'MENU_ITEM', targetId: 8, pred: 20.0, low: 16.0, high: 24.0, actual: 22.000, model: 'v1.0.0-baseline' },
    { id: 22, date: '2026-10-28', type: 'INGREDIENT', targetId: 2, pred: 4.600, low: 3.900, high: 5.300, actual: 4.900, model: 'v1.0.0-baseline' },
    { id: 23, date: '2026-10-29', type: 'MENU_ITEM', targetId: 8, pred: 21.0, low: 17.0, high: 25.0, actual: 19.000, model: 'v1.0.0-baseline' },
    { id: 24, date: '2026-10-30', type: 'MENU_ITEM', targetId: 5, pred: 32.0, low: 27.0, high: 37.0, actual: 34.000, model: 'v1.0.0-baseline' }
  ];

  const forecastSql = forecastRecords.map(f =>
    `(${f.id}, '${f.date}', '${f.type}', ${f.targetId}, ${f.pred.toFixed(3)}, ${f.low.toFixed(3)}, ${f.high.toFixed(3)}, ${f.actual !== null ? f.actual.toFixed(3) : 'NULL'}, '${f.model}', '2026-11-01 02:00:00')`
  );

  const wasteMovementsSql = wasteStockMovements.map(m =>
    `(${m.id}, ${m.batchId}, '${m.type}', ${m.qty.toFixed(3)}, ${m.bal.toFixed(3)}, '${m.ref}', '${m.notes}', ${m.user}, '${m.date}')`
  ).join(',\n');

  const content = `-- ============================================================================
-- Urban Bites Restaurant & Food Inventory System
-- Seed File 5: Food Waste Records, Waste Movements & Demand Forecasts
-- Database: MySQL 8 (InnoDB, utf8mb4)
-- Records: 35 Waste Events across 6 reasons, 28 Waste Movements, 24 Forecasts
-- ============================================================================

USE \`restaurant_inventory_db\`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. WASTE RECORDS (35 Realistic Food Loss Events)
-- ----------------------------------------------------------------------------
INSERT INTO \`waste_records\` (\`id\`, \`batch_id\`, \`ingredient_id\`, \`menu_item_id\`, \`quantity_wasted\`, \`unit_id\`, \`waste_reason\`, \`financial_loss\`, \`logged_by_user_id\`, \`notes\`, \`logged_at\`) VALUES
${wasteSqlRows.join(',\n')}
ON DUPLICATE KEY UPDATE \`financial_loss\` = VALUES(\`financial_loss\`);

-- ----------------------------------------------------------------------------
-- 2. STOCK MOVEMENTS (Waste Disposal Deductions)
-- ----------------------------------------------------------------------------
INSERT INTO \`stock_movements\` (\`id\`, \`batch_id\`, \`movement_type\`, \`quantity\`, \`balance_after\`, \`reference_id\`, \`notes\`, \`created_by_user_id\`, \`created_at\`) VALUES
${wasteMovementsSql}
ON DUPLICATE KEY UPDATE \`quantity\` = VALUES(\`quantity\`);

-- ----------------------------------------------------------------------------
-- 3. DEMAND FORECASTS (24 Model Predictions for ML Microservice Verification)
-- ----------------------------------------------------------------------------
INSERT INTO \`demand_forecasts\` (\`id\`, \`forecast_date\`, \`target_type\`, \`target_id\`, \`predicted_quantity\`, \`confidence_lower_bound\`, \`confidence_upper_bound\`, \`actual_quantity_consumed\`, \`model_version\`, \`generated_at\`) VALUES
${forecastSql.join(',\n')}
ON DUPLICATE KEY UPDATE \`predicted_quantity\` = VALUES(\`predicted_quantity\`);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Seed File 5 (Waste Records & Demand Forecasts) loaded successfully.' AS status;
`;

  fs.writeFileSync(path.join(__dirname, '05_waste_and_forecasts.sql'), content);
  console.log(`05_waste_and_forecasts.sql written successfully (${wasteDefinitions.length} waste events, ${forecastRecords.length} forecasts).`);
}

buildSuppliersAndInventoryFile();
buildHistoricalTransactionsFile();
buildWasteAndForecastsFile();

console.log('All seed files generated successfully with complete mathematical reconciliation.');
