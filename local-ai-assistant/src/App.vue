<script setup lang="ts">
import { onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import ChatHistory from "./features/chat/ChatHistory.vue";
import ChatConversation from "./features/chat/ChatConversation.vue";
import PrivacySettingsDialog from "./features/chat/PrivacySettingsDialog.vue";
import { useChatHistory } from "./features/chat/useChatHistory";
import type { ChatMessage, PrivacySettings } from "./features/chat/types";

interface OllamaStatus {
  connected: boolean;
  model_available: boolean;
  models: string[];
  error: string | null;
}

const { sessions, activeId, activeChat, ready: historyReady, error: historyError, initialize, createChat, selectChat, deleteChat, addMessage } = useChatHistory();
const status = ref<OllamaStatus | null>(null);
const isSending = ref(false);
const settingsOpen = ref(false);
const settingsReady = ref(false);
const settingsSaving = ref(false);
const settingsError = ref<string | null>(null);
const privacySettings = ref<PrivacySettings>({
  internetAccess: true,
  localServiceAccess: true,
  microphoneAccess: true,
  selectedFileAccess: false,
});

async function loadPrivacySettings() {
  try {
    privacySettings.value = await invoke<PrivacySettings>("get_privacy_settings");
  } catch (error) {
    privacySettings.value = {
      internetAccess: false,
      localServiceAccess: false,
      microphoneAccess: false,
      selectedFileAccess: false,
    };
    settingsError.value = `Could not load privacy settings: ${String(error)}`;
  } finally {
    settingsReady.value = true;
  }
}

async function savePrivacySettings(next: PrivacySettings) {
  settingsSaving.value = true;
  settingsError.value = null;
  try {
    await invoke("save_privacy_settings", { settings: next });
    privacySettings.value = next;
    settingsOpen.value = false;
    if (next.localServiceAccess) await checkConnection();
    else {
      status.value = {
        connected: false,
        model_available: false,
        models: [],
        error: "Local Ollama access is disabled in Privacy settings",
      };
    }
  } catch (error) {
    settingsError.value = `Could not save privacy settings: ${String(error)}`;
  } finally {
    settingsSaving.value = false;
  }
}

async function checkConnection() {
  if (!privacySettings.value.localServiceAccess) {
    status.value = {
      connected: false,
      model_available: false,
      models: [],
      error: "Local Ollama access is disabled in Privacy settings",
    };
    return;
  }
  try {
    status.value = await invoke<OllamaStatus>("check_ollama");
  } catch (error) {
    status.value = {
      connected: false,
      model_available: false,
      models: [],
      error: String(error),
    };
  }
}

async function sendMessage(text: string) {
  if (isSending.value) return;
  // Capture the target before awaiting Ollama so the reply stays in the chat that sent it.
  const chatId = activeId.value ?? createChat();
  const userMessage: ChatMessage = { role: "user", content: text, createdAt: Date.now() };
  // Store the prompt first, so it remains in history even if Ollama is offline or errors.
  addMessage(chatId, userMessage);
  isSending.value = true;

  try {
    if (!privacySettings.value.localServiceAccess) {
      addMessage(chatId, {
        role: "assistant",
        content: "Local Ollama access is turned off. Enable it in Privacy settings to send this conversation.",
        createdAt: Date.now(),
      });
      return;
    }
    if (!status.value?.connected || !status.value.model_available) await checkConnection();

    if (!status.value?.connected) {
      addMessage(chatId, {
        role: "assistant",
        content: `Ollama is not connected. Start Ollama and try again.${status.value?.error ? ` (${status.value.error})` : ""}`,
        createdAt: Date.now(),
      });
      return;
    }

    if (!status.value.model_available) {
      addMessage(chatId, {
        role: "assistant",
        content: "Model qwen3:1.7b was not found. Run: ollama pull qwen3:1.7b",
        createdAt: Date.now(),
      });
      return;
    }

    const messages = sessions.value.find((session) => session.id === chatId)?.messages ?? [];
    const requestMessages = messages.map(({ role, content }) => ({ role, content }));
    const response = await invoke<string>("ollama_chat", {
      messages: requestMessages,
    });
    addMessage(chatId, {
      role: "assistant",
      content: response || "The AI did not return a response.",
      createdAt: Date.now(),
    });
  } catch (error) {
    addMessage(chatId, {
      role: "assistant",
      content: `Request failed: ${String(error)}`,
      createdAt: Date.now(),
    });
  } finally {
    isSending.value = false;
  }
}

onMounted(() => {
  void initialize();
  void loadPrivacySettings().then(() => checkConnection());
});
</script>

<template>
  <main class="app-shell">
    <ChatHistory
      :sessions="sessions"
      :active-id="activeId"
      :disabled="isSending || !historyReady || !settingsReady || !!historyError"
      :storage-error="historyError"
      @create="createChat"
      @select="selectChat"
      @remove="deleteChat"
      @settings="settingsOpen = true"
    />
    <ChatConversation
      :messages="activeChat?.messages ?? []"
      :busy="isSending"
      :disabled="!historyReady || !settingsReady || !!historyError"
      :connected="status?.connected ?? null"
      :model-available="status?.model_available ?? null"
      :internet-access="privacySettings.internetAccess"
      :microphone-access="privacySettings.microphoneAccess"
      :selected-file-access="privacySettings.selectedFileAccess"
      :settings-ready="settingsReady"
      @send="sendMessage"
    />
    <PrivacySettingsDialog
      v-if="settingsOpen"
      :settings="privacySettings"
      :saving="settingsSaving"
      :error="settingsError"
      @save="savePrivacySettings"
      @close="settingsOpen = false; settingsError = null"
    />
  </main>
</template>

<style>
:root {
  font-family: Inter, "Segoe UI", sans-serif;
  color: #e9eaf0;
  background: #101116;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 360px; min-height: 100vh; background: #101116; }
button, textarea { font: inherit; }
button { color: inherit; }

.app-shell {
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 520px;
  overflow: hidden;
  background: #101116;
}

.sidebar {
  display: flex;
  flex: 0 0 270px;
  flex-direction: column;
  min-width: 0;
  padding: 22px 14px 14px;
  background: #17181f;
  border-right: 1px solid #292a33;
}
.sidebar-brand { display: flex; align-items: center; gap: 11px; padding: 0 8px 25px; }
.brand-icon { display: block; flex: 0 0 38px; width: 38px; height: 38px; border-radius: 11px; object-fit: cover; }
.sidebar-brand strong, .sidebar-brand span { display: block; }
.sidebar-brand strong { font-size: 13px; }
.sidebar-brand span { margin-top: 3px; color: #858797; font-size: 11px; }
.new-chat { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; min-height: 42px; border: 1px solid #3a3b48; border-radius: 11px; background: #242630; cursor: pointer; font-size: 12px; font-weight: 600; }
.new-chat:hover:not(:disabled) { background: #2c2e3a; }
.new-chat span { font-size: 19px; line-height: 1; }
.privacy-trigger { display: flex; align-items: center; gap: 9px; width: 100%; margin-top: 8px; padding: 10px 11px; border: 1px solid transparent; border-radius: 9px; background: transparent; color: #aeb1bf; text-align: left; font-size: 11px; cursor: pointer; }
.privacy-trigger:hover { border-color: #343643; background: #23252e; color: #e0e1e8; }
.privacy-trigger span { color: #9eadd0; }
.privacy-trigger:disabled { opacity: .45; cursor: not-allowed; }
button:disabled { opacity: .5; cursor: not-allowed; }
.history-heading { display: flex; justify-content: space-between; align-items: center; margin: 28px 8px 10px; color: #858797; font-size: 9px; font-weight: 700; letter-spacing: .12em; }
.history-count { display: grid; min-width: 20px; height: 18px; place-items: center; padding: 0 5px; border-radius: 6px; background: #252630; color: #b2b4c1; letter-spacing: 0; }
.history-list { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
.empty-history { padding: 13px 9px; color: #717382; font-size: 11px; line-height: 1.6; }
.storage-error { margin: 12px 2px 0; padding: 9px; border: 1px solid #754b35; border-radius: 8px; background: #2b211d; color: #efad73; font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.history-item { display: flex; align-items: center; min-width: 0; border: 1px solid transparent; border-radius: 9px; }
.history-item.active { border-color: #343643; background: #23252e; }
.history-select { display: flex; flex: 1; flex-direction: column; gap: 5px; min-width: 0; padding: 10px 9px; border: 0; background: transparent; text-align: left; cursor: pointer; }
.history-title { overflow: hidden; color: #d0d1d9; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.history-date { color: #777987; font-size: 9px; }
.delete-chat { width: 28px; height: 30px; margin-right: 4px; border: 0; border-radius: 7px; background: transparent; color: #858797; font-size: 19px; cursor: pointer; }
.delete-chat:hover:not(:disabled) { background: #39303a; color: #ff9a9a; }
.sidebar-footnote { margin-top: auto; padding: 12px 8px 2px; border-top: 1px solid #292a33; color: #737582; font-size: 10px; }

.conversation { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.conversation-header { display: flex; flex: 0 0 76px; align-items: center; justify-content: space-between; gap: 12px; padding: 0 30px; border-bottom: 1px solid #292a33; }
.eyebrow { color: #838797; font-size: 9px; font-weight: 700; letter-spacing: .14em; }
.conversation-header h1 { margin: 5px 0 0; color: #e9eaf0; font-size: 14px; font-weight: 650; }
.connection { display: flex; align-items: center; gap: 8px; color: #e5aa75; font-size: 10px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #db9659; }
.connection.online { color: #71d1a2; }
.connection.online .dot { background: #71d1a2; box-shadow: 0 0 9px #71d1a277; }
.messages { flex: 1; overflow-y: auto; padding: 35px max(24px, calc((100% - 790px) / 2)); }
.welcome { display: flex; min-height: 100%; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.welcome-icon { display: block; width: 64px; height: 64px; margin-bottom: 12px; border: 1px solid #3b4660; border-radius: 18px; object-fit: cover; }
.welcome h2 { margin: 12px 0 7px; font-size: 21px; font-weight: 600; }
.welcome p { margin: 5px 0; color: #9598a6; font-size: 12px; }
.message { display: flex; gap: 12px; margin: 0 0 24px; }
.avatar { display: grid; flex: 0 0 32px; width: 32px; height: 32px; place-items: center; border-radius: 10px; background: #2d3a55; color: #c5d5ff; font-size: 10px; font-weight: 700; }
.avatar img { width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
.message.user .avatar { background: #40374e; color: #decaff; }
.message-body { min-width: 0; padding-top: 2px; }
.message-label { display: block; margin-bottom: 6px; color: #b5bfd3; font-size: 10px; font-weight: 700; }
.message-text { color: #e0e1e8; font-size: 13px; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
.typing { display: flex; align-items: center; gap: 4px; color: #8c92a2; font-size: 11px; }
.typing i { width: 4px; height: 4px; border-radius: 50%; background: #9ba8c3; animation: pulse 1s infinite alternate; }
.typing i:nth-child(2) { animation-delay: .2s; }.typing i:nth-child(3) { margin-right: 4px; animation-delay: .4s; }
@keyframes pulse { to { opacity: .25; transform: translateY(-2px); } }
.composer-area { padding: 16px 24px 14px; }
.composer { display: flex; align-items: flex-end; gap: 12px; max-width: 790px; margin: 0 auto; padding: 11px 12px 11px 16px; border: 1px solid #393b47; border-radius: 15px; background: #191a21; }
.composer:focus-within { border-color: #596a91; box-shadow: 0 0 0 3px #52658a1c; }
.composer textarea { flex: 1; min-width: 0; max-height: 140px; min-height: 28px; resize: vertical; padding: 5px 0; border: 0; outline: 0; background: transparent; color: #f0f0f4; font-size: 12px; line-height: 1.6; }
.composer textarea::placeholder { color: #777b89; }
.send-button { display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center; border: 0; border-radius: 10px; background: #5679c4; color: white; font-size: 20px; cursor: pointer; }
.send-button:disabled { opacity: .35; cursor: not-allowed; }
.file-picker { display: none; }
.attach-button { display: grid; flex: 0 0 30px; width: 30px; height: 30px; place-items: center; border: 1px solid #3a3d4a; border-radius: 8px; background: #242630; color: #b8c5e1; font-size: 19px; cursor: pointer; }
.attach-button:disabled { opacity: .4; cursor: not-allowed; }
.attached-file { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; max-width: 790px; margin: 8px auto 0; padding: 8px 9px; border: 1px solid #3a3d4a; border-radius: 7px; color: #acb9d6; font-size: 10px; }
.attached-file-details { min-width: 0; }
.attached-file-details strong { display: block; overflow-wrap: anywhere; }
.attached-file-details ul { max-height: 90px; overflow: auto; margin: 5px 0; padding-left: 16px; color: #969bad; }
.attached-file-details li { padding: 2px 0; overflow-wrap: anywhere; }
.attached-file-details small { color: #777d8f; font-size: 9px; }
.attached-file button { border: 0; background: transparent; color: #bbbcca; cursor: pointer; }
.composer-hint { display: flex; justify-content: space-between; max-width: 790px; margin: 8px auto 0; color: #737684; font-size: 9px; }

@media (max-width: 700px) {
  .sidebar { flex-basis: 205px; padding-right: 10px; padding-left: 10px; }
  .conversation-header { padding: 0 16px; }
  .messages { padding-right: 16px; padding-left: 16px; }
}
@media (max-width: 520px) {
  .app-shell { min-height: 480px; }
  .sidebar { flex-basis: 62px; align-items: center; padding: 14px 6px; }
  .sidebar-brand { justify-content: center; padding: 0 0 18px; }
  .sidebar-brand > div:last-child, .new-chat, .privacy-trigger { font-size: 0; }
  .new-chat { width: 42px; min-width: 42px; }
  .new-chat span { font-size: 20px; }
  .privacy-trigger { width: 42px; height: 42px; justify-content: center; padding: 0; }
  .privacy-trigger span { font-size: 15px; }
  .history-heading { justify-content: center; margin: 20px 0 9px; }
  .history-heading > span:first-child, .history-count, .history-date, .history-title, .delete-chat, .empty-history, .sidebar-footnote { display: none; }
  .history-item { width: 42px; justify-content: center; }
  .history-select { align-items: center; padding: 11px 4px; }
  .history-select::before { content: "•"; color: #a9c5ff; font-size: 22px; line-height: 12px; }
  .conversation-header { flex-basis: 68px; padding: 0 12px; }
  .conversation-header h1 { font-size: 12px; }
  .connection { gap: 5px; font-size: 8px; }
  .composer-area { padding: 12px 10px; }
  .composer-hint { font-size: 8px; }
}
</style>
