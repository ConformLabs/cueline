# Downloads one speech model choice's files for Cueline's Setup (cueline.nsi runs it from $PLUGINSDIR):
#   get-model.ps1 -Files "file|url|bytes;file|url|bytes" -Dir "%APPDATA%\Cueline\models"
# A file is kept only when it is exactly its size; one already there at that size is not downloaded again.
# Exit 0: all there; 1: one or more did not download (the panel can download them later in Models).
param([string]$Files, [string]$Dir)
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$failed = 0
foreach ($entry in $Files.Split(";")) {
  $file, $url, $bytes = $entry.Split("|")
  $dest = Join-Path $Dir $file
  if ((Test-Path $dest) -and (Get-Item $dest).Length -eq [int64]$bytes) { Write-Output "${file}: already downloaded"; continue }
  Write-Output "${file}: downloading $bytes bytes from $url"
  & "$env:SystemRoot\System32\curl.exe" -fsSL --retry 3 --connect-timeout 20 -o "$dest.part" $url
  if ($LASTEXITCODE -eq 0 -and (Test-Path "$dest.part") -and (Get-Item "$dest.part").Length -eq [int64]$bytes) {
    Move-Item -Force "$dest.part" $dest
    Write-Output "${file}: done"
  } else {
    Remove-Item -Force "$dest.part" -ErrorAction SilentlyContinue
    Write-Output "${file}: not downloaded"
    $failed++
  }
}
if ($failed) { exit 1 }
exit 0
