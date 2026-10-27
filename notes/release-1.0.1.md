**Cueline 1.0.1: choose speech models in the installer.**

### New
- **Download speech models while you install.** The Mac Installer (Installation Type) and the Windows Setup (Choose speech models) list the models with their sizes: ivrit.ai large-v3-turbo for Hebrew and the speaker and silence models are ticked, and Whisper large-v3-turbo, ivrit.ai large-v3, Whisper large-v3 and Whisper small are there to add. The panel is ready the first time you open it.
- A model already on your computer is not downloaded again, every file is checked against its exact size, and a download that fails never fails the install: the panel's Models screen gets it later.
- Silent Windows installs: `Cueline-Setup-1.0.1.exe /S` downloads the ticked models, `/MODELS=ivrit-turbo,turbo,helpers` picks others, `/MODELS=none` none.
- **About and help** links to Cueline's page on [conformlabs.co](https://conformlabs.co/cueline/).

### Updating
Download the installer below and run it, then restart Premiere Pro. Your models, settings and history are kept. Cueline tells you when a new version is out (Updates in its menu).

Tested on Premiere Pro 2026 (26.5) on macOS 26 (Apple silicon; the engine also on Intel, through Rosetta). On Windows 11: the installer, its model downloads and the engine.
