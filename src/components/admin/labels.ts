//THE FIXED TEXTS OF THE HOME PAGE the admin can retype: translation keys by
//group, in the order of the page. The page types them in place (InlineLabel),
//the panel lists them (LabelsForm).

export interface LabelGroup {
  //Translation key of the group title
  titleKey: string
  keys:     readonly string[]
}

export const LABEL_GROUPS: readonly LabelGroup[] = [
  { titleKey: "labelsGroupNav",    keys: ["navHome", "navProjects", "navGallery", "navExperience", "navAbout", "navContact"] },
  { titleKey: "navHome",           keys: ["heroTitle"] },
  { titleKey: "navProjects",       keys: ["projectsTitle", "projectsStatVertices", "projectsStatFaces", "projectsStatEdges", "projectsStatTriangles"] },
  { titleKey: "navGallery",        keys: ["galleryTitle", "projectNoImage"] },
  { titleKey: "navExperience",     keys: ["experienceTitle"] },
  { titleKey: "navAbout",          keys: ["experienceAbout", "experienceInterest", "experienceGames", "experienceArt"] },
  { titleKey: "navContact",        keys: ["experienceContact", "experiencePhone", "experienceMail", "experienceInsta", "experienceCv", "contactCv"] },
  { titleKey: "labelsGroupFooter", keys: ["footerBackToTop"] },
]

//The id that links a label typed on the page to its field in the panel
export function labelFieldId(key: string): string {
  return `label:${key}`
}
