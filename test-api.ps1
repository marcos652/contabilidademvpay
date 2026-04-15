try {
  $body = '{"customerId":"1","startDate":"2026-03-01 00:00:00","endDate":"2026-03-31 23:59:59"}'
  $r = Invoke-WebRequest -Uri 'http://localhost:5173/api/mysql-summary' -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing
  Write-Host "Status:" $r.StatusCode
  Write-Host "Body:" $r.Content
} catch {
  Write-Host "ERROR:" $_.Exception.Message
  $stream = $_.Exception.Response.GetResponseStream()
  if ($stream) {
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Response Body:" $reader.ReadToEnd()
    $reader.Close()
  }
}
