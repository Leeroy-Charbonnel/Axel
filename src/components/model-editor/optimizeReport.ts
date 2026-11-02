import { useToast } from "../../composables/useToast"
import { useTranslations } from "../../composables/useTranslations"
import { formatBytes } from "../../lib/format"

export interface OptimizeOutcome {
  optimizeReport: { bytesBefore: number; bytesAfter: number } | null
  optimizeError:  string | null
}

//long enough to read the sizes while the editor opens
const REPORT_TOAST_MS = 8000

const toast = useToast()
const { t } = useTranslations()

//The sizes before and after, or why the file stayed as it was.
export function toastOptimizeOutcome(outcome: OptimizeOutcome): void {
  const report = outcome.optimizeReport
  if (report) {
    toast.show({
      type:     "success",
      title:    t("modelsOptimizedTitle"),
      message:  t("modelsOptimizedSizes").replace("{before}", formatBytes(report.bytesBefore)).replace("{after}", formatBytes(report.bytesAfter)),
      duration: REPORT_TOAST_MS,
    })
    return
  }
  toast.show({ type: "warning", title: t("modelsOptimizeFailedTitle"), message: outcome.optimizeError ?? "", duration: REPORT_TOAST_MS })
}
