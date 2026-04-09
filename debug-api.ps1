# Debug API responses
$baseUrl = "http://localhost:3000/api/v1"
$managerEmail = "manager@restaurant.com"
$managerPassword = "Manager123@456"

Write-Host "Testing login endpoint with manager credentials..."

$loginBody = @{
  email = $managerEmail
  password = $managerPassword
} | ConvertTo-Json

try {
  $response = Invoke-RestMethod -Uri "$baseUrl/auth/staff/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $loginBody -ErrorAction Stop
  
  Write-Host "Login Response:" -ForegroundColor Green
  Write-Host ($response | ConvertTo-Json -Depth 10)
  
  # Access properties
  Write-Host "`nExtracted values:"
  Write-Host "Token type: $($response.GetType())"
  Write-Host "Token value: $($response.token)"
  
  if ($response.restaurant) {
    Write-Host "Restaurant ID: $($response.restaurant.id)"
  } else {
    Write-Host "No restaurant property found"
  }
  
} catch {
  Write-Host "Error: $_" -ForegroundColor Red
  Write-Host $_.Exception.Response
}
