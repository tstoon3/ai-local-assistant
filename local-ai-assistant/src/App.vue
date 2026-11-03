
<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { invoke } from "@tauri-apps/api/core";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OllamaStatus {
  connected: boolean;
  model_available: boolean;
  models: string[];
  error: string | null;
}

const messages = ref<ChatMessage[]>([]);
const input = ref("");
const isSending = ref(false);
const status = ref<OllamaStatus | null>(null);
const chatContainer = ref<HTMLElement | null>(null);

async function checkConnection() {
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

async function scrollToBottom() {
  await nextTick();

  if (chatContainer.value) {
    chatContainer.value.scrollTop =
      chatContainer.value.scrollHeight;
  }
}

async function sendMessage() {
  const text = input.value.trim();

  if (!text || isSending.value) return;

  if (!status.value?.connected) {
    await checkConnection();
  }

  if (!status.value?.connected) return;

  if (!status.value.model_available) {
    messages.value.push({
      role: "assistant",
      content: "ไม่พบโมเดล qwen3:1.7b ใน Ollama",
    });
    return;
  }

  messages.value.push({
    role: "user",
    content: text,
  });

  input.value = "";
  isSending.value = true;

  await scrollToBottom();

  try {
    const history = messages.value.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const response = await invoke<string>("ollama_chat", {
      messages: history,
    });

    messages.value.push({
      role: "assistant",
      content: response || "AI ไม่ได้ส่งข้อความตอบกลับ",
    });
  } catch (error) {
    messages.value.push({
      role: "assistant",
      content: `เกิดข้อผิดพลาด: ${String(error)}`,
    });
  } finally {
    isSending.value = false;
    await scrollToBottom();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

onMounted(() => {
  checkConnection();
});
</script>

<template>
  <main class="app">
    <header class="header">
      <div class="brand">
        <div class="brand-icon">AI</div>
        <div>
          <h1>Local AI Assistant</h1>
          <p>Private AI running on your device</p>
        </div>
      </div>

      <div
        class="connection"
        :class="{ online: status?.connected && status?.model_available }"
      >
        <span class="dot"></span>
        {{
          status?.connected
            ? status.model_available
              ? "Ollama Connected"
              : "Model Not Found"
            : "Disconnected"
        }}
      </div>
    </header>

    <section class="chat" ref="chatContainer">
      <div v-if="messages.length === 0" class="welcome">
        <div class="welcome-icon">✦</div>
        <h2>สวัสดีครับ</h2>
        <p>ผมคือ Local AI Assistant ของคุณ</p>
        <p class="hint">
          เริ่มต้นสนทนากับ Qwen 3 ได้เลย
        </p>
      </div>

      <div
        v-for="(message, index) in messages"
        :key="index"
        class="message"
        :class="message.role"
      >
        <div class="avatar">
          {{ message.role === "user" ? "คุณ" : "AI" }}
        </div>

        <div class="message-content">
          <span class="message-label">
            {{ message.role === "user" ? "You" : "Assistant" }}
          </span>
          <div class="message-text">{{ message.content }}</div>
        </div>
      </div>

      <div v-if="isSending" class="message assistant">
        <div class="avatar">AI</div>
        <div class="message-content">
          <span class="message-label">Assistant</span>
          <div class="typing">กำลังคิด...</div>
        </div>
      </div>
    </section>

    <footer class="composer">
      <div class="input-wrapper">
        <textarea
          v-model="input"
          placeholder="พิมพ์ข้อความที่ต้องการถาม..."
          rows="1"
          :disabled="isSending"
          @keydown="handleKeydown"
        ></textarea>

        <button
          class="send-button"
          :disabled="!input.trim() || isSending"
          @click="sendMessage"
        >
          ➤
        </button>
      </div>

      <div class="footer-info">
        <span>Qwen 3 · 1.7B</span>
        <span>Local Processing · Offline First</span>
      </div>
    </footer>
  </main>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Segoe UI", "Noto Sans Thai", sans-serif;
  background: #111318;
  color: #e8eaf0;
}

button,
textarea {
  font: inherit;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 400px;
  background: #111318;
}

.header {
  height: 76px;
  padding: 0 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #292c35;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon,
.avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #28334a;
  color: #a9c5ff;
  font-weight: 700;
}

.brand h1 {
  font-size: 15px;
  margin: 0;
}

.brand p {
  margin: 4px 0 0;
  color: #858b9a;
  font-size: 11px;
}

.connection {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #efad73;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e59b53;
}

.connection.online {
  color: #65d6a0;
}

.connection.online .dot {
  background: #65d6a0;
}

.chat {
  flex: 1;
  overflow-y: auto;
  padding: 28px max(24px, calc((100% - 850px) / 2));
}

.welcome {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.welcome-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 22px;
  background: #27334a;
  color: #a9c5ff;
  font-size: 32px;
}

.welcome h2 {
  margin: 20px 0 8px;
  font-size: 24px;
}

.welcome p {
  color: #b1b6c2;
  margin: 4px;
}

.welcome .hint {
  color: #777f91;
  font-size: 13px;
  margin-top: 12px;
}

.message {
  display: flex;
  gap: 14px;
  margin-bottom: 28px;
}

.message.user .avatar {
  background: #3b3651;
  color: #d0baff;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  margin: 2px 0 8px;
  color: #aebbd2;
}

.message-text {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.typing {
  color: #9ba5b7;
  font-size: 13px;
}

.composer {
  padding: 18px 24px 12px;
  border-top: 1px solid #292c35;
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  max-width: 850px;
  margin: auto;
  padding: 12px;
  border: 1px solid #3a3e4b;
  background: #1a1d25;
  border-radius: 16px;
}

.input-wrapper textarea {
  flex: 1;
  min-width: 0;
  resize: vertical;
  max-height: 120px;
  min-height: 32px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #fff;
  padding: 7px;
  font-size: 14px;
}

.input-wrapper textarea::placeholder {
  color: #737b8b;
}

.send-button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: #547bd1;
  color: white;
  cursor: pointer;
}

.send-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.footer-info {
  max-width: 850px;
  margin: 10px auto 0;
  display: flex;
  justify-content: space-between;
  color: #72798a;
  font-size: 10px;
}

@media (max-width: 600px) {
  .header {
    padding: 0 14px;
  }

  .connection {
    font-size: 10px;
  }

  .composer {
    padding: 12px;
  }
}
</style>
