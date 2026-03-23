<script setup lang="ts">
import { ref } from 'vue';
import { Key, Check, Trash2, X, Eye, EyeOff } from 'lucide-vue-next';

defineProps<{
  hasApiKey: boolean;
}>();

const emit = defineEmits<{
  save: [key: string];
  delete: [];
  close: [];
}>();

const keyInput = ref('');
const showKey = ref(false);
const isSaving = ref(false);

async function handleSave(): Promise<void> {
  if (!keyInput.value.trim()) return;
  isSaving.value = true;
  emit('save', keyInput.value.trim());
  keyInput.value = '';
  isSaving.value = false;
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
    @click.self="emit('close')"
  >
    <div
      class="bg-surface rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-border/50"
    >
      <div class="flex items-center justify-between px-7 py-5 border-b border-border/50">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Key :size="18" class="text-purple-500" />
          </div>
          <h3 class="text-lg font-bold text-text-1">Gemini API 설정</h3>
        </div>
        <button
          class="p-2 rounded-xl text-text-3 hover:bg-surface-mute hover:text-text-1 transition-all"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <div class="p-7">
        <div v-if="hasApiKey" class="space-y-4">
          <div
            class="flex items-center gap-3 px-4 py-3 rounded-xl bg-success/10 border border-success/20"
          >
            <Check :size="18" class="text-success" />
            <span class="text-sm font-semibold text-success">API 키가 설정되어 있습니다</span>
          </div>
          <button
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all"
            @click="emit('delete')"
          >
            <Trash2 :size="16" />
            API 키 삭제
          </button>
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-text-3 font-medium">
            텍스트 변환 기능을 사용하려면 Google Gemini API 키가 필요합니다.
          </p>
          <div class="relative">
            <input
              v-model="keyInput"
              :type="showKey ? 'text' : 'password'"
              placeholder="AIza..."
              class="w-full px-4 py-3 pr-12 rounded-xl bg-surface-mute border border-border/50 text-sm text-text-1 placeholder:text-text-3/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
              @keyup.enter="handleSave"
            />
            <button
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-3 hover:text-text-1 transition-colors"
              @click="showKey = !showKey"
            >
              <EyeOff v-if="showKey" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
          <button
            class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!keyInput.trim() || isSaving"
            @click="handleSave"
          >
            <Key :size="16" />
            저장
          </button>
          <p class="text-[11px] text-text-3/70 text-center">
            키는 기기에 암호화되어 저장되며 외부로 전송되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
