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
        class="media-dialog__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-dialog-title"
        tabindex="-1"
      >
        <header class="media-dialog__head">
          <h2 id="media-dialog-title" class="media-dialog__title">{{ t('mediaTitle') }}</h2>
          <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :aria-label="t('editorClose')" @click="cancelPick">
            <X :size="18" />
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
  padding: var(--spacing-lg);
  background-color: var(--overlay-bg);
  backdrop-filter: blur(var(--filter-blur));
}

.media-dialog__box {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--editor-dialog-width);
  max-height: 100%;
  color: var(--editor-text);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
}

.media-dialog__box:focus-visible { outline: none; }

.media-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-lg);
  border-bottom: var(--border-width) solid var(--editor-line);
}

.media-dialog__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-normal);
}

.media-dialog__body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--spacing-lg);
}

@media (max-width: 640px) {
  .media-dialog { padding: 0; }
  .media-dialog__box { height: 100%; max-width: none; border: none; }
  .media-dialog__body { padding: var(--spacing-sm); }
}
</style>
