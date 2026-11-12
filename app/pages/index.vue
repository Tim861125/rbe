<script setup lang="ts">
const { groups, total, loadError, refresh } = await useGroups()
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-12">
      <header class="flex items-center justify-between gap-4 border-b border-border py-4">
        <!-- 品牌橘标题（同 lunch-order site-brand） -->
        <h1 class="text-primary font-heading text-2xl font-bold tracking-wide sm:text-3xl">小組報名人數統計</h1>
        <DarkModeToggle />
      </header>

      <main class="flex flex-col gap-4">
        <section
          v-if="groups.length"
          aria-label="小組報名人數"
          class="anim-rise grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <GroupCard v-for="group in groups" :key="group.key" :group="group" />
        </section>
        <div v-if="loadError" class="flex items-center gap-3 text-sm text-muted-foreground">
          <span>小組名單載入失敗，請檢查網路後重試。</span>
          <button
            type="button"
            class="border-input hover:bg-accent/70 border px-3 py-1 text-foreground"
            @click="refresh()"
          >
            重新載入
          </button>
        </div>
        <p v-else-if="!groups.length" class="text-muted-foreground text-sm">小組名單載入中…</p>

        <TotalCard :total="total" />
        <RoughBarChart :data="groups" />
      </main>
    </div>
  </div>
</template>
