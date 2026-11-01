# Urban Bites Backend Service

Backend REST API for **Urban Bites — Restaurant & Food Inventory Management System with Demand Prediction and Food Waste Reduction**.

Built on **Node.js 24**, **Express 4 (ES Modules)**, **MySQL 8 (`mysql2/promise`)**, and **MongoDB Atlas (`mongoose`)**.

---

## 1. Quick Start

### Prerequisites
- Node.js $\ge 18$
- MySQL Server 8.0 on port 3306
- MongoDB Atlas cluster connection string

### Environment Configuration
Copy `.env.example` to `.env` and configure:
```ini
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# MySQL 8 Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=restaurant_inventory_db

# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.9sc6q4w.mongodb.net/restaurant_inventory_logs?retryWrites=true&w=majority

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_at_least_16_chars
JWT_EXPIRES_IN=24h
```

### Running Locally
```bash
# Install dependencies
npm install

# Start development server with file watching
npm run dev

# Run infrastructure and utility test suite
npm test
```

---

## 2. API Response Contract

All API endpoints return JSON conforming strictly to the `ApiResponse` utility ([`src/utils/apiResponse.js`](src/utils/apiResponse.js)):

### Success Payload Structure
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": {
    "item": { "id": 1, "name": "Crispy French Fries" }
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "totalCount": 1
  }
}
```

### Usage in Controllers:
```javascript
import { ApiResponse } from '../utils/apiResponse.js';

// Standard 200 OK
ApiResponse.ok(res, data, 'Data retrieved successfully', { page: 1 });

// Standard 201 Created
ApiResponse.created(res, newItem, 'Order placed successfully');

// Manual instantiation
new ApiResponse(200, payload, 'Custom message').send(res);
```

---

## 3. Centralized Error Handling

All application errors are intercepted by [`src/middleware/errorHandler.js`](src/middleware/errorHandler.js) and normalized into a consistent error contract:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed for request data",
    "status": 400,
    "code": "VALIDATION_ERROR",
    "timestamp": "2026-11-02T02:25:00.000Z",
    "details": [
      {
        "field": "items.0.quantity",
        "message": "Number must be greater than or equal to 1",
        "rule": "too_small"
      }
    ]
  }
}
```

### Operational Errors (`ApiError`):
Throw or pass `ApiError` ([`src/utils/apiError.js`](src/utils/apiError.js)) inside controllers and services:
```javascript
import { ApiError } from '../utils/apiError.js';

// 400 Bad Request
throw ApiError.badRequest('Invalid inventory batch ID', 'INVALID_BATCH_ID');

// 401 Unauthorized
throw ApiError.unauthorized('Invalid credentials', 'AUTH_FAILED');

// 403 Forbidden
throw ApiError.forbidden('Only inventory managers can receive purchase orders', 'FORBIDDEN_ROLE');

// 404 Not Found
throw ApiError.notFound('Menu item not found', 'MENU_ITEM_NOT_FOUND');

// 409 Conflict
throw ApiError.conflict('Order already completed', 'ORDER_ALREADY_PROCESSED');
```

### Automatic Error Mapping:
- **Zod Validation Errors:** Transformed into HTTP 400 with field-level details.
- **JWT Errors:** `TokenExpiredError` $\rightarrow$ 401 (`TOKEN_EXPIRED`), `JsonWebTokenError` $\rightarrow$ 401 (`INVALID_TOKEN`).
- **MySQL Errors:**
  - Duplicate key (`ER_DUP_ENTRY`) $\rightarrow$ 409 (`DUPLICATE_ENTRY`).
  - Foreign key missing (`ER_NO_REFERENCED_ROW_2`) $\rightarrow$ 400 (`FOREIGN_KEY_VIOLATION`).
  - Restrict violation (`ER_ROW_IS_REFERENCED_2`) $\rightarrow$ 409 (`RESTRICT_CONSTRAINT_VIOLATION`).
  - Stored procedure business rule signal (`ER_SIGNAL_EXCEPTION`) $\rightarrow$ 400 (`BUSINESS_RULE_VIOLATION`).
- **Production Sanitization:** Stack traces and sensitive internal details are stripped in production mode.

---

## 4. JWT Authentication Middleware

Implemented in [`src/middleware/auth.js`](src/middleware/auth.js):
- **Mechanism:** HTTP Header `Authorization: Bearer <token>`.
- **Claims Attached to `req.user`:**
  - `id`: Staff User ID (matches `users.id`)
  - `username`: Staff username
  - `role`: Staff role string (`ADMIN`, `INVENTORY_MANAGER`, `CHEF`, `CASHIER`)
  - `email`: Staff email
- **Token Generation Helper:**
  ```javascript
  import { generateToken } from '../middleware/auth.js';
  const token = generateToken({ id: user.id, username: user.username, role: user.role, email: user.email });
  ```

---

## 5. Role-Based Access Control (RBAC)

Implemented in [`src/middleware/rbac.js`](src/middleware/rbac.js) matching the database roles table:
- **`ADMIN`:** System configuration, staff management, full access
- **`INVENTORY_MANAGER`:** Procurement, supplier catalog, batches, par levels
- **`CHEF`:** Recipes, menu items, kitchen production, waste auditing
- **`CASHIER`:** Dining tables, POS orders, payment processing

### Route Protection Usage:
```javascript
import { authenticateJWT } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

// Route accessible only by ADMIN
router.delete('/users/:id', authenticateJWT, requireRole('ADMIN'), userController.delete);

// Route accessible by ADMIN or INVENTORY_MANAGER
router.post('/inventory/batches', authenticateJWT, requireRole('ADMIN', 'INVENTORY_MANAGER'), inventoryController.createBatch);
```

---

## 6. Authentication & Staff Management API Endpoints

### 6.1 Authentication Endpoints (`/api/v1/auth`)

#### `POST /api/v1/auth/login`
Authenticates a staff member using either `username` or `email` and password.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "identifier": "rohit_admin",
    "password": "UrbanBites@2026"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Login successful",
    "data": {
      "user": {
        "id": 1,
        "role_id": 1,
        "role": "ADMIN",
        "username": "rohit_admin",
        "email": "rohit.admin@urbanbites.in",
        "full_name": "Rohit Sharma",
        "phone": "+91 98201 11223",
        "is_active": true,
        "created_at": "2026-11-02T02:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "24h"
    },
    "meta": null
  }
  ```
- **Error Response (401 Unauthorized):**
  ```json
  {
    "success": false,
    "error": {
      "message": "Invalid username/email or password",
      "status": 401,
      "code": "INVALID_CREDENTIALS",
      "timestamp": "2026-11-02T02:30:00.000Z"
    }
  }
  ```

#### `GET /api/v1/auth/profile`
Retrieves live profile data directly from MySQL for the currently authenticated staff token.
- **Access:** Private (Any valid JWT)
- **Header:** `Authorization: Bearer <token>`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Profile retrieved successfully",
    "data": {
      "id": 1,
      "role_id": 1,
      "role": "ADMIN",
      "role_description": "Full system access, user management, and system configuration",
      "username": "rohit_admin",
      "email": "rohit.admin@urbanbites.in",
      "full_name": "Rohit Sharma",
      "phone": "+91 98201 11223",
      "is_active": true,
      "created_at": "2026-11-02T02:00:00.000Z",
      "updated_at": "2026-11-02T02:30:00.000Z"
    },
    "meta": null
  }
  ```

---

### 6.2 Staff Management Endpoints (`/api/v1/users`)
All staff management endpoints are strictly restricted to the **ADMIN** role via `requireRole('ADMIN')`.

| Method | Endpoint | Description | Query / Body Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | List staff members | `?page=1&limit=20&role=CHEF&isActive=true&search=patel` |
| `GET` | `/api/v1/users/:id` | Get staff member by ID | URL path param `:id` |
| `POST` | `/api/v1/users` | Create staff member | Body: `role_id`, `username`, `email`, `password`, `full_name`, `phone?`, `is_active?` |
| `PATCH`| `/api/v1/users/:id` | Update staff details | Body: `role_id?`, `username?`, `email?`, `password?`, `full_name?`, `phone?`, `is_active?` |
| `PATCH`| `/api/v1/users/:id/status` | Activate/Deactivate | Body: `{ "is_active": false }` |

#### Creating a Staff Account:
```http
POST /api/v1/users HTTP/1.1
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{
  "role_id": 3,
  "username": "sanjay_linecook",
  "email": "sanjay.cook@urbanbites.in",
  "password": "SecurePassword@2026",
  "full_name": "Sanjay Verma",
  "phone": "+91 98205 99887",
  "is_active": true
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Staff member account created successfully",
  "data": {
    "id": 11,
    "role_id": 3,
    "role_name": "CHEF",
    "role_description": "Kitchen management, recipe creation, production, and food waste auditing",
    "username": "sanjay_linecook",
    "email": "sanjay.cook@urbanbites.in",
    "full_name": "Sanjay Verma",
    "phone": "+91 98205 99887",
    "is_active": true,
    "created_at": "2026-11-02T02:35:00.000Z"
  },
  "meta": null
}
```

---

### 6.3 Security Controls & Business Protections

1. **Anti-User Enumeration:**
   - Both invalid usernames and incorrect passwords return identical generic `401 Unauthorized` responses (`INVALID_CREDENTIALS`).
2. **Password Hash Protection:**
   - `password_hash` is stripped by DAO projection in `UserModel.findById` and `UserModel.findAll`. It is never returned in any response envelope.
3. **Last Active Admin Protection:**
   - The system prevents an administrator from deactivating or demoting the last active account with `ADMIN` privileges (`LAST_ADMIN_PROTECTION`).
4. **Self-Privilege Escalation Prevention:**
   - Users updating their own profiles cannot alter their own `role_id` (`SELF_ROLE_CHANGE_FORBIDDEN`).
5. **Immediate Token Revocation on Deactivation:**
   - `GET /api/v1/auth/profile` queries fresh user status from MySQL. If an admin deactivates an account, existing JWTs for that account immediately receive `401 ACCOUNT_DEACTIVATED`.
6. **MongoDB Atlas Audit Logging:**
   - Security-sensitive actions (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `STAFF_CREATED`, `STAFF_UPDATED`, `STAFF_DEACTIVATED`) are recorded in MongoDB Atlas. Passwords, JWT tokens, and credentials are automatically stripped.

// Route accessible by CHEF or ADMIN
router.post('/waste', authenticateJWT, requireRole('ADMIN', 'CHEF'), wasteController.logWaste);
```

---

## 6. Request Validation Middleware

Implemented in [`src/middleware/validate.js`](src/middleware/validate.js) powered by **Zod**:

```javascript
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const createOrderSchema = {
  body: z.object({
    order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'ONLINE']),
    table_id: z.number().int().positive().optional(),
    items: z.array(z.object({
      menu_item_id: z.number().int().positive(),
      quantity: z.number().int().min(1)
    })).min(1, 'Order must contain at least 1 item')
  }),
  query: z.object({
    discountCode: z.string().optional()
  })
};

router.post('/orders', validate(createOrderSchema), orderController.createOrder);
```

---

## 7. MongoDB Atlas Audit Log Model

Implemented in [`src/models/mongo/AuditLog.js`](src/models/mongo/AuditLog.js):
- **Purpose:** Non-relational append-only compliance audit trail.
- **Fields:** `userId`, `username`, `action`, `resourceType`, `resourceId`, `timestamp`, `requestId`, `metadata`.
- **Security Sanitization:** Mongoose setter automatically strips `password`, `password_hash`, `token`, `jwt`, `secret`, `cardNumber`, `cvv` from the metadata object before saving.

### Recording an Audit Event:
```javascript
import { AuditLog } from '../models/mongo/AuditLog.js';

await AuditLog.record({
  userId: req.user.id,
  username: req.user.username,
  action: 'PROCESS_FEFO_ORDER',
  resourceType: 'ORDER',
  resourceId: orderId,
  requestId: req.headers['x-request-id'] || null,
  metadata: {
    totalAmount: order.total_amount,
    consumedIngredientsCount: 4
  }
});
```

---

## 8. Automated Infrastructure Test Suite

To verify the complete infrastructure, JWT flows, RBAC matrix, Zod validations, and MongoDB Atlas persistence, run:

```bash
npm test
```

Test Results Output:
```
===============================================================
  Urban Bites Backend Core Infrastructure & Utilities Suite    
===============================================================

[Test 1] ApiResponse Utility
  ✅ PASS: Success flag is true for 200 OK
  ✅ PASS: Status code matches 200
  ✅ PASS: Message matches payload
  ✅ PASS: Data payload is preserved
  ✅ PASS: Meta payload is preserved

[Test 2] ApiError Utility
  ✅ PASS: Status code is 400
  ✅ PASS: Error code matches ITEM_INVALID
  ✅ PASS: Error details preserved
  ✅ PASS: Operational error flag is true

[Test 3] Centralized Error Handler Normalization
  ✅ PASS: Error handler outputs correct status code 400
  ✅ PASS: Error response has success: false
  ✅ PASS: Error response has code ITEM_INVALID
  ✅ PASS: Details array present

[Test 4] JWT Authentication: Valid Token
  ✅ PASS: Valid token passes to next()
  ✅ PASS: req.user.username decoded correctly
  ✅ PASS: req.user.role decoded correctly

[Test 5] JWT Authentication: Missing Token
  ✅ PASS: Missing token produces ApiError
  ✅ PASS: Status code is 401
  ✅ PASS: Error code is TOKEN_MISSING

[Test 6] JWT Authentication: Invalid Token
  ✅ PASS: Invalid token returns 401
  ✅ PASS: Error code is INVALID_TOKEN

[Test 7] JWT Authentication: Expired Token
  ✅ PASS: Expired token returns 401
  ✅ PASS: Error code is TOKEN_EXPIRED

[Test 8] RBAC: Authorized Role (Admin)
  ✅ PASS: Admin user authorized successfully

[Test 9] RBAC: Unauthorized Role (Cashier accessing Admin route)
  ✅ PASS: Unauthorized role produces ApiError
  ✅ PASS: Unauthorized role returns 403 Forbidden
  ✅ PASS: Error code is FORBIDDEN_ROLE

[Test 10] Zod Request Body Validation
  ✅ PASS: Invalid body triggers ZodError
  ✅ PASS: Zod captured multiple validation issues
  ✅ PASS: ZodError mapped to 400 Bad Request
  ✅ PASS: Error code mapped to VALIDATION_ERROR
  ✅ PASS: Field-level error details included in response

[Test 11] MongoDB Atlas AuditLog Persistence & Security Sanitization
  ✅ PASS: Audit log saved to MongoDB Atlas with ObjectId
  ✅ PASS: Action stored correctly
  ✅ PASS: Non-sensitive metadata preserved
  ✅ PASS: Security: password field was automatically stripped
  ✅ PASS: Security: token field was automatically stripped
  🧹 Cleaned up verification test document from MongoDB Atlas

===============================================================
  Summary: 37 Passed, 0 Failed
===============================================================
```
