<script setup lang="ts">
import { lastSectionCounts } from "../../composables/usePortfolio"

//THE PAGE WHILE /api/portfolio IS IN FLIGHT, in the shapes of what is coming:
//the title screen, a project still, the gallery cells. The counts are
//the ones this browser drew last time (see usePortfolio).
const counts = lastSectionCounts()
</script>

<template>
  <div class="skeleton" aria-hidden="true">
    <section class="skeleton__hero">
      <div class="skeleton__hero-frame">
        <div class="skeleton__block skeleton__hero-title"></div>
        <div class="skeleton__block skeleton__line"></div>
      </div>
    </section>

    <section class="site-section">
      <div class="site-container skeleton__stack">
        <div class="skeleton__block skeleton__title"></div>
        <div v-for="i in Math.min(counts.projects, 2)" :key="i" class="skeleton__block skeleton__frame"></div>
      </div>
    </section>

    <section class="site-section">
      <div class="site-container skeleton__stack">
        <div class="skeleton__block skeleton__title"></div>
        <div class="skeleton__gallery">
          <div v-for="i in counts.gallery" :key="i" class="skeleton__block skeleton__card"></div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.skeleton__block { background-color: var(--site-surface-hover); }

.skeleton__hero {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100svh - var(--site-chrome-top));
}

.skeleton__hero-frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  width: calc(100% - var(--site-hero-inset));
  height: calc(100% - var(--site-hero-inset));
  border: var(--border-width-sm) solid var(--site-line);
}

.skeleton__hero-title {
  width: var(--site-skeleton-mid);
  height: var(--site-hero-title);
}

.skeleton__stack {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.skeleton__line {
  width: var(--site-skeleton-short);
  height: var(--site-fs-h3);
}

.skeleton__frame {
  width: 100%;
  aspect-ratio: var(--site-still-aspect);
}

.skeleton__title {
  width: var(--site-skeleton-title);
  height: var(--site-fs-h2);
}

.skeleton__gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--site-gallery-min)), 1fr));
  gap: var(--site-col-gap);
}

.skeleton__card { aspect-ratio: var(--site-gallery-aspect); }

/*the placeholders breathe, so a slow network reads as loading, not broken*/
@media (prefers-reduced-motion: no-preference) {
  .skeleton__block { animation: skeleton-pulse 1.6s ease-in-out infinite; }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
</style>
