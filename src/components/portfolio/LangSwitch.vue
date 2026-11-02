<script setup lang="ts">
import { useLanguage } from "../../composables/useLanguage"
import type { Lang } from "../../lib/lang"

//FR / EN - each language named in itself, the current one pressed
const { lang, setLang } = useLanguage()

const LANGS: { code: Lang; name: string }[] = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
]
</script>

<template>
  <div class="lang-switch" role="group" aria-label="Langue / Language">
    <button
      v-for="item in LANGS"
      :key="item.code"
      type="button"
      class="lang-switch__option"
      :lang="item.code"
      :aria-label="item.name"
      :aria-pressed="lang === item.code"
      @click="setLang(item.code)"
    >
      {{ item.code }}
    </button>
  </div>
</template>

<style scoped>
.lang-switch {
  display: inline-flex;
}

.lang-switch__option {
  min-width: var(--site-touch-target);
  min-height: var(--site-touch-target);
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--site-tracking-label);
  text-transform: uppercase;
  color: var(--site-text-caption);
  transition: color var(--site-duration-fast) ease;
}

.lang-switch__option:hover { color: var(--site-text-heading); }
.lang-switch__option[aria-pressed="true"] { color: var(--site-accent); }
</style>
