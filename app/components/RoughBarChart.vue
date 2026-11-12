<script setup lang="ts">
import rough from 'roughjs'

// props 依 brief：data 順序即圖表順序（台北、中壢、新竹、台中），不得重排
const props = defineProps<{ data: Array<{ name: string; count: number }> }>()

const colorMode = useColorMode()
const canvasRef = ref<HTMLCanvasElement>()

// bar 高動畫進度 0→1（rAF grow-in），重繪情境（換色／resize）直接以 1 繪製
const ANIM_MS = 800
const PAD_X = 10
const LABEL_H = 24
const VALUE_H = 22
const TOP_H = 8
const MIN_PLOT_H = 140
const ASPECT = 0.45 // 高度 = 寬度 × 0.45，一屏版面下長條圖壓矮

let raf = 0
let observer: ResizeObserver | undefined

/** 從 CSS 變數取目前深／淺主題的實際顏色，rough.js 才能換色重繪 */
function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function drawCanvas(progress: number) {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const cssWidth = canvas.clientWidth
  if (!cssWidth || !props.data.length)
    return

  const cssHeight = Math.max(MIN_PLOT_H, Math.round(cssWidth * ASPECT)) + LABEL_H + VALUE_H + TOP_H
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  // 依實際寬度覆寫 CSS 近似高度
  canvas.style.height = `${cssHeight}px`

  const foreground = cssVar('--foreground')
  const fill = cssVar('--chart-4')
  const rc = rough.canvas(canvas)

  // 手繪外框（整個繪圖區）
  rc.rectangle(2, 2, cssWidth - 4, cssHeight - 4, {
    stroke: foreground,
    strokeWidth: 1.5,
    roughness: 1.8,
    seed: 7,
  })

  const plotTop = TOP_H
  const plotBottom = cssHeight - LABEL_H
  const plotHeight = plotBottom - plotTop
  const n = props.data.length
  const slot = (cssWidth - PAD_X * 2) / n
  const barWidth = slot * 0.6
  const maxCount = Math.max(...props.data.map(d => d.count), 1)
  // 最高 bar 只長到 plotHeight - VALUE_H：數值標籤才不會貼到手繪外框被裁
  const barScale = plotHeight - VALUE_H
  const font = getComputedStyle(document.body).fontFamily
  // seed 綁定 index：同一組的 bar 形狀在動畫與重繪間穩定
  props.data.forEach((item, i) => {
    const x = PAD_X + slot * i + (slot - barWidth) / 2
    const targetHeight = item.count / maxCount * barScale
    const height = targetHeight * progress
    const y = plotBottom - height
    if (height > 1) {
      rc.rectangle(x, y, barWidth, height, {
        fillStyle: 'hachure',
        fill,
        stroke: foreground,
        strokeWidth: 1.5,
        roughness: 1.8,
        seed: 42 + i,
      })
    }
    ctx.fillStyle = foreground
    ctx.textAlign = 'center'
    ctx.font = `600 14px ${font}`
    ctx.fillText(item.name, x + barWidth / 2, cssHeight - 8)
    ctx.font = `14px ${font}`
    ctx.fillText(String(item.count), x + barWidth / 2, y - 6)
  })
}

function cancelAnim() {
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}

function animateIn() {
  cancelAnim()
  const start = performance.now()
  const frame = (now: number) => {
    const t = Math.min((now - start) / ANIM_MS, 1)
    drawCanvas(1 - (1 - t) ** 3) // easeOutCubic
    if (t < 1)
      raf = requestAnimationFrame(frame)
    else
      raf = 0
  }
  raf = requestAnimationFrame(frame)
}

function redraw() {
  drawCanvas(1)
}

// 換深淺色：canvas 顏色來自當時抓取的 CSS 變數，必須重繪而非 CSS 切換
watch(() => colorMode.value, () => {
  if (canvasRef.value)
    redraw()
})

// data 變動（refresh 後人數更新）時重新長出
watch(() => props.data, () => {
  if (canvasRef.value)
    animateIn()
})

onMounted(() => {
  animateIn()
  // NaikaiFont 非同步載入：字体就緒後重繪一次，canvas 標字才用到手寫字
  document.fonts?.ready.then(() => {
    if (canvasRef.value)
      redraw()
  })
  if (canvasRef.value) {
    // canvas 寬度變動（RWD）時重繪；observer 回呼內改 canvas.height 不會重複觸發
    observer = new ResizeObserver(redraw)
    observer.observe(canvasRef.value)
  }
})

onBeforeUnmount(() => {
  cancelAnim()
  observer?.disconnect()
})
</script>

<template>
  <ClientOnly>
    <Card size="sm">
      <CardContent>
        <!-- h-[198px] 為防 FCP CLS 的近似高度（375px 手機寬的實際值）；JS 繪製時以 style.height 覆寫 -->
        <canvas
          ref="canvasRef"
          role="img"
          aria-label="各組報名人數長條圖"
          class="block h-[198px] w-full"
        />
      </CardContent>
    </Card>
    <template #fallback>
      <Card size="sm">
        <CardContent>
          <ul class="flex flex-col gap-1 text-sm text-muted-foreground">
            <li v-for="item in data" :key="item.name" class="flex justify-between">
              <span>{{ item.name }}</span>
              <span class="tabular-nums">{{ item.count }} 人</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>
  </ClientOnly>
</template>

