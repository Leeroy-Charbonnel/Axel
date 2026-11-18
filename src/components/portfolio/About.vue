<script setup lang="ts">
import { computed } from "vue"
import { useLanguage } from "../../composables/useLanguage"
import { IMAGE_SIZES } from "../../lib/media"
import { safeUrl } from "../../lib/safe-url"
import SiteImage from "../SiteImage.vue"
import AnimatedReveal from "./AnimatedReveal.vue"
import EditableRegion from "../admin/EditableRegion.vue"
import InlineText from "../admin/InlineText.vue"
import type { ProfileDto } from "../../types/portfolio"

//ABOUT CARD, under the timeline: the portrait (to Sketchfab) and the bio, then
//the contact details and the interests side by side
const props = defineProps<{ profile: ProfileDto }>()

const { t } = useLanguage()

const avatarHref = computed(() => safeUrl(props.profile.links.sketchfab))
const email      = computed(() => props.profile.contact.email.trim())
const mailto     = computed(() => (email.value ? safeUrl(`mailto:${email.value}`) : null))
const phone      = computed(() => props.profile.contact.phone.trim())
//a tel: link built from the digits only, so nothing else can ride along
const telHref    = computed(() => (phone.value ? `tel:${phone.value.replace(/[^\d+]/g, "")}` : null))
const instaHref  = computed(() => safeUrl(props.profile.links.instagram))
//"https://www.instagram.com/name/" reads as "@name"
const instaName  = computed(() => {
  if (!instaHref.value) return ""
  const handle = new URL(instaHref.value).pathname.split("/").filter(Boolean)[0]
  return handle ? `@${handle}` : instaHref.value
})
//the stored url is site-relative (/media/...): resolve it before the check
const cvHref     = computed(() => (props.profile.cvUrl ? safeUrl(new URL(props.profile.cvUrl, window.location.origin).href) : null))

const interestGroups = computed(() => [
  { key: "games", title: t("experienceGames"), items: props.profile.interests.games },
  { key: "art",   title: t("experienceArt"),   items: props.profile.interests.art },
].filter((group) => group.items.length > 0))
</script>

<template>
  <EditableRegion kind="profile" :label="t('editorKindProfile')">
    <div id="about" tabindex="-1" class="about">
      <AnimatedReveal class="about__section">
        <h3 class="about__heading">{{ t("experienceAbout") }}</h3>
        <div class="about__intro">
          <component
            :is="avatarHref ? 'a' : 'div'"
            v-if="profile.avatarUrl"
            :href="avatarHref ?? undefined"
            :target="avatarHref ? '_blank' : undefined"
            :rel="avatarHref ? 'noopener noreferrer' : undefined"
            class="about__avatar"
          >
            <SiteImage :src="profile.avatarUrl" :alt="profile.name" :sizes="IMAGE_SIZES.avatar" />
          </component>
          <InlineText
            kind="profile"
            field="about"
            :value="profile.about"
            :label="t('fieldAbout')"
            tag="p"
            multiline
            class="about__text"
          />
        </div>
      </AnimatedReveal>

      <div class="about__columns">
        <AnimatedReveal id="contact" tabindex="-1" :delay="0.2" class="about__contact">
          <h3 class="about__heading">{{ t("experienceContact") }}</h3>
          <ul class="about__list">
            <li v-if="telHref" class="about__item">
              <span class="about__label">{{ t("experiencePhone") }}</span>
              <a :href="telHref" class="about__link">{{ phone }}</a>
            </li>
            <li v-if="mailto" class="about__item">
              <span class="about__label">{{ t("experienceMail") }}</span>
              <a :href="mailto" class="about__link about__link--email">{{ email }}</a>
            </li>
            <li v-if="instaHref" class="about__item">
              <span class="about__label">{{ t("experienceInsta") }}</span>
              <a :href="instaHref" target="_blank" rel="noopener noreferrer" class="about__link">{{ instaName }}</a>
            </li>
            <li v-if="cvHref" class="about__item">
              <span class="about__label">{{ t("experienceCv") }}</span>
              <a :href="cvHref" download class="about__link">{{ t("contactCv") }}</a>
            </li>
          </ul>
        </AnimatedReveal>

        <AnimatedReveal v-if="interestGroups.length" :delay="0.3">
          <h3 class="about__heading">{{ t("experienceInterest") }}</h3>
          <div class="about__interests">
            <div v-for="group in interestGroups" :key="group.key">
              <h4 class="about__interest-title">{{ group.title }}</h4>
              <ul class="about__list">
                <li v-for="(item, i) in group.items" :key="i">{{ item }}</li>
              </ul>
            </div>
          </div>
        </AnimatedReveal>
      </div>
    </div>
  </EditableRegion>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  margin-top: var(--spacing-3xl);
  padding: var(--spacing-xl);
  border: var(--border-width-sm) solid var(--site-line);
  background-color: var(--site-card);
  scroll-margin-top: var(--site-chrome-top);
}

.about__contact { scroll-margin-top: var(--site-chrome-top); }

.about__heading {
  position: relative;
  width: fit-content;
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-normal);
  text-transform: uppercase;
  color: var(--site-text-heading);
}

/*the short rule under each heading*/
.about__heading::after {
  content: "";
  position: absolute;
  bottom: calc(-1 * var(--spacing-xs));
  left: 0;
  width: 40%;
  height: var(--border-width-md);
  background-color: var(--site-line-strong);
}

.about__intro {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.about__avatar {
  display: block;
  flex-shrink: 0;
  width: var(--site-avatar);
  aspect-ratio: 1;
  overflow: hidden;
  transition: box-shadow var(--site-duration-fast) ease;
}

a.about__avatar:hover { box-shadow: 0 0 0 var(--border-width-md) var(--site-line-strong); }

.about__avatar :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.about__text {
  max-width: var(--site-text-width);
  white-space: pre-line;
  color: var(--site-text-body);
}

.about__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xl);
}

.about__list {
  list-style: none;
  color: var(--site-text-body);
}

.about__item {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--spacing-md);
}

.about__label {
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  color: var(--site-text-caption);
}

.about__link {
  width: fit-content;
  max-width: 100%;
  color: var(--site-text-body);
  transition: color var(--site-duration-fast) ease;
}

.about__link:hover { color: var(--site-accent); }

.about__link--email { overflow-wrap: anywhere; }

.about__interests {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.about__interest-title {
  font-size: var(--site-fs-label);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-normal);
  text-transform: uppercase;
  color: var(--site-text-caption);
}

@media (max-width: 768px) {
  .about__section { text-align: center; }
  .about__section .about__heading { margin-inline: auto; }
  .about__section .about__heading::after { left: 30%; }

  .about__intro {
    flex-direction: column;
    align-items: center;
  }
}

@media (max-width: 768px) {
  .about { padding: var(--spacing-lg); }

  .about__columns,
  .about__interests { grid-template-columns: minmax(0, 1fr); }
}
</style>
