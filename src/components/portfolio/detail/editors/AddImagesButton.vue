<script setup lang="ts">
import { Images } from "lucide-vue-next"
import { useMediaLibrary, type MediaFile } from "../../../admin/media/useMediaLibrary"
import { useTranslations } from "../../../../composables/useTranslations"

//SEVERAL IMAGES AT ONCE - picked together in the media library, in the order
//they were ticked; the list editor turns each one into an item
const emit = defineEmits<{ add: [files: MediaFile[]] }>()
const { t } = useTranslations()
const { pickMedia } = useMediaLibrary()

async function pick() {
  const files = await pickMedia({ accept: "image", multiple: true })
  if (files.length) emit("add", files)
}
</script>

<template>
  <button type="button" class="ed-btn" @click="pick">
    <Images :size="16" aria-hidden="true" />
    {{ t('blockAddImages') }}
  </button>
</template>
