<template>
  <component :is="blok.component" v-bind="{ ...$props, ...$attrs }" />
</template>

<script setup lang="ts">
import type { SbBlokData } from '@storyblok/js'
export interface SbComponentProps {
      blok: SbBlokData
    }
defineProps<SbComponentProps>()
</script>
