<script setup lang="ts">
import rough from 'roughjs'
import type { Options } from 'roughjs/bin/core'

// port 自 lunch-order rough/RoughFrame.vue：stroke 預設改 var(--foreground) 以相容深淺色
const props = withDefaults(defineProps<{
  shape?: 'rect' | 'line'
  fill?: string
  fillStyle?: 'hachure' | 'solid' | 'zigzag'
  stroke?: string
  roughness?: number
  seed?: number
}>(), {
  shape: 'rect', fillStyle: 'hachure', stroke: 'var(--foreground)', roughness: 1.2,
})

const host = ref<HTMLElement | null>(null)
const drawing = ref<SVGSVGElement | null>(null)
const drawn = ref(false)
const stableSeed = props.seed ?? Math.floor(Math.random() * 2_000_000_000)
let observer: ResizeObserver | undefined

function redraw() {
  if (!host.value || !drawing.value) return
  const { width, height } = host.value.getBoundingClientRect()
  if (width <= 0 || height <= 0) return
  drawing.value.replaceChildren()
  const renderer = rough.svg(drawing.value)
  const options: Options = {
    roughness: props.roughness, seed: stableSeed, stroke: props.stroke,
    strokeWidth: 1.5, fill: props.fill, fillStyle: props.fillStyle,
  }
  const drawable = props.shape === 'line'
    ? renderer.line(2, height / 2, Math.max(2, width - 2), height / 2, options)
    : renderer.rectangle(2, 2, Math.max(1, width - 4), Math.max(1, height - 4), options)
  drawing.value.appendChild(drawable)
  drawn.value = true
}

onMounted(() => {
  observer = new ResizeObserver(redraw)
  if (host.value) observer.observe(host.value)
  redraw()
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => [props.shape, props.fill, props.fillStyle, props.stroke, props.roughness], redraw)
</script>

<template>
  <div ref="host" class="rough-frame" :class="{ 'rough-frame--line': shape === 'line', 'is-drawn': drawn }">
    <svg ref="drawing" class="rough-frame__drawing" aria-hidden="true" />
    <div class="rough-frame__content"><slot /></div>
  </div>
</template>
