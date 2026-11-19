<script setup lang="ts" generic="T extends string | Bilingual">
import { computed } from "vue"
import { useRoute } from "vue-router"
import InlineText from "../../admin/InlineText.vue"
import type { Bilingual } from "../../../types/portfolio"

//A TEXT OF A BLOCK, TYPED ON THE PAGE. The blocks are the page's own state,
//not an entity draft: the typed value goes back to the block, where the panel
//field reads it, and the page history records it. Outside edit mode it is the
//plain element with its text.

defineProps<{
  //A plain string, or a text per language
  value:      T
  label:      string
  tag?:       string
  multiline?: boolean
  //Read mode leaves the element out when the text is empty
  optional?:  boolean
}>()
const emit = defineEmits<{ write: [value: T] }>()
defineSlots<{ default?: (scope: { text: string }) => unknown }>()

const route = useRoute()
const projectId = computed(() => Number(route.params.id))
</script>

<template>
  <InlineText
    kind="mainProject"
    :item-id="projectId"
    field="detailPage"
    :value="value"
    :label="label"
    :tag="tag"
    :multiline="multiline"
    :optional="optional"
    fallback
    :write="(v) => emit('write', v as T)"
  >
    <template v-if="$slots.default" #default="{ text }">
      <slot :text="text" />
    </template>
  </InlineText>
</template>
