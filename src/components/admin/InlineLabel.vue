<script setup lang="ts">
import { computed } from "vue"
import InlineEditable from "./InlineEditable.vue"
import { useEditor } from "../../composables/useEditor"
import { useTranslations } from "../../composables/useTranslations"
import { labelFieldId } from "./labels"

//A FIXED TEXT OF THE SITE, TYPED IN PLACE. Outside edit mode it renders its
//element with the translation. In edit mode the element holds a text box for
//the site's language: typing drafts the label, the panel's field follows, and
//Save writes the translation.

const props = withDefaults(defineProps<{
  //Translation key
  name: string
  tag?: string
}>(), { tag: "span" })

const editor = useEditor()
const { t } = useTranslations()

const saved = computed(() => t(props.name))
const ariaName = computed(() => `${t("labelsTitle")} - ${saved.value}`)

//The panel shows the labels when no item is selected
function onFocus() {
  editor.clear()
  editor.activeField.value = labelFieldId(props.name)
}

//A label cannot be empty: it gets its saved text back
function onBlur() {
  if (editor.label(props.name).trim() === "") editor.setLabel(props.name, saved.value)
  if (editor.activeField.value === labelFieldId(props.name)) editor.activeField.value = null
}
</script>

<template>
  <component :is="tag" v-if="editor.editMode.value" data-inline-label>
    <InlineEditable
      :model-value="editor.label(name)"
      :label="ariaName"
      :placeholder="saved"
      :lang="editor.editLang.value"
      @update:model-value="editor.setLabel(name, $event)"
      @focus="onFocus"
      @blur="onBlur"
    />
  </component>
  <component :is="tag" v-else>{{ saved }}</component>
</template>
