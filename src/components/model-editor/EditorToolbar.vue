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
      <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :title="`${t('modelEditorFrameModel')} (F)`" :aria-label="t('modelEditorFrameModel')" @click="emit('frameModel')">
        <Focus :size="16" />
      </button>
      <button type="button" class="ed-btn ed-btn--ghost ed-btn--icon" :title="t('modelEditorRestView')" :aria-label="t('modelEditorRestView')" @click="emit('restView')">
        <House :size="16" />
      </button>
      <div class="tb__help-host">
        <button
          ref="helpButton"
          type="button"
          class="ed-btn ed-btn--ghost ed-btn--icon"
          :class="{ 'ed-btn--active': help }"
          :aria-expanded="help"
          aria-haspopup="dialog"
          :title="`${t('modelEditorShortcuts')} (?)`"
          :aria-label="t('modelEditorShortcuts')"
          @click="help = !help"
        >
          <CircleHelp :size="16" />
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
          <p class="tb__help-title">{{ t('modelEditorShortcuts') }}</p>
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
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-xs) var(--vsui-space-sm);
  background-color: var(--editor-surface);
  border-bottom: var(--border-width) solid var(--editor-line-soft);
}

.tb__seg { flex: 0 1 auto; }

.tb__end {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-2xs);
  margin-left: auto;
}

.tb__help-host { position: relative; }

.tb__help {
  position: absolute;
  top: calc(100% + var(--vsui-space-xs));
  right: 0;
  z-index: var(--editor-z-inspector);
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-sm);
  width: var(--vsui-panel-md);
  padding: var(--vsui-space-md);
  background-color: var(--editor-surface-raised);
  border: var(--border-width) solid var(--editor-line);
  border-radius: var(--editor-radius);
  box-shadow: var(--editor-shadow);
}

.tb__help:focus-visible { outline: none; box-shadow: var(--editor-shadow), var(--editor-focus); }

.tb__help-title { font-weight: var(--font-weight-semibold); }

.tb__keys {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--vsui-space-xs) var(--vsui-space-sm);
  font-size: var(--editor-fs-sm);
  color: var(--editor-text);
}

.tb__kbd {
  display: inline-block;
  min-width: var(--me-kbd-width);
  padding: 0 var(--vsui-space-xs);
  font-family: inherit;
  font-size: var(--editor-fs-xs);
  text-align: center;
  color: var(--editor-text);
  background-color: var(--editor-input-bg);
  border: var(--border-width) solid var(--editor-line);
  border-radius: var(--editor-radius);
}

/*PHONE - the frame choice is for authoring views, which needs room*/
@media (max-width: 640px) {
  .tb__frames { display: none; }
  .tb__seg { flex: 1 1 auto; }
}
</style>
