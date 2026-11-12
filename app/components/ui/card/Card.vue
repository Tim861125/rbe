<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from 'cn'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  size?: 'default' | 'sm'
}>(), {
  size: 'default',
})
</script>

<template>
  <!-- 手繪框卡片（同 lunch-order r-card）：框線由 RoughFrame 以 rough.js 繪製，取代 ring/rounded -->
  <div
    data-slot="card"
    :data-size="size"
    :class="cn('text-card-foreground group/card flex flex-col text-sm', props.class)"
  >
    <RoughFrame class="flex min-h-0 flex-1 flex-col">
      <div class="flex flex-1 flex-col gap-4 py-4 group-data-[size=sm]/card:gap-3 group-data-[size=sm]/card:py-3">
        <slot />
      </div>
    </RoughFrame>
  </div>
</template>
