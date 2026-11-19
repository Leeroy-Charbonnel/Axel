import { describe, expect, mock, test } from "bun:test"
import { nextTick, ref } from "vue"
import type { MainProjectDto, PortfolioDto } from "../../src/types/portfolio"

//the editor's collaborators, replaced before it is imported: the portfolio is
//a ref the test swaps the way a reload would, and the API always succeeds
const data = ref<PortfolioDto | null>(null)
const reloadWith = { next: null as PortfolioDto | null }
//every request the editor sent: method, path, body
const requests: unknown[][] = []
mock.module("../../src/composables/usePortfolio", () => ({
  usePortfolio: () => ({ data, reload: async () => { data.value = reloadWith.next } }),
  apiJson:      async (...args: unknown[]) => { requests.push(args); return {} },
  uploadFile:   async () => ({}),
}))
mock.module("../../src/composables/useToast", () => ({ useToast: () => ({ error: () => {}, info: () => {}, success: () => {} }) }))
mock.module("../../src/composables/useConfirm", () => ({ useConfirm: () => ({ confirm: async () => true, open: ref(false) }) }))
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

describe("useEditor site labels and undo", () => {
  test("a typed label is a draft, undone and dropped when it equals the saved text", () => {
    const ed = useEditor()
    //the mocked translation of a key is the key itself
    expect(ed.label("heroTitle")).toBe("heroTitle")
    ed.setLabel("heroTitle", "Folio")
    expect(ed.label("heroTitle")).toBe("Folio")
    expect(ed.isLabelDirty("heroTitle")).toBe(true)
    expect(ed.dirty.value).toBe(true)

    ed.undo()
    expect(ed.label("heroTitle")).toBe("heroTitle")
    expect(ed.dirty.value).toBe(false)
    ed.redo()
    expect(ed.label("heroTitle")).toBe("Folio")

    ed.setLabel("heroTitle", "heroTitle")
    expect(ed.isLabelDirty("heroTitle")).toBe(false)
    expect(ed.dirty.value).toBe(false)
    ed.discardAll()
  })

  test("an emptied label is not saved and no undo brings it back", async () => {
    const ed = useEditor()
    data.value = portfolio([1])
    reloadWith.next = data.value
    ed.setLabel("heroTitle", "  ")
    expect(ed.dirty.value).toBe(true)

    //saved while the box is still empty: nothing is sent for it
    requests.length = 0
    expect(await ed.saveAll()).toBe(true)
    expect(requests).toEqual([])

    //left empty: the saved text is back and emptying it was not a step
    ed.restoreBlankLabel("heroTitle")
    expect(ed.label("heroTitle")).toBe("heroTitle")
    expect(ed.dirty.value).toBe(false)
    expect(ed.canUndo.value).toBe(false)

    //an empty label inside an older step comes back as the saved text
    ed.setLabel("heroTitle", "")
    ed.setLabel("navHome", "Home")
    ed.setLabel("navAbout", "About")
    ed.undo()
    expect(ed.label("navHome")).toBe("Home")
    expect(ed.label("heroTitle")).toBe("heroTitle")
    expect(ed.isLabelDirty("heroTitle")).toBe(false)
    ed.discardAll()
  })

  test("an undo selects the item it changed", () => {
    const ed = useEditor()
    data.value = portfolio([1, 2])
    ed.patch("mainProject", 2, { year: "2030" })
    ed.select("mainProject", 1)
    ed.undo()
    expect(ed.selection.value).toEqual({ kind: "mainProject", id: 2 })
    ed.clear()
    ed.discardAll()
  })
})

describe("useEditor and the history of a page", () => {
  test("the newest step is undone first and redone last, whichever history holds it", () => {
    const ed = useEditor()
    data.value = portfolio([1])
    const calls: string[] = []
    const canUndo = ref(true)
    const canRedo = ref(false)
    let pageStepAt = Date.now() - 1000
    const unregister = ed.registerPageActions({
      save:       async () => {},
      discard:    () => {},
      dirty:      ref(false),
      undo:       () => { calls.push("undo"); canUndo.value = false; canRedo.value = true },
      redo:       () => { calls.push("redo"); canUndo.value = true; canRedo.value = false },
      canUndo,
      canRedo,
      lastStepAt: () => pageStepAt,
      dropRedo:   () => { calls.push("dropRedo"); canRedo.value = false },
    })

    //the page step came first: the editor's is undone before it
    ed.patch("mainProject", 1, { year: "2040" })
    expect(calls).toEqual(["dropRedo"])
    ed.undo()
    expect(ed.draft("mainProject", 1)).toBeNull()
    expect(calls).toEqual(["dropRedo"])
    ed.undo()
    expect(calls).toEqual(["dropRedo", "undo"])

    //redone in the reverse order
    ed.redo()
    expect(calls).toEqual(["dropRedo", "undo", "redo"])
    expect(ed.draft("mainProject", 1)).toBeNull()
    ed.redo()
    expect(ed.draft("mainProject", 1)).toEqual({ year: "2040" })

    //a page step made after the editor's goes first
    pageStepAt = Date.now() + 1000
    ed.undo()
    expect(calls).toEqual(["dropRedo", "undo", "redo", "undo"])
    expect(ed.draft("mainProject", 1)).toEqual({ year: "2040" })

    //a step recorded by the page ends the editor's redo
    ed.undo()
    expect(ed.draft("mainProject", 1)).toBeNull()
    canRedo.value = false
    ed.pageStepped()
    expect(ed.canRedo.value).toBe(false)
    ed.redo()
    expect(ed.draft("mainProject", 1)).toBeNull()

    unregister()
    ed.discardAll()
  })
})
