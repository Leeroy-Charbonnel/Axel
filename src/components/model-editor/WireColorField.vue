<script setup lang="ts">
import { computed } from "vue"
import { useTranslations } from "../../composables/useTranslations"
import type { WireColor } from "../../three/types"
import { SITE_BACKGROUND } from "../../three/wireColor"
import ColorField from "./ColorField.vue"
import SegmentedControl from "./SegmentedControl.vue"

//A WIREFRAME COLOUR: a colour of its own, or the site background, which
//follows the site theme.

type Kind = "fixed" | "site"

const props = defineProps<{
  label:      string
  //undefined = the default colour
  modelValue: WireColor | undefined
  //the default colour, a fixed one
  auto:       string
}>()

const emit = defineEmits<{ "update:modelValue": [value: WireColor | undefined] }>()

const { t } = useTranslations()

const kind = computed<Kind>(() => (props.modelValue === SITE_BACKGROUND ? "site" : "fixed"))
const kinds = computed<{ value: Kind; label: string }[]>(() => [
  { value: "fixed", label: t("modelEditorWireColorFixed") },
  { value: "site",  label: t("modelEditorWireColorSite") },
])

//the default colour is not saved
function setFixed(color: string) {
  emit("update:modelValue", color.toLowerCase() === props.auto.toLowerCase() ? undefined : color)
}

function setKind(next: Kind) {
  if (next === kind.value) return
  emit("update:modelValue", next === "site" ? SITE_BACKGROUND : undefined)
}
</script>

<template>
  <div class="wc">
    <SegmentedControl :label="label" :model-value="kind" :options="kinds" auto="fixed" @update:model-value="setKind" />
    <ColorField v-if="kind === 'fixed'" :label="t('modelEditorColor')" :model-value="modelValue ?? auto" :auto="auto" @update:model-value="setFixed" />
  </div>
</template>

<style scoped>
.wc {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-xs);
}
</style>
