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
  { value: '5', label: '+5' },
  { value: '10', label: '+10' },
  { value: '-5', label: '−5' },
  { value: '-10', label: '−10' },
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
 * pending 的清理由呼叫端決定（± pending 在成功後歸零；快速選單不動 pending）。
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

/** 快速選單：選後立即送出該數額，不合併 pending；送完回到 placeholder */
function onQuickChange(value: string | undefined) {
  if (!value || isSubmitting.value)
    return
  const amount = Number(value)
  if (Number.isNaN(amount) || amount === 0)
    return
  void applySubmit(amount)
}
</script>

<template>
  <Card class="h-full">
    <CardHeader>
      <CardTitle class="font-heading text-xl">{{ group.name }}</CardTitle>
      <CardDescription>目前人數</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex flex-col items-center gap-1">
        <span
          class="font-heading text-5xl leading-none font-semibold tabular-nums"
          :class="pending < 0 ? 'text-destructive' : ''"
        >{{ pending !== 0 ? previewCount : group.count }}</span>
        <p
          v-if="pending !== 0"
          role="status"
          class="text-sm"
          :class="pending > 0 ? 'text-primary' : 'text-destructive'"
        >
          暫存 {{ pendingText }}，送出後生效
        </p>
      </div>

      <div class="flex items-stretch gap-2">
        <Button
          variant="outline"
          size="lg"
          class="min-h-[44px] min-w-[44px] flex-1 text-lg active:scale-[0.97] active:translate-y-px"
          aria-label="減 1 人"
          :disabled="isSubmitting"
          @click="updatePending(-1)"
        >
          −
        </Button>
        <Button
          variant="outline"
          size="lg"
          class="min-h-[44px] min-w-[44px] flex-1 text-lg active:scale-[0.97] active:translate-y-px"
          aria-label="加 1 人"
          :disabled="isSubmitting"
          @click="updatePending(1)"
        >
          ＋
        </Button>
      </div>

      <Select :model-value="undefined" :disabled="isSubmitting" @update:model-value="onQuickChange">
        <SelectTrigger
          class="min-h-[44px] w-full"
          aria-label="快速調整人數"
        >
          <SelectValue placeholder="快速調整（選後立即送出）" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in quickOptions"
            :key="option.value"
            :value="option.value"
            class="min-h-[44px]"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        size="lg"
        class="min-h-[44px] w-full text-base active:scale-[0.98] active:translate-y-px"
        :disabled="pending === 0 || isSubmitting"
        @click="sendPending"
      >
        <Loader2 v-if="isSubmitting" class="animate-spin" />
        <template v-if="pending === 0">送出</template>
        <template v-else>送出 {{ pendingText }}</template>
      </Button>
    </CardContent>
  </Card>
</template>
