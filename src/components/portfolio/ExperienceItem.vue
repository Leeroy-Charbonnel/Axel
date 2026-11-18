<script setup lang="ts">
import { computed } from "vue"
import { useLanguage } from "../../composables/useLanguage"
import { useEditor } from "../../composables/useEditor"
import EditableRegion from "../admin/EditableRegion.vue"
import InlineText from "../admin/InlineText.vue"
import { bulletSlots } from "../admin/entities"
import UnpublishedBadge from "./UnpublishedBadge.vue"
import type { ExperienceDto } from "../../types/portfolio"

//ONE ROW OF THE TIMELINE: the period stacked on the left, a vertical line, then
//the role, the company (city), the summary and the bullets
const props = defineProps<{ experience: ExperienceDto }>()

const { t, lang } = useLanguage()
const { editMode } = useEditor()

//"06.2023-ACT." is drawn on two lines, or as "06.2023 – ACT." on a phone
const periodParts = computed(() => props.experience.period[lang.value].split("-").map((s) => s.trim()).filter(Boolean))
const bullets = computed(() => props.experience.description[lang.value].filter((b) => b.trim() !== ""))
//Edit mode lists every bullet slot, as the inspector does
const bulletCount = computed(() => bulletSlots(props.experience.description))
</script>

<template>
  <EditableRegion kind="experience" :id="experience.id" :label="t('editorKindExperience')">
    <article class="job" :class="{ 'site-unpublished': !experience.published }">
      <UnpublishedBadge :published="experience.published" />
      <InlineText
        kind="experience"
        :item-id="experience.id"
        field="period"
        :value="experience.period"
        :label="t('fieldPeriod')"
        tag="p"
        class="job__period"
      >
        <span v-for="(part, i) in periodParts" :key="i" class="job__period-part">{{ part }}</span>
      </InlineText>
      <div class="job__body">
        <InlineText
          kind="experience"
          :item-id="experience.id"
          field="title"
          :value="experience.title"
          :label="t('fieldJobTitle')"
          tag="h3"
          class="job__title"
        />
        <p v-if="experience.company || experience.location || editMode" class="job__where">
          <InlineText
            kind="experience"
            :item-id="experience.id"
            field="company"
            :value="experience.company"
            :label="t('fieldCompany')"
            optional
          />
          <InlineText
            v-slot="{ text }"
            kind="experience"
            :item-id="experience.id"
            field="location"
            :value="experience.location"
            :label="t('fieldLocation')"
            optional
            class="job__location"
          >({{ text }})</InlineText>
        </p>
        <InlineText
          kind="experience"
          :item-id="experience.id"
          field="summary"
          :value="experience.summary"
          :label="t('fieldSummary')"
          tag="p"
          multiline
          optional
          class="job__summary"
        />
        <ul v-if="bullets.length || (editMode && bulletCount)" class="job__bullets">
          <InlineText
            v-for="i in bulletCount"
            :key="i"
            kind="experience"
            :item-id="experience.id"
            field="description"
            :index="i - 1"
            :value="experience.description"
            :label="`${t('fieldBullet')} ${i}`"
            tag="li"
            optional
          />
        </ul>
      </div>
    </article>
  </EditableRegion>
</template>

<style scoped>
.job {
  position: relative;
  display: grid;
  grid-template-columns: var(--site-exp-period) minmax(0, 1fr);
  gap: var(--spacing-md);
  align-items: start;
}

.job__period {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-right: var(--spacing-md);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--site-text-heading);
}

.job__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-left: var(--spacing-xl);
  border-left: var(--border-width-sm) solid var(--site-line-strong);
}

.job__title {
  font-size: var(--site-exp-title);
  font-weight: var(--font-weight-bold);
  line-height: var(--site-lh-tight);
  letter-spacing: var(--letter-spacing-normal);
  color: var(--site-text-heading);
}

.job__where {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xxs);
  font-size: var(--site-exp-company);
  color: var(--site-text-body);
}

.job__location { color: var(--site-text-caption); }

.job__summary {
  max-width: var(--site-text-width);
  white-space: pre-line;
  color: var(--site-text-body);
}

.job__bullets {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  max-width: var(--site-text-width);
  list-style: none;
  color: var(--site-text-body);
}

.job__bullets li {
  position: relative;
  padding-left: var(--spacing-lg);
}

.job__bullets li::before {
  content: "";
  position: absolute;
  top: calc(var(--site-lh-body) * 0.5em);
  left: 0;
  width: var(--spacing-sm);
  height: var(--border-width-md);
  background-color: var(--site-text-caption);
}

@media (max-width: 768px) {
  .job { grid-template-columns: minmax(0, 1fr); }

  .job__period {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    padding-right: 0;
  }

  .job__period-part + .job__period-part::before {
    content: "\2013";
    margin-right: var(--spacing-xs);
  }

  .job__body { padding-left: var(--spacing-md); }
}
</style>
