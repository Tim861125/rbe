<script setup lang="ts">
import type { Group } from '~/composables/useGroups'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

// props 介面依 brief：只有 group；refresh/submit 來自 useGroups（useAsyncData 同 key 共用）
const props = defineProps<{ group: Group }>()

const { refresh, submit } = await useGroups()

const pending = ref(0)
const isSubmitting = ref(false)

const quickOptions = [
  { amount: 10, label: '+10' },
  { amount: 5, label: '+5' },
  { amount: -5, label: '−5' },
  { amount: -10, label: '−10' },
]

const previewCount = computed(() => props.group.count + pending.value)
const pendingText = computed(() =>
  pending.value > 0 ? `+${pending.value}` : `−${Math.abs(pending.value)}`,
)

function updatePending(delta: number) {
  pending.value += delta
}

/**
 * 共用送出流程：成功 → refresh() 並回 true；失敗 → toast 顯示 API 錯誤。
 * pending 的清理由呼叫端決定（± 在成功後歸零；快速按鈕不動 pending）。
 */
async function applySubmit(amount: number): Promise<boolean> {
  if (isSubmitting.value)
    return false
  isSubmitting.value = true
  try {
    const res = await submit(props.group.key, amount)
    if (res.ok) {
      await refresh()
      if (amount > 0)
        toast.success('已更新並公告')
      else
        toast.info('已更新（不對外公告）')
      return true
    }
    toast.error(res.error ?? '更新失敗，請稍後再試')
    return false
  }
  catch {
    toast.error('連線失敗，請稍後再試')
    return false
  }
  finally {
    isSubmitting.value = false
  }
}

async function sendPending() {
  if (pending.value === 0 || isSubmitting.value)
    return
  const ok = await applySubmit(pending.value)
  if (ok)
    pending.value = 0
}

/** 快速按鈕：點了立即送出該數額，不合併 pending */
function onQuickSubmit(amount: number) {
  if (!amount || isSubmitting.value)
    return
  void applySubmit(amount)
}
</script>

<template>
  <Card size="sm" class="h-full">
    <!-- 一屏版面：組名與人數同行，數字顏色即暫存狀態（橘=加、紅=減），不放說明文字 -->
    <CardHeader class="grid-flow-col items-center">
      <CardTitle class="font-heading truncate text-base leading-none">{{ group.name }}</CardTitle>
      <CardAction class="self-center">
        <span
          role="status"
          class="font-heading text-3xl leading-none font-semibold tabular-nums"
          :class="pending > 0 ? 'text-primary' : pending < 0 ? 'text-destructive' : ''"
        >{{ previewCount }}</span>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-2">
      <div class="flex items-stretch gap-2">
        <Button
          variant="outline"
          size="icon"
          class="active:scale-[0.97] active:translate-y-px"
          aria-label="減 1 人"
          :disabled="isSubmitting"
          @click="updatePending(-1)"
        >
          −
        </Button>
        <Button
          class="min-w-0 flex-1 active:scale-[0.98] active:translate-y-px"
          :disabled="pending === 0 || isSubmitting"
          @click="sendPending"
        >
          <Loader2 v-if="isSubmitting" class="animate-spin" />
          <template v-if="pending === 0">送出</template>
          <template v-else>送出 {{ pendingText }}</template>
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="active:scale-[0.97] active:translate-y-px"
          aria-label="加 1 人"
          :disabled="isSubmitting"
          @click="updatePending(1)"
        >
          ＋
        </Button>
      </div>

      <div class="flex items-center gap-1">
        <Button
          v-for="option in quickOptions"
          :key="option.amount"
          variant="ghost"
          size="sm"
          class="min-w-0 flex-1 px-0 tabular-nums text-muted-foreground"
          :class="option.amount < 0 ? 'text-destructive/70' : ''"
          :aria-label="option.amount > 0 ? `立即增加 ${option.amount} 人` : `立即減少 ${Math.abs(option.amount)} 人`"
          :disabled="isSubmitting"
          @click="onQuickSubmit(option.amount)"
        >
          {{ option.label }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
