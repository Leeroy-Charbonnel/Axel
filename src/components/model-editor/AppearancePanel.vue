<script setup lang="ts">
import { computed, onMounted } from "vue"
import { ChevronDown, ImageUp, Sun } from "lucide-vue-next"
import ToggleField from "../admin/fields/ToggleField.vue"
import { useMediaLibrary } from "../admin/media/useMediaLibrary"
import { useTranslations } from "../../composables/useTranslations"
import type { ViewerSettings } from "../../three/types"
import LightList from "./LightList.vue"
import SegmentedControl from "./SegmentedControl.vue"
import SliderField from "./SliderField.vue"
import { autoValues, LIGHT_PRESETS, type LightPreset, matchPreset, presetLights } from "./autoSettings"
import { useModelEditor } from "./useModelEditor"

//APPEARANCE - the environment and the lights of each look (normal, wireframe),
//then the stage: ground shadow and zoom limits. The look being edited is the
//look the viewport shows.

const ed = useModelEditor()
const media = useMediaLibrary()
const { t } = useTranslations()

type Look = "normal" | "wireframe"
const look = computed<Look>({
  get: () => (ed.preview.value === "wireframe" ? "wireframe" : "normal"),
  set: (v) => { ed.preview.value = v === "wireframe" ? "wireframe" : "render" },
})
const looks = computed<{ value: Look; label: string }[]>(() => [
  { value: "normal",    label: t("modelEditorLookNormal") },
  { value: "wireframe", label: t("modelEditorLookWireframe") },
])

const modeKey = computed(() => (look.value === "normal" ? "normalMode" : "wireframeMode") as "normalMode" | "wireframeMode")
const env = computed(() => ed.doc.value.settings[modeKey.value] ?? {})
const hdrName = computed(() => {
  const e = env.value
  if (!e.hdrUrl) return null
  return media.files.value.find((f) => f.id === e.hdrId)?.originalFilename ?? e.hdrUrl.split("/").pop() ?? e.hdrUrl
})

function setEnv(key: string, mutate: (m: NonNullable<ViewerSettings["normalMode"]>) => void) {
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

function useStudio() {
  setEnv("hdr", (m) => {
    delete m.hdrId
    m.hdrUrl = null
  })
}

//LIGHTS
const setup = computed(() => ed.setup.value)
const auto = computed(() => (setup.value ? autoValues(setup.value) : null))
const preset = computed(() => (setup.value ? matchPreset(ed.doc.value.settings.lights ?? [], setup.value) : null))
const presetOptions = computed(() => LIGHT_PRESETS.map((p) => ({ value: p, label: t(`modelEditorPreset_${p}`) })))

function applyPreset(p: LightPreset) {
  const s = setup.value
  if (!s) return
  ed.change("light-preset", (d) => {
    d.settings.lights = presetLights(s, p)
  })
}

//STAGE - an unset value follows the auto setup
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
      <SegmentedControl :label="t('modelEditorLook')" :model-value="look" :options="looks" @update:model-value="(v) => (look = v)" />
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorEnvironment') }}</h3>
      <div class="ap__env">
        <span class="ap__env-name">
          <Sun v-if="!hdrName" :size="16" aria-hidden="true" />
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
    </section>

    <section class="ed-form__section">
      <h3 class="ed-form__title">{{ t('modelEditorLighting') }}</h3>
      <SegmentedControl :label="t('modelEditorLightPreset')" :model-value="preset" :options="presetOptions" auto="studio" @update:model-value="applyPreset" />
      <p v-if="!preset" class="ed-hint">{{ t('modelEditorPresetCustom') }}</p>
      <button type="button" class="ed-btn ap__drawer" :aria-expanded="ed.showLights.value" @click="ed.showLights.value = !ed.showLights.value">
        <span>{{ t('modelEditorLightsAdvanced') }} ({{ (ed.doc.value.settings.lights ?? []).length }})</span>
        <ChevronDown :size="16" class="ap__chevron" aria-hidden="true" />
      </button>
      <LightList v-if="ed.showLights.value" :mode="look" />
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
.ap__env {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--vsui-space-xs);
}

.ap__env-name {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: var(--vsui-space-xs);
  min-width: 0;
  color: var(--editor-text);
  overflow-wrap: anywhere;
}

.ap__drawer { justify-content: space-between; }
.ap__drawer[aria-expanded="true"] .ap__chevron { transform: rotate(180deg); }
.ap__chevron { transition: transform var(--transition-fast) ease; }
</style>
