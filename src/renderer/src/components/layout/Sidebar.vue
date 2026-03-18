<script setup lang="ts">
import { Sun, Moon, Book, LogIn, Key } from 'lucide-vue-next'
import { useTheme } from '../../composables/useTheme'

defineProps<{
  isLoggedIn: boolean
  hasApiKey: boolean
}>()

const emit = defineEmits<{
  login: []
  openSettings: []
}>()

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <aside class="w-64 border-r border-border/50 bg-surface-soft flex flex-col transition-colors duration-200 h-full">
    <div class="p-8 flex items-center gap-4">
      <div class="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold shadow-sm">
        S
      </div>
      <h1 class="text-xl font-extrabold text-text-1 tracking-tight">숭실 다운로더</h1>
    </div>

    <nav class="flex-1 px-5 py-4 flex flex-col gap-2">
      <div class="px-3 py-2 text-[11px] font-bold text-text-3 uppercase tracking-[0.1em] mb-2 opacity-70">
        Main Menu
      </div>
      
      <button class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold bg-primary/10 text-primary transition-all shadow-sm shadow-primary/5">
        <Book :size="19" />
        내 강의 목록
      </button>

      <button
        class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium text-text-2 hover:bg-surface-mute hover:text-text-1 transition-all"
        @click="emit('openSettings')"
      >
        <Key :size="19" :class="hasApiKey ? 'text-purple-500' : ''" />
        <span class="flex-1 text-left">Gemini API 설정</span>
        <span v-if="hasApiKey" class="w-2 h-2 rounded-full bg-success"></span>
      </button>
    </nav>

    <div class="p-6 border-t border-border/50 flex flex-col gap-3">
      <button
        v-if="!isLoggedIn"
        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-hover shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        @click="emit('login')"
      >
        <LogIn :size="16" />
        LMS 로그인
      </button>
      <div v-else class="px-4 py-2.5 rounded-lg text-sm font-medium bg-success/10 text-success text-center border border-success/20">
        로그인 됨
      </div>

      <button
        class="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium text-text-2 hover:bg-surface-mute hover:text-text-1 transition-all"
        @click="toggleTheme"
      >
        <span class="flex items-center gap-2">
          <Moon v-if="isDark" :size="16" />
          <Sun v-else :size="16" />
          {{ isDark ? '라이트 모드' : '다크 모드' }}
        </span>
      </button>
    </div>
  </aside>
</template>
