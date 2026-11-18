<script setup lang="ts">
import { computed, ref } from "vue"
import { Plus } from "lucide-vue-next"
import { useEditor } from "../../composables/useEditor"
import { useTranslations } from "../../composables/useTranslations"
import { KINDS, type EntityKind } from "./entities"

//ADD AN ITEM TO A SECTION - creates it on the server and opens it in the
//inspector. Renders nothing outside edit mode.

const props = defineProps<{ kind: Exclude<EntityKind, "profile"> }>()

const editor = useEditor()
const { t } = useTranslations()
const busy = ref(false)
const label = computed(() => t(KINDS[props.kind].collection?.addKey ?? ""))

async function add() {
  busy.value = true
  try {
    await editor.createItem(props.kind)
  } catch (e) {
    console.error(`[editor] could not create a ${props.kind}:`, e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button v-if="editor.editMode.value" type="button" class="section-add ed-ui" :disabled="busy" @click="add">
    <Plus :size="16" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.section-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--vsui-space-xs);
  width: 100%;
  min-height: var(--editor-control);
  padding: var(--vsui-space-sm);
  color: var(--editor-text-muted);
  background-color: transparent;
  border: var(--border-width) dashed var(--editor-line);
  border-radius: var(--editor-radius);
  cursor: pointer;
  transition: border-color var(--transition-fast) ease, color var(--transition-fast) ease, background-color var(--transition-fast) ease;
}

.section-add:hover:not(:disabled) {
  color: var(--editor-accent);
  border-color: var(--editor-accent);
  background-color: var(--editor-accent-soft);
}

.section-add:focus-visible { outline: none; box-shadow: var(--editor-focus); }
.section-add:disabled { opacity: var(--vsui-disabled-opacity); cursor: progress; }
</style>
