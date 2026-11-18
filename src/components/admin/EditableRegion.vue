<script setup lang="ts">
import { computed } from "vue"
import { useEditor } from "../../composables/useEditor"
import { useTranslations } from "../../composables/useTranslations"
import { entityKey, type EntityId, type EntityKind } from "./entities"

//AN ITEM OF THE PAGE THAT CAN BE EDITED. Outside edit mode it renders its slot
//and nothing else. In edit mode it wraps the slot: hover outline and label
//chip, click or Enter selects it for the inspector, and clicks never reach the
//content inside (links, lightboxes) while editing.

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  kind:  EntityKind
  id?:   EntityId
  label: string
  tag?:  string
}>(), { id: null, tag: "div" })

const editor = useEditor()
const { t } = useTranslations()
const selected = computed(() => editor.isSelected(props.kind, props.id))
const dirty    = computed(() => editor.isDirty(props.kind, props.id))

function onClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  editor.select(props.kind, props.id)
}

function onKeydown(e: KeyboardEvent) {
  if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return
  e.preventDefault()
  editor.select(props.kind, props.id, { focus: true })
}
</script>

<template>
  <slot v-if="!editor.editMode.value" />
  <component
    :is="tag"
    v-else
    v-bind="$attrs"
    class="editable-region"
    :class="{ 'editable-region--selected': selected }"
    role="button"
    tabindex="0"
    :aria-pressed="selected"
    :aria-label="`${t('editorEditItem')} ${label}`"
    :data-edit-key="entityKey(kind, id)"
    @click.capture="onClick"
    @keydown="onKeydown"
  >
    <span class="editable-region__chip" aria-hidden="true">
      {{ label }}<span v-if="dirty" class="editable-region__dirty"></span>
    </span>
    <slot />
  </component>
</template>

<style scoped>
.editable-region {
  position: relative;
  cursor: pointer;
}

.editable-region::after {
  content: "";
  position: absolute;
  inset: calc(-1 * var(--editor-region-inset));
  z-index: var(--editor-z-region);
  border: var(--border-width) dashed transparent;
  pointer-events: none;
  transition: border-color var(--transition-fast) ease;
}

.editable-region:hover::after { border-color: var(--editor-text-muted); }
.editable-region:focus-visible { outline: none; }
.editable-region:focus-visible::after { border-color: hsl(var(--ring)); border-style: solid; }
.editable-region--selected::after,
.editable-region--selected:hover::after {
  border-color: var(--editor-accent);
  border-style: solid;
}

.editable-region__chip {
  position: absolute;
  top: calc(-1 * var(--editor-region-inset));
  left: calc(-1 * var(--editor-region-inset));
  z-index: var(--editor-z-region);
  display: none;
  align-items: center;
  gap: var(--vsui-space-xs);
  padding: var(--vsui-space-2xs) var(--vsui-space-sm);
  font-family: var(--editor-font);
  font-size: var(--editor-fs-xs);
  font-weight: var(--font-weight-semibold);
  line-height: var(--editor-lh);
  letter-spacing: normal;
  text-transform: none;
  color: var(--editor-on-accent);
  background-color: var(--editor-text-muted);
  pointer-events: none;
}

.editable-region:hover > .editable-region__chip,
.editable-region:focus-visible > .editable-region__chip,
.editable-region--selected > .editable-region__chip { display: inline-flex; }

.editable-region--selected > .editable-region__chip { background-color: var(--editor-accent); }

.editable-region__dirty {
  width: var(--vsui-space-xs);
  height: var(--vsui-space-xs);
  border-radius: var(--border-radius-full);
  background-color: var(--editor-warning);
}

/*touch has no hover: the chip stays visible so the regions read as editable*/
@media (hover: none) {
  .editable-region > .editable-region__chip { display: inline-flex; }
  .editable-region::after { border-color: var(--editor-line); }
}
</style>
