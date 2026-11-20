<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import type { ChatMessage } from "./types";

type WhisperModule = typeof import("./localWhisper");
type WhisperModel = Awaited<ReturnType<WhisperModule["loadLocalWhisper"]>>;

const props = defineProps<{
  messages: ChatMessage[];
  busy: boolean;
  interruptible: boolean;
  internetAccess: boolean;
  microphoneAccess: boolean;
}>();
const emit = defineEmits<{ send: [text: string]; close: [] }>();

const language = ref("th-TH");
const callActive = ref(false);
const listening = ref(false);
const speaking = ref(false);
const transcribing = ref(false);
const transcript = ref("");
const error = ref("");
const status = ref("Ready when you are");
let model: WhisperModel | null = null;
let whisperModule: WhisperModule | null = null;
let audioContext: AudioContext | null = null;
let microphoneStream: MediaStream | null = null;
let microphoneSource: MediaStreamAudioSourceNode | null = null;
let speechFilter: BiquadFilterNode | null = null;
let analyserNode: AnalyserNode | null = null;
let meterFrame: number | null = null;
let recorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let candidateStartedAt = 0;
let lastSpeechAt = 0;
let speechFrames = 0;
let speechConfirmed = false;
let waitingForReply = false;
let speechGeneration = 0;
let audioGeneration = 0;

async function startCall() {
  if (callActive.value) return;
  if (!props.microphoneAccess) {
    error.value = "Enable microphone access in Privacy settings before starting voice chat.";
    return;
  }
  callActive.value = true;
  waitingForReply = false;
  error.value = "";

  try {
    // Start Web Audio from the user's click, then load the speech model only when voice is used.
    audioContext = new AudioContext();
    await audioContext.resume();
    if (!model) {
      status.value = "Loading local Whisper model...";
      whisperModule ??= await import("./localWhisper");
      model = await whisperModule.loadLocalWhisper(props.internetAccess, (progress) => {
        if (progress.status === "progress" && typeof progress.progress === "number") {
          status.value = `Downloading Whisper model: ${Math.round(progress.progress)}%`;
        } else if (progress.status === "done") {
          status.value = "Preparing local Whisper model...";
        }
      });
    }
    if (callActive.value) await startListening();
  } catch (reason) {
    error.value = props.internetAccess
      ? `Could not load local Whisper. Check the connection and retry. ${String(reason)}`
      : `Whisper Small is not cached yet. Turn on Internet access once to download the model. ${String(reason)}`;
    stopCall();
    status.value = "Local speech model unavailable";
  }
}

async function startListening() {
  if (!callActive.value || props.busy || transcribing.value) return;
  if (!props.microphoneAccess) {
    stopCall();
    error.value = "Microphone access is disabled in Privacy settings.";
    return;
  }
  if (speaking.value && !props.interruptible) return;

  try {
    if (!microphoneStream) {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This WebView does not provide microphone capture.");
      }
      microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!callActive.value || !props.microphoneAccess) {
        microphoneStream.getTracks().forEach((track) => track.stop());
        microphoneStream = null;
        return;
      }
      audioContext ??= new AudioContext();
      await audioContext.resume();
      microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
      speechFilter = audioContext.createBiquadFilter();
      speechFilter.type = "bandpass";
      speechFilter.frequency.value = 1200;
      speechFilter.Q.value = 0.6;
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 1024;
      microphoneSource.connect(speechFilter).connect(analyserNode);
      const generation = ++audioGeneration;
      monitorMicrophone(generation);
    }
    listening.value = !speaking.value;
    status.value = speaking.value ? "Speak to interrupt..." : "Listening on this device...";
  } catch (reason) {
    error.value = `Could not access the microphone: ${String(reason)}`;
    status.value = "Microphone needs attention";
    listening.value = false;
  }
}

function monitorMicrophone(generation: number) {
  if (!analyserNode) return;
  const analyser = analyserNode;
  const samples = new Float32Array(analyser.fftSize);

  const inspect = () => {
    if (generation !== audioGeneration || !callActive.value || !microphoneStream) return;
    const canListen = listening.value || (speaking.value && props.interruptible);
    if (canListen && !props.busy && !transcribing.value) {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      const threshold = speaking.value ? 0.05 : 0.025;
      const now = performance.now();

      if (rms > threshold) {
        if (!recorder) startUtteranceRecording(now);
        speechFrames += 1;
        lastSpeechAt = now;
        if (!speechConfirmed && speechFrames >= 5) {
          speechConfirmed = true;
          if (speaking.value) interruptAssistant();
          else status.value = "Recording your turn...";
        }
      } else if (recorder) {
        speechFrames = 0;
        const quietFor = now - lastSpeechAt;
        if (!speechConfirmed && now - candidateStartedAt > 420) {
          discardUtterance();
        } else if (speechConfirmed && quietFor > 850) {
          recorder.stop();
        }
      }
    }
    meterFrame = requestAnimationFrame(inspect);
  };

  meterFrame = requestAnimationFrame(inspect);
}

function startUtteranceRecording(now: number) {
  if (!microphoneStream || typeof MediaRecorder === "undefined") {
    error.value = "This WebView cannot record microphone audio for local transcription.";
    status.value = "Audio recording unavailable";
    return;
  }

  try {
    candidateStartedAt = now;
    lastSpeechAt = now;
    speechFrames = 0;
    speechConfirmed = false;
    audioChunks = [];
    recorder = new MediaRecorder(microphoneStream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: recorder?.mimeType || "audio/webm" });
      const shouldTranscribe = speechConfirmed;
      recorder = null;
      audioChunks = [];
      speechFrames = 0;
      speechConfirmed = false;
      if (shouldTranscribe && callActive.value) void transcribeUtterance(blob);
    };
    recorder.start();
  } catch (reason) {
    recorder = null;
    error.value = `Could not record microphone audio: ${String(reason)}`;
  }
}

function discardUtterance() {
  const current = recorder;
  recorder = null;
  audioChunks = [];
  speechFrames = 0;
  speechConfirmed = false;
  if (current && current.state !== "inactive") {
    current.onstop = null;
    current.stop();
  }
}

async function transcribeUtterance(blob: Blob) {
  if (blob.size < 3000 || !model) {
    if (callActive.value && !props.busy && !speaking.value) status.value = "Listening on this device...";
    return;
  }

  waitingForReply = true;
  listening.value = false;
  transcribing.value = true;
  status.value = "Transcribing locally...";
  stopMicrophoneCapture();
  let decoder: AudioContext | null = null;

  try {
    const audioBytes = await blob.arrayBuffer();
    decoder = new AudioContext();
    const decoded = await decoder.decodeAudioData(audioBytes);
    const sampleCount = Math.ceil((decoded.length / decoded.sampleRate) * 16000);
    const offline = new OfflineAudioContext(1, sampleCount, 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const resampled = await offline.startRendering();
    const audio = resampled.getChannelData(0);
    const detectedText = await whisperModule!.transcribeLocally(
      model,
      audio,
      language.value === "th-TH" ? "thai" : "english",
    );
    await decoder.close();
    decoder = null;

    if (!callActive.value) return;
    if (!detectedText) {
      waitingForReply = false;
      transcribing.value = false;
      status.value = "No speech detected. Listening again...";
      await startListening();
      return;
    }

    transcript.value = detectedText;
    status.value = "Thinking...";
    emit("send", detectedText);
  } catch (reason) {
    waitingForReply = false;
    transcribing.value = false;
    error.value = `Local transcription failed: ${String(reason)}`;
    status.value = "Could not transcribe that turn";
    if (callActive.value) await startListening();
  } finally {
    if (decoder) await decoder.close();
    transcribing.value = false;
  }
}

function stopMicrophoneCapture(closeContext = false) {
  audioGeneration += 1;
  if (meterFrame !== null) cancelAnimationFrame(meterFrame);
  meterFrame = null;
  microphoneStream?.getTracks().forEach((track) => track.stop());
  microphoneStream = null;
  microphoneSource?.disconnect();
  speechFilter?.disconnect();
  analyserNode?.disconnect();
  microphoneSource = null;
  speechFilter = null;
  analyserNode = null;
  listening.value = false;
  if (closeContext && audioContext) {
    void audioContext.close();
    audioContext = null;
  }
}

function stopCall() {
  callActive.value = false;
  waitingForReply = false;
  listening.value = false;
  speaking.value = false;
  transcribing.value = false;
  speechGeneration += 1;
  const current = recorder;
  recorder = null;
  if (current && current.state !== "inactive") {
    current.onstop = null;
    current.stop();
  }
  audioChunks = [];
  stopMicrophoneCapture(true);
  window.speechSynthesis?.cancel();
  status.value = "Call ended";
}

function retryMicrophone() {
  error.value = "";
  if (!model) {
    void startCall();
    return;
  }
  void startListening();
}

function interruptAssistant() {
  speechGeneration += 1;
  window.speechSynthesis?.cancel();
  speaking.value = false;
  listening.value = true;
  transcript.value = "";
  status.value = "You interrupted. Recording...";
}

function finishSpeaking() {
  speaking.value = false;
  if (callActive.value) {
    status.value = "Listening on this device...";
    void startListening();
  }
}

function speakReply(message: ChatMessage) {
  const synthesis = window.speechSynthesis;
  if (!synthesis) {
    error.value = "Speech output is not available in this WebView.";
    finishSpeaking();
    return;
  }

  listening.value = false;
  if (!props.interruptible) stopMicrophoneCapture();
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message.content);
  const generation = ++speechGeneration;
  utterance.lang = language.value;
  utterance.onstart = () => {
    if (generation !== speechGeneration) return;
    speaking.value = true;
    status.value = props.interruptible ? "Speaking. Speak anytime to interrupt..." : "Speaking. Your mic is paused...";
    if (props.interruptible) void startListening();
  };
  utterance.onend = () => {
    if (generation === speechGeneration) finishSpeaking();
  };
  utterance.onerror = () => {
    if (generation !== speechGeneration) return;
    error.value = "Could not play the spoken reply. Check that a system voice is installed.";
    finishSpeaking();
  };
  speaking.value = true;
  synthesis.speak(utterance);
}

watch(
  [() => props.messages.length, () => props.busy],
  () => {
    const lastMessage = props.messages[props.messages.length - 1];
    if (!callActive.value || props.busy || !waitingForReply || !lastMessage || lastMessage.role !== "assistant") return;
    waitingForReply = false;
    speakReply(lastMessage);
  },
);

onUnmounted(stopCall);
watch(() => props.microphoneAccess, (allowed) => {
  if (!allowed && callActive.value) {
    stopCall();
    error.value = "Microphone access was turned off in Privacy settings.";
  }
});
</script>

<template>
  <div class="voice-backdrop" role="presentation" @click.self="emit('close')">
    <section class="voice-call" role="dialog" aria-modal="true" aria-labelledby="voice-title">
      <button class="voice-close" aria-label="Close voice chat" @click="emit('close')">×</button>
      <span class="eyebrow">LOCAL AI · VOICE CHAT</span>
      <h2 id="voice-title">{{ interruptible ? "Talk it through" : "Take turns" }}</h2>
      <span class="voice-mode">{{ interruptible ? "Interruptions on" : "Wait until the reply finishes" }}</span>
      <p class="voice-status">{{ status }}</p>

      <div class="voice-orb" :class="{ listening, speaking, busy: busy || transcribing }" aria-hidden="true">
        <span class="orb-ring ring-one"></span>
        <span class="orb-ring ring-two"></span>
        <span class="orb-core"><i></i><i></i><i></i><i></i><i></i></span>
      </div>

      <p class="live-transcript">{{ transcript || (speaking ? interruptible ? "Speak anytime to interrupt" : "AI is speaking. Mic will reopen after the reply." : listening ? "I'm listening..." : "Your conversation will appear in chat history") }}</p>

      <label class="voice-language">
        <span>Spoken language</span>
        <select v-model="language" :disabled="callActive">
          <option value="th-TH">Thai</option>
          <option value="en-US">English (US)</option>
        </select>
      </label>

      <div v-if="error" class="voice-error" role="status">{{ error }}</div>

      <div class="voice-controls">
      <button v-if="!callActive" class="call-start" :disabled="!microphoneAccess" @click="startCall">Start voice chat</button>
        <button v-else-if="!listening && !speaking && !busy && !transcribing" class="call-start" @click="retryMicrophone">Start microphone</button>
        <button v-if="speaking && interruptible" class="call-interrupt" @click="interruptAssistant">Interrupt</button>
        <button v-if="callActive" class="call-end" @click="stopCall">End call</button>
      </div>

      <p class="voice-privacy">{{ interruptible ? "Speak anytime to interrupt a reply. Detection depends on your microphone and echo cancellation." : "The microphone stays off while the AI speaks, so its reply cannot be interrupted." }} Whisper Small runs locally, using the GPU when WebGPU is available. {{ internetAccess ? "First use downloads its model." : "Internet is off; only a cached model can be used." }}</p>
    </section>
  </div>
</template>

<style scoped>
.voice-backdrop { position: fixed; z-index: 10; inset: 0; display: grid; place-items: center; padding: 20px; background: #08090dcc; backdrop-filter: blur(10px); }
.voice-call { position: relative; display: flex; width: min(480px, 100%); min-height: 590px; flex-direction: column; align-items: center; padding: 36px 32px 26px; overflow: hidden; border: 1px solid #353746; border-radius: 25px; background: radial-gradient(ellipse at 50% 34%, #252c3f 0%, #191a22 49%, #15161c 100%); box-shadow: 0 30px 100px #0009; text-align: center; }
.voice-close { position: absolute; top: 17px; right: 19px; width: 34px; height: 34px; border: 1px solid #41424d; border-radius: 50%; background: #252630; color: #c7c8d1; font-size: 23px; cursor: pointer; }
.voice-call h2 { margin: 11px 0 5px; font-size: 23px; font-weight: 600; }
.voice-mode { margin: 1px 0 5px; color: #91a9df; font-size: 9px; }
.voice-status { min-height: 18px; margin: 0; color: #9ca4b8; font-size: 12px; }
.voice-orb { position: relative; display: grid; width: 230px; height: 230px; place-items: center; margin: 35px 0 24px; }
.orb-ring { position: absolute; inset: 12px; border: 1px solid #64739533; border-radius: 50%; transition: transform .4s, border-color .4s; }
.ring-two { inset: 31px; border-color: #7d8eb144; }
.orb-core { display: flex; align-items: center; justify-content: center; gap: 7px; width: 115px; height: 115px; border: 1px solid #8195c56b; border-radius: 50%; background: radial-gradient(circle at 38% 30%, #647bb0, #303b57 62%, #202635); box-shadow: 0 0 45px #667fb044, inset 0 0 22px #cad8ff22; }
.orb-core i { width: 6px; height: 6px; border-radius: 50%; background: #d6e0ff; opacity: .82; animation: dot-float 1.4s ease-in-out infinite alternate; }
.orb-core i:nth-child(2), .orb-core i:nth-child(4) { animation-delay: .25s; }
.orb-core i:nth-child(3) { animation-delay: .5s; }
.orb-core i:nth-child(5) { animation-delay: .75s; }
.voice-orb.listening .orb-ring { transform: scale(1.08); border-color: #76d6b577; animation: ring-pulse 1.7s ease-out infinite; }
.voice-orb.listening .ring-two { animation-delay: .55s; }
.voice-orb.speaking .orb-core { box-shadow: 0 0 65px #879fe888, inset 0 0 28px #cad8ff44; }
.voice-orb.busy .orb-core i { animation-duration: .45s; }
.live-transcript { min-height: 44px; max-width: 350px; margin: 0 0 20px; color: #c0c3ce; font-size: 12px; line-height: 1.6; }
.voice-language { display: flex; align-items: center; gap: 10px; margin: auto 0 18px; color: #8e92a0; font-size: 10px; }
.voice-language select { padding: 7px 11px; border: 1px solid #383a46; border-radius: 8px; background: #20212a; color: #d2d4dc; font-size: 11px; }
.voice-error { width: 100%; margin: 0 0 15px; padding: 10px; border: 1px solid #754b35; border-radius: 9px; background: #2b211d; color: #efad73; font-size: 10px; line-height: 1.5; }
.voice-controls { display: flex; justify-content: center; gap: 10px; }
.call-start, .call-end { min-width: 135px; padding: 11px 18px; border: 0; border-radius: 10px; font-size: 11px; font-weight: 650; cursor: pointer; }
.call-start { background: #597cc6; color: white; }
.call-start:disabled { opacity: .5; cursor: not-allowed; }
.call-interrupt { min-width: 105px; padding: 11px 18px; border: 1px solid #6c758d; border-radius: 10px; background: #303747; color: #e5eaff; font-size: 11px; font-weight: 650; cursor: pointer; }
.call-end { background: #37303a; color: #efb0b0; }
.voice-privacy { max-width: 355px; margin: 17px 0 0; color: #737887; font-size: 9px; line-height: 1.5; }
@keyframes ring-pulse { 0% { opacity: .8; transform: scale(.98); } 100% { opacity: .1; transform: scale(1.18); } }
@keyframes dot-float { to { opacity: .3; transform: translateY(-5px) scale(.8); } }
@media (max-width: 500px) { .voice-call { min-height: 540px; padding: 34px 22px 22px; } .voice-orb { width: 195px; height: 195px; margin: 27px 0 18px; } .orb-core { width: 100px; height: 100px; } }
</style>
