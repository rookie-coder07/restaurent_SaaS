# Error Handling Testing Guide

## Overview
This guide covers comprehensive testing of the improved error handling system for the Restaurant SaaS application.

## Test Environment Setup

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Unit Tests

### 1. Backend Error Messages (errorMessages.js)

#### Test: Error Code Mapping
```javascript
import { ERROR_CODES, ERROR_MESSAGES, getErrorMessage } from '../utils/errorMessages';

test('Error message exists for all error codes', () => {
  Object.values(ERROR_CODES).forEach(code => {
    expect(ERROR_MESSAGES[code]).toBeDefined();
    expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
  });
});

test('getErrorMessage returns correct message', () => {
  expect(getErrorMessage(ERROR_CODES.INVALID_LOGIN))
    .toBe('Incorrect email or password');
});

test('getErrorMessage returns default for unknown code', () => {
  expect(getErrorMessage('unknown_code'))
    .toBe('Something went wrong. Please try again.');
});
```

#### Test: Database Error Mapping
```javascript
import { mapDatabaseError } from '../utils/errorMessages';

test('Maps unique violation to ALREADY_EXISTS', () => {
  const error = { code: '23505', message: 'unique violation' };
  const result = mapDatabaseError(error);
  expect(result.code).toBe(ERROR_CODES.ALREADY_EXISTS);
  expect(result.status).toBe(409);
});

test('Maps foreign key violation to NOT_FOUND', () => {
  const error = { code: '23503', message: 'foreign key violation' };
  const result = mapDatabaseError(error);
  expect(result.code).toBe(ERROR_CODES.NOT_FOUND);
  expect(result.status).toBe(404);
});

test('Maps null violation to MISSING_FIELD', () => {
  const error = { code: '23502', message: 'not null violation' };
  const result = mapDatabaseError(error);
  expect(result.code).toBe(ERROR_CODES.MISSING_FIELD);
  expect(result.status).toBe(400);
});
```

### 2. Frontend Error Classifier (errorClassifier.js)

#### Test: Error Classification
```javascript
import { classifyError, ERROR_TYPES } from '../utils/errorClassifier';

test('Classifies timeout error correctly', () => {
  const error = {
    code: 'ECONNABORTED',
    request: true,
    response: null,
    message: 'timeout'
  };
  expect(classifyError(error)).toBe(ERROR_TYPES.TIMEOUT);
});

test('Classifies network error correctly', () => {
  const error = {
    request: true,
    response: null,
    code: 'ECONNREFUSED'
  };
  expect(classifyError(error)).toBe(ERROR_TYPES.NETWORK);
});

test('Classifies validation error by status code', () => {
  const error = {
    response: { status: 400 }
  };
  expect(classifyError(error)).toBe(ERROR_TYPES.VALIDATION);
});

test('Classifies authentication error by status code', () => {
  const error = {
    response: { status: 401 }
  };
  expect(classifyError(error)).toBe(ERROR_TYPES.AUTHENTICATION);
});

test('Classifies rate limit error by status code', () => {
  const error = {
    response: { status: 429 }
  };
  expect(classifyError(error)).toBe(ERROR_TYPES.RATE_LIMIT);
});
```

#### Test: User-Friendly Messages
```javascript
import { getUserFriendlyMessage } from '../utils/errorClassifier';

test('Returns server message if available', () => {
  const error = {
    response: {
      data: { message: 'Custom error from server' }
    }
  };
  expect(getUserFriendlyMessage(error))
    .toBe('Custom error from server');
});

test('Returns appropriate message for timeout', () => {
  const error = {
    code: 'ECONNABORTED',
    request: true,
    response: null
  };
  expect(getUserFriendlyMessage(error))
    .toBe('The request took too long. Please try again.');
});

test('Returns appropriate message for network error', () => {
  const error = {
    request: true,
    response: null
  };
  expect(getUserFriendlyMessage(error))
    .toContain('internet connection');
});
```

## Integration Tests

### 1. Login Error Scenarios

#### Test: Invalid Credentials
```bash
# Using API testing tool (e.g., Postman, curl)
POST /api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "wrongpassword"
}

# Expected Response:
# Status: 401
# Body: {
#   "success": false,
#   "message": "Incorrect email or password",
#   "code": "invalid_login"
# }
```

#### Test: Account Not Found
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "nonexistent@example.com",
  "password": "password123"
}

# Expected Response:
# Status: 404
# Body: {
#   "success": false,
#   "message": "No account found with this email",
#   "code": "account_not_found"
# }
```

### 2. Validation Error Scenarios

#### Test: Missing Required Fields
```bash
POST /api/items/create
Content-Type: application/json

{
  "name": "Item Name"
  # Missing required "price" field
}

# Expected Response:
# Status: 400
# Body: {
#   "success": false,
#   "message": "Please fill in all required fields",
#   "code": "missing_field"
# }
```

#### Test: Invalid Data Format
```bash
POST /api/items/create
Content-Type: application/json

{
  "name": "Item Name",
  "price": "not-a-number"
}

# Expected Response:
# Status: 400
# Body: {
#   "success": false,
#   "message": "Please check your input and try again.",
#   "code": "validation_error"
# }
```

### 3. Permission Error Scenarios

#### Test: Insufficient Permissions
```bash
GET /api/admin/reports
Authorization: Bearer {user-token}  # Regular user token

# Expected Response:
# Status: 403
# Body: {
#   "success": false,
#   "message": "You do not have permission to perform this action",
#   "code": "insufficient_permissions"
# }
```

### 4. Rate Limiting

#### Test: Rate Limit Exceeded
```bash
# Make 100+ requests rapidly to same endpoint
for i in {1..150}; do
  curl -X GET http://localhost:5000/api/users -H "Authorization: Bearer $TOKEN"
done

# Expected Response (after rate limit):
# Status: 429
# Body: {
#   "success": false,
#   "message": "Too many requests. Please wait a moment before trying again",
#   "code": "rate_limit"
# }
```

## Frontend Component Tests

### 1. Error Display Component

```javascript
import { render, screen } from '@testing-library/react';
import ErrorDisplay from '../components/ErrorDisplay';
import { ERROR_TYPES } from '../utils/errorClassifier';

test('Displays network error message', () => {
  const error = {
    type: ERROR_TYPES.NETWORK,
    message: 'Check your internet connection'
  };
  render(<ErrorDisplay error={error} />);
  expect(screen.getByText(/internet connection/i)).toBeInTheDocument();
});

test('Displays retry button for retryable errors', () => {
  const error = {
    type: ERROR_TYPES.NETWORK,
    isNetworkError: true
  };
  const onRetry = jest.fn();
  render(<ErrorDisplay error={error} onRetry={onRetry} />);
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

### 2. useError Hook Tests

```javascript
import { renderHook, act } from '@testing-library/react';
import { useError } from '../hooks/useError';

test('useError initializes with no error', () => {
  const { result } = renderHook(() => useError());
  expect(result.current.error).toBeNull();
});

test('useError handles error correctly', () => {
  const { result } = renderHook(() => useError());
  
  const mockError = {
    response: { status: 401 },
    request: true
  };
  
  act(() => {
    result.current.handleError(mockError);
  });
  
  expect(result.current.error).toBeDefined();
  expect(result.current.error.type).toBe(ERROR_TYPES.AUTHENTICATION);
});

test('useError can clear errors', () => {
  const { result } = renderHook(() => useError());
  
  act(() => {
    result.current.handleError(mockError);
    result.current.clearError();
  });
  
  expect(result.current.error).toBeNull();
});
```

## Manual Testing Checklist

### Authentication
- [ ] Login with invalid credentials shows "Incorrect email or password"
- [ ] Login with non-existent email shows "No account found with this email"
- [ ] Expired session shows "Your session has expired. Please log in again"
- [ ] Session timeout correctly redirects to login

### Validation
- [ ] Submitting form with missing required fields shows specific field errors
- [ ] Invalid email format shows "Please enter a valid email address"
- [ ] Invalid phone format shows "Please enter a valid phone number"
- [ ] Invalid price shows "Please enter a valid price"

### Permissions
- [ ] Regular user accessing admin page shows "Only administrators can perform this action"
- [ ] User accessing other user's data shows permission denied message

### Network
- [ ] Disconnecting internet and making request shows network error message
- [ ] Request timeout shows "The request took too long. Please try again"
- [ ] Network reconnection allows automatic retry

### Rate Limiting
- [ ] Rapid requests show "Too many requests. Please wait..."
- [ ] Rate limit error includes retry mechanism
- [ ] Waiting period restores access

### File Upload
- [ ] Upload file > 5MB shows "File is too large. Maximum size is 5MB"
- [ ] Upload unsupported file type shows "File type is not supported"
- [ ] Missing file shows "Please select a file to upload"

## Performance Testing

### Load Test with Error Scenarios
```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  // Test with invalid credentials
  http.post('http://localhost:5000/api/auth/login', {
    email: 'test@example.com',
    password: 'wrong'
  });

  // Test with missing fields
  http.post('http://localhost:5000/api/items', {
    name: 'Item'
    // Missing price
  });

  sleep(1);
}
```

## Deployment Verification

### Stage 1: Development
- [ ] All unit tests pass
- [ ] Manual testing complete
- [ ] No console errors

### Stage 2: Staging
- [ ] Deploy to staging environment
- [ ] Run integration tests against staging
- [ ] Verify error messages are user-friendly
- [ ] Verify no technical details exposed

### Stage 3: Production
- [ ] Monitor error logs in production
- [ ] Verify user feedback on error clarity
- [ ] Check for any unexpected error patterns
- [ ] Validate performance impact

## Error Monitoring

### Key Metrics to Monitor
1. **Error Rate**: Total errors per hour
2. **Error Types**: Distribution of error types
3. **Response Times**: API latency with error handling
4. **User Retries**: How many users retry after error
5. **Session Recovery**: Users who recover after network error

### Logging Setup
```javascript
// Example: Log error details for monitoring
import { formatError } from '../utils/errorClassifier';

const handleRequestError = (error) => {
  const formattedError = formatError(error);
  
  // Log to monitoring service
  console.log({
    timestamp: new Date().toISOString(),
    type: formattedError.type,
    statusCode: formattedError.statusCode,
    message: formattedError.message,
    isNetworkError: formattedError.isNetworkError,
  });
};
```

## Success Criteria

✅ All error scenarios have user-friendly messages
✅ Network errors distinguished from server errors
✅ No technical stack traces exposed to users
✅ All error types properly classified
✅ Error retry logic works correctly
✅ Session recovery works after authentication error
✅ Performance impact less than 50ms per request
✅ Error rate monitoring active and alerting configured

## Rollback Plan

If issues occur:
1. Revert error handling changes: `git revert <commit-hash>`
2. Deploy previous version to production
3. Investigate root cause
4. Create bug fix and re-test
5. Deploy fix to production
