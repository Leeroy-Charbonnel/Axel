<script setup lang="ts">
import { onMounted, ref, useId } from "vue"
import { X } from "lucide-vue-next"
import { useTranslations } from "../../../composables/useTranslations"

//WHAT A THING OF THE ADD TAB IS: its name, a picture (the slot) and a few
//words. A native modal dialog: Escape and a click beside it close it, and the
//focus goes back to the button that opened it.
defineProps<{ title: string; description: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useTranslations()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

onMounted(() => dialog.value?.showModal())

//The owner unmounts it at once; the browser's own close event comes a frame later
function close() {
  dialog.value?.close()
  emit("close")
}
</script>

<template>
  <dialog ref="dialog" class="help" :aria-labelledby="titleId" @cancel.prevent="close" @click.self="close">
    <div class="help__box ed-ui">
      <header class="help__head">
        <h2 :id="titleId" class="help__title">{{ title }}</h2>
        <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('editorClose')" @click="close">
          <X :size="16" aria-hidden="true" />
        </button>
      </header>
      <slot />
      <p class="help__text">{{ description }}</p>
    </div>
  </dialog>
</template>

<style scoped>
.help {
  width: min(var(--confirm-width), 100% - 2 * var(--vsui-space-lg));
  margin: auto;
  padding: 0;
  color: var(--editor-text);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
  border-radius: var(--editor-radius);
  box-shadow: var(--editor-shadow);
}
.help::backdrop { background-color: var(--overlay-bg); }
.help__box {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-md);
  padding: var(--vsui-space-lg);
}
.help__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--vsui-space-sm);
}
.help__title {
  font-size: var(--editor-fs);
  font-weight: var(--font-weight-semibold);
}
.help__text {
  line-height: var(--editor-lh);
  color: var(--editor-text-muted);
}
</style>
