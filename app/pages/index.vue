<script setup lang="ts">
const { groups, total } = await useGroups()
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-12">
      <header class="flex items-center justify-between py-4">
        <h1 class="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">小組報名人數統計</h1>
        <DarkModeToggle />
      </header>

      <main class="flex flex-col gap-4">
        <section
          v-if="groups.length"
          aria-label="小組報名人數"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <GroupCard v-for="group in groups" :key="group.key" :group="group" />
        </section>
        <p v-else class="text-sm text-muted-foreground">小組名單載入中…</p>

        <TotalCard :total="total" />
        <RoughBarChart :data="groups" />
      </main>
    </div>
  </div>
</template>
