<script setup lang="ts">
import { ref, useId, watch } from "vue"
import { Plus } from "lucide-vue-next"
import { useEditor } from "../../../composables/useEditor"
import { useTranslations } from "../../../composables/useTranslations"
import { pickBilingual, renderMd } from "../../../lib/markdown"
import type { Lang } from "../../../lib/lang"
import BlockEmpty from "./BlockEmpty.vue"
import BlockText from "./BlockText.vue"
import type { AccordionBlockContent } from "../../../types/portfolio"

//ACCORDION - one section open at a time, the first one to start with. Each
//header is a real button wired to its panel (aria-expanded / aria-controls);
//up and down arrows move between headers. In edit mode every section is open
//and its title and body are typed in place.

const props = defineProps<{ content: AccordionBlockContent; lang: Lang }>()
const { t } = useTranslations()
const { editMode: editing } = useEditor()
const uid = useId()

const openIdx = ref<number | null>(props.content.items.length ? 0 : null)
const heads = ref<HTMLButtonElement[]>([])

watch(() => props.content.items.length, (n) => {
  if (openIdx.value !== null && openIdx.value >= n) openIdx.value = n ? 0 : null
})

function toggle(i: number) {
  openIdx.value = openIdx.value === i ? null : i
}

function onKeydown(e: KeyboardEvent, i: number) {
  const n = props.content.items.length
  const moves: Record<string, number> = { ArrowDown: (i + 1) % n, ArrowUp: (i - 1 + n) % n, Home: 0, End: n - 1 }
  const to = moves[e.key]
  if (to === undefined) return
  e.preventDefault()
  heads.value[to]?.focus()
}
</script>

<template>
  <div v-if="content.items.length" class="baccordion" :lang="lang">
    <section v-for="(item, i) in content.items" :key="i" class="baccordion__item">
      <h3 class="baccordion__heading">
        <div v-if="editing" class="baccordion__head baccordion__head--editing">
          <BlockText :value="item.title" :label="t('fieldTitle')" @write="(v) => (item.title = v)" />
          <Plus :size="16" class="baccordion__icon" aria-hidden="true" />
        </div>
        <button
          v-else
          :id="`${uid}-h${i}`"
          ref="heads"
          type="button"
          class="baccordion__head"
          :aria-expanded="openIdx === i"
          :aria-controls="`${uid}-p${i}`"
          @click="toggle(i)"
          @keydown="onKeydown($event, i)"
        >
          <span>{{ pickBilingual(item.title, lang) }}</span>
          <Plus :size="16" class="baccordion__icon" aria-hidden="true" />
        </button>
      </h3>
      <BlockText
        v-if="editing"
        tag="div"
        class="baccordion__body md-content"
        multiline
        :value="item.body"
        :label="t('blockFieldBody')"
        @write="(v) => (item.body = v)"
      />
      <div
        v-else
        v-show="openIdx === i"
        :id="`${uid}-p${i}`"
        role="region"
        :aria-labelledby="`${uid}-h${i}`"
        class="baccordion__body md-content"
        v-html="renderMd(pickBilingual(item.body, lang))"
      ></div>
    </section>
  </div>
  <BlockEmpty v-else type="accordion" :message="t('blockEmptyItems')" />
</template>

<style scoped>
.baccordion {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 0 var(--spacing-md);
}
.baccordion__item { border-bottom: var(--border-width) solid var(--site-line); }
.baccordion__heading { margin: 0; }
.baccordion__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
  min-height: var(--site-touch-target);
  padding: var(--spacing-sm) 0;
  background: transparent;
  border: none;
  color: var(--site-text-heading);
  font-size: var(--site-fs-small);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-heading);
  text-align: left;
  cursor: pointer;
  transition: color var(--transition-fast) ease;
}
.baccordion__head:hover { color: var(--site-accent); }
.baccordion__head--editing,
.baccordion__head--editing:hover { color: var(--site-text-heading); cursor: default; }
.baccordion__head:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: var(--vsui-space-2xs); }
.baccordion__icon { flex-shrink: 0; transition: transform var(--transition-fast) ease; }
.baccordion__head[aria-expanded="true"] .baccordion__icon { transform: rotate(45deg); }
.baccordion__body {
  padding: 0 0 var(--spacing-md);
  font-size: var(--site-fs-small);
  line-height: var(--site-lh-body);
  color: var(--site-text-body);
}
@media (prefers-reduced-motion: reduce) {
  .baccordion__icon { transition: none; }
}
</style>
