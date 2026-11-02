<script setup lang="ts">
//THE HEAD OF A HOME SECTION: an uppercase tracked title followed by a hairline
//that runs to the edge of the grid.
defineProps<{ id: string; title: string }>()
</script>

<template>
  <header class="section-header">
    <h2 :id="id" class="section-header__title">{{ title }}</h2>
    <span class="section-header__rule" aria-hidden="true"></span>
  </header>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.section-header__title {
  font-size: var(--site-fs-h2);
  font-weight: var(--site-fw-display);
  line-height: var(--site-lh-tight);
  letter-spacing: var(--site-tracking-heading);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.section-header__rule {
  flex: 1 1 auto;
  height: var(--border-width-sm);
  background-color: var(--site-line);
}
</style>
