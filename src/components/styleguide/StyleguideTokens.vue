<script setup lang="ts">
import { useTranslations } from "../../composables/useTranslations"

//THE DESIGN TOKENS, drawn with their own values: the type scale, the colours
//(shadcn HSL and the site levels derived from --ink) and the spacing scale
const { t } = useTranslations()

const TYPE = ["display", "h1", "h2", "h3", "body", "small", "label"]
const HSL = ["background", "foreground", "card", "muted", "muted-foreground", "primary", "border-color", "destructive", "success", "warning"]
const TEXT = ["site-text-heading", "site-text-body", "site-text-caption", "site-accent", "site-line"]
const SPACING = ["spacing-xxs", "spacing-xs", "spacing-sm", "spacing-md", "spacing-lg", "spacing-xl", "spacing-2xl", "spacing-3xl", "spacing-5xl"]
const LAYOUT = ["site-gutter", "site-col-gap", "detail-gap", "site-touch-target"]
</script>

<template>
  <div class="sgt">
    <h3 class="sgt__h3">{{ t('styleguideType') }}</h3>
    <ul class="sgt__type">
      <li v-for="name in TYPE" :key="name" class="sgt__type-row">
        <code class="sgt__code">--site-fs-{{ name }}</code>
        <span class="sgt__type-sample" :style="{ fontSize: `var(--site-fs-${name})` }">{{ t('styleguideTypeSample') }}</span>
      </li>
    </ul>

    <h3 class="sgt__h3">{{ t('styleguideColors') }}</h3>
    <ul class="sgt__swatches">
      <li v-for="name in HSL" :key="name" class="sgt__swatch">
        <span class="sgt__chip" :style="{ backgroundColor: `hsl(var(--${name}))` }"></span>
        <code class="sgt__code">--{{ name }}</code>
      </li>
      <li v-for="name in TEXT" :key="name" class="sgt__swatch">
        <span class="sgt__chip sgt__chip--text" :style="{ color: `var(--${name})` }">Aa</span>
        <code class="sgt__code">--{{ name }}</code>
      </li>
    </ul>

    <h3 class="sgt__h3">{{ t('styleguideSpacing') }}</h3>
    <ul class="sgt__spaces">
      <li v-for="name in [...SPACING, ...LAYOUT]" :key="name" class="sgt__space">
        <code class="sgt__code">--{{ name }}</code>
        <span class="sgt__bar" :style="{ width: `var(--${name})` }"></span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sgt { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.sgt__h3 {
  margin: 0;
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
}
.sgt__code {
  font-size: var(--site-fs-label);
  color: var(--site-text-caption);
  white-space: nowrap;
}
.sgt__type,
.sgt__spaces { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.sgt__type-row {
  display: grid;
  grid-template-columns: minmax(0, var(--vsui-panel-sm)) minmax(0, 1fr);
  align-items: baseline;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) 0;
  border-bottom: var(--border-width) solid var(--site-line);
}
.sgt__type-sample {
  line-height: var(--site-lh-tight);
  color: var(--site-text-heading);
  overflow-wrap: anywhere;
}
.sgt__swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--site-spec-min)), 1fr));
  gap: var(--spacing-md);
  margin: 0;
  padding: 0;
  list-style: none;
}
.sgt__swatch { display: flex; flex-direction: column; gap: var(--spacing-xxs); }
.sgt__chip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--spacing-3xl);
  border: var(--border-width) solid var(--site-line);
}
.sgt__chip--text { font-size: var(--site-fs-h3); font-weight: var(--font-weight-bold); }
.sgt__space {
  display: grid;
  grid-template-columns: minmax(0, var(--vsui-panel-sm)) minmax(0, 1fr);
  align-items: center;
  gap: var(--spacing-md);
  min-height: var(--spacing-xl);
}
.sgt__bar {
  display: block;
  height: var(--spacing-xs);
  background-color: var(--site-accent);
}
@media (max-width: 640px) {
  .sgt__type-row,
  .sgt__space { grid-template-columns: minmax(0, 1fr); gap: var(--spacing-xxs); }
}
</style>
