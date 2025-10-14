$body = '{"input":"Hello World"}'
$response = Invoke-WebRequest -Uri http://localhost:3000/api/agents/echo/execute -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing
Write-Host "Status Code:" $response.StatusCode
Write-Host "Response:" $response.Content
