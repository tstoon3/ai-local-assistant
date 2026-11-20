import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, ChatSession } from "./types";

interface HistorySnapshot {
  sessions: ChatSession[];
  activeId: string | null;
}

const LEGACY_STORAGE_KEY = "local-ai-assistant.chat-history.v1";
// Keep one shared history store so every component observes the same active chat.
const sessions = ref<ChatSession[]>([]);
const activeId = ref<string | null>(null);
const ready = ref(false);
const error = ref<string | null>(null);
const activeChat = computed(
  () => sessions.value.find((session) => session.id === activeId.value) ?? null,
);
let persistQueue = Promise.resolve();

function snapshot(): HistorySnapshot {
  return JSON.parse(JSON.stringify({ sessions: sessions.value, activeId: activeId.value })) as HistorySnapshot;
}

function readLegacyHistory(): HistorySnapshot | null {
  // Import histories created by earlier app versions, which used localStorage.
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<HistorySnapshot>;
    if (!Array.isArray(saved.sessions)) return null;
    const validSessions = saved.sessions.filter(
      (session): session is ChatSession =>
        !!session && typeof session.id === "string" && typeof session.title === "string" && Array.isArray(session.messages),
    ).map((session) => ({
      ...session,
      updatedAt: Number(session.updatedAt) || Date.now(),
      messages: session.messages.map((message) => ({
        ...message,
        createdAt: Number(message.createdAt) || Number(session.updatedAt) || Date.now(),
      })),
    }));
    const validActiveId = validSessions.some((session) => session.id === saved.activeId)
      ? saved.activeId ?? null
      : validSessions[0]?.id ?? null;
    return { sessions: validSessions, activeId: validActiveId };
  } catch {
    return null;
  }
}

async function saveSnapshot(nextSnapshot = snapshot()) {
  await invoke("save_chat_history", { snapshot: nextSnapshot });
}

watch(
  [sessions, activeId],
  ([nextSessions, nextActiveId]) => {
    if (!ready.value) return;
    const nextSnapshot = JSON.parse(JSON.stringify({ sessions: nextSessions, activeId: nextActiveId })) as HistorySnapshot;
    // Serialize writes so a slower, older save cannot overwrite a newer edit.
    persistQueue = persistQueue
      .then(() => saveSnapshot(nextSnapshot))
      .then(() => { error.value = null; })
      .catch((reason: unknown) => { error.value = `Could not save chat history: ${String(reason)}`; });
  },
  { deep: true },
);

async function initialize() {
  error.value = null;
  try {
    const databaseHistory = await invoke<HistorySnapshot>("load_chat_history");
    // Only import the legacy copy when SQLite is empty; then remove it after a successful save.
    const legacyHistory = databaseHistory.sessions.length === 0 ? readLegacyHistory() : null;
    const initialHistory = legacyHistory ?? databaseHistory;
    sessions.value = initialHistory.sessions;
    activeId.value = initialHistory.activeId;

    if (legacyHistory) {
      await saveSnapshot(legacyHistory);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } else if (databaseHistory.sessions.length > 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    ready.value = true;
  } catch (reason) {
    error.value = `Could not open the local SQLite database: ${String(reason)}`;
    ready.value = true;
  }
}

function createChat() {
  const now = Date.now();
  const chat: ChatSession = {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    updatedAt: now,
  };
  sessions.value.unshift(chat);
  activeId.value = chat.id;
  return chat.id;
}

function selectChat(id: string) {
  if (sessions.value.some((session) => session.id === id)) activeId.value = id;
}

function deleteChat(id: string) {
  sessions.value = sessions.value.filter((session) => session.id !== id);
  if (activeId.value === id) activeId.value = sessions.value[0]?.id ?? null;
}

function addMessage(chatId: string, message: ChatMessage) {
  const chat = sessions.value.find((session) => session.id === chatId);
  if (!chat) return;
  chat.messages.push(message);
  chat.updatedAt = Date.now();
  // Use the first user prompt as a compact title for the history list.
  if (chat.title === "New chat" && message.role === "user") {
    chat.title = message.content.trim().replace(/\s+/g, " ").slice(0, 36) || "New chat";
  }
  sessions.value.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useChatHistory() {
  return { sessions, activeId, activeChat, ready, error, initialize, createChat, selectChat, deleteChat, addMessage };
}
