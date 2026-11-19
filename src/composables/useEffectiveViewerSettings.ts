import { computed, type ComputedRef, type Ref } from "vue"
import type { ViewerSettings } from "../three/types"
import type { EditorPrefsDto, MainProjectDto, Model3dDto, PortfolioDto } from "../types/portfolio"

//EFFECTIVE VIEWER SETTINGS - the model's viewerSettings snapshot with the
//admin's GLOBAL editor3d_* prefs layered on top (glow colour, line width, how
//the swept surfaces take the light). The globals always win, so a tweak in the
//editor reaches every model on the site instead of staying frozen in whichever
//was saved last. The wireframe colours are each model's own.
//
//The camera comes from the named view the project (or block) picks, desktop or
//phone. A name that matches no view leaves startView null: the viewer then uses
//the model's default view for its frame, or frames the model on its own.

type Source<T> = Ref<T> | ComputedRef<T> | { value: T }

export function applyEditorPrefs(raw: unknown, prefs: EditorPrefsDto | undefined): ViewerSettings {
  const base = (raw ?? {}) as ViewerSettings
  const next: ViewerSettings = { ...base, wireframeMode: { ...(base.wireframeMode ?? {}) } }
  const wf = next.wireframeMode!
  if (prefs?.wireframeModeColor) wf.color        = prefs.wireframeModeColor
  if (prefs?.wireframeLineWidth) {
    const width = Number(prefs.wireframeLineWidth)
    if (Number.isFinite(width) && width > 0) wf.overlayLineWidth = width
    else console.warn(`[applyEditorPrefs] malformed editor3d_wireframe_line_width pref "${prefs.wireframeLineWidth}", ignored`)
  }
  if (prefs?.wireframeMaterial) {
    try {
      wf.material = JSON.parse(prefs.wireframeMaterial)
    } catch (e) {
      //corrupt global pref: keep the per-model material but leave a trace
      console.warn("[applyEditorPrefs] malformed editor3d_wireframe_material pref, ignored:", e)
    }
  }
  return next
}

//Settings for one model seen through one named view.
export function viewerSettingsFor(model: Model3dDto, viewName: string, prefs: EditorPrefsDto | undefined): ViewerSettings {
  const settings = applyEditorPrefs(model.viewerSettings, prefs)
  const view = viewName ? model.views.find((v) => v.name === viewName) : undefined
  settings.startView = view ? { pos: view.position, target: view.target, aspect: view.aspect } : null
  return settings
}

function attachedModel(project: MainProjectDto, portfolio: PortfolioDto | null): Model3dDto | null {
  if (!project.model3dId) return null
  return portfolio?.models.find((m) => m.id === project.model3dId) ?? null
}

export function useEffectiveViewerSettings(
  project: Source<MainProjectDto>,
  portfolioData: Ref<PortfolioDto | null>,
  opts: { mobile?: boolean } = {},
) {
  return computed<ViewerSettings | null>(() => {
    const proj  = project.value
    const model = attachedModel(proj, portfolioData.value)
    if (!model) return null
    const viewName = opts.mobile ? (proj.model3dMobileView || proj.model3dDesktopView) : proj.model3dDesktopView
    return viewerSettingsFor(model, viewName, portfolioData.value?.editorPrefs)
  })
}

export function useResolvedGlbUrl(project: Source<MainProjectDto>, portfolioData: Ref<PortfolioDto | null>) {
  return computed(() => {
    const model = attachedModel(project.value, portfolioData.value)
    return model ? model.glbUrl : null
  })
}

//The copy with smaller textures; the viewer takes it on a touch device or a slow computer
export function useResolvedGlbLightUrl(project: Source<MainProjectDto>, portfolioData: Ref<PortfolioDto | null>) {
  return computed(() => attachedModel(project.value, portfolioData.value)?.glbPhoneUrl ?? null)
}
