<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

function toggle() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly fallback-tag="span">
    <Button
      variant="outline"
      size="icon"
      :aria-label="isDark ? '切換至淺色模式' : '切換至深色模式'"
      @click="toggle"
    >
      <Sun v-if="isDark" />
      <Moon v-else />
    </Button>
    <template #fallback>
      <Button variant="outline" size="icon" aria-label="切換深色模式" disabled>
        <Sun />
      </Button>
    </template>
  </ClientOnly>
</template>
