import { env, pipeline } from "@huggingface/transformers";

type WhisperResult = { text: string } | { text: string }[];
type WhisperPipeline = (
  audio: Float32Array,
  options: { language: string; task: "transcribe" },
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

/** Loads the multilingual tiny Whisper model in the renderer and lets Transformers.js cache it locally. */
export function loadLocalWhisper(
  allowInternet: boolean,
  onProgress?: (progress: WhisperProgress) => void,
) {
  if (!modelPromise) {
    env.allowRemoteModels = allowInternet;
    env.useBrowserCache = true;
    env.backends.onnx.wasm!.wasmPaths = localWasmPaths;
    modelPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      local_files_only: !allowInternet,
      progress_callback: (progress) => onProgress?.(progress as WhisperProgress),
    }).then((model) => model as unknown as WhisperPipeline).catch((error: unknown) => {
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
  const result = await model(audio, { language, task: "transcribe" });
  const first: { text?: string } = Array.isArray(result) ? result[0] : result;
  return first?.text?.trim() ?? "";
}
