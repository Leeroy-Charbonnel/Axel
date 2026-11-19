<script setup lang="ts">
import { computed, onMounted } from "vue"
import { ImageUp, Sun } from "lucide-vue-next"
import ToggleField from "../admin/fields/ToggleField.vue"
import FileThumb from "../admin/media/FileThumb.vue"
import { useMediaLibrary } from "../admin/media/useMediaLibrary"
import { useTranslations } from "../../composables/useTranslations"
import type { EnvironmentSettings, ViewerSettings } from "../../three/types"
import LookSwitch from "./LookSwitch.vue"
import SliderField from "./SliderField.vue"
import { autoValues } from "./autoSettings"
import { useModelEditor } from "./useModelEditor"

//SCENE - the environment map of each look (file, strength, turn, shown behind
//the model or not), then the stage: ground glow and zoom limits.

const ed = useModelEditor()
const media = useMediaLibrary()
const { t } = useTranslations()

const modeKey = computed(() => (ed.preview.value === "wireframe" ? "wireframeMode" : "normalMode"))
const env = computed<EnvironmentSettings>(() => ed.doc.value.settings[modeKey.value] ?? {})
//the picked map's file, once the library has loaded
const hdrFile = computed(() => (env.value.hdrUrl ? media.files.value.find((f) => f.id === env.value.hdrId) ?? null : null))
const hdrName = computed(() => {
  const e = env.value
  if (!e.hdrUrl) return null
  return hdrFile.value?.originalFilename ?? e.hdrUrl.split("/").pop() ?? e.hdrUrl
})

function setEnv(key: string, mutate: (m: EnvironmentSettings) => void) {
  const k = modeKey.value
  ed.change(`env-${k}-${key}`, (d) => {
    mutate((d.settings[k] ??= {}))
  })
}

async function pickHdr() {
  const [file] = await media.pickMedia({ accept: "hdr" })
  if (!file) return
  setEnv("hdr", (m) => {
    m.hdrId = file.id
    m.hdrUrl = file.url
  })
}

//the studio has no picture to show behind the model
function useStudio() {
  setEnv("hdr", (m) => {
    delete m.hdrId
    delete m.hdrBackground
    m.hdrUrl = null
  })
}

//STAGE - an unset value follows the auto setup
const auto = computed(() => (ed.setup.value ? autoValues(ed.setup.value) : null))
const stage = computed(() => ({ ...auto.value?.stage, ...ed.doc.value.settings.stage }))

function setStage<K extends keyof NonNullable<ViewerSettings["stage"]>>(key: K, value: NonNullable<ViewerSettings["stage"]>[K]) {
  ed.change(`stage-${key}`, (d) => {
    const next = { ...(d.settings.stage ?? {}), [key]: value }
    //back on the auto value: no override left to save
    if (auto.value && auto.value.stage[key] === value) delete next[key]
    d.settings.stage = next
    if (Object.keys(next).length === 0) delete d.settings.stage
  })
}

onMounted(() => {
  if (!media.files.value.length && !media.loading.value) void media.load()
})
</script>

<template>
  <div class="ed-form">
    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorEnvironment') }}</h3>
      <LookSwitch />
      <div class="sp__env">
        <span class="sp__env-name">
          <Sun v-if="!hdrName" :size="16" aria-hidden="true" />
          <span v-else-if="hdrFile" class="sp__env-thumb"><FileThumb :file="hdrFile" :icon-size="16" /></span>
          <ImageUp v-else :size="16" aria-hidden="true" />
          <span>{{ hdrName ?? t('modelEditorEnvStudio') }}</span>
        </span>
        <button v-if="hdrName" type="button" class="ed-btn ed-btn--ghost" @click="useStudio">{{ t('modelEditorEnvUseStudio') }}</button>
        <button type="button" class="ed-btn" @click="pickHdr">{{ t('modelEditorEnvPick') }}</button>
      </div>
      <SliderField
        :label="t('modelEditorIntensity')"
        :model-value="env.hdrIntensity ?? 1"
        :min="0"
        :max="3"
        :step="0.05"
        :auto="1"
        @update:model-value="(v) => setEnv('intensity', (m) => (m.hdrIntensity = v))"
      />
      <SliderField
        :label="t('modelEditorEnvRotation')"
        :model-value="env.hdrRotation ?? 0"
        :min="0"
        :max="360"
        :step="1"
        unit="°"
        :auto="0"
        @update:model-value="(v) => setEnv('rotation', (m) => (m.hdrRotation = v))"
      />
      <ToggleField
        v-if="hdrName"
        :label="t('modelEditorEnvBackground')"
        :hint="t('modelEditorEnvBackgroundHint')"
        :model-value="env.hdrBackground ?? false"
        @update:model-value="(v) => setEnv('background', (m) => (m.hdrBackground = v))"
      />
    </section>

    <section v-if="auto" class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorStage') }}</h3>
      <ToggleField :label="t('modelEditorGround')" :hint="t('modelEditorGroundHint')" :model-value="stage.ground ?? true" @update:model-value="(v) => setStage('ground', v)" />
      <SliderField
        :label="t('modelEditorLift')"
        :hint="t('modelEditorLiftHint')"
        :model-value="stage.lift ?? auto.stage.lift"
        :min="0"
        :max="1"
        :step="0.01"
        unit="×R"
        :auto="auto.stage.lift"
        @update:model-value="(v) => setStage('lift', v)"
      />
      <SliderField
        :label="t('modelEditorZoomMin')"
        :model-value="stage.orbitMin ?? auto.stage.orbitMin"
        :min="0.05"
        :max="5"
        :step="0.01"
        unit="×R"
        :auto="auto.stage.orbitMin"
        @update:model-value="(v) => setStage('orbitMin', v)"
      />
      <SliderField
        :label="t('modelEditorZoomMax')"
        :model-value="stage.orbitMax ?? auto.stage.orbitMax"
        :min="1"
        :max="40"
        :step="0.1"
        unit="×R"
        :auto="auto.stage.orbitMax"
        @update:model-value="(v) => setStage('orbitMax', v)"
      />
      <p class="ed-hint">{{ t('modelEditorRadiusHint') }}</p>
    </section>
  </div>
</template>

<style scoped>
.sp__env {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--vsui-space-xs);
}

.sp__env-name {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: var(--vsui-space-xs);
  min-width: 0;
  color: var(--editor-text);
  overflow-wrap: anywhere;
}

.sp__env-thumb {
  flex-shrink: 0;
  width: var(--editor-media-preview);
  height: var(--editor-media-preview);
  overflow: hidden;
  color: var(--editor-text-muted);
  background-color: var(--editor-input-bg);
  border-radius: var(--editor-radius);
}
</style>
