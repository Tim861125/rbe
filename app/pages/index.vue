<script setup lang="ts">
const { groups, total, loadError, refresh } = await useGroups()
</script>

<template>
  <!-- 一屏版面：手機由上而下（總人數→卡片 2×2→長條圖）；lg 起雙欄，左卡片右總數＋圖表 -->
  <div class="min-h-dvh bg-background text-foreground">
    <div class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-4 lg:px-6">
      <header class="flex items-center justify-between gap-4 border-b border-border py-3">
        <!-- 品牌橘標題（同 lunch-order site-brand） -->
        <h1 class="text-primary font-heading text-xl font-bold tracking-wide sm:text-2xl">小組報名人數統計</h1>
        <DarkModeToggle />
      </header>

      <main class="flex flex-1 flex-col gap-3 lg:grid lg:min-h-0 lg:content-center lg:grid-cols-[1.35fr_1fr] lg:gap-4">
        <TotalCard :total="total" class="order-1 lg:order-none lg:col-start-2 lg:row-start-1" />

        <section
          v-if="groups.length"
          aria-label="小組報名人數"
          class="anim-rise order-2 grid content-start grid-cols-2 gap-3 lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:gap-4"
        >
          <GroupCard v-for="group in groups" :key="group.key" :group="group" />
        </section>

        <div class="order-3 lg:order-none lg:col-start-2 lg:row-start-2">
          <RoughBarChart :data="groups" />
        </div>

        <div v-if="loadError" class="text-muted-foreground order-4 flex items-center gap-3 text-sm lg:col-start-1 lg:row-start-3">
          <span>小組名單載入失敗，請檢查網路後重試。</span>
          <button
            type="button"
            class="border-input hover:bg-accent/70 border px-3 py-1 text-foreground"
            @click="refresh()"
          >
            重新載入
          </button>
        </div>
        <p v-else-if="!groups.length" class="text-muted-foreground order-4 text-sm lg:col-start-1 lg:row-start-3">小組名單載入中…</p>
      </main>
    </div>
  </div>
</template>
