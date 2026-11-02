//DEFAULTS FOR THE 3D VIEWER, IN ONE PLACE.
//
//Each of these is the value used when a project carries no viewerSettings and
//the admin has never set the matching editor3d_* preference. They were written
//literally in five places across ThreeViewer.vue and ModelEditorPage.vue, so
//changing the wireframe tint meant finding all five and getting them to agree.
//
//The settings-table keys live here too: the editor writes them, the viewer reads
//them back through useEffectiveViewerSettings, and a typo in either half is a
//preference that silently stops applying.
export const VIEWER_DEFAULTS = {
  //tints the emissive picks
  wireframeModeColor: "#14b8a6",
  //the lines drawn over the model in wireframe mode
  wireframeLineColor: "#000000",
  //an unlit material with no colour of its own
  normalColor:        "#ffffff",
  wireframeOverlayOn: true,
  //pixels
  wireframeLineWidth: 1,
  //what the swept part of the model turns into
  wireframeMaterial:  { color: "#808080", metalness: 0, roughness: 0.5, envMapIntensity: 1, specularIntensity: 1 },
  //the ground under the model only shows its shadow, at this opacity
  shadowOpacity:      0.35,
  //the soft disc of light on the floor under every model: colour, opacity at
  //its centre, and diameter in model radii
  floorGlowColor:     "#ffffff",
  floorGlowOpacity:   0.09,
  floorGlowScale:     3.2,
} as const

//THE BLUEPRINT LOOK of a detail-page viewer: white edges over surfaces left
//clear, so the page shows through them, as on a technical plan
export const BLUEPRINT_LOOK = {
  lineColor: "#ffffff",
  material:  { color: "#000000", metalness: 0, roughness: 1, envMapIntensity: 0, specularIntensity: 0, clear: true },
} as const

export const VIEWER_PREF_KEYS = {
  modeColor:      "editor3d_wireframe_mode_color",
  lineColor:      "editor3d_wireframe_line_color",
  materialParams: "editor3d_wireframe_material",
  lineWidth:      "editor3d_wireframe_line_width",
} as const
