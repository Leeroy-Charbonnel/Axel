import { computed, ref, type Ref } from "vue"
import { useEffectiveViewerSettings, useResolvedGlbUrl } from "./useEffectiveViewerSettings"
import { useIsMobile } from "./useIsMobile"
import { useLanguage } from "./useLanguage"
import { useLightbox } from "./useLightbox"
import { usePortfolio } from "./usePortfolio"
import { pickBilingual } from "../lib/markdown"
import type { MainProjectDto, ThumbnailDto } from "../types/portfolio"

//WHAT A PROJECT CARD KNOWS BEYOND ITS MARKUP: the 3D model it can open, the
//still it shows (lit or wireframe) and the slides it hands the lightbox.
//showWireframe is passed in when another component shares the same mode
export function useProjectCard(project: Ref<MainProjectDto>, showWireframe: Ref<boolean> = ref(false)) {
  const { lang, t } = useLanguage()
  const { data: portfolioData } = usePortfolio()
  const { open: openLightbox } = useLightbox()
  const { isMobile } = useIsMobile()

  const desktopSettings = useEffectiveViewerSettings(project, portfolioData)
  const mobileSettings  = useEffectiveViewerSettings(project, portfolioData, { mobile: true })
  const viewerSettings  = computed(() => (isMobile.value ? mobileSettings.value : desktopSettings.value))
  const glbUrl          = useResolvedGlbUrl(project, portfolioData)

  //wireframe mode: the viewer's own mode when there is a model, the button when
  //there is only the still; the thumbnails and the lightbox follow it
  const hasWireframe  = computed(() => Boolean(project.value.mainWireframeUrl))
  const stillUrl      = computed(() =>
    showWireframe.value && project.value.mainWireframeUrl ? project.value.mainWireframeUrl : project.value.mainImageUrl)

  //the other language when this one is empty, as on the project page
  const title       = computed(() => pickBilingual(project.value.title, lang.value))
  const role        = computed(() => pickBilingual(project.value.role, lang.value))
  const description = computed(() => pickBilingual(project.value.description, lang.value))

  //a thumbnail as shown: its wireframe render in wireframe mode, when it has one
  const thumbUrl = (thumb: ThumbnailDto) => (showWireframe.value && thumb.wireframeUrl ? thumb.wireframeUrl : thumb.url)

  const slides = computed(() => {
    const list: { url: string; alt: string }[] = []
    if (stillUrl.value) list.push({ url: stillUrl.value, alt: title.value })
    for (const thumb of project.value.thumbnails) {
      const url = thumbUrl(thumb)
      if (url) list.push({ url, alt: thumb.description[lang.value] })
    }
    return list
  })

  function openStill() {
    openLightbox(slides.value, 0)
  }

  //slides skip images without a file, so a thumbnail is found by url, not position
  function openThumbnail(thumb: ThumbnailDto) {
    openLightbox(slides.value, slides.value.findIndex((s) => s.url === thumbUrl(thumb)))
  }

  return { lang, t, title, role, description, viewerSettings, glbUrl, showWireframe, hasWireframe, stillUrl, openStill, openThumbnail }
}
