# Erwin Local AI Assistant

Desktop assistant built with Tauri, Vue, Ollama and local Whisper transcription.

## Recommended desktop profile

The default profile targets a Ryzen 5 5600X, 32 GB RAM and an NVIDIA GPU with 8 GB VRAM:

- Chat uses `qwen3:4b` with an 8K context and keeps the model warm for 10 minutes. The 4B model leaves GPU memory available for Whisper and the desktop compositor.
- Voice uses multilingual `Xenova/whisper-small` with 4-bit weights. Transformers.js tries WebGPU first and falls back to local WASM CPU inference. WASM is limited to at most six threads so Ollama remains responsive.
- Whisper processes longer utterances in overlapping 20-second chunks.

Install a current NVIDIA driver, Ollama, and the chat model:

```powershell
ollama pull qwen3:4b
```

Start Ollama before opening Erwin. On first use of voice, enable **Internet access for Whisper downloads** and let the model finish downloading (roughly several hundred MB). After that, turn Internet access off to use the cached model offline. Chat itself is sent only to Ollama on `127.0.0.1`.

For more response quality, `qwen3:8b` can be installed, but its roughly 5.2 GB model leaves less headroom on an 8 GB GPU when Whisper and Windows are also using graphics memory. If Ollama reports GPU memory pressure, return to `qwen3:4b` or reduce `num_ctx` in `src-tauri/src/lib.rs` to 4096.

## Development

```powershell
npm install
npm run tauri dev
```

## Voice troubleshooting

See [docs/VOICE_TROUBLESHOOTING_TH.md](docs/VOICE_TROUBLESHOOTING_TH.md).
