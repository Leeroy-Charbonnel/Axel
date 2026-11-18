<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ArrowLeft, Box, Folder, Palette, Wrench } from "lucide-vue-next"
import SoftwareEditor from "../components/portfolio/SoftwareEditor.vue"
import Models3dTab    from "../components/portfolio/Models3dTab.vue"
import MediaBrowser   from "../components/admin/media/MediaBrowser.vue"
import ThemeSettings  from "../components/admin/theme/ThemeSettings.vue"
import { useTranslations } from "../composables/useTranslations"

//ADMIN SETTINGS - the catalogues the pages draw from: software, 3D models and
//uploaded files, and the site theme. The open tab lives in the address (?tab=models) so the edit
//bar menu can link straight to it.

const route  = useRoute()
const router = useRouter()
const { t } = useTranslations()

type TabKey = "software" | "models" | "files" | "theme"
const TABS: { key: TabKey; labelKey: string; icon: typeof Box }[] = [
  { key: "software", labelKey: "settingsTabSoftware", icon: Wrench },
  { key: "models",   labelKey: "settingsTabModels",   icon: Box },
  { key: "files",    labelKey: "settingsTabFiles",    icon: Folder },
  { key: "theme",    labelKey: "settingsTabTheme",    icon: Palette },
]

const currentTab = computed<TabKey>(() => TABS.find((tab) => tab.key === route.query.tab)?.key ?? "software")

function openTab(key: TabKey) {
  void router.replace({ query: { ...route.query, tab: key } })
}
</script>

<template>
  <div class="ed-ui settings-page">
    <header class="settings-page__header">
      <RouterLink to="/" class="ed-btn ed-btn--ghost">
        <ArrowLeft :size="16" />
        <span>{{ t('settingsBack') }}</span>
      </RouterLink>
      <h1 class="settings-page__title">{{ t('settingsTitle') }}</h1>
    </header>

    <nav class="settings-page__tabs" :aria-label="t('settingsTitle')">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="ed-btn ed-btn--ghost settings-page__tab"
        :class="{ 'ed-btn--active': currentTab === tab.key }"
        :aria-current="currentTab === tab.key ? 'page' : undefined"
        @click="openTab(tab.key)"
      >
        <component :is="tab.icon" :size="16" aria-hidden="true" />
        <span>{{ t(tab.labelKey) }}</span>
      </button>
    </nav>

    <section class="settings-page__panel">
      <SoftwareEditor v-if="currentTab === 'software'" />
      <Models3dTab    v-else-if="currentTab === 'models'" />
      <ThemeSettings  v-else-if="currentTab === 'theme'" />
      <MediaBrowser   v-else mode="manage" />
    </section>
  </div>
</template>

<style scoped>
/*the column is centred by its own padding, so the surface runs edge to edge*/
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-lg);
  min-height: calc(100dvh - var(--editor-bar-offset));
  padding: var(--vsui-space-xl) max(var(--vsui-space-lg), (100% - var(--editor-page-width)) / 2);
  background-color: var(--editor-surface);
}

.settings-page__header {
  display: flex;
  align-items: center;
  gap: var(--vsui-space-sm);
  padding-bottom: var(--vsui-space-md);
  border-bottom: var(--border-width) solid var(--editor-line-soft);
}

.settings-page__title {
  font-size: var(--vsui-text-base);
  font-weight: var(--font-weight-semibold);
  color: var(--editor-text);
}

/*TABS - a compact segmented row*/
.settings-page__tabs {
  display: flex;
  align-self: flex-start;
  gap: var(--vsui-space-2xs);
  max-width: 100%;
  padding: var(--vsui-space-2xs);
  overflow-x: auto;
  scrollbar-width: thin;
  background-color: var(--editor-input-bg);
  border-radius: var(--editor-radius);
}

.settings-page__tab {
  flex-shrink: 0;
  min-height: calc(var(--editor-control) - 2 * var(--vsui-space-2xs));
}

.settings-page__tab:not(.ed-btn--active) { color: var(--editor-text-muted); }
.settings-page__tab:not(.ed-btn--active):hover { color: var(--editor-text); }

.settings-page__panel {
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-lg);
}

@media (max-width: 640px) {
  .settings-page { padding: var(--vsui-space-md); }
}
</style>
