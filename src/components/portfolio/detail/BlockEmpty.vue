<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../../composables/useTranslations"
import { blockType } from "./block-types"
import type { DetailBlockType } from "../../../types/portfolio"

//A BLOCK WITH NOTHING TO SHOW YET: its type icon and what is missing
const props = defineProps<{ type: DetailBlockType; message?: string }>()
const { t } = useTranslations()
const def = computed(() => blockType(props.type))
</script>

<template>
  <div class="block-empty">
    <component :is="def.icon" :size="24" aria-hidden="true" />
    <span>{{ message ?? t('blockEmptyMedia') }}</span>
  </div>
</template>

<style scoped>
.block-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: 100%;
  padding: var(--spacing-md);
  text-align: center;
  font-size: var(--site-fs-label);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-caption);
  border: var(--border-width) dashed var(--site-line);
}
</style>
