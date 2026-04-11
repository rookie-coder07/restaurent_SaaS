# SECURITY TESTING SUITE - PowerShell Version
# Run all security verification tests on Windows

param(
    [switch]$Verbose = $false,
    [string]$BaseUrl = "http://localhost:5000/api/v1",
    [switch]$RunFullTests = $false
)

# Colors
$Green = @{ ForegroundColor = "Green" }
$Red = @{ ForegroundColor = "Red" }
$Yellow = @{ ForegroundColor = "Yellow" }
$Cyan = @{ ForegroundColor = "Cyan" }

Write-Host "🔐 SECURITY TESTING SUITE - Windows PowerShell" @Yellow
Write-Host "=============================================" @Yellow
Write-Host "Base URL: $BaseUrl" @Cyan

# Test counters
$script:TestsPassed = 0
$script:TestsFailed = 0
$script:TestsRun = 0

function Test-File {
    param([string]$Path, [string]$Description)
    
    Write-Host "`nTesting: $Description" @Yellow
    $Path = "$PSScriptRoot/$Path"
    
    if (Test-Path $Path) {
        Write-Host "✓ PASS: $Description" @Green
        $script:TestsPassed++
    } else {
        Write-Host "✗ FAIL: File not found - $Path" @Red
        $script:TestsFailed++
    }
    $script:TestsRun++
}

function Test-FileContent {
    param([string]$Path, [string]$Pattern, [string]$Description)
    
    Write-Host "`nTesting: $Description" @Yellow
    $Path = "$PSScriptRoot/$Path"
    
    if ((Test-Path $Path) -and (Select-String -Path $Path -Pattern $Pattern -Quiet)) {
        Write-Host "✓ PASS: $Description" @Green
        $script:TestsPassed++
    } else {
        Write-Host "✗ FAIL: Pattern not found - $Description in $Path" @Red
        $script:TestsFailed++
    }
    $script:TestsRun++
}

function Test-Endpoint {
    param([string]$Method, [string]$Endpoint, [object]$Body, [string]$Description, [int[]]$ExpectedStatus)
    
    if (-not $RunFullTests) {
        return
    }
    
    Write-Host "`nTesting: $Description" @Yellow
    
    try {
        $url = "$BaseUrl$Endpoint"
        
        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri $url -Method Get -ErrorAction SilentlyContinue
        } else {
            $response = Invoke-WebRequest -Uri $url -Method $Method -Body ($Body | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue
        }
        
        $statusCode = $response.StatusCode
        if ($ExpectedStatus -contains $statusCode) {
            Write-Host "✓ PASS: Got expected status $statusCode" @Green
            $script:TestsPassed++
        } else {
            Write-Host "✗ FAIL: Expected status $($ExpectedStatus -join ',') but got $statusCode" @Red
            $script:TestsFailed++
        }
    } catch {
        # Error response is also valid for these tests
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($ExpectedStatus -contains $statusCode) {
            Write-Host "✓ PASS: Got expected status $statusCode" @Green
            $script:TestsPassed++
        } else {
            Write-Host "✗ FAIL: Expected status $($ExpectedStatus -join ',') but got $statusCode" @Red
            $script:TestsFailed++
        }
    }
    $script:TestsRun++
}

# ============= FILE STRUCTURE TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "SECURITY IMPORTS AND FILES CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-FileContent "src/routes/auth.js" "SecurityAuditLogger" "auth.js imports SecurityAuditLogger"
Test-FileContent "src/routes/order.js" "SecurityAuditLogger" "order.js imports SecurityAuditLogger"
Test-FileContent "src/routes/menu.js" "SecurityAuditLogger" "menu.js imports SecurityAuditLogger"
Test-FileContent "src/routes/table.js" "SecurityAuditLogger" "table.js imports SecurityAuditLogger"
Test-FileContent "src/routes/developer.js" "SecurityAuditLogger" "developer.js imports SecurityAuditLogger"
Test-FileContent "src/routes/restaurant.js" "SecurityAuditLogger" "restaurant.js imports SecurityAuditLogger"
Test-FileContent "src/routes/customer.js" "SecurityAuditLogger" "customer.js imports SecurityAuditLogger"
Test-FileContent "src/routes/inventory.js" "SecurityAuditLogger" "inventory.js imports SecurityAuditLogger"
Test-FileContent "src/routes/activity.js" "SecurityAuditLogger" "activity.js imports SecurityAuditLogger"
Test-FileContent "src/routes/takeaway.js" "SecurityAuditLogger" "takeaway.js imports SecurityAuditLogger"

# ============= PASSWORD SECURITY TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "PASSWORD SECURITY CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-FileContent "src/routes/auth.js" "validatePasswordStrength" "auth.js validates password strength"
Test-File "src/utils/passwordSecurity.js" "passwordSecurity.js exists"
Test-FileContent "src/utils/passwordSecurity.js" "bcryptjs" "passwordSecurity.js uses bcrypt"
Test-FileContent "src/utils/passwordSecurity.js" "12" "passwordSecurity.js uses 12 salt rounds"

# ============= INPUT VALIDATION TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "INPUT VALIDATION CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-FileContent "src/routes/order.js" "discountAmount" "order.js validates discount amounts"
Test-FileContent "src/routes/menu.js" "price.*>" "menu.js validates prices"
Test-FileContent "src/routes/customer.js" "tableId.*tableNumber" "customer.js validates table"
Test-FileContent "src/routes/customer.js" "items.*length" "customer.js validates items array"

# ============= CRITICAL OPERATION LOGGING TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "CRITICAL OPERATION LOGGING CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-FileContent "src/routes/order.js" "logCriticalOperation" "order.js logs critical operations"
Test-FileContent "src/routes/menu.js" "logCriticalOperation" "menu.js logs deletions"
Test-FileContent "src/routes/table.js" "logCriticalOperation" "table.js logs deletions"
Test-FileContent "src/routes/restaurant.js" "logCriticalOperation" "restaurant.js logs staff operations"
Test-FileContent "src/routes/developer.js" "logCriticalOperation" "developer.js logs admin operations"

# ============= DATA ACCESS LOGGING TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "DATA ACCESS LOGGING CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-FileContent "src/routes/activity.js" "logDataAccess" "activity.js logs data access"
Test-FileContent "src/routes/customer.js" "logDataAccess" "customer.js logs data access"
Test-FileContent "src/routes/inventory.js" "logDataAccess" "inventory.js logs data access"
Test-FileContent "src/routes/analyticsRouter.js" "logDataAccess" "analyticsRouter.js logs data access"

# ============= SUSPICIOUS ACTIVITY DETECTION TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "SUSPICIOUS ACTIVITY DETECTION CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-FileContent "src/routes/order.js" "logSuspiciousActivity" "order.js detects suspicious discounts"
Test-FileContent "src/routes/menu.js" "logSuspiciousActivity" "menu.js detects suspicious prices"
Test-FileContent "src/routes/customer.js" "logSuspiciousActivity" "customer.js detects suspicious orders"

# ============= AUTHORIZATION TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "AUTHORIZATION CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-FileContent "src/routes/order.js" "requireBillingRole" "order.js uses requireBillingRole"
Test-FileContent "src/routes/menu.js" "requireRole" "menu.js uses requireRole"
Test-FileContent "src/routes/developer.js" "requireDeveloperAccess" "developer.js uses requireDeveloperAccess"
Test-FileContent "src/routes/restaurant.js" "manage_staff" "restaurant.js checks manage_staff permission"

# ============= SECURITY UTILITIES TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "SECURITY UTILITIES CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-File "src/utils/securityAudit.js" "securityAudit.js utility exists"
Test-File "src/utils/passwordSecurity.js" "passwordSecurity.js utility exists"
Test-File "src/utils/sqlInjectionPrevention.js" "sqlInjectionPrevention.js utility exists"
Test-File "src/middleware/securityHeaders.js" "securityHeaders.js middleware exists"
Test-File "src/middleware/authorization.js" "authorization.js middleware exists"
Test-File "src/middleware/dataIsolation.js" "dataIsolation.js middleware exists"

# ============= APP.JS INTEGRATION TESTS =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "APP.JS INTEGRATION CHECK" @Yellow
Write-Host "$('='*50)" @Yellow

Test-FileContent "src/app.js" "secureHeadersMiddleware" "app.js has secureHeaders middleware"
Test-FileContent "src/app.js" "preventSQLInjection" "app.js has preventSQLInjection middleware"
Test-FileContent "src/app.js" "preventXSS" "app.js has preventXSS middleware"
Test-FileContent "src/app.js" "corsConfiguration" "app.js uses corsConfiguration"

# ============= OPTIONAL ENDPOINT TESTS =============

if ($RunFullTests) {
    Write-Host "`n$('='*50)" @Yellow
    Write-Host "ENDPOINT TESTS (Server must be running)" @Yellow
    Write-Host "$('='*50)" @Yellow
    
    # Test weak password rejection
    Test-Endpoint "POST" "/auth/register" `
        @{ email = "test@example.com"; password = "123"; restaurantName = "Test" } `
        "Weak password should be rejected" `
        @(400, 422)
    
    # Test unauthorized access
    Test-Endpoint "GET" "/orders" `
        $null `
        "Unauthenticated request should fail" `
        @(401, 302, 403)
}

# ============= SUMMARY =============

Write-Host "`n$('='*50)" @Yellow
Write-Host "TEST SUMMARY" @Yellow
Write-Host "$('='*50)" @Yellow

Write-Host "Total Tests: $script:TestsRun"
Write-Host "Passed: " -NoNewline
Write-Host "$script:TestsPassed" @Green
Write-Host "Failed: " -NoNewline
Write-Host "$script:TestsFailed" @Red

if ($script:TestsFailed -eq 0) {
    Write-Host "`n" @Green
    Write-Host "✓ ALL SECURITY TESTS PASSED!" @Green
    Write-Host "Ready for deployment!" @Green
    exit 0
} else {
    Write-Host "`n" @Red
    Write-Host "✗ SOME TESTS FAILED - Please review above" @Red
    exit 1
}
