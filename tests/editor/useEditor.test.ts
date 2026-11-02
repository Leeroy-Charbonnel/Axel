import { describe, expect, mock, test } from "bun:test"
import { nextTick, ref } from "vue"
import type { MainProjectDto, PortfolioDto } from "../../src/types/portfolio"

//the editor's collaborators, replaced before it is imported: the portfolio is
//a ref the test swaps the way a reload would, and the API always succeeds
const data = ref<PortfolioDto | null>(null)
const reloadWith = { next: null as PortfolioDto | null }
mock.module("../../src/composables/usePortfolio", () => ({
  usePortfolio: () => ({ data, reload: async () => { data.value = reloadWith.next } }),
  apiJson:      async () => ({}),
}))
mock.module("../../src/composables/useToast", () => ({ useToast: () => ({ error: () => {} }) }))
mock.module("../../src/composables/useConfirm", () => ({ useConfirm: () => ({ confirm: async () => true }) }))
mock.module("../../src/composables/useTranslations", () => ({ useTranslations: () => ({ t: (key: string) => key }) }))

const { useEditor } = await import("../../src/composables/useEditor")

function project(id: number): MainProjectDto {
  return { id, year: "2020" } as MainProjectDto
}

function portfolio(ids: number[]): PortfolioDto {
  return { mainProjects: ids.map(project), galleryProjects: [], experiences: [], profile: null } as unknown as PortfolioDto
}

describe("useEditor history after a delete", () => {
  test("undo after removeItem does not bring the deleted draft back", async () => {
    const ed = useEditor()
    data.value = portfolio([1, 2])
    ed.patch("mainProject", 2, { year: "2021" })
    ed.patch("mainProject", 1, { year: "2022" })
    expect(ed.draft("mainProject", 2)).toEqual({ year: "2021" })

    reloadWith.next = portfolio([1])
    await ed.removeItem("mainProject", 2)
    expect(ed.draft("mainProject", 2)).toBeNull()

    //back to the state before project 1 was edited: project 2's draft was in it
    ed.undo()
    expect(ed.draft("mainProject", 1)).toBeNull()
    expect(ed.draft("mainProject", 2)).toBeNull()
    ed.redo()
    expect(ed.draft("mainProject", 1)).toEqual({ year: "2022" })
    expect(ed.draft("mainProject", 2)).toBeNull()
    ed.discardAll()
  })

  test("a reload that no longer has an entity drops its drafts and their history", async () => {
    const ed = useEditor()
    data.value = portfolio([1, 3])
    ed.patch("mainProject", 3, { year: "2023" })
    ed.patch("mainProject", 1, { year: "2024" })

    //deleted in another tab: the next reload simply lacks it
    data.value = portfolio([1])
    await nextTick()
    expect(ed.draft("mainProject", 3)).toBeNull()
    expect(ed.draft("mainProject", 1)).toEqual({ year: "2024" })
    ed.undo()
    expect(ed.draft("mainProject", 3)).toBeNull()
    ed.discardAll()
  })
})
