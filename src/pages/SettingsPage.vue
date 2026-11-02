<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { ArrowLeft, Box, Folder, Wrench } from "lucide-vue-next"
import SoftwareEditor from "../components/portfolio/SoftwareEditor.vue"
import Models3dTab    from "../components/portfolio/Models3dTab.vue"
import MediaBrowser   from "../components/admin/media/MediaBrowser.vue"
import { useTranslations } from "../composables/useTranslations"

//ADMIN SETTINGS - the catalogues the pages draw from: software, 3D models and
//uploaded files. The open tab lives in the address (?tab=models) so the edit
//bar menu can link straight to it.

const route  = useRoute()
const router = useRouter()
const { t } = useTranslations()

type TabKey = "software" | "models" | "files"
const TABS: { key: TabKey; labelKey: string; icon: typeof Box }[] = [
  { key: "software", labelKey: "settingsTabSoftware", icon: Wrench },
  { key: "models",   labelKey: "settingsTabModels",   icon: Box },
  { key: "files",    labelKey: "settingsTabFiles",    icon: Folder },
]

const currentTab = computed<TabKey>(() => TABS.find((tab) => tab.key === route.query.tab)?.key ?? "software")

function openTab(key: TabKey) {
  void router.replace({ query: { ...route.query, tab: key } })
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-page__header">
      <RouterLink to="/" class="ed-btn">
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
        class="settings-page__tab"
        :class="{ 'settings-page__tab--active': currentTab === tab.key }"
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
      <MediaBrowser   v-else mode="manage" />
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: var(--vsui-page-width);
  margin: 0 auto;
  padding: var(--spacing-3xl) var(--spacing-xl);
  color: var(--editor-text);
}

.settings-page__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.settings-page__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  color: var(--color-text-hover);
}

.settings-page__tabs {
  display: flex;
  gap: var(--spacing-xxs);
  margin-bottom: var(--spacing-xl);
  overflow-x: auto;
  border-bottom: var(--border-width) solid var(--editor-line);
}

.settings-page__tab {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: var(--editor-target);
  padding: 0 var(--spacing-lg);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  white-space: nowrap;
  color: var(--editor-text-muted);
  box-shadow: inset 0 calc(-1 * var(--border-width-md)) 0 transparent;
  transition: color var(--transition-fast) ease, box-shadow var(--transition-fast) ease;
}

.settings-page__tab:hover { color: var(--color-text-hover); }
.settings-page__tab:focus-visible { outline: none; box-shadow: var(--editor-focus); }
.settings-page__tab--active {
  color: var(--editor-accent);
  box-shadow: inset 0 calc(-1 * var(--border-width-md)) 0 var(--editor-accent);
}

.settings-page__panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

@media (max-width: 640px) {
  .settings-page { padding: var(--spacing-lg) var(--spacing-md); }
  .settings-page__header { gap: var(--spacing-sm); }
}
</style>
