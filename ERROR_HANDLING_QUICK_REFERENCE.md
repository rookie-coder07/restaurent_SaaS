# Error Handling Quick Reference

## Backend

### Import Error Utilities
```javascript
import { 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  createErrorResponse, 
  mapDatabaseError,
  getErrorMessage 
} from '../utils/errorMessages.js';
```

### Error Response Patterns

**Missing Required Field**
```javascript
if (!req.body.email) {
  return res.status(400).json(
    createErrorResponse(400, ERROR_CODES.MISSING_FIELD)
  );
}
```

**Invalid Input Format**
```javascript
if (!isValidEmail(req.body.email)) {
  return res.status(400).json(
    createErrorResponse(400, ERROR_CODES.INVALID_EMAIL)
  );
}
```

**Database Error**
```javascript
try {
  const user = await User.create(userData);
} catch (error) {
  const { code, status } = mapDatabaseError(error);
  return res.status(status).json(createErrorResponse(status, code));
}
```

**Permission Denied**
```javascript
if (!req.user.is_admin) {
  return res.status(403).json(
    createErrorResponse(403, ERROR_CODES.ADMIN_ONLY)
  );
}
```

**Resource Not Found**
```javascript
const item = await Item.findById(req.params.id);
if (!item) {
  return res.status(404).json(
    createErrorResponse(404, ERROR_CODES.NOT_FOUND)
  );
}
```

**Authentication Failed**
```javascript
// Invalid credentials
res.status(401).json(
  createErrorResponse(401, ERROR_CODES.INVALID_LOGIN)
);

// Account doesn't exist
res.status(404).json(
  createErrorResponse(404, ERROR_CODES.ACCOUNT_NOT_FOUND)
);

// Session expired
res.status(401).json(
  createErrorResponse(401, ERROR_CODES.SESSION_EXPIRED)
);
```

**Duplicate Entry**
```javascript
// Automatic via mapDatabaseError()
// PostgreSQL 23505 → ALREADY_EXISTS → 409
// Or explicit:
res.status(409).json(
  createErrorResponse(409, ERROR_CODES.ALREADY_EXISTS)
);
```

**Rate Limiting**
```javascript
res.status(429).json(
  createErrorResponse(429, ERROR_CODES.RATE_LIMIT)
);
```

**Server Error**
```javascript
res.status(500).json(
  createErrorResponse(500, ERROR_CODES.SERVER_ERROR)
);
```

## Frontend

### Import Error Utilities
```javascript
// For components
import { useError, useFormError } from '../hooks/useError';

// For utilities
import { 
  classifyError, 
  getUserFriendlyMessage,
  formatError,
  shouldRetryRequest 
} from '../utils/errorClassifier';
```

### Component Patterns

**Login Form**
```javascript
function LoginForm() {
  const { error, handleError, clearError } = useError();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (email, password) => {
    clearError();
    setIsLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/dashboard');
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="error-alert">
          <p>{error.message}</p>
          {error.isNetworkError && (
            <button onClick={() => handleSubmit(email, password)}>
              Retry
            </button>
          )}
        </div>
      )}
      <form onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(email, password);
      }}>
        {/* form fields */}
      </form>
    </>
  );
}
```

**Form with Validation**
```javascript
function RegisterForm() {
  const { errors, setFieldError, clearFieldError } = useFormError();
  const { error, handleError } = useError();
  const [formData, setFormData] = useState({});

  const handleEmailChange = (e) => {
    const email = e.target.value;
    setFormData(prev => ({ ...prev, email }));
    
    if (!email.includes('@')) {
      setFieldError('email', 'Please enter a valid email');
    } else {
      clearFieldError('email');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (Object.keys(errors).length > 0) {
      return; // Don't submit if validation errors
    }

    try {
      await api.post('/auth/register', formData);
      navigate('/login');
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert type="error" message={error.message} />}
      
      <input onChange={handleEmailChange} />
      {errors.email && <span className="error">{errors.email}</span>}
      
      <button type="submit">Register</button>
    </form>
  );
}
```

**Async Data Loading**
```javascript
function UsersList() {
  const { data, loading, error, execute, retry } = useAsyncError(
    () => api.get('/users')
  );

  useEffect(() => {
    execute();
  }, [execute]);

  if (loading) return <div>Loading users...</div>;
  
  if (error) {
    return (
      <div className="error-container">
        <p>{error.message}</p>
        <button onClick={retry}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      {data.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

**API Call with Manual Error Handling**
```javascript
async function deleteItem(itemId) {
  try {
    await api.delete(`/items/${itemId}`);
    showSuccess('Item deleted');
    refetchItems();
  } catch (error) {
    const formatted = formatError(error);
    
    if (formatted.isNetworkError) {
      showError('Check your internet connection');
    } else if (formatted.type === 'rate_limit') {
      showError(`Too many requests. Retry in ${getWaitTime()}s`);
    } else {
      showError(formatted.message);
    }
  }
}
```

**Error Boundary Wrapper**
```javascript
// Wrap any component that might throw
export default withErrorBoundary(ItemsList, {
  FallbackComponent: ({ error, resetError }) => (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h3>Failed to load items</h3>
      <p>{error?.message}</p>
      <button onClick={resetError}>Try again</button>
    </div>
  ),
  onError: (error) => {
    console.error('ItemsList error:', error);
    // Log to error tracking service
  }
});
```

### Quick Error Type Checks

```javascript
const { error } = useError();

// Network error?
if (error?.isNetworkError) {
  // Show "Check your connection" with Retry button
}

// Server error?
if (error?.isServerError) {
  // Show "Server error, try again later"
}

// Timeout?
if (error?.type === 'timeout') {
  // Show "Request took too long"
}

// Rate limited?
if (error?.type === 'rate_limit') {
  // Show "Too many requests, wait before retrying"
}

// Not found?
if (error?.statusCode === 404) {
  // Show "Item not found"
}
```

## Common Error Codes

```javascript
// Authentication
ERROR_CODES.INVALID_LOGIN           // "Incorrect email or password"
ERROR_CODES.ACCOUNT_NOT_FOUND       // "No account found with this email"
ERROR_CODES.SESSION_EXPIRED         // "Session has expired"

// Validation
ERROR_CODES.MISSING_FIELD           // "Please fill in all required fields"
ERROR_CODES.INVALID_EMAIL           // "Invalid email address"
ERROR_CODES.INVALID_PRICE           // "Enter a valid price"

// Permissions
ERROR_CODES.INSUFFICIENT_PERMISSIONS // "You don't have permission"
ERROR_CODES.ADMIN_ONLY              // "Only admins can do this"

// Resources
ERROR_CODES.NOT_FOUND               // "Item doesn't exist"
ERROR_CODES.ALREADY_EXISTS          // "Item already exists"
ERROR_CODES.CANNOT_DELETE           // "Item is in use"

// Network
ERROR_CODES.NETWORK_ERROR           // "Check internet"
ERROR_CODES.TIMEOUT                 // "Request too slow"
ERROR_CODES.RATE_LIMIT              // "Too many requests"
```

## Error Response Examples

### Backend Returns
```json
{
  "success": false,
  "statusCode": 401,
  "code": "invalid_login",
  "message": "Incorrect email or password"
}
```

### Frontend Receives (via useError)
```javascript
{
  type: "authentication",
  message: "Incorrect email or password",
  statusCode: 401,
  code: "invalid_login",
  isNetworkError: false,
  isServerError: false,
  isClientError: true
}
```

## Pro Tips

**Tip 1: Check error before showing**
```javascript
if (error && !error.message.startsWith('Server')) {
  showError(error.message);
}
```

**Tip 2: Provide context in error**
```javascript
handleError(err, 'Failed to delete item');
// Shows: "Failed to delete item: Correct error message"
```

**Tip 3: Retry with exponential backoff**
```javascript
// Automatically handled by useError hook
const { retry } = useError();

// Or manual retry with delay
setTimeout(() => {
  refetch();
}, Math.pow(2, attemptCount) * 1000);
```

**Tip 4: Log errors for monitoring**
```javascript
const handleError = (err) => {
  console.error({
    type: formatError(err).type,
    message: err.message,
    timestamp: new Date(),
    url: window.location.href
  });
};
```

**Tip 5: Distinguish errors for UI**
```javascript
if (error?.type === 'validation') {
  // Show form validation messages
} else if (error?.type === 'network') {
  // Show need internet connection
} else if (error?.type === 'authentication') {
  // Redirect to login
}
```

## File Locations

- Backend: `backend/src/utils/errorMessages.js`
- Frontend: `frontend/src/utils/errorClassifier.js`
- Hooks: `frontend/src/hooks/useError.js`
- Tests: `ERROR_HANDLING_TESTING_GUIDE.md`
- Docs: `ERROR_HANDLING_IMPLEMENTATION_GUIDE.md`
- Summary: `ERROR_HANDLING_SUMMARY.md`

## Cheat Sheet

```
Backend:          createErrorResponse(status, errorCode)
Frontend Hook:    useError()
Form Validation:  useFormError()
Error Check:      formatError(error)
Classify Error:   classifyError(error)
Get Message:      getUserFriendlyMessage(error)
```
