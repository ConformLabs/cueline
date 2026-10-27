#!/bin/sh
# Builds whisper-cli for macOS as one universal binary (Apple Silicon + Intel), static, with the Metal
# shaders embedded, into extension/engine/mac/. Needs Xcode command line tools and cmake.
#   scripts/build-engine-mac.sh [whisper.cpp tag]
set -e
TAG="${1:-v1.9.5}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/cueline-whisper-$TAG"
[ -d "$WORK" ] || git clone --depth 1 --branch "$TAG" https://github.com/ggml-org/whisper.cpp "$WORK"
cmake -S "$WORK" -B "$WORK/build-universal" -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
  -DBUILD_SHARED_LIBS=OFF -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DGGML_NATIVE=OFF \
  -DGGML_BLAS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DWHISPER_SDL2=OFF
cmake --build "$WORK/build-universal" --config Release -j --target whisper-cli
mkdir -p "$ROOT/extension/engine/mac"
cp "$WORK/build-universal/bin/whisper-cli" "$ROOT/extension/engine/mac/whisper-cli"
lipo -info "$ROOT/extension/engine/mac/whisper-cli"
