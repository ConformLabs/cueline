# Builds Cueline's Windows engine on a Windows PC, into $Out:
#   whisper-cli.exe       whisper.cpp with the Vulkan GPU backend (NVIDIA, AMD and Intel graphics), static, static C runtime
#                         (no Visual C++ redistributable); it needs the vulkan-1.dll every graphics driver installs
#   whisper-cli-cpu.exe   the same on the CPU only (AVX2), for PCs without a Vulkan driver (engine.js picks)
#   diarize\          sherpa-onnx's prebuilt speaker diarization (static-runtime build) and Cueline's
#                     cueline-voiceprint.exe (native\voiceprint.c) compiled against its C API
# Needs Visual Studio Build Tools (C++), CMake and Git. Run by scripts/build-windows.mjs over SSH, or by hand:
#   powershell -ExecutionPolicy Bypass -File build-windows.ps1 -Work C:\cueline-build -VoiceprintC voiceprint.c
param([string]$Work = "C:\cueline-build", [string]$WhisperTag = "v1.9.5", [string]$Sherpa = "2.0.1", [string]$VoiceprintC = "voiceprint.c")
$ErrorActionPreference = "Stop"
$Out = Join-Path $Work "out"
# a clean output folder: only what this build makes gets copied back into the extension
Remove-Item -Recurse -Force $Out -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Work, $Out, (Join-Path $Out "diarize") | Out-Null

# Visual Studio's x64 build environment for cl.exe
$vs = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -property installationPath
cmd /c "`"$vs\VC\Auxiliary\Build\vcvars64.bat`" >nul && set" | ForEach-Object { if ($_ -match "^([^=]+)=(.*)$") { [Environment]::SetEnvironmentVariable($matches[1], $matches[2]) } }

# 1. whisper.cpp, twice: with Vulkan (needs the Vulkan SDK to build) and CPU only
$src = Join-Path $Work "whisper.cpp-$WhisperTag"
if (!(Test-Path $src)) { git clone --depth 1 --branch $WhisperTag https://github.com/ggml-org/whisper.cpp $src; if ($LASTEXITCODE) { throw "git clone failed" } }
if (!$env:VULKAN_SDK) { $sdk = Get-ChildItem "C:\VulkanSDK" -Directory -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1; if ($sdk) { $env:VULKAN_SDK = $sdk.FullName; $env:PATH = "$($sdk.FullName)\Bin;$env:PATH" } }
if (!$env:VULKAN_SDK) { throw "the Vulkan SDK is not installed (winget install KhronosGroup.VulkanSDK)" }
foreach ($v in @(@{ name = "whisper-cli.exe"; dir = "build-cueline-vulkan"; vulkan = "ON" }, @{ name = "whisper-cli-cpu.exe"; dir = "build-cueline"; vulkan = "OFF" })) {
  $bld = Join-Path $src $v.dir
  cmake -S $src -B $bld -G "Visual Studio 18 2026" -A x64 -DBUILD_SHARED_LIBS=OFF -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded `
    -DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DGGML_OPENMP=OFF "-DGGML_VULKAN=$($v.vulkan)" `
    -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DWHISPER_SDL2=OFF
  if ($LASTEXITCODE) { throw "cmake configure failed ($($v.name))" }
  cmake --build $bld --config Release --target whisper-cli -j
  if ($LASTEXITCODE) { throw "whisper-cli build failed ($($v.name))" }
  Copy-Item (Join-Path $bld "bin\Release\whisper-cli.exe") (Join-Path $Out $v.name) -Force
}

# 2. sherpa-onnx speaker diarization (prebuilt, static C runtime)
$name = "sherpa-onnx-v$Sherpa-win-x64-shared-MT-Release-no-tts"
$sh = Join-Path $Work $name
if (!(Test-Path $sh)) {
  curl.exe -fsSL -o (Join-Path $Work "$name.tar.bz2") "https://github.com/k2-fsa/sherpa-onnx/releases/download/v$Sherpa/$name.tar.bz2"
  if ($LASTEXITCODE) { throw "sherpa-onnx download failed" }
  tar -xjf (Join-Path $Work "$name.tar.bz2") -C $Work
}
Copy-Item (Join-Path $sh "bin\sherpa-onnx-offline-speaker-diarization.exe") (Join-Path $Out "diarize") -Force
Get-ChildItem (Join-Path $sh "lib") -Filter *.dll | ForEach-Object { Copy-Item $_.FullName (Join-Path $Out "diarize") -Force }

# 3. the voice-print helper against sherpa-onnx's C API
$lib = Get-ChildItem (Join-Path $sh "lib") -Filter "sherpa-onnx-c-api.lib" | Select-Object -First 1
if (!$lib) { throw "sherpa-onnx-c-api.lib not found in $sh\lib" }
Push-Location (Join-Path $Out "diarize")
cl /nologo /O2 /MT /I (Join-Path $sh "include") $VoiceprintC $lib.FullName /Fe:cueline-voiceprint.exe /link /SUBSYSTEM:CONSOLE
if ($LASTEXITCODE) { Pop-Location; throw "voiceprint build failed" }
Remove-Item *.obj -ErrorAction SilentlyContinue
Pop-Location
Get-ChildItem -Recurse $Out | Select-Object FullName, Length | Format-Table -AutoSize
