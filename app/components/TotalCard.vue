<script setup lang="ts">
defineProps<{ total: number }>()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="font-heading">目前總人數</CardTitle>
    </CardHeader>
    <CardContent>
      <p class="font-heading text-5xl font-semibold tabular-nums sm:text-6xl">{{ total }}</p>
    </CardContent>
  </Card>
</template>
