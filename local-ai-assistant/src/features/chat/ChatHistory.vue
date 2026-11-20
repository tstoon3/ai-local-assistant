<script setup lang="ts">
import type { ChatSession } from "./types";

defineProps<{
  sessions: ChatSession[];
  activeId: string | null;
  disabled?: boolean;
  storageError?: string | null;
}>();

const emit = defineEmits<{
  // The parent owns the data; this component only reports the user's choice.
  create: [];
  select: [id: string];
  remove: [id: string];
  settings: [];
}>();

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <img class="brand-icon" src="/erwin-icon.png" alt="" />
      <div>
        <strong>Erwin</strong>
        <span>AI Assistant</span>
      </div>
    </div>

    <button class="new-chat" :disabled="disabled" @click="emit('create')">
      <span aria-hidden="true">＋</span> New chat
    </button>

    <button class="privacy-trigger" :disabled="disabled" @click="emit('settings')">
      <span aria-hidden="true">⚙</span> Privacy & access
    </button>

    <div v-if="storageError" class="storage-error">{{ storageError }}</div>

    <div class="history-heading">
      <span>CHAT HISTORY</span>
      <span class="history-count">{{ sessions.length }}</span>
    </div>

    <nav class="history-list" aria-label="Chat history">
      <div v-if="sessions.length === 0" class="empty-history">
        Your conversations will appear here.
      </div>
      <div
        v-for="session in sessions"
        :key="session.id"
        class="history-item"
        :class="{ active: session.id === activeId }"
      >
        <button
          class="history-select"
          :disabled="disabled"
          :title="session.title"
          @click="emit('select', session.id)"
        >
          <span class="history-title">{{ session.title }}</span>
          <span class="history-date">{{ formatDate(session.updatedAt) }}</span>
        </button>
        <button
          class="delete-chat"
          :disabled="disabled"
          :aria-label="`Delete ${session.title}`"
          title="Delete chat"
          @click="emit('remove', session.id)"
        >
          ×
        </button>
      </div>
    </nav>

    <div class="sidebar-footnote">Saved on this device</div>
  </aside>
</template>
