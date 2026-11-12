<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '.'
import { cn } from 'cn'
import { Primitive } from 'reka-ui'
import { buttonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
})

// 手繪框变體（同 lunch-order RButton）：primary 实色橘底、default 只有框线；文字类变体不加框
const framed = computed(() => (props.variant ?? 'default') === 'default' || props.variant === 'outline')
</script>

<template>
  <RoughFrame
    v-if="framed"
    :class="cn('frame-fill has-disabled:opacity-55', props.class)"
    :fill="variant !== 'outline' ? 'var(--primary)' : undefined"
    :fill-style="variant !== 'outline' ? 'solid' : 'hachure'"
    :roughness="1.4"
  >
    <Primitive
      data-slot="button"
      :data-variant="variant"
      :data-size="size"
      :as="as"
      :as-child="asChild"
      :class="cn(buttonVariants({ variant, size }), 'rounded-none')"
    >
      <slot />
    </Primitive>
  </RoughFrame>
  <Primitive
    v-else
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
