import { ref, onMounted, type Ref } from 'vue';

const isDark = ref(false);

interface UseThemeReturn {
  isDark: Ref<boolean>;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeReturn {
  function applyTheme(): void {
    if (isDark.value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function toggleTheme(): void {
    isDark.value = !isDark.value;
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
    applyTheme();
  }

  onMounted(() => {
    const saved = localStorage.getItem('theme');
    isDark.value = saved === 'dark';
    applyTheme();
  });

  return { isDark, toggleTheme };
}
