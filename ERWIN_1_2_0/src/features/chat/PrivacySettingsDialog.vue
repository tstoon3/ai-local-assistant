<script setup lang="ts">
import { ref, watch } from "vue";
import type { PrivacySettings } from "./types";

const props = defineProps<{
  settings: PrivacySettings;
  saving: boolean;
  error: string | null;
}>();
const emit = defineEmits<{
  save: [settings: PrivacySettings];
  close: [];
}>();

const draft = ref<PrivacySettings>({ ...props.settings });
watch(() => props.settings, (settings) => { draft.value = { ...settings }; }, { deep: true });

function save() {
  emit("save", { ...draft.value });
}

</script>

<template>
  <div class="privacy-backdrop" role="presentation" @click.self="emit('close')">
    <section class="privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
      <button class="privacy-close" aria-label="Close privacy settings" @click="emit('close')">×</button>
      <span class="eyebrow">ERWIN / PRIVACY</span>
      <h2 id="privacy-title">Access and permissions</h2>
      <p class="privacy-intro">Choose which connections and device features Erwin can use.</p>

      <label class="setting-row">
        <span><strong>Internet access for Whisper downloads</strong><small>This only allows downloading the speech-recognition model. Chat and local-file reading do not search or send data to the internet. Turn it off after the model is cached to use voice offline.</small></span>
        <input v-model="draft.internetAccess" type="checkbox" />
      </label>
      <label class="setting-row">
        <span><strong>Local AI service (Ollama)</strong><small>Allow chat requests to Ollama at 127.0.0.1 on this device.</small></span>
        <input v-model="draft.localServiceAccess" type="checkbox" />
      </label>
      <label class="setting-row">
        <span><strong>Microphone</strong><small>Allow voice chat to request microphone access. Windows may also ask for permission.</small></span>
        <input v-model="draft.microphoneAccess" type="checkbox" />
      </label>
      <label class="setting-row">
        <span><strong>User-selected files and folders</strong><small>Allow choosing one supported text/source file (up to 64 KB) or a folder (up to 40 files, 80 KB total). Hidden files, binary files, dependencies, and build folders are skipped. Selected contents go only to local Ollama and are saved in chat history.</small></span>
        <input v-model="draft.selectedFileAccess" type="checkbox" />
      </label>

      <p class="privacy-note">Erwin's private SQLite database remains available so chat history and these settings can be saved. File access only applies to files you choose explicitly.</p>
      <p v-if="error" class="privacy-error" role="alert">{{ error }}</p>
      <div class="privacy-actions">
        <button class="privacy-cancel" :disabled="saving" @click="emit('close')">Cancel</button>
        <button class="privacy-save" :disabled="saving" @click="save">{{ saving ? "Saving…" : "Save settings" }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.privacy-backdrop { position: fixed; z-index: 20; inset: 0; display: grid; place-items: center; padding: 18px; background: #08090dcc; backdrop-filter: blur(8px); }
.privacy-dialog { position: relative; width: min(540px, 100%); padding: 30px; border: 1px solid #383a47; border-radius: 18px; background: #191a22; box-shadow: 0 25px 80px #0009; }
.privacy-close { position: absolute; top: 14px; right: 15px; width: 32px; height: 32px; border: 1px solid #41424d; border-radius: 50%; background: #252630; color: #c7c8d1; font-size: 21px; cursor: pointer; }
.eyebrow { color: #858b9c; font-size: 9px; font-weight: 700; letter-spacing: .14em; }
h2 { margin: 9px 0 5px; font-size: 20px; font-weight: 620; }
.privacy-intro { margin: 0 0 18px; color: #9295a3; font-size: 11px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 0; border-top: 1px solid #30313c; cursor: pointer; }
.setting-row strong, .setting-row small { display: block; }
.setting-row strong { color: #e0e1e8; font-size: 12px; }
.setting-row small { max-width: 410px; margin-top: 4px; color: #898c9a; font-size: 10px; line-height: 1.5; }
.setting-row input { flex: 0 0 auto; width: 17px; height: 17px; accent-color: #718fd0; }
.privacy-note { margin: 14px 0 0; color: #7f8391; font-size: 10px; line-height: 1.5; }
.privacy-error { margin: 12px 0 0; color: #efad73; font-size: 11px; }
.privacy-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 23px; }
.privacy-cancel, .privacy-save { padding: 9px 14px; border: 1px solid #41424d; border-radius: 8px; background: #252630; font-size: 10px; cursor: pointer; }
.privacy-save { border-color: #597cc6; background: #597cc6; color: #fff; }
.privacy-actions button:disabled { opacity: .55; cursor: not-allowed; }
@media (max-width: 500px) { .privacy-dialog { padding: 25px 20px 20px; } .setting-row { gap: 12px; } }
</style>
