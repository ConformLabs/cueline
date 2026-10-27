#!/bin/sh
# Speaker detection for macOS, universal (Apple Silicon + Intel), into extension/engine/mac/diarize/:
# sherpa-onnx's prebuilt diarization tool and libraries (Apache-2.0), and Cueline's voice-print
# helper (native/voiceprint.c) compiled against them.
#   scripts/build-speakers-mac.sh [sherpa-onnx version]
set -e
VER="${1:-2.0.1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/cueline-sherpa-$VER"
NAME="sherpa-onnx-v$VER-osx-universal2-shared-no-tts"
mkdir -p "$WORK"
[ -d "$WORK/$NAME" ] || (cd "$WORK" && curl -fsSL -O "https://github.com/k2-fsa/sherpa-onnx/releases/download/v$VER/$NAME.tar.bz2" && tar xjf "$NAME.tar.bz2")
S="$WORK/$NAME"
OUT="$ROOT/extension/engine/mac/diarize"
mkdir -p "$OUT"
cp "$S/bin/sherpa-onnx-offline-speaker-diarization" "$S/lib/libonnxruntime.dylib" "$S/lib/libsherpa-onnx-c-api.dylib" "$OUT/"
clang -O2 -arch arm64 -arch x86_64 -mmacosx-version-min=12.0 -I "$S/include" "$ROOT/native/voiceprint.c" \
  -L "$OUT" -lsherpa-onnx-c-api -Wl,-rpath,@loader_path -o "$OUT/cueline-voiceprint"
lipo -info "$OUT/sherpa-onnx-offline-speaker-diarization" "$OUT/cueline-voiceprint"
