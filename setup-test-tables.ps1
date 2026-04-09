# Setup test tables and assign to waiter
$baseUrl = "http://localhost:3000/api/v1"
$managerEmail = "manager@restaurant.com"
$managerPassword = "Manager123@456"
$waiterEmail = "testwaiter@pos.com"

Write-Host "Login as Manager" -ForegroundColor Cyan

# Login as manager
$loginBody = @{
  email = $managerEmail
  password = $managerPassword
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/staff/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody -ErrorAction Stop

$managerToken = $loginResponse.data.accessToken
$restaurantId = $loginResponse.data.restaurant.id
Write-Host "Manager token obtained" -ForegroundColor Green
Write-Host "Restaurant ID: $restaurantId"

# Get existing tables
Write-Host "Get existing tables" -ForegroundColor Cyan

$headers = @{
  "Authorization" = "Bearer $managerToken"
  "x-restaurant-id" = $restaurantId
  "Content-Type" = "application/json"
}

$tablesResponse = Invoke-RestMethod -Uri "$baseUrl/tables" `
  -Method Get `
  -Headers $headers -ErrorAction SilentlyContinue

$existingTables = $tablesResponse.tables
Write-Host "Found $(($existingTables | Measure-Object).Count) existing tables"

# Create new tables if needed
$tableIds = @()
if ($existingTables.Count -eq 0) {
  Write-Host "Creating new tables" -ForegroundColor Cyan
  
  for ($i = 1; $i -le 3; $i++) {
    $tableBody = @{
      tableNumber = "$i"
      capacity = 4
      status = "available"
    } | ConvertTo-Json
    
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/tables" `
      -Method Post `
      -Headers $headers `
      -Body $tableBody
    
    $tableIds += $createResponse.id
    Write-Host "Created Table $i (ID: $($createResponse.id))" -ForegroundColor Green
  }
} else {
  Write-Host "Using existing tables" -ForegroundColor Green
  $tableIds = $existingTables | ForEach-Object { $_.id }
  $existingTables | ForEach-Object { 
    Write-Host "Table: $($_.tableNumber) (ID: $($_.id))" 
  }
}

# Get waiter ID
Write-Host "Get waiter staff ID" -ForegroundColor Cyan

$staffResponse = Invoke-RestMethod -Uri "$baseUrl/restaurants/staff" `
  -Method Get `
  -Headers $headers

$waiter = $staffResponse.staff | Where-Object { $_.email -eq $waiterEmail }
if ($waiter) {
  Write-Host "Waiter found" -ForegroundColor Green
  Write-Host "ID: $($waiter.id)"
  Write-Host "Name: $($waiter.name)"
  
  # Update waiter with assigned tables
  Write-Host "Assign tables to waiter" -ForegroundColor Cyan
  
  $updatePayload = @{
    assignedTables = $tableIds
  } | ConvertTo-Json
  
  $updateResponse = Invoke-RestMethod -Uri "$baseUrl/restaurants/staff/$($waiter.id)" `
    -Method Put `
    -Headers $headers `
    -Body $updatePayload
  
  Write-Host "Tables assigned to waiter" -ForegroundColor Green
  Write-Host "Assigned $($tableIds.Count) tables"
} else {
  Write-Host "Waiter not found!" -ForegroundColor Red
  Write-Host "Available staff:"
  $staffResponse.staff | ForEach-Object { Write-Host "- $($_.name) ($($_.email)) - Role: $($_.role)" }
}

Write-Host "Setup complete!" -ForegroundColor Green
