# ENDPOINT MIGRATION TO SECURITY

## How to Update Existing Endpoints

### Step 1: Add Authentication

**Before:**
```javascript
router.get('/orders', ordersController);
```

**After:**
```javascript
import { authMiddleware } from '../middleware/auth.js';

router.get('/orders', authMiddleware, ordersController);
```

### Step 2: Add Authorization

**Before:**
```javascript
router.delete('/users/:id', authMiddleware, deleteUserController);
```

**After:**
```javascript
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/authorization.js';

router.delete('/users/:id', authMiddleware, requireAdmin, deleteUserController);
```

### Step 3: Add Input Validation

**Before:**
```javascript
router.post('/orders', authMiddleware, async (req, res) => {
  const { tableId, items, amount } = req.body;
  // Direct usage - vulnerable to invalid data
});
```

**After:**
```javascript
import { validateInput } from '../middleware/validation.js';

const schema = {
  tableId: { required: true, type: 'string', maxLength: 50 },
  items: { required: true, type: 'array', minLength: 1 },
  amount: { required: true, type: 'number', min: 0.01, max: 999999.99 }
};

router.post(
  '/orders',
  authMiddleware,
  validateInput(schema),
  ordersController
);
```

### Step 4: Ensure Data Isolation

**Before:**
```javascript
const { data: orders } = await supabase
  .from('orders')
  .select('*');
```

**After:**
```javascript
const { data: orders } = await supabase
  .from('orders')
  .select('*')
  .eq('restaurant_id', req.restaurantId); // CRITICAL: Always include this
```

### Step 5: Add Security Logging

**Before:**
```javascript
export const loginController = async (req, res) => {
  const user = await getUserByEmail(req.body.email);
  // No logging of failed attempts
};
```

**After:**
```javascript
import SecurityAuditLogger from '../utils/securityAudit.js';

export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    if (!user || !await verifyPassword(password, user.password_hash)) {
      SecurityAuditLogger.logLoginAttempt(email, false, req.ip, 'Invalid credentials');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    SecurityAuditLogger.logLoginAttempt(email, true, req.ip);
    res.json({ token: generateToken(user) });
  } catch (error) {
    SecurityAuditLogger.logLoginAttempt(req.body.email, false, req.ip, error.message);
    throw error;
  }
};
```

## Complete Migration Examples

### Example 1: User Registration

**Before (Vulnerable):**
```javascript
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // No validation
    const hash = require('bcryptjs').hashSync(password, 10);
    
    const { data: user } = await supabase
      .from('users')
      .insert({ email, password_hash: hash, name })
      .select()
      .single();

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message }); // Leaks details
  }
});
```

**After (Secure):**
```javascript
import { validateInput } from '../middleware/validation.js';
import {
  hashPassword,
  validatePasswordStrength
} from '../utils/passwordSecurity.js';
import SecurityAuditLogger from '../utils/securityAudit.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const registerSchema = {
  email: {
    required: true,
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: { required: true, type: 'string', minLength: 8 },
  name: { required: true, type: 'string', minLength: 2, maxLength: 100 }
};

router.post(
  '/register',
  validateInput(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    // Validate password strength
    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Check email exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      SecurityAuditLogger.logSuspiciousActivity(
        'unknown',
        'duplicate_registration',
        { email },
        req.ip
      );
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        name,
        restaurant_id: req.body.restaurantId || null
      })
      .select('id, email, name')
      .single();

    if (error) throw error;

    SecurityAuditLogger.logSecurityEvent(
      'user_registration',
      { userId: user.id, email },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  })
);
```

### Example 2: Order Creation

**Before (Vulnerable):**
```javascript
router.post('/orders', async (req, res) => {
  try {
    const { tableId, items, amount } = req.body;
    
    // No validation, no auth, no restaurant isolation
    const { data: order } = await supabase
      .from('orders')
      .insert({
        table_id: tableId,
        items: JSON.stringify(items),
        amount
      })
      .select()
      .single();

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.stack }); // Dumps stack trace
  }
});
```

**After (Secure):**
```javascript
import { authMiddleware } from '../middleware/auth.js';
import { authorize } from '../middleware/authorization.js';
import { validateInput } from '../middleware/validation.js';
import SecurityAuditLogger from '../utils/securityAudit.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const createOrderSchema = {
  tableId: {
    required: true,
    type: 'string',
    maxLength: 50,
    pattern: /^[a-zA-Z0-9-_]+$/
  },
  items: {
    required: true,
    type: 'array',
    minLength: 1
  },
  amount: {
    required: true,
    type: 'number',
    min: 0.01,
    max: 999999.99
  }
};

router.post(
  '/orders',
  authMiddleware,
  authorize(['waiter', 'manager', 'admin']),
  validateInput(createOrderSchema),
  asyncHandler(async (req, res) => {
    const { tableId, items, amount } = req.body;
    const userId = req.user.id;
    const restaurantId = req.restaurantId;

    // Verify table exists and belongs to restaurant
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('id', tableId)
      .single();

    if (!table) {
      SecurityAuditLogger.logUnauthorizedAccess(
        userId,
        '/orders',
        'POST',
        req.ip
      );
      return res.status(400).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Create order with restaurant isolation
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurantId, // CRITICAL: Always include
        table_id: tableId,
        user_id: userId,
        items,
        amount,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Log the data access
    SecurityAuditLogger.logDataAccess(
      userId,
      'orders',
      'create',
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  })
);
```

### Example 3: Delete Order (Admin Only)

**Before (Vulnerable):**
```javascript
router.delete('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // No auth check, anyone can delete
    await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**After (Secure):**
```javascript
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/authorization.js';
import SecurityAuditLogger from '../utils/securityAudit.js';
import { asyncHandler } from '../middleware/errorHandler.js';

router.delete(
  '/orders/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const restaurantId = req.restaurantId;

    // Verify order exists and belongs to restaurant
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('id', id)
      .single();

    if (!order) {
      SecurityAuditLogger.logUnauthorizedAccess(
        userId,
        `/orders/${id}`,
        'DELETE',
        req.ip
      );
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Delete order
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) throw error;

    // Log the critical operation
    SecurityAuditLogger.logCriticalOperation(
      userId,
      'order_deletion',
      { orderId: id, amount: order.amount },
      req.ip
    );

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  })
);
```

## Automated Route Migration

Create a script to find all routes and check compliance:

```javascript
// routes/auditRoutes.js
import fs from 'fs';
import path from 'path';
import { grep_search } from 'your-code-tools';

export async function auditRoutes() {
  const routeFiles = fs.readdirSync('./routes').filter(f => f.endsWith('.js'));
  
  for (const file of routeFiles) {
    const content = fs.readFileSync(path.join('./routes', file), 'utf8');
    
    const hasAuth = content.includes('authMiddleware');
    const hasValidation = content.includes('validateInput');
    const hasErrorHandler = content.includes('asyncHandler');
    const hasLogging = content.includes('SecurityAuditLogger');
    
    console.log(`\n=== ${file} ===`);
    console.log(`✅ Auth: ${hasAuth ? '✓' : '✗'}`);
    console.log(`✅ Validation: ${hasValidation ? '✓' : '✗'}`);
    console.log(`✅ Error Handler: ${hasErrorHandler ? '✓' : '✗'}`);
    console.log(`✅ Logging: ${hasLogging ? '✓' : '✗'}`);
  }
}
```

## Priority Migration Order

1. **CRITICAL (Week 1):**
   - `/auth/login` - Add password validation
   - `/auth/register` - Add password security
   - All DELETE endpoints - Add requireAdmin/requireManager
   - All POST/PUT endpoints - Add validation

2. **HIGH (Week 2):**
   - All GET endpoints - Verify data isolation
   - All endpoints with amounts - Add range validation
   - All protected endpoints - Add authorization

3. **MEDIUM (Week 3):**
   - Add security logging to all critical operations
   - Add data access logging to read operations
   - Verify error messages are safe

4. **LOW (Week 4):**
   - Add suspicious activity detection
   - Add rate limit monitoring
   - Performance optimization

## Completion Checklist

- [ ] All 50+ endpoints updated
- [ ] All auth endpoints secured
- [ ] All admin endpoints protected
- [ ] All data endpoints isolated
- [ ] All inputs validated
- [ ] All errors safe
- [ ] All critical ops logged
- [ ] All passwords hashed
- [ ] Staging tested
- [ ] Production deployed

## Testing After Migration

```bash
# Test each route for:
# 1. Authentication required
# 2. Authorization enforced
# 3. Input validation works
# 4. Error messages safe
# 5. Data isolation applied

npm run test:security
npm run test:auth
npm run test:validation
npm run test:isolation
npm run e2e:security
```
