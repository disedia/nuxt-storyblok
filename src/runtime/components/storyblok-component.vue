<template>
  <component :is="blok.component" v-bind="{ ...$props, ...$attrs }" />
</template>
<script setup>
  defineProps({
    blok: Object
  })
</script>
