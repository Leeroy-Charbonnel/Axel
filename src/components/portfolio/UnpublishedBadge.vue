<script setup lang="ts">
import { useEditor } from "../../composables/useEditor"
import { useLanguage } from "../../composables/useLanguage"

//THE MARK OF AN ITEM VISITORS DO NOT SEE. Only drawn in edit mode; the parent
//carries .site-unpublished so the rest of the item is dimmed.
defineProps<{ published: boolean }>()

const { editMode } = useEditor()
const { t } = useLanguage()
</script>

<template>
  <span v-if="editMode && !published" class="site-unpublished__badge">{{ t("unpublished") }}</span>
</template>
