<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { ChevronDown } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import { useSectionNav } from "../../composables/useSectionNav"
import EditableRegion from "../admin/EditableRegion.vue"
import InlineText from "../admin/InlineText.vue"
import type { ProfileDto } from "../../types/portfolio"

//TITLE SCREEN - the framed viewport with its drifting grid: PORTFOLIO, the name
//with its last word in the accent, the headline, and a hint to scroll on.
const props = defineProps<{ profile: ProfileDto }>()

const { t } = useLanguage()
const { go } = useSectionNav()

//Where the last word of a name starts and ends, null for an empty name
function lastWord(name: string): { start: number; end: number } | null {
  const match = /\S+(?=\s*$)/.exec(name)
  return match ? { start: match.index, end: match.index + match[0].length } : null
}

const nameParts = computed(() => {
  const name = props.profile.name
  const last = lastWord(name)
  return last
    ? { first: name.slice(0, last.start).trim(), last: name.slice(last.start, last.end) }
    : { first: "", last: "" }
})

//Hide the hint once the visitor scrolled a quarter of the screen
const scrolled = ref(false)
function onScroll() {
  scrolled.value = window.scrollY > window.innerHeight / 4
}
onMounted(() => {
  onScroll()
  window.addEventListener("scroll", onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener("scroll", onScroll))
</script>

<template>
  <section id="home" tabindex="-1" class="hero" aria-labelledby="hero-title">
    <span class="hero__glow hero__glow--top" aria-hidden="true"></span>
    <span class="hero__glow hero__glow--bottom" aria-hidden="true"></span>

    <div class="hero__frame">
      <span class="hero__grid" aria-hidden="true"></span>

      <EditableRegion kind="profile" :label="t('editorKindProfile')">
        <div class="hero__content">
          <h1 id="hero-title" class="hero__heading">
            <span class="hero__title">{{ t("heroTitle") }}</span>{{ " " }}
            <InlineText kind="profile" field="name" :value="profile.name" :label="t('fieldName')" :accent="lastWord" class="hero__name">
              <span v-if="nameParts.first">{{ nameParts.first }}</span>{{ " " }}
              <span class="hero__name-last">{{ nameParts.last }}</span>
            </InlineText>
          </h1>
          <InlineText
            kind="profile"
            field="headline"
            :value="profile.headline"
            :label="t('fieldHeadline')"
            tag="p"
            optional
            class="hero__role"
          />
        </div>
      </EditableRegion>
    </div>

    <button
      type="button"
      class="hero__hint"
      :class="{ 'hero__hint--gone': scrolled }"
      :aria-label="t('heroScrollHint')"
      @click="go('projects')"
    >
      <ChevronDown aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100svh - var(--site-chrome-top));
  overflow-x: clip;
}

/*the divider under the title screen*/
.hero::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 10%;
  width: 80%;
  height: var(--border-width-md);
  background-color: var(--site-line);
}

.hero__glow {
  position: absolute;
  width: var(--glow-size);
  height: var(--glow-size);
  background-image: radial-gradient(circle, var(--site-hero-glow) 0%, transparent 25%);
  pointer-events: none;
}

.hero__glow--top {
  --glow-size: var(--site-hero-glow-top);
  top: calc(var(--glow-size) / -2);
  right: calc(var(--glow-size) / -2);
}

.hero__glow--bottom {
  --glow-size: var(--site-hero-glow-bottom);
  bottom: calc(var(--glow-size) / -2);
  left: calc(var(--glow-size) / -2);
}

.hero__frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(100% - var(--site-hero-inset));
  height: calc(100% - var(--site-hero-inset));
  border: var(--border-width-sm) solid var(--site-line-strong);
}

.hero__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--site-hero-grid-line) var(--border-width-sm), transparent var(--border-width-sm)),
    linear-gradient(90deg, var(--site-hero-grid-line) var(--border-width-sm), transparent var(--border-width-sm));
  background-size: var(--site-hero-grid) var(--site-hero-grid);
  pointer-events: none;
}

.hero__content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  text-align: center;
}

.hero__heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.hero__title {
  font-size: var(--site-hero-title);
  font-weight: var(--font-weight-black);
  line-height: var(--site-lh-tight);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--site-text-heading);
}

.hero__name {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-sm);
  font-size: var(--site-hero-name);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-normal);
  text-transform: uppercase;
  color: var(--site-text-body);
}

.hero__name-last { color: var(--site-accent); }

.hero__role {
  font-size: var(--site-hero-role);
  letter-spacing: var(--letter-spacing-normal);
  text-transform: uppercase;
  color: var(--site-text-caption);
}

.hero__hint {
  position: absolute;
  bottom: var(--spacing-xl);
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--site-touch-target);
  height: var(--site-touch-target);
  background-color: transparent;
  border: none;
  color: var(--site-text-body);
  cursor: pointer;
  transform: translateX(-50%);
  transition: opacity var(--site-reveal-duration) var(--site-ease), color var(--site-duration-fast) ease;
}

.hero__hint:hover { color: var(--site-accent); }

.hero__hint--gone {
  opacity: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .hero__grid { animation: hero-grid-drift var(--site-hero-grid-drift) linear infinite; }
  .hero__title { animation: hero-rise var(--site-reveal-duration) var(--site-ease) both; }
  .hero__name,
  .hero__role { animation: hero-fade calc(var(--site-reveal-duration) * 1.5) var(--site-ease) var(--site-reveal-duration) both; }
  .hero__hint > * {
    animation:
      hero-fade var(--site-reveal-duration) var(--site-ease) var(--site-hero-hint-delay) both,
      hero-bounce var(--site-hero-hint-bounce) ease-in-out var(--site-hero-hint-delay) infinite;
  }
}

@keyframes hero-grid-drift {
  from { background-position: 0 0; }
  to   { background-position: var(--site-hero-grid) var(--site-hero-grid); }
}

@keyframes hero-rise {
  from { opacity: 0; transform: translateY(var(--site-hero-rise)); }
  to   { opacity: 1; transform: none; }
}

@keyframes hero-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes hero-bounce {
  0%, 100% { transform: none; }
  50%      { transform: translateY(var(--site-hero-hint-shift)); }
}
</style>
