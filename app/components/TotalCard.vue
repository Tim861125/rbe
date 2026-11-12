<script setup lang="ts">
defineProps<{ total: number }>()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="font-heading">目前總人數</CardTitle>
    </CardHeader>
    <CardContent>
      <!-- 總數用強調橘（同 lunch-order 總金額的呈現） -->
      <p class="text-primary font-heading text-5xl font-bold tabular-nums sm:text-6xl">{{ total }}</p>
    </CardContent>
  </Card>
</template>
