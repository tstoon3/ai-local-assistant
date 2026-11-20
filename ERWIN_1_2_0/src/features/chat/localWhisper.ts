import { env, pipeline } from "@huggingface/transformers";

type WhisperResult = { text: string } | { text: string }[];
type WhisperPipeline = (
  audio: Float32Array,
  options: { language: string; task: "transcribe"; chunk_length_s?: number; stride_length_s?: number },
) => Promise<WhisperResult>;

type WhisperProgress = {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

let modelPromise: Promise<WhisperPipeline> | null = null;

// Ship ONNX's runtime module and WASM beside the app so it never needs the
// jsDelivr fallback configured by Transformers.js in packaged WebViews.
const localWasmPaths = {
  mjs: new URL("../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs", import.meta.url).href,
  wasm: new URL("../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm", import.meta.url).href,
};

/** Loads a quantized multilingual Whisper model, preferring the GPU and falling back to CPU/WASM. */
export function loadLocalWhisper(
  allowInternet: boolean,
  onProgress?: (progress: WhisperProgress) => void,
) {
  if (!modelPromise) {
    env.allowRemoteModels = allowInternet;
    env.useBrowserCache = true;
    const wasm = env.backends.onnx.wasm!;
    wasm.wasmPaths = localWasmPaths;
    // 5600X has 12 logical processors; leave capacity for Ollama and the UI.
    wasm.numThreads = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 2));
    const options = {
      dtype: "q4" as const,
      local_files_only: !allowInternet,
      progress_callback: (progress: unknown) => onProgress?.(progress as WhisperProgress),
    };
    const load = async () => {
      if ("gpu" in navigator) {
        try {
          return await pipeline("automatic-speech-recognition", "Xenova/whisper-small", {
            ...options,
            device: "webgpu",
          });
        } catch (gpuError) {
          console.warn("Whisper WebGPU initialization failed; using CPU/WASM.", gpuError);
        }
      }
      return pipeline("automatic-speech-recognition", "Xenova/whisper-small", options);
    };
    modelPromise = load().then((model) => model as unknown as WhisperPipeline).catch((error: unknown) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

export async function transcribeLocally(
  model: WhisperPipeline,
  audio: Float32Array,
  language: "thai" | "english",
) {
  const result = await model(audio, {
    language,
    task: "transcribe",
    chunk_length_s: 20,
    stride_length_s: 4,
  });
  const first: { text?: string } = Array.isArray(result) ? result[0] : result;
  return first?.text?.trim() ?? "";
}
