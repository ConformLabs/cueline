# Privacy

Cueline Captions is made by Conform Labs. It has no accounts, no analytics and no telemetry. Your audio, transcripts and
captions stay on your computer: transcription and speaker detection run locally.

Cueline goes online only for these, from its installer or its panel:

| What | Where | When |
|---|---|---|
| Speech models | huggingface.co (ivrit.ai, ggml-org) | During the install if you tick them, or when you download one in the panel's Models |
| Silence model | huggingface.co (ggml-org/whisper-vad) | During the install if you tick the speaker and silence models, or once, on the first transcription |
| Speaker models | huggingface.co and github.com (k2-fsa/sherpa-onnx) | During the install if you tick them, or once, on the first run with speakers by voice |
| Update check | api.github.com (ConformLabs/cueline releases); when GitHub limits that, github.com and raw.githubusercontent.com (the same release and its notes) | At most once a day; off in Updates › Check automatically |

Each request sends only what any download sends (the address asked for, and "Cueline" with its version as the
browser name). Links in About and help open in your browser.
