# Order Delete Permission Diagnostic - PowerShell Version
# This script tests the order deletion endpoint to diagnose permission issues

param(
  [string]$ApiBaseUrl = "restaurent-backend-448t.onrender.com",
  [string]$Email = "owner@restaurant.com",
  [string]$Password = "Owner123@456",
  [string]$Portal = "admin"
)

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Order Delete Permission Test" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "API Base URL: $ApiBaseUrl"
Write-Host "Email: $Email"
Write-Host "Portal: $Portal"
Write-Host ""

# Step 1: Login
Write-Host "Step 1: Logging in..." -ForegroundColor Yellow
try {
  $loginBody = @{
    email = $Email
    password = $Password
    portal = $Portal
  } | ConvertTo-Json

  $loginResponse = Invoke-WebRequest -Uri "https://$ApiBaseUrl/api/v1/auth/login" `
    -Method POST `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $loginBody `
    -ErrorAction Stop

  $loginData = $loginResponse.Content | ConvertFrom-Json
  
  $token = $loginData.data.accessToken
  $userRole = $loginData.data.user.role
  
  if (-not $token) {
    Write-Host "❌ Login failed!" -ForegroundColor Red
    Write-Host "Response: $($loginResponse.Content)" -ForegroundColor Red
    exit 1
  }

  Write-Host "✅ Login successful!" -ForegroundColor Green
  Write-Host "Token: $($token.Substring(0, 50))...[REDACTED]" -ForegroundColor Green
  Write-Host "Role: $userRole" -ForegroundColor Green
  Write-Host ""

} catch {
  Write-Host "❌ Login request failed!" -ForegroundColor Red
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# Step 2: Test permission check
Write-Host "Step 2: Testing permission check (GET /orders/active)..." -ForegroundColor Yellow
try {
  $permResponse = Invoke-WebRequest -Uri "https://$ApiBaseUrl/api/v1/orders/active" `
    -Method GET `
    -Headers @{"Authorization" = "Bearer $token"} `
    -ErrorAction SilentlyContinue `
    -WarningAction SilentlyContinue

  Write-Host "✅ Permission check passed! (Status: $($permResponse.StatusCode))" -ForegroundColor Green
  Write-Host ""

} catch {
  $statusCode = $_.Exception.Response.StatusCode.Value__
  Write-Host "❌ Permission check failed with status $statusCode" -ForegroundColor Red
  Write-Host ""
}

# Step 3: Try to delete a (fake) order  
Write-Host "Step 3: Testing order deletion endpoint..." -ForegroundColor Yellow
try {
  $deleteBody = @{
    reason = "Test deletion for permission check"
    currentPassword = ""
  } | ConvertTo-Json

  $deleteResponse = Invoke-WebRequest -Uri "https://$ApiBaseUrl/api/v1/orders/test-order-id-for-permission-test/delete" `
    -Method POST `
    -Headers @{
      "Authorization" = "Bearer $token"
      "Content-Type" = "application/json"
    } `
    -Body $deleteBody `
    -ErrorAction Stop

  Write-Host "✅ Got success response! (Status: $($deleteResponse.StatusCode))" -ForegroundColor Green
  Write-Host "Response: $($deleteResponse.Content | ConvertFrom-Json | ConvertTo-Json)" -ForegroundColor Green

} catch {
  $response = $_.Exception.Response
  $statusCode = $response.StatusCode.Value__
  
  Write-Host "HTTP Status: $statusCode" -ForegroundColor Yellow
  
  try {
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    $responseData = $responseBody | ConvertFrom-Json
    
    if ($statusCode -eq 403) {
      Write-Host "❌ Got 403 Forbidden - Permission DENIED!" -ForegroundColor Red
      Write-Host ""
      Write-Host "This indicates the checkPermission middleware is rejecting the request." -ForegroundColor Red
      Write-Host "The user role likely isn't recognized as having 'manage_orders' permission." -ForegroundColor Red
      Write-Host ""
      Write-Host "Error Details:" -ForegroundColor Yellow
      Write-Host $responseData | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Yellow
      
    } elseif ($statusCode -eq 400 -or $statusCode -eq 404) {
      Write-Host "✅ Got $statusCode - Permission GRANTED!" -ForegroundColor Green
      Write-Host ""
      Write-Host "This means the authorization check passed." -ForegroundColor Green
      Write-Host "The error is just validation or resource not found (which is expected)." -ForegroundColor Green
      Write-Host ""
      Write-Host "Response:" -ForegroundColor Cyan
      Write-Host $responseData | ConvertTo-Json | Write-Host
      
    } elseif ($statusCode -eq 401) {
      Write-Host "❌ Got 401 Unauthorized - Token INVALID!" -ForegroundColor Red
      Write-Host "The authentication check failed." -ForegroundColor Red
      
    } else {
      Write-Host "Got status $statusCode" -ForegroundColor Yellow
      Write-Host "Response: $($responseData | ConvertTo-Json)" -ForegroundColor Yellow
    }
    
  } catch {
    Write-Host "Response: $responseBody" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
