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
  Urban Bites Backend Core Infrastructure & Utilities Suite    
===============================================================
  Summary: 39 Passed, 0 Failed (Infrastructure Suite)

===============================================================
  Urban Bites Auth & Staff Management API Verification Suite   
===============================================================
  Summary: 52 Passed, 0 Failed (Auth & Staff Suite)

===============================================================
  Urban Bites Master Catalog APIs Verification Suite           
===============================================================
  Summary: 76 Passed, 0 Failed (Master Catalog Suite)

===============================================================
  Urban Bites Menu Item Management APIs Verification Suite     
===============================================================
  Summary: 55 Passed, 0 Failed (Menu Item Suite)
===============================================================
  Combined Total: 222 Passed, 0 Failed
```

---

## 9. Security Hardening Architecture (Phase 2 — Task 3)

### 1. Login Enumeration & Account Status Protection
- **Generic 401 Response:** All failed authentication attempts (nonexistent username/email, incorrect password, or deactivated account) return the exact same generic HTTP 401 response:
  ```json
  {
    "success": false,
    "error": {
      "message": "Invalid username/email or password",
      "status": 401,
      "code": "INVALID_CREDENTIALS"
    }
  }
  ```
- **Forensic Audit Logging:** While the external response never leaks whether an account exists or is inactive, internal security logs recorded in MongoDB Atlas retain the specific failure reason (`USER_NOT_FOUND`, `INVALID_PASSWORD`, `ACCOUNT_DEACTIVATED`) without storing passwords or tokens.

### 2. Concurrency-Safe Last-Active-Admin Protection
- **The Threat:** Race conditions where concurrent requests simultaneously check the active admin count (`activeAdmins <= 1`) and proceed to deactivate/demote both administrators, leaving the system with 0 active admins.
- **The Defense:** Implemented in `UserModel.updateUserStatusSafely` and `UserModel.updateUserSafely`:
  - Executes inside a MySQL InnoDB ACID transaction (`START TRANSACTION`).
  - Acquires exclusive row locks via `SELECT ... FOR UPDATE` on all active `ADMIN` accounts and the target user row.
  - Re-evaluates active administrator count under row lock before applying the mutation.
  - Automatically issues `ROLLBACK` and throws `LAST_ADMIN_PROTECTION` (HTTP 400) if the operation would leave zero active administrators.
- **Verification:** Verified via automated concurrent simulation with `Promise.all` attempting parallel deactivations of both active administrators. Exactly one is rejected with `LAST_ADMIN_PROTECTION`, ensuring at least 1 active administrator remains.

### 3. Dynamic Current-Role & Status Authorization
- **The Threat:** Stale JWT claims. A user granted an `ADMIN` role who is subsequently demoted to `CASHIER` or deactivated could continue executing admin actions for up to 24 hours using their existing unexpired JWT.
- **The Defense:** Implemented in `authenticateJWT` and `requireRole`:
  - Every authenticated request dynamically retrieves the user's fresh status and role from MySQL (`UserModel.findById(decoded.id)`).
  - Deactivated accounts (`is_active = false`) are immediately revoked with HTTP 401 `ACCOUNT_DEACTIVATED`.
  - The in-memory request role is overwritten with the live database role (`req.user.role = user.role_name`).
  - Demoted administrators immediately receive HTTP 403 `FORBIDDEN_ROLE` on admin routes, even with a valid, unexpired token.

---

## 10. Master Catalog APIs (Phase 2 — Task 4A)

### 1. Categories Management (`/api/v1/categories`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/categories` | Authenticated Staff | List categories with search, active filter, and pagination |
| `GET` | `/api/v1/categories/:id` | Authenticated Staff | Get single category by ID with menu items count |
| `POST` | `/api/v1/categories` | `ADMIN`, `INVENTORY_MANAGER` | Create new category (duplicate name protected) |
| `PATCH` | `/api/v1/categories/:id` | `ADMIN`, `INVENTORY_MANAGER` | Update category details (name, description, status) |

#### Query Parameters (`GET /api/v1/categories`):
- `page` (number, default: 1): Page number
- `limit` (number, default: 50, max: 100): Page limit
- `search` (string): Search category name or description
- `isActive` (`true` \| `false` \| `all`): Active status filter

#### Create Category Example (`POST /api/v1/categories`):
```json
// Request Body
{
  "name": "Artisanal Breads",
  "description": "Sourdough, baguettes, and fresh brioche",
  "is_active": true
}

// 201 Created Response
{
  "success": true,
  "statusCode": 201,
  "message": "Category created successfully",
  "data": {
    "id": 6,
    "name": "Artisanal Breads",
    "description": "Sourdough, baguettes, and fresh brioche",
    "is_active": true,
    "created_at": "2026-11-02T03:00:00.000Z",
    "menu_items_count": 0
  }
}
```

---

### 2. Units of Measurement Reference (`/api/v1/units`)

Read-only reference data endpoints providing measurement hierarchy and recursive conversion ratios.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/units` | Authenticated Staff | List units with conversion ratios and base unit details |
| `GET` | `/api/v1/units/:id` | Authenticated Staff | Get unit details by ID |

#### Query Parameters (`GET /api/v1/units`):
- `unitType` (`WEIGHT` \| `VOLUME` \| `COUNT`): Filter by physical unit classification
- `search` (string): Search unit name or abbreviation

#### Unit Response Example:
```json
{
  "id": 2,
  "name": "Gram",
  "abbreviation": "g",
  "unit_type": "WEIGHT",
  "base_unit_id": 1,
  "base_unit": {
    "id": 1,
    "name": "Kilogram",
    "abbreviation": "kg"
  },
  "conversion_factor": 0.001,
  "created_at": "2026-11-01T20:00:00.000Z"
}
```

---

### 3. Raw Ingredients Catalog (`/api/v1/ingredients`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/ingredients` | Authenticated Staff | List ingredients with pagination, search, and unit details |
| `GET` | `/api/v1/ingredients/:id` | Authenticated Staff | Get ingredient by ID with unit and dish category details |
| `POST` | `/api/v1/ingredients` | `ADMIN`, `INVENTORY_MANAGER` | Create ingredient with unit and category validation |
| `PATCH` | `/api/v1/ingredients/:id` | `ADMIN`, `INVENTORY_MANAGER` | Update ingredient attributes and threshold levels |

#### Query Parameters (`GET /api/v1/ingredients`):
- `page` (number, default: 1): Page number
- `limit` (number, default: 20, max: 100): Page limit
- `search` (string): Search ingredient name
- `unit_id` (number): Filter by measurement unit
- `category_id` (number): Filter ingredients used in dishes of a specific category
- `isActive` (`true` \| `false` \| `all`): Active status filter

#### Create Ingredient Example (`POST /api/v1/ingredients`):
```json
// Request Body
{
  "name": "Organic Wild Honey",
  "unit_id": 1,
  "category_id": 5,
  "minimum_stock_level": 2.5,
  "optimal_par_level": 10.0,
  "cost_per_unit": 450.0,
  "is_active": true
}

// 201 Created Response
{
  "success": true,
  "statusCode": 201,
  "message": "Ingredient created successfully",
  "data": {
    "id": 29,
    "name": "Organic Wild Honey",
    "unit_id": 1,
    "unit": {
      "id": 1,
      "name": "Kilogram",
      "abbreviation": "kg",
      "unit_type": "WEIGHT",
      "conversion_factor": 1.0,
      "base_unit_id": null
    },
    "minimum_stock_level": 2.5,
    "optimal_par_level": 10.0,
    "cost_per_unit": 450.0,
    "is_active": true,
    "categories": [
      { "id": 5, "name": "Desserts" }
    ],
    "created_at": "2026-11-02T03:00:00.000Z",
    "updated_at": "2026-11-02T03:00:00.000Z"
  }
}
```

#### Error Handling Codes:
- `DUPLICATE_CATEGORY_NAME` (409): Category with specified name already exists.
- `DUPLICATE_INGREDIENT_NAME` (409): Ingredient with specified name already exists.
- `INVALID_UNIT_ID` (400): Specified unit of measure does not exist.
- `INVALID_CATEGORY_ID` (400): Specified category does not exist.
- `INVALID_PAR_LEVEL` (400): Optimal par level must be $\ge$ minimum stock level.
- `CATEGORY_NOT_FOUND` (404): Category with ID does not exist.
- `INGREDIENT_NOT_FOUND` (404): Ingredient with ID does not exist.
- `FORBIDDEN_ROLE` (403): Staff role lacks modification privileges.

---

## 11. Menu Item Management APIs (Phase 2 — Task 4B.1)

Sellable culinary dishes linked to menu categories with recipe bill-of-materials resolution.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/menu-items` | Authenticated Staff | List menu items with search, category filter, availability status, and pagination |
| `GET` | `/api/v1/menu-items/:id` | Authenticated Staff | Get menu item by ID with resolved category and recipe yield/instructions |
| `POST` | `/api/v1/menu-items` | `ADMIN`, `INVENTORY_MANAGER` | Create new menu item with category reference validation and duplicate protection |
| `PATCH` | `/api/v1/menu-items/:id` | `ADMIN`, `INVENTORY_MANAGER` | Update menu item details, category reassignment, price, or availability |

#### Query Parameters (`GET /api/v1/menu-items`):
- `page` (number, default: 1): Page number
- `limit` (number, default: 20, max: 100): Page limit
- `search` (string): Keyword search against menu item name or description
- `category_id` (number): Filter by parent menu category
- `isAvailable` (`true` \| `false` \| `all`): Availability status filter

#### Create Menu Item Example (`POST /api/v1/menu-items`):
```json
// Request Body
{
  "category_id": 2,
  "name": "Truffle Mushroom Swiss Burger",
  "description": "Char-grilled patty with wild mushrooms, Swiss cheese, and truffle aioli",
  "selling_price": 240.0,
  "preparation_time_mins": 15,
  "is_available": true
}

// 201 Created Response
{
  "success": true,
  "statusCode": 201,
  "message": "Menu item created successfully",
  "data": {
    "id": 16,
    "category_id": 2,
    "category": {
      "id": 2,
      "name": "Burgers",
      "description": "Signature gourmet handcrafted burgers with house fries"
    },
    "name": "Truffle Mushroom Swiss Burger",
    "description": "Char-grilled patty with wild mushrooms, Swiss cheese, and truffle aioli",
    "selling_price": 240,
    "preparation_time_mins": 15,
    "is_available": true,
    "has_recipe": false,
    "recipe": null,
    "created_at": "2026-11-02T03:14:00.000Z",
    "updated_at": "2026-11-02T03:14:00.000Z"
  },
  "meta": null
}
```

#### Fetch Menu Item by ID Example (`GET /api/v1/menu-items/1`):
```json
// 200 OK Response
{
  "success": true,
  "statusCode": 200,
  "message": "Menu item details retrieved successfully",
  "data": {
    "id": 1,
    "category_id": 1,
    "category": {
      "id": 1,
      "name": "Appetizers",
      "description": "Starters, fried delicacies, and finger foods"
    },
    "name": "Crispy French Fries",
    "description": "Deep fried golden potato batons seasoned with rock salt and herbs",
    "selling_price": 110,
    "preparation_time_mins": 10,
    "is_available": true,
    "has_recipe": true,
    "recipe": {
      "id": 1,
      "yield_servings": 1,
      "instructions": "Cut 250g potatoes into batons, blanch in salted water, and flash fry at 180C until crisp.",
      "created_at": "2026-11-01T20:00:00.000Z"
    },
    "created_at": "2026-11-01T20:00:00.000Z",
    "updated_at": "2026-11-01T20:00:00.000Z"
  }
}
```

#### Error Handling Codes:
- `DUPLICATE_MENU_ITEM_NAME` (409): A menu item with this name already exists.
- `INVALID_CATEGORY_ID` (400): Specified `category_id` does not exist in `categories`.
- `INVALID_PRICE` (400): Selling price cannot be negative.
- `INVALID_PREP_TIME` (400): Preparation time in minutes cannot be negative.
- `MENU_ITEM_NOT_FOUND` (404): Menu item with specified ID does not exist.
- `FORBIDDEN_ROLE` (403): Staff role lacks menu item creation or update privileges.


