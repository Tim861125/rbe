<script setup lang="ts">
import { Users } from 'lucide-vue-next'

defineProps<{ total: number }>()
</script>

<template>
  <!-- 一屏版面：人物圖示＋強調橘大數字即可自明是總人數（同 lunch-order 總金額的呈現），不放文字標題 -->
  <Card size="sm">
    <CardContent class="flex items-center justify-center gap-2.5">
      <Users class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span
        role="status"
        aria-label="目前總人數"
        class="text-primary font-heading text-4xl leading-none font-bold tabular-nums"
      >{{ total }}</span>
    </CardContent>
  </Card>
</template>
