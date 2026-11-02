<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { CircleHelp, Focus, House } from "lucide-vue-next"
import { useTranslations } from "../../composables/useTranslations"
import type { ViewerMode } from "../../three/types"
import SegmentedControl from "./SegmentedControl.vue"
import { type FrameKind, useModelEditor } from "./useModelEditor"

//OVER THE VIEWPORT: what the model shows as (render, wireframe, clay), the
//frame it is seen in, the camera shortcuts and the keyboard help.

const help = defineModel<boolean>("help", { required: true })
const emit = defineEmits<{ frameModel: []; restView: [] }>()

const ed = useModelEditor()
const { t } = useTranslations()

const modes = computed<{ value: ViewerMode; label: string }[]>(() => [
  { value: "render",    label: t("modelEditorModeRender") },
  { value: "wireframe", label: t("modelEditorModeWireframe") },
  { value: "clay",      label: t("modelEditorModeClay") },
])
const frames = computed<{ value: FrameKind; label: string }[]>(() => [
  { value: "free",    label: t("modelEditorFrameFree") },
  { value: "desktop", label: t("modelEditorFrameDesktop") },
  { value: "phone",   label: t("modelEditorFramePhone") },
])

const SHORTCUTS = [
  { keys: "F",        label: "modelEditorKeyFrame" },
  { keys: "1 - 4",    label: "modelEditorKeyPanels" },
  { keys: "Ctrl S",   label: "modelEditorKeySave" },
  { keys: "Ctrl Z",   label: "modelEditorKeyUndo" },
  { keys: "Ctrl Y",   label: "modelEditorKeyRedo" },
  { keys: "?",        label: "modelEditorKeyHelp" },
  { keys: "Esc",      label: "modelEditorKeyEscape" },
]

const helpButton = ref<HTMLButtonElement | null>(null)
const helpPanel  = ref<HTMLElement | null>(null)

watch(help, async (open) => {
  await nextTick()
  if (open) helpPanel.value?.focus()
})

function closeHelp() {
  help.value = false
  helpButton.value?.focus()
}
</script>

<template>
  <div class="tb" role="toolbar" :aria-label="t('modelEditorToolbar')">
    <SegmentedControl class="tb__seg" bare :label="t('modelEditorMode')" :model-value="ed.preview.value" :options="modes" @update:model-value="(m) => (ed.preview.value = m)" />
    <SegmentedControl class="tb__seg tb__frames" bare :label="t('modelEditorFrame')" :model-value="ed.frame.value" :options="frames" @update:model-value="(f) => (ed.frame.value = f)" />
    <div class="tb__end">
      <button type="button" class="ed-btn ed-btn--icon tb__btn" :title="`${t('modelEditorFrameModel')} (F)`" :aria-label="t('modelEditorFrameModel')" @click="emit('frameModel')">
        <Focus :size="18" />
      </button>
      <button type="button" class="ed-btn ed-btn--icon tb__btn" :title="t('modelEditorRestView')" :aria-label="t('modelEditorRestView')" @click="emit('restView')">
        <House :size="18" />
      </button>
      <div class="tb__help-host">
        <button
          ref="helpButton"
          type="button"
          class="ed-btn ed-btn--icon tb__btn"
          :class="{ 'ed-btn--active': help }"
          :aria-expanded="help"
          aria-haspopup="dialog"
          :title="`${t('modelEditorShortcuts')} (?)`"
          :aria-label="t('modelEditorShortcuts')"
          @click="help = !help"
        >
          <CircleHelp :size="18" />
        </button>
        <div
          v-if="help"
          ref="helpPanel"
          class="tb__help"
          role="dialog"
          tabindex="-1"
          :aria-label="t('modelEditorShortcuts')"
          @keydown.esc.stop="closeHelp"
        >
          <p class="ed-label">{{ t('modelEditorShortcuts') }}</p>
          <dl class="tb__keys">
            <template v-for="s in SHORTCUTS" :key="s.keys">
              <dt><kbd class="tb__kbd">{{ s.keys }}</kbd></dt>
              <dd>{{ t(s.label) }}</dd>
            </template>
          </dl>
          <p class="ed-hint">{{ t('modelEditorShortcutsMouse') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  background-color: var(--me-chrome-bg);
  border-bottom: var(--border-width) solid var(--editor-line);
}

.tb__seg { flex: 0 1 var(--me-seg-width); }

.tb__end {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  margin-left: auto;
}

.tb__btn {
  min-width: var(--me-seg-height);
  min-height: var(--me-seg-height);
}

.tb__help-host { position: relative; }

.tb__help {
  position: absolute;
  top: calc(100% + var(--spacing-xs));
  right: 0;
  z-index: var(--editor-z-inspector);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: var(--vsui-panel-md);
  padding: var(--spacing-md);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
  box-shadow: var(--vsui-shadow-lg);
}

.tb__help:focus-visible { outline: none; box-shadow: var(--editor-focus); }

.tb__keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--editor-text);
}

.tb__kbd {
  display: inline-block;
  min-width: var(--me-kbd-width);
  padding: 0 var(--spacing-xxs);
  font-family: inherit;
  font-size: var(--font-size-xs);
  text-align: center;
  color: var(--editor-text);
  border: var(--border-width) solid var(--editor-line);
}

/*PHONE - the frame choice is for authoring views, which needs room*/
@media (max-width: 640px) {
  .tb__frames { display: none; }
  .tb__seg { flex: 1 1 auto; }
}
</style>
