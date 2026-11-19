<script setup lang="ts">
import type { DetailBlockType } from "../../../types/portfolio"

//A SMALL DRAWING OF A BLOCK TYPE, for the help of the Add tab: what the block
//looks like once filled. Solid bars are text, frames are media, the accent
//marks what moves or what the reader acts on.
defineProps<{ type: DetailBlockType }>()
</script>

<template>
  <svg class="sketch" viewBox="0 0 96 56" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <g v-if="type === 'text'" class="sketch__solid">
      <rect x="8" y="12" width="80" height="4" />
      <rect x="8" y="22" width="72" height="4" />
      <rect x="8" y="32" width="76" height="4" />
      <rect x="8" y="42" width="48" height="4" />
    </g>

    <g v-else-if="type === 'heading'">
      <path d="M8 14H88M8 10V18M88 10V18" />
      <rect class="sketch__solid" x="8" y="30" width="44" height="8" />
      <path class="sketch__accent-line" d="M58 40L64 28" />
    </g>

    <g v-else-if="type === 'quote'">
      <rect class="sketch__accent" x="8" y="8" width="5" height="10" />
      <rect class="sketch__accent" x="17" y="8" width="5" height="10" />
      <rect class="sketch__solid" x="8" y="25" width="76" height="5" />
      <rect class="sketch__solid" x="8" y="34" width="56" height="5" />
      <rect class="sketch__soft" x="8" y="46" width="28" height="3" />
    </g>

    <g v-else-if="type === 'image'">
      <rect x="8" y="6" width="80" height="44" />
      <path d="M8 44L30 24L46 38L60 28L88 48" />
      <circle class="sketch__accent" cx="70" cy="18" r="5" />
    </g>

    <g v-else-if="type === 'video'">
      <rect x="8" y="6" width="80" height="44" />
      <path class="sketch__accent" d="M42 19V37L58 28Z" />
    </g>

    <g v-else-if="type === 'carousel'">
      <rect x="8" y="6" width="80" height="44" />
      <path d="M20 21L14 27L20 33M76 21L82 27L76 33" />
      <circle class="sketch__solid" cx="41" cy="43" r="2" />
      <circle class="sketch__accent" cx="48" cy="43" r="2" />
      <circle class="sketch__solid" cx="55" cy="43" r="2" />
    </g>

    <g v-else-if="type === 'marquee'">
      <rect x="-12" y="10" width="28" height="28" />
      <rect x="22" y="10" width="28" height="28" />
      <rect x="56" y="10" width="28" height="28" />
      <rect x="90" y="10" width="28" height="28" />
      <path class="sketch__accent-line" d="M64 48H32M38 44L32 48L38 52" />
    </g>

    <g v-else-if="type === 'compare'">
      <rect class="sketch__soft" x="8" y="6" width="40" height="44" />
      <rect x="8" y="6" width="80" height="44" />
      <path class="sketch__accent-line" d="M48 6V50" />
      <circle class="sketch__accent" cx="48" cy="28" r="6" />
    </g>

    <g v-else-if="type === 'accordion'">
      <rect class="sketch__solid" x="8" y="7" width="40" height="4" />
      <path class="sketch__accent-line" d="M81 6L87 12M87 6L81 12" />
      <rect class="sketch__soft" x="8" y="17" width="72" height="3" />
      <rect class="sketch__soft" x="8" y="24" width="60" height="3" />
      <path d="M8 32H88M8 44H88M84 35V41M81 38H87M84 47V53M81 50H87" />
      <rect class="sketch__solid" x="8" y="36" width="34" height="4" />
      <rect class="sketch__solid" x="8" y="48" width="46" height="4" />
    </g>

    <g v-else-if="type === 'specs'">
      <path d="M8 20H88M8 36H88" />
      <rect class="sketch__soft" x="8" y="10" width="24" height="3" />
      <rect class="sketch__solid" x="56" y="9" width="32" height="4" />
      <rect class="sketch__soft" x="8" y="27" width="30" height="3" />
      <rect class="sketch__solid" x="64" y="26" width="24" height="4" />
      <rect class="sketch__soft" x="8" y="43" width="20" height="3" />
      <rect class="sketch__solid" x="50" y="42" width="38" height="4" />
    </g>

    <g v-else-if="type === 'counters'">
      <path d="M8 12H30M37 12H59M66 12H88" />
      <rect class="sketch__solid" x="8" y="19" width="20" height="12" />
      <rect class="sketch__solid" x="37" y="19" width="16" height="12" />
      <rect class="sketch__solid" x="66" y="19" width="22" height="12" />
      <rect class="sketch__soft" x="8" y="38" width="16" height="3" />
      <rect class="sketch__soft" x="37" y="38" width="18" height="3" />
      <rect class="sketch__soft" x="66" y="38" width="14" height="3" />
    </g>

    <g v-else-if="type === 'button'">
      <rect class="sketch__accent" x="20" y="18" width="56" height="20" />
      <rect class="sketch__on-accent" x="28" y="26" width="28" height="4" />
      <path class="sketch__on-accent-line" d="M62 32L68 24M63 24H68V29" />
    </g>

    <g v-else-if="type === 'embed'">
      <rect x="8" y="6" width="80" height="44" />
      <path d="M8 16H88" />
      <circle class="sketch__solid" cx="14" cy="11" r="1.5" />
      <circle class="sketch__solid" cx="20" cy="11" r="1.5" />
      <circle class="sketch__solid" cx="26" cy="11" r="1.5" />
      <path class="sketch__accent" d="M42 25V41L58 33Z" />
    </g>

    <g v-else-if="type === 'viewer3d'">
      <path d="M48 6L72 18L48 30L24 18ZM24 18V40L48 52L72 40V18M48 30V52" />
      <path class="sketch__accent-line" d="M80 44A34 12 0 0 1 60 53M60 53L66 49M60 53L65 56" />
    </g>

    <g v-else-if="type === 'legend'">
      <rect x="8" y="7" width="10" height="10" />
      <rect class="sketch__solid" x="26" y="10" width="50" height="4" />
      <rect x="8" y="23" width="10" height="10" />
      <rect class="sketch__solid" x="26" y="26" width="38" height="4" />
      <rect x="8" y="39" width="10" height="10" />
      <rect class="sketch__solid" x="26" y="42" width="44" height="4" />
    </g>

    <g v-else-if="type === 'sequence'">
      <rect x="8" y="8" width="20" height="22" />
      <rect x="38" y="8" width="20" height="22" />
      <rect x="68" y="8" width="20" height="22" />
      <path class="sketch__accent-line" d="M30 19H36M60 19H66" />
      <rect class="sketch__solid" x="14" y="36" width="8" height="4" />
      <rect class="sketch__solid" x="44" y="36" width="8" height="4" />
      <rect class="sketch__solid" x="74" y="36" width="8" height="4" />
      <rect class="sketch__soft" x="10" y="45" width="16" height="3" />
      <rect class="sketch__soft" x="40" y="45" width="16" height="3" />
      <rect class="sketch__soft" x="70" y="45" width="16" height="3" />
    </g>

    <g v-else-if="type === 'materials'">
      <circle class="sketch__accent" cx="18" cy="16" r="8" />
      <rect class="sketch__solid" x="34" y="10" width="30" height="4" />
      <rect class="sketch__soft" x="34" y="19" width="44" height="3" />
      <circle cx="18" cy="40" r="8" />
      <rect class="sketch__solid" x="34" y="34" width="24" height="4" />
      <rect class="sketch__soft" x="34" y="43" width="38" height="3" />
    </g>
  </svg>
</template>

<style scoped>
.sketch {
  display: block;
  width: 100%;
  height: auto;
  color: var(--editor-text-muted);
  background-color: var(--editor-input-bg);
  border: var(--border-width) solid var(--editor-line-soft);
}
.sketch__solid { fill: currentColor; stroke: none; }
.sketch__soft { fill: currentColor; stroke: none; opacity: var(--vsui-disabled-opacity); }
.sketch__accent { fill: var(--editor-accent); stroke: none; }
.sketch__accent-line { stroke: var(--editor-accent); }
.sketch__on-accent { fill: var(--editor-on-accent); stroke: none; }
.sketch__on-accent-line { stroke: var(--editor-on-accent); }
</style>
