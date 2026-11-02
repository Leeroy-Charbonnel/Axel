<script setup lang="ts">
import { computed } from "vue"
import { useLanguage } from "../../composables/useLanguage"
import { IMAGE_SIZES } from "../../lib/media"
import SiteImage from "../SiteImage.vue"
import AnimatedReveal from "./AnimatedReveal.vue"
import SectionHeader from "./SectionHeader.vue"
import SoftwareChips from "./SoftwareChips.vue"
import EditableRegion from "../admin/EditableRegion.vue"
import type { ProfileDto, SoftwareDto } from "../../types/portfolio"

//ABOUT - portrait and bio on one side, the tools and the interests on the other.
const props = defineProps<{ profile: ProfileDto; software: SoftwareDto[] }>()

const { t, lang } = useLanguage()

const interestGroups = computed(() => [
  { key: "games", title: t("experienceGames"), items: props.profile.interests.games },
  { key: "art",   title: t("experienceArt"),   items: props.profile.interests.art },
].filter((group) => group.items.length > 0))
</script>

<template>
  <section id="about" class="site-section" aria-labelledby="about-title">
    <div class="site-container">
      <SectionHeader id="about-title" :title="t('experienceAbout')" />

      <AnimatedReveal>
        <EditableRegion kind="profile" :label="t('editorKindProfile')">
          <div class="about">
            <div class="about__intro">
              <SiteImage
                v-if="profile.avatarUrl"
                :src="profile.avatarUrl"
                :alt="profile.name"
                :sizes="IMAGE_SIZES.avatar"
                class="about__avatar"
              />
              <p class="about__bio">{{ profile.about[lang] }}</p>
            </div>

            <div class="about__side">
              <div v-if="software.length" class="about__group">
                <h3 class="site-eyebrow">{{ t("aboutSoftware") }}</h3>
                <SoftwareChips :software="software" />
              </div>

              <div v-if="interestGroups.length" class="about__group">
                <h3 class="site-eyebrow">{{ t("experienceInterest") }}</h3>
                <div class="about__interests">
                  <div v-for="group in interestGroups" :key="group.key">
                    <h4 class="about__interest-title">{{ group.title }}</h4>
                    <ul class="about__interest-list">
                      <li v-for="(item, i) in group.items" :key="i">{{ item }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </EditableRegion>
      </AnimatedReveal>
    </div>
  </section>
</template>

<style scoped>
.about {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: var(--site-col-gap);
}

.about__intro {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xl);
}

.about__avatar {
  flex-shrink: 0;
  width: var(--site-avatar);
  height: var(--site-avatar);
  object-fit: cover;
  border: var(--border-width-sm) solid var(--site-line);
}

.about__bio {
  max-width: var(--site-text-width);
  white-space: pre-line;
  font-size: var(--site-fs-h3);
  font-weight: var(--font-weight-medium);
  line-height: var(--site-lh-body);
  color: var(--site-text-body);
}

.about__side {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.about__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}


.about__interests {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.about__interest-title {
  margin-bottom: var(--spacing-xxs);
  font-size: var(--site-fs-small);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-tight);
  color: var(--site-text-heading);
}

.about__interest-list {
  list-style: none;
  font-size: var(--site-fs-small);
  color: var(--site-text-body);
}

@media (max-width: 1024px) {
  .about { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 640px) {
  .about__intro { flex-direction: column; }
}
</style>
