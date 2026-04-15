# Test script to verify password change fix (401 vs 403 issue)
# This tests the complete flow from login to password change

param(
    [string]$baseUrl = "http://localhost:3000/api/v1",
    [string]$email = "manager@test.com",
    [string]$password = "TestPassword@123",
    [string]$newPassword = "NewPassword@123"
)

$ErrorActionPreference = "Stop"

function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Error-Custom { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Yellow }

Write-Info "Testing password change endpoint fix"
Write-Info "Base URL: $baseUrl"
Write-Info ""

# Step 1: Login to get JWT token
Write-Info "Step 1: Logging in to get JWT token..."
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            email = $email
            password = $password
        }) `
        -ErrorAction Stop

    $token = $loginResponse.data.accessToken
    if (-not $token) {
        Write-Error-Custom "No token returned from login"
        exit 1
    }

    Write-Success "Login successful"
    Write-Info "Token length: $($token.Length) characters"
    Write-Info ""
} catch {
    Write-Error-Custom "Login failed: $($_.Exception.Message)"
    Write-Host $_.Exception.Response.StatusCode
    exit 1
}

# Step 2: Attempt to change password without token (should return 401, not 403)
Write-Info "Step 2: Testing password change without token (should be 401)..."
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/change-password" `
        -Method Post `
        -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            currentPassword = $password
            newPassword = $newPassword
        }) `
        -ErrorAction Stop

    Write-Error-Custom "Unexpected success - should have failed with 401"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Success "Got expected 401 status code"
    } elseif ($statusCode -eq 403) {
        Write-Error-Custom "Got 403 (WRONG - should be 401 for authentication failure)"
    } else {
        Write-Error-Custom "Got unexpected status code: $statusCode"
    }
}

Write-Info ""

# Step 3: Attempt to change password WITH token (should succeed with 200)
Write-Info "Step 3: Testing password change with valid token (should be 200)..."
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/change-password" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{
            Authorization = "Bearer $token"
        } `
        -Body (ConvertTo-Json @{
            currentPassword = $password
            newPassword = $newPassword
        }) `
        -ErrorAction Stop

    if ($response.success) {
        Write-Success "Password change successful with 200 OK"
        Write-Info "Message: $($response.message)"
    } else {
        Write-Error-Custom "Password change failed: $($response.message)"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $body = $_ | ConvertFrom-Json -ErrorAction SilentlyContinue
    
    if ($statusCode -eq 403) {
        Write-Error-Custom "Got 403 Forbidden - THIS IS THE BUG"
        Write-Error-Custom "Error message: $($body.message)"
    } elseif ($statusCode -eq 401) {
        Write-Error-Custom "Got 401 Unauthorized - token may be invalid"
        Write-Error-Custom "Error message: $($body.message)"
    } else {
        Write-Error-Custom "Password change failed with status code: $statusCode"
        Write-Error-Custom "Error: $($body.message)"
    }
}

Write-Info ""
Write-Success "Test completed"
