<script setup lang="ts">
import { computed } from "vue"
import { Download, Phone } from "lucide-vue-next"
import { useLanguage } from "../../composables/useLanguage"
import { safeUrl } from "../../lib/safe-url"
import AnimatedReveal from "./AnimatedReveal.vue"
import Availability from "./Availability.vue"
import SectionHeader from "./SectionHeader.vue"
import SocialLinks from "./SocialLinks.vue"
import EditableRegion from "../admin/EditableRegion.vue"
import type { ProfileDto } from "../../types/portfolio"

//CONTACT - the address as the call to action, then availability, the resume,
//the phone when there is one, and the links.
const props = defineProps<{ profile: ProfileDto }>()

const { t } = useLanguage()

const email   = computed(() => props.profile.contact.email.trim().toLowerCase())
const mailto  = computed(() => (email.value ? safeUrl(`mailto:${email.value}`) : null))
//a line break, when one is needed, goes before the @ and nowhere else
const emailParts = computed(() => {
  const at = email.value.lastIndexOf("@")
  return at < 0 ? [email.value, ""] : [email.value.slice(0, at), email.value.slice(at)]
})
//the stored url is site-relative (/media/...): resolve it before the check
const cvHref  = computed(() => (props.profile.cvUrl ? safeUrl(new URL(props.profile.cvUrl, window.location.origin).href) : null))
//a tel: link built from the digits only, so nothing else can ride along
const phone   = computed(() => props.profile.contact.phone.trim())
const telHref = computed(() => (phone.value ? `tel:${phone.value.replace(/[^\d+]/g, "")}` : null))
</script>

<template>
  <section id="contact" class="site-section" aria-labelledby="contact-title">
    <div class="site-container">
      <SectionHeader id="contact-title" :title="t('experienceContact')" />

      <AnimatedReveal>
        <EditableRegion kind="profile" :label="t('editorKindProfile')">
          <div class="contact">
            <p class="contact__lead">{{ t("contactLead") }}</p>
            <a v-if="mailto" :href="mailto" class="contact__email">{{ emailParts[0] }}<wbr>{{ emailParts[1] }}</a>

            <div class="contact__details">
              <Availability :profile="profile" />
              <div class="contact__actions">
                <a v-if="cvHref" :href="cvHref" download class="site-button site-button--primary">
                  <Download aria-hidden="true" />
                  {{ t("contactCv") }}
                </a>
                <a v-if="telHref" :href="telHref" class="site-button">
                  <Phone aria-hidden="true" />
                  {{ phone }}
                </a>
              </div>
              <SocialLinks :links="profile.links" />
            </div>
          </div>
        </EditableRegion>
      </AnimatedReveal>
    </div>
  </section>
</template>

<style scoped>
.contact {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.contact__lead {
  font-size: var(--site-fs-h3);
  color: var(--site-text-body);
}

.contact__email {
  align-self: flex-start;
  max-width: 100%;
  /*as large as the column lets a usual address run on one line*/
  font-size: clamp(var(--site-fs-h3), var(--site-email-fit), var(--site-fs-h1));
  font-weight: var(--site-fw-display);
  line-height: var(--site-lh-tight);
  color: var(--site-text-heading);
  overflow-wrap: break-word;
  text-decoration: underline;
  text-decoration-thickness: var(--border-width-sm);
  text-decoration-color: var(--site-accent);
  text-underline-offset: var(--site-underline-offset);
  transition: color var(--site-duration-fast) ease;
}

.contact__email:hover { color: var(--site-accent); }

.contact__details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding-top: var(--spacing-lg);
  border-top: var(--border-width-sm) solid var(--site-line);
}

.contact__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.contact__actions:empty { display: none; }
</style>
