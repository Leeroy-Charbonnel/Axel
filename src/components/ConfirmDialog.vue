<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useConfirm } from "../composables/useConfirm"
import { useTranslations } from "../composables/useTranslations"

//THE ONE CONFIRMATION IN THE APP. Mounted once in App.vue; every caller goes
//through useConfirm().confirm(). Nothing else in the project should build a
//confirmation of its own.

const { open, request, accept, dismiss } = useConfirm()
const { t } = useTranslations()

const confirmButton = ref<HTMLButtonElement | null>(null)
const cancelButton  = ref<HTMLButtonElement | null>(null)

//the confirming button takes focus, so Enter answers and Escape refuses without
//reaching for the mouse; a destructive request focuses Cancel instead, so Enter
//never deletes by reflex. Focus moves after the paint that mounts it.
watch(open, async (isOpen) => {
  if (!isOpen) return
  await new Promise(requestAnimationFrame)
  const target = request.value?.destructive ? cancelButton : confirmButton
  target.value?.focus()
})

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === "Escape") {
    e.preventDefault()
    dismiss()
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown))
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="open && request"
        class="confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        @click.self="dismiss"
      >
        <div class="confirm__box ed-ui">
          <h2 id="confirm-title" class="confirm__title">{{ request.title }}</h2>
          <p v-if="request.what" class="confirm__what">{{ request.what }}</p>

          <div class="confirm__actions">
            <button ref="cancelButton" type="button" class="ed-btn" @click="dismiss">{{ t("confirmCancel") }}</button>
            <button
              ref="confirmButton"
              type="button"
              class="ed-btn"
              :class="request.destructive ? 'confirm__destructive' : 'ed-btn--primary'"
              @click="accept"
            >
              {{ request.action }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm {
  position: fixed;
  inset: 0;
  z-index: var(--z-confirm);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--vsui-space-lg);
  background-color: var(--overlay-bg);
}

.confirm__box {
  width: 100%;
  max-width: var(--confirm-width);
  display: flex;
  flex-direction: column;
  gap: var(--vsui-space-sm);
  padding: var(--vsui-space-lg);
  background-color: var(--editor-surface);
  border: var(--border-width) solid var(--editor-line);
  border-radius: var(--editor-radius);
  box-shadow: var(--editor-shadow);
}

.confirm__title {
  font-size: var(--editor-fs);
  font-weight: var(--font-weight-semibold);
}

.confirm__what {
  color: var(--editor-text-muted);
  overflow-wrap: anywhere;
}

.confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--vsui-space-xs);
  margin-top: var(--vsui-space-xs);
}

/*a destructive action is filled red, the only red button of the editor*/
.confirm__destructive {
  font-weight: var(--font-weight-semibold);
  color: hsl(var(--destructive-foreground));
  background-color: var(--editor-danger);
}

.confirm__destructive:hover { border-color: transparent; background-color: hsl(var(--destructive) / 0.85); }

.confirm-enter-active,
.confirm-leave-active {
  transition: opacity var(--transition-fast);
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
</style>
