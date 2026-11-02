<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, watchEffect } from "vue"
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router"
import { ArrowLeft, ArrowRight } from "lucide-vue-next"
import { useEditor } from "../composables/useEditor"
import { useLanguage } from "../composables/useLanguage"
import { apiJson, usePortfolio } from "../composables/usePortfolio"
import { useSnapshotHistory } from "../composables/useSnapshotHistory"
import { pickBilingual } from "../lib/markdown"
import type { Lang } from "../lib/lang"
import EditableRegion from "../components/admin/EditableRegion.vue"
import DetailGrid from "../components/portfolio/detail/DetailGrid.vue"
import BentoEditor from "../components/portfolio/detail/BentoEditor.vue"
import ProjectMedia from "../components/portfolio/ProjectMedia.vue"
import ProjectSpecStrip from "../components/portfolio/ProjectSpecStrip.vue"
import SoftwareChips from "../components/portfolio/SoftwareChips.vue"
import { hasContent, storedContent } from "../components/portfolio/detail/block-types"
import NotFoundPage from "./NotFoundPage.vue"
import type { DetailBlock, DetailPage } from "../types/portfolio"

//PROJECT DETAIL PAGE - a case study: header (title, year, role, summary, spec
//strip, software), the content blocks (or, while there are none, the still,
//its thumbnails and the 3D model) and the previous / next published project.
//For the admin in edit
//mode the header is an editable region (inspector) and the blocks become the
//bento editor; the blocks are this page's own state, saved through the edit
//bar.

const route  = useRoute()
const router = useRouter()
const { lang, t } = useLanguage()
const editor = useEditor()
const { editMode, editLang } = editor
const portfolio = usePortfolio()
const { data } = portfolio

//the edit bar picks the language being written; the canvas shows that one
const shownLang = computed<Lang>(() => editMode.value ? editLang.value : lang.value)

const SKELETON_BLOCKS = 4

const projectId = computed(() => Number(route.params.id))
const source  = computed(() => data.value?.mainProjects.find((p) => p.id === projectId.value) ?? null)
const project = computed(() => source.value ? editor.display("mainProject", source.value) : null)
const title   = computed(() => pickBilingual(project.value?.title, shownLang.value))

const published = computed(() => (data.value?.mainProjects ?? []).filter((p) => p.published))
const position  = computed(() => published.value.findIndex((p) => p.id === projectId.value))
const prev = computed(() => position.value > 0 ? published.value[position.value - 1]! : null)
const next = computed(() => position.value >= 0 ? published.value[position.value + 1] ?? null : null)
const indexLabel = computed(() => t("detailIndex")
  .replace("{n}", String(position.value + 1).padStart(2, "0"))
  .replace("{total}", String(published.value.length).padStart(2, "0")))


watchEffect(() => {
  if (title.value) document.title = `${title.value} | ${t("siteTitle")}`
})

//BLOCKS - a local copy, its history, and what was last saved
const blocks    = ref<DetailBlock[]>([])
const savedJson = ref("[]")
const history   = useSnapshotHistory(blocks)
const dirty     = computed(() => JSON.stringify(blocks.value) !== savedJson.value)
//what a visitor sees: unfinished blocks are left out
const shownBlocks = computed(() => blocks.value.filter((b) => hasContent(b, shownLang.value, data.value?.models ?? [])))

function syncBlocks() {
  blocks.value = JSON.parse(JSON.stringify(source.value?.detailPage.blocks ?? [])) as DetailBlock[]
  savedJson.value = JSON.stringify(blocks.value)
  history.reset()
}

//fresh data replaces the copy unless it holds unsaved work
watch([() => portfolio.loaded.value, projectId], ([loaded]) => {
  if (loaded && !dirty.value) syncBlocks()
}, { immediate: true })

async function save() {
  history.commit()
  const sent = JSON.stringify(blocks.value)
  const page: DetailPage = { blocks: blocks.value.map((b) => ({ ...b, content: storedContent(b) })) }
  await apiJson("PUT", `/api/main-project/${projectId.value}`, { detailPage: page })
  savedJson.value = sent
  history.reset()
}

const unregister = editor.registerPageActions({
  save,
  discard:  syncBlocks,
  dirty,
  undo:     history.undo,
  redo:     history.redo,
  canUndo:  history.canUndo,
  canRedo:  history.canRedo,
})
onBeforeUnmount(unregister)

//leaving with unsaved work asks first, including previous / next
async function guardLeave() {
  if (!editMode.value || !editor.dirty.value) return true
  return editor.confirmDiscard()
}
onBeforeRouteLeave(guardLeave)
onBeforeRouteUpdate(guardLeave)

function goBack() {
  if (window.history.state?.back) router.back()
  else void router.push("/")
}
</script>

<template>
  <NotFoundPage v-if="portfolio.loaded.value && !portfolio.error.value && !project" />
  <article v-else class="case" :class="{ 'case--editing': editMode }" :lang="shownLang">
    <div v-if="!portfolio.loaded.value && !portfolio.error.value" class="site-container case__skeleton" aria-busy="true">
      <span class="case__skel case__skel--line"></span>
      <span class="case__skel case__skel--title"></span>
      <span class="case__skel case__skel--text"></span>
      <div class="case__skel-grid">
        <span v-for="i in SKELETON_BLOCKS" :key="i" class="case__skel"></span>
      </div>
    </div>

    <div v-else-if="portfolio.error.value || !project" class="site-container case__missing">
      <a class="case__back" href="/" @click.prevent="goBack">
        <ArrowLeft :size="16" aria-hidden="true" />
        <span>{{ t('detailBack') }}</span>
      </a>
      <p class="case__missing-text" role="alert">{{ portfolio.error.value }}</p>
    </div>

    <template v-else>
      <header class="site-container case__head">
        <a class="case__back" href="/" @click.prevent="goBack">
          <ArrowLeft :size="16" aria-hidden="true" />
          <span>{{ t('detailBack') }}</span>
        </a>

        <EditableRegion kind="mainProject" :id="project.id" :label="t('editorKindMainProject')">
          <div class="case__intro">
            <p class="site-eyebrow case__eyebrow">
              <span v-if="position >= 0">{{ indexLabel }}</span>
              <span v-else class="case__draft">{{ t('detailUnpublished') }}</span>
              <span v-if="project.year">{{ project.year }}</span>
            </p>
            <h1 class="case__title">{{ title }}</h1>

            <div class="case__summary">
              <p class="case__description">{{ pickBilingual(project.description, shownLang) }}</p>
              <dl class="case__facts">
                <div v-if="pickBilingual(project.role, shownLang)" class="case__fact">
                  <dt>{{ t('detailRole') }}</dt>
                  <dd>{{ pickBilingual(project.role, shownLang) }}</dd>
                </div>
                <div v-if="project.year" class="case__fact">
                  <dt>{{ t('detailYear') }}</dt>
                  <dd>{{ project.year }}</dd>
                </div>
                <div v-if="project.software.length" class="case__fact">
                  <dt>{{ t('detailSoftware') }}</dt>
                  <dd><SoftwareChips :software="project.software" /></dd>
                </div>
              </dl>
            </div>

            <ProjectSpecStrip :stats="project.stats" :lang="shownLang" />
          </div>
        </EditableRegion>
      </header>

      <section class="site-container case__blocks" :aria-label="title">
        <BentoEditor v-if="editMode" v-model:blocks="blocks" :lang="shownLang" :commit="history.commit" />
        <DetailGrid v-else-if="shownBlocks.length" :blocks="shownBlocks" :lang="shownLang" />
        <ProjectMedia v-else :project="project" />
      </section>

      <nav v-if="prev || next" class="site-container case__pager" :aria-label="t('detailPager')">
        <RouterLink v-if="prev" :to="`/project/${prev.id}`" class="case__pager-link">
          <span class="case__pager-label"><ArrowLeft :size="16" aria-hidden="true" />{{ t('detailPrev') }}</span>
          <span class="case__pager-title">{{ pickBilingual(prev.title, shownLang) }}</span>
        </RouterLink>
        <RouterLink v-if="next" :to="`/project/${next.id}`" class="case__pager-link case__pager-link--next">
          <span class="case__pager-label">{{ t('detailNext') }}<ArrowRight :size="16" aria-hidden="true" /></span>
          <span class="case__pager-title">{{ pickBilingual(next.title, shownLang) }}</span>
        </RouterLink>
      </nav>
    </template>
  </article>
</template>

<style scoped>
.case {
  display: flex;
  flex-direction: column;
  gap: var(--site-section-gap);
  padding-top: var(--spacing-3xl);
  padding-bottom: var(--site-section-gap);
  font-family: var(--site-font);
  color: var(--site-text-body);
}
.site-container {
  width: 100%;
  max-width: calc(var(--site-max-width) + 2 * var(--site-gutter));
  margin-inline: auto;
  padding-inline: var(--site-gutter);
}
/*the panel sits on the right edge (bottom sheet below 1025px)*/
.case--editing { padding-right: var(--detail-panel-width); }
@media (max-width: 1024px) {
  .case--editing { padding-right: 0; padding-bottom: calc(var(--detail-sheet-height) + var(--spacing-xl)); }
}

/*HEADER*/
.case__head {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  animation: case-rise var(--site-reveal-duration) var(--site-ease) both;
}
.case__back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--spacing-xs);
  min-height: var(--site-touch-target);
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
  transition: color var(--transition-fast) ease;
}
.case__back:hover { color: var(--site-text-heading); }
.case__back:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: var(--vsui-space-2xs); }
.case__intro {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.case__eyebrow {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin: 0;
}
.case__draft { color: var(--site-accent); }
.case__title {
  margin: 0;
  font-size: var(--site-fs-h1);
  line-height: var(--site-lh-tight);
  font-weight: var(--site-fw-display);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-heading);
  color: var(--site-text-heading);
  overflow-wrap: break-word;
  hyphens: auto;
}
.case__summary {
  display: grid;
  grid-template-columns: repeat(var(--site-columns), minmax(0, 1fr));
  column-gap: var(--site-col-gap);
  row-gap: var(--spacing-xl);
}
.case__description {
  grid-column: 1 / span 7;
  max-width: var(--site-text-width);
  margin: 0;
  font-size: var(--site-fs-body);
  line-height: var(--site-lh-body);
  white-space: pre-line;
}
.case__facts {
  grid-column: 9 / span 4;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin: 0;
}
.case__fact {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
}
.case__fact dt {
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
}
.case__fact dd {
  margin: 0;
  font-size: var(--site-fs-small);
  color: var(--site-text-heading);
}

/*PREVIOUS / NEXT*/
.case__pager {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--site-col-gap);
}
.case__pager-link {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-md);
  border-top: var(--border-width) solid var(--site-line);
  transition: border-color var(--transition-fast) ease;
}
.case__pager-link--next { grid-column: 2; align-items: flex-end; text-align: right; }
.case__pager-link:hover { border-color: var(--site-accent); }
.case__pager-link:focus-visible { outline: var(--border-width-md) solid hsl(var(--ring)); outline-offset: var(--vsui-space-2xs); }
.case__pager-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--site-fs-label);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-label);
  color: var(--site-text-caption);
}
.case__pager-title {
  font-size: var(--site-fs-h3);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--site-tracking-heading);
  color: var(--site-text-heading);
}

/*MISSING / LOADING*/
.case__missing { display: flex; flex-direction: column; gap: var(--spacing-xl); }
.case__missing-text {
  margin: 0;
  font-size: var(--site-fs-h3);
  color: var(--site-text-heading);
}
.case__skeleton { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.case__skel {
  display: block;
  height: var(--detail-row-h);
  background-color: var(--tag-bg);
}
.case__skel--line  { width: var(--detail-skel-short); height: var(--spacing-md); }
.case__skel--title { width: var(--detail-skel-long); height: var(--site-fs-h1); }
.case__skel--text  { max-width: var(--site-text-width); height: var(--spacing-3xl); }
.case__skel-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--detail-gap);
  margin-top: var(--spacing-xl);
}
.case__skel-grid .case__skel:first-child { grid-column: span 2; }
@media (prefers-reduced-motion: no-preference) {
  .case__skel { animation: case-pulse var(--detail-skel-pulse) ease-in-out infinite; }
}
@keyframes case-pulse {
  50% { opacity: var(--detail-skel-dim); }
}
@keyframes case-rise {
  from { opacity: 0; transform: translateY(var(--site-reveal-distance)); }
}

/*TABLET AND PHONE*/
@media (max-width: 1024px) {
  .case__description,
  .case__facts { grid-column: 1 / -1; }
  .case__facts { flex-direction: row; flex-wrap: wrap; gap: var(--spacing-lg) var(--spacing-2xl); }
}
@media (max-width: 640px) {
  .case { padding-top: var(--spacing-lg); }
  .case__pager { grid-template-columns: minmax(0, 1fr); }
  .case__pager-link--next { grid-column: 1; }
  .case__skel-grid { grid-template-columns: minmax(0, 1fr); }
  .case__skel-grid .case__skel:first-child { grid-column: auto; }
}
</style>
