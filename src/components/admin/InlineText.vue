<script setup lang="ts" generic="K extends EntityKind">
import { computed } from "vue"
import InlineEditable from "./InlineEditable.vue"
import { useEditor } from "../../composables/useEditor"
import { useTranslations } from "../../composables/useTranslations"
import { pickBilingual } from "../../lib/bilingual"
import type { Lang } from "../../lib/lang"
import type { Bilingual, ProjectStats } from "../../types/portfolio"
import { entityKey, titleOf, type DraftOf, type EntityId, type EntityKind, type EntityOf } from "./entities"

//A TEXT OF THE PAGE, TYPED IN PLACE. Outside edit mode it renders its element
//with the text, or with its slot when the text needs more markup. In edit mode
//the same element holds a plain text box for the site's language: typing
//patches the entity's draft, so the inspector field follows; a change from the
//inspector, an undo or a language switch rewrites the text and keeps the caret.

type ListPerLang = Record<Lang, string[]>
//One named part of a field: contact.phone, interests.games, stats.vertices
type Parts = Record<string, string | string[] | number | undefined>
type InlineValue = string | Bilingual | ListPerLang | ProjectStats | Parts
interface TextPart { start: number; end: number }

const props = withDefaults(defineProps<{
  kind:       K
  itemId?:    EntityId
  field:      keyof EntityOf[K] & string
  //A plain string, a text per language, or a list per language with index
  value:      InlineValue
  index?:     number
  //The part of the value to type, in place of the language
  part?:      string
  //The part is a whole number
  numeric?:   boolean
  label:      string
  tag?:       string
  multiline?: boolean
  //Read mode leaves the element out when the text is empty
  optional?:  boolean
  //Read mode shows the other language when this one is empty
  fallback?:  boolean
  //The part drawn in the accent while typing, as the read mode draws it
  accent?:    (text: string) => TextPart | null
  //Takes the typed value instead of the entity's draft, for a text a page keeps in its own state
  write?:     (value: InlineValue) => void
}>(), {
  itemId: null, index: undefined, part: undefined, numeric: false, tag: "span", multiline: false, optional: false, fallback: false,
  accent: undefined, write: undefined,
})

defineSlots<{ default?: (scope: { text: string }) => unknown }>()

const editor = useEditor()
const { t } = useTranslations()
const lang = editor.editLang

//A text that is the same in every language
const plain = computed(() => typeof props.value === "string" || props.part !== undefined)
//Where the text sits in an object value
const slotKey = computed(() => props.part ?? lang.value)

function slotOf(value: InlineValue): string | string[] | number | undefined {
  return typeof value === "string" ? value : (value as Parts)[slotKey.value]
}

function listOf(value: InlineValue): string[] {
  const list = slotOf(value)
  if (!Array.isArray(list)) throw new Error(`InlineText: ${props.field}.${slotKey.value} is not a list`)
  return list
}

//The text being typed: this language only
const raw = computed(() => {
  if (props.index !== undefined) return listOf(props.value)[props.index] ?? ""
  const slot = slotOf(props.value)
  if (Array.isArray(slot)) throw new Error(`InlineText: ${props.field}.${slotKey.value} is a list, it needs an index`)
  //A count of zero is an empty box
  if (props.numeric) return slot ? String(slot) : ""
  return String(slot ?? "")
})

const shown = computed(() => props.fallback && !plain.value && props.index === undefined
  ? pickBilingual(props.value as Bilingual, lang.value)
  : raw.value)

const placeholder = computed(() => plain.value
  ? props.label
  : t("inlineTextPlaceholder").replace("{field}", props.label).replace("{lang}", lang.value.toUpperCase()))

//The field and its saved item, so every text box has its own name
const ariaName = computed(() => {
  const entity = editor.find(props.kind, props.itemId)
  if (!entity) throw new Error(`InlineText: ${entityKey(props.kind, props.itemId)} is not in the portfolio`)
  const title = titleOf(props.kind, entity, lang.value)
  return title ? `${props.label} - ${title}` : props.label
})

function nextValue(text: string): InlineValue {
  const value = props.value
  if (typeof value === "string") return text
  //A typed count stays a whole number the server can store
  if (props.numeric) return { ...value, [slotKey.value]: Math.min(Number(text), Number.MAX_SAFE_INTEGER) }
  if (props.index === undefined) return { ...value, [slotKey.value]: text }
  const list = listOf(value)
  const next = Array.from({ length: Math.max(list.length, props.index + 1) }, (_, i) => list[i] ?? "")
  next[props.index] = text
  return { ...value, [slotKey.value]: next }
}

function commit(text: string) {
  if (props.write) return props.write(nextValue(text))
  editor.patch(props.kind, props.itemId, { [props.field]: nextValue(text) } as DraftOf<K>)
}

//Selects the item and points the inspector at this field
function onFocus() {
  if (props.write) return
  editor.select(props.kind, props.itemId)
  editor.activeField.value = props.label
}

function onBlur() {
  if (editor.activeField.value === props.label) editor.activeField.value = null
}
</script>

<template>
  <!--The element keeps its own role (heading, list item); the text box is inside-->
  <component :is="tag" v-if="editor.editMode.value">
    <InlineEditable
      :model-value="raw"
      :label="ariaName"
      :placeholder="placeholder"
      :multiline="multiline"
      :digits="numeric"
      :lang="plain ? undefined : lang"
      :accent="accent"
      @update:model-value="commit"
      @focus="onFocus"
      @blur="onBlur"
    />
  </component>
  <component :is="tag" v-else-if="!optional || shown.trim() !== ''">
    <slot :text="shown">{{ shown }}</slot>
  </component>
</template>
