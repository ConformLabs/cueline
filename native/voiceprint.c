/* cueline-voiceprint: one voice print (speaker embedding) per time span of a 16 kHz mono WAV.
 *   cueline-voiceprint <embedding-model.onnx> <audio.wav>   < spans ("start end" in seconds, one per line)
 * Prints one line per span: the embedding as comma-separated floats, or an empty line when the
 * span is too short to measure. Built on sherpa-onnx's C API (Apache-2.0). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "sherpa-onnx/c-api/c-api.h"

int main(int argc, char **argv) {
  if (argc < 3) { fprintf(stderr, "usage: %s model.onnx audio.wav < spans\n", argv[0]); return 2; }
  SherpaOnnxSpeakerEmbeddingExtractorConfig cfg;
  memset(&cfg, 0, sizeof(cfg));
  cfg.model = argv[1]; cfg.num_threads = 2; cfg.provider = "cpu";
  const SherpaOnnxSpeakerEmbeddingExtractor *ex = SherpaOnnxCreateSpeakerEmbeddingExtractor(&cfg);
  if (!ex) { fprintf(stderr, "could not load %s\n", argv[1]); return 1; }
  const SherpaOnnxWave *wave = SherpaOnnxReadWave(argv[2]);
  if (!wave) { fprintf(stderr, "could not read %s\n", argv[2]); return 1; }
  int dim = SherpaOnnxSpeakerEmbeddingExtractorDim(ex);
  double a, b;
  while (scanf("%lf %lf", &a, &b) == 2) {
    long s0 = (long)(a * wave->sample_rate), s1 = (long)(b * wave->sample_rate);
    if (s0 < 0) s0 = 0;
    if (s1 > wave->num_samples) s1 = wave->num_samples;
    const SherpaOnnxOnlineStream *st = SherpaOnnxSpeakerEmbeddingExtractorCreateStream(ex);
    if (s1 > s0) SherpaOnnxOnlineStreamAcceptWaveform(st, wave->sample_rate, wave->samples + s0, (int32_t)(s1 - s0));
    SherpaOnnxOnlineStreamInputFinished(st);
    if (SherpaOnnxSpeakerEmbeddingExtractorIsReady(ex, st)) {
      const float *e = SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(ex, st);
      for (int i = 0; i < dim; i++) printf(i ? ",%.5f" : "%.5f", e[i]);
      SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(e);
    }
    printf("\n"); fflush(stdout);
    SherpaOnnxDestroyOnlineStream(st);
  }
  SherpaOnnxFreeWave(wave);
  SherpaOnnxDestroySpeakerEmbeddingExtractor(ex);
  return 0;
}
