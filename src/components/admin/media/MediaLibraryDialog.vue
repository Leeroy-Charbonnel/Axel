<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { X } from "lucide-vue-next"
import MediaBrowser from "./MediaBrowser.vue"
import { useMediaLibrary } from "./useMediaLibrary"
import { useTranslations } from "../../../composables/useTranslations"

//THE ONE FILE PICKER. Mounted once in App.vue; answers pickMedia() from
//anywhere. Full screen on phone, a centred panel above.

const { request, resolvePick, cancelPick } = useMediaLibrary()
const { t } = useTranslations()
const box = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null

watch(request, async (open) => {
  if (open) {
    returnFocus = document.activeElement as HTMLElement | null
    await nextTick()
    box.value?.focus()
  } else {
    returnFocus?.focus()
    returnFocus = null
  }
})

function onKeydown(e: KeyboardEvent) {
  if (request.value && e.key === "Escape") {
    e.preventDefault()
    cancelPick()
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown))
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="request" class="media-dialog" @click.self="cancelPick">
      <div
        ref="box"
        class="ed-ui media-dialog__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-dialog-title"
        tabindex="-1"
      >
        <header class="media-dialog__head">
          <h2 id="media-dialog-title" class="media-dialog__title">{{ t('mediaTitle') }}</h2>
          <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('editorClose')" @click="cancelPick">
            <X :size="16" />
          </button>
        </header>
        <div class="media-dialog__body">
          <MediaBrowser
            mode="pick"
            :accept="request.accept"
            :multiple="request.multiple"
            @pick="resolvePick"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.media-dialog {
  position: fixed;
  inset: 0;
  z-index: var(--editor-z-media);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--vsui-space-lg);
  background-color: var(--overlay-bg);
}

.media-dialog__box {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--editor-dialog-width);
  max-height: 100%;
  overflow: hidden;
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
  border-radius: var(--editor-radius);
  box-shadow: var(--editor-shadow);
}

.media-dialog__box:focus-visible { outline: none; }

.media-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-xs) var(--vsui-space-xs) var(--vsui-space-xs) var(--vsui-space-md);
  border-bottom: var(--border-width) solid var(--editor-line-soft);
}

.media-dialog__title {
  font-size: var(--editor-fs);
  font-weight: var(--font-weight-semibold);
}

.media-dialog__body {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  padding: var(--vsui-space-md);
}

@media (max-width: 640px) {
  .media-dialog { padding: 0; }
  .media-dialog__box { height: 100%; max-width: none; border: none; border-radius: 0; }
  .media-dialog__body { padding: var(--vsui-space-sm); }
}
</style>
