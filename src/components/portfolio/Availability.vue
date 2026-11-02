<script setup lang="ts">
import { computed } from "vue"
import { useEditor } from "../../composables/useEditor"
import { useLanguage } from "../../composables/useLanguage"
import type { ProfileDto } from "../../types/portfolio"

//THE AVAILABILITY LINE: a dot and a sentence. Visitors see it only while the
//profile says available; the admin sees the unavailable state in edit mode.
const props = defineProps<{ profile: ProfileDto }>()

const { editMode } = useEditor()
const { t, lang } = useLanguage()

const text = computed(() => {
  if (!props.profile.available) return t("unavailable")
  return props.profile.availability[lang.value] || t("availableDefault")
})
</script>

<template>
  <p v-if="profile.available || editMode" class="availability" :class="{ 'availability--off': !profile.available }">
    <span class="availability__dot" aria-hidden="true"></span>
    {{ text }}
  </p>
</template>

<style scoped>
.availability {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

.availability__dot {
  flex-shrink: 0;
  width: var(--site-dot);
  height: var(--site-dot);
  border-radius: var(--border-radius-full);
  background-color: var(--site-available);
  box-shadow: 0 0 0 var(--site-dot-halo) var(--site-available-halo);
}

.availability--off { color: var(--site-text-caption); }
.availability--off .availability__dot { background-color: var(--site-text-caption); box-shadow: none; }
</style>
