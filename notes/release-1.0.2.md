**Cueline 1.0.2: transcription on the graphics card on Windows.**

### New
- **Windows uses the GPU.** Cueline now transcribes with Vulkan on NVIDIA, AMD and Intel graphics. On an RTX 5070 Ti, 30 seconds of Hebrew takes about 4 seconds instead of 27 on the CPU. It picks a dedicated graphics card over the graphics built into the processor, and says which one in the panel's status line. PCs without a Vulkan driver keep the CPU engine. The first transcription on a PC takes a few seconds longer while the graphics driver prepares the engine; after that it's fast.
- **The logo says "Cueline Captions"** in the installers, like Surehand MCP's.

### Updating
Download the installer below and run it, then restart Premiere Pro. Your models, settings and history are kept. Cueline tells you when a new version is out (Updates in its menu).

Tested on Premiere Pro 2026 (26.5) on macOS 26 (Apple silicon) and Windows 11 (RTX 5070 Ti with Vulkan, and the CPU engine).
