<script lang="ts">
import type { Component } from "vue"

export interface EditorTab<K extends string = string> {
  key:    K
  icon:   Component
  label:  string
  title?: string
}
</script>

<script setup lang="ts" generic="K extends string">
import { computed, shallowReactive, watch } from "vue"

//EDITOR TABS - a row of tabs over their panes, for the editor's side panels.
//Arrows, Home and End move between tabs; only the open tab is in the Tab
//order. A pane comes from the slot named after its tab. With `keep`, a pane
//opened once stays mounted while hidden; without it, only the open pane exists.
//The `end` slot sits beside the tabs, outside the tab list. With `rail`, the
//tabs are a column of icons on the left and the open tab names the panel.

const props = withDefaults(defineProps<{
  tabs:     EditorTab<K>[]
  //The tab list's accessible name
  label:    string
  //Makes the tab and pane ids unique on the page
  idPrefix: string
  keep?:    boolean
  padded?:  boolean
  rail?:    boolean
}>(), { keep: false, padded: false, rail: false })

const open = defineModel<K>({ required: true })

const visited = shallowReactive(new Set<K>([open.value]))
watch(open, (key) => visited.add(key))

const tabEls = new Map<K, HTMLElement>()
const tabId  = (key: K) => `${props.idPrefix}-tab-${key}`
const paneId = (key: K) => `${props.idPrefix}-pane-${key}`
const mounted = (key: K) => key === open.value || (props.keep && visited.has(key))
const openLabel = computed(() => props.tabs.find((tb) => tb.key === open.value)?.label ?? "")

const MOVES: Record<string, (i: number, n: number) => number> = {
  ArrowLeft:  (i, n) => (i - 1 + n) % n,
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowUp:    (i, n) => (i - 1 + n) % n,
  ArrowDown:  (i, n) => (i + 1) % n,
  Home:       () => 0,
  End:        (_, n) => n - 1,
}

function onKeydown(e: KeyboardEvent) {
  const move = MOVES[e.key]
  if (!move) return
  e.preventDefault()
  const i = props.tabs.findIndex((tb) => tb.key === open.value)
  const next = props.tabs[move(i, props.tabs.length)]!
  open.value = next.key
  tabEls.get(next.key)?.focus()
}
</script>

<template>
  <div class="ed-tabs" :class="{ 'ed-tabs--rail': rail }">
    <div class="ed-tabs__bar">
      <div class="ed-tabs__list" role="tablist" :aria-label="label" :aria-orientation="rail ? 'vertical' : 'horizontal'" @keydown="onKeydown">
        <button
          v-for="tb in tabs"
          :id="tabId(tb.key)"
          :key="tb.key"
          :ref="(el) => { if (el) tabEls.set(tb.key, el as HTMLElement); else tabEls.delete(tb.key) }"
          type="button"
          role="tab"
          class="ed-tabs__tab"
          :aria-selected="open === tb.key"
          :aria-controls="mounted(tb.key) ? paneId(tb.key) : undefined"
          :tabindex="open === tb.key ? 0 : -1"
          :title="tb.title ?? tb.label"
          @click="open = tb.key"
        >
          <component :is="tb.icon" class="ed-tabs__icon" aria-hidden="true" />
          <span class="ed-tabs__label">{{ tb.label }}</span>
        </button>
      </div>
      <slot v-if="!rail" name="end" />
    </div>
    <div class="ed-tabs__main">
    <div v-if="rail" class="ed-tabs__head">
      <span class="ed-tabs__title">{{ openLabel }}</span>
      <slot name="end" />
    </div>
    <template v-for="tb in tabs" :key="tb.key">
      <div
        v-if="mounted(tb.key)"
        v-show="open === tb.key"
        :id="paneId(tb.key)"
        class="ed-tabs__pane"
        :class="{ 'ed-tabs__pane--padded': padded }"
        role="tabpanel"
        :aria-labelledby="tabId(tb.key)"
      >
        <slot :name="tb.key" />
      </div>
    </template>
    </div>
  </div>
</template>

<style scoped>
.ed-tabs {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/*A compact row, the open tab raised*/
.ed-tabs__bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--vsui-space-2xs);
  padding: var(--vsui-space-xs);
  border-bottom: var(--border-width) solid var(--editor-line);
}

.ed-tabs__list {
  display: flex;
  flex: 1;
  gap: var(--vsui-space-2xs);
  min-width: 0;
  container: ed-tabs / inline-size;
}

.ed-tabs__tab {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: var(--vsui-space-xs);
  min-width: 0;
  min-height: var(--editor-control);
  padding: 0 var(--vsui-space-xs);
  font-size: var(--editor-fs-sm);
  color: var(--editor-text-muted);
  border-radius: var(--editor-radius);
  cursor: pointer;
  transition: color var(--transition-fast) ease, background-color var(--transition-fast) ease;
}

.ed-tabs__tab:hover { color: var(--editor-text); }
.ed-tabs__tab[aria-selected="true"] {
  color: var(--editor-text);
  background-color: var(--editor-surface-raised);
}
.ed-tabs__tab[aria-selected="true"] .ed-tabs__icon { color: var(--editor-accent); }
.ed-tabs__tab:focus-visible { outline: none; box-shadow: var(--editor-focus); }

.ed-tabs__icon {
  flex-shrink: 0;
  width: var(--editor-icon);
  height: var(--editor-icon);
}

.ed-tabs__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ed-tabs__pane {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.ed-tabs__pane--padded { padding: var(--vsui-space-md); }

.ed-tabs__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/*RAIL - icons in a column on the left, the open tab named on top*/
.ed-tabs--rail { flex-direction: row; }
.ed-tabs--rail .ed-tabs__bar {
  flex-direction: column;
  border-bottom: none;
  border-right: var(--border-width) solid var(--editor-line);
}
.ed-tabs--rail .ed-tabs__list { flex: none; flex-direction: column; container-type: normal; }
.ed-tabs--rail .ed-tabs__tab {
  flex: none;
  width: var(--editor-control);
  padding: 0;
}
.ed-tabs--rail .ed-tabs__label { display: none; }

.ed-tabs__head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--vsui-space-xs);
  min-height: calc(var(--editor-control) + 2 * var(--vsui-space-xs));
  padding: 0 var(--vsui-space-xs) 0 var(--vsui-space-sm);
  border-bottom: var(--border-width) solid var(--editor-line);
}

.ed-tabs__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--editor-fs-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--editor-text);
}

/*A narrow row: only the open tab spells its name, the others keep their icon and title*/
@container ed-tabs (max-width: 360px) {
  .ed-tabs__tab { flex: 0 0 auto; min-width: var(--editor-control); }
  .ed-tabs__tab[aria-selected="true"] { flex: 1 1 auto; }
  .ed-tabs__tab:not([aria-selected="true"]) .ed-tabs__label { display: none; }
}
</style>
