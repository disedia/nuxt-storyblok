import { defu } from 'defu'
import { runtimeDir } from './utils'
import { defineNuxtModule, addPlugin, addServerHandler, createResolver, addComponentsDir, addComponent, extendViteConfig } from '@nuxt/kit'

export interface ModuleOptions {

    /**
     * Storyblok Public API Key
     * @default ''
     * @example '123456789'
     * @type string
     * @docs https://www.storyblok.com/tp/add-a-headless-CMS-to-nuxt-3-in-5-minutes
     */
    accessToken: string

    editor?:{
      /**
       * Path of storyblok v2 editor for localhost and server
       * @default /editor
       * @example '/editor'
       * @type string
       * @docs
       */
      path?: string
      /**
       * In local development it is always req.headers.host - must be set to use live preview with your custom domain
       * @default ''
       * @example 'https://example.com'
       * @type string
       * @docs
       */
      previewUrl?: string

      /**
       * Storyblok preview token -> automatically used in editor or preview mode if set
      */
      previewToken?: string

      /**
       * Usually previewToken is only used inside editor, this setting forces the usage of previewToken outside of the editor but limited to dev mode
       */
      forceDevPreview?: boolean
    }

    bridge?: {
      /**
       * Enable bridge mode -> in production always false, in dev mode true but can be overwritten by url query preview=true
       * @default nuxt.options.dev
       * @type boolean
       * @docs
       */
      enabled?: boolean
    }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'storyblok-nuxt-module',
    configKey: 'storyblok',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    accessToken: '' as string,
    editor: {
      path: '/editor' as string,
      previewUrl: '' as string,
      forceDevPreview: false as boolean
    },
    bridge: {
      enabled: false
    }
  },
  setup (options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    if (!options.accessToken) {
      // eslint-disable-next-line no-console
      console.warn('Missing Storyblok Access Token in nuxt.config.js/ts')
    }

    nuxt.options.runtimeConfig.public.storyblok = defu(nuxt.options.runtimeConfig.public.storyblok, {
      accessToken: options.accessToken,
      editor: {
        path: options.editor.path,
        previewUrl: options.editor.previewUrl,
        forceDevPreview: nuxt.options.dev ? options.editor.forceDevPreview : false,   
      },
      bridge: {
        enabled: options.bridge.enabled || nuxt.options.dev
      }
    })
    /*
    * PreviewToken should be kept secret and should only be exposed in editor mode
    */
    nuxt.options.runtimeConfig.storyblokPreviewToken = options.editor.previewToken || options.accessToken

    // Transpile runtime
    nuxt.options.build.transpile.push(runtimeDir)

    // Add supabase session endpoint to store the session on server-side
    addServerHandler({
      route: options.editor.path,
      handler: resolve(runtimeDir, 'server/storyblokHandler')
    })

    nuxt.hook('autoImports:dirs', (dirs) => {
      dirs.push(resolve(runtimeDir, 'composables'))
    })

    // Add richtext vue plugin --> cc: https://github.com/MarvinRudolph/storyblok-rich-text-renderer
    addPlugin(resolve(runtimeDir, 'plugins', 'storyblok'))

    // add app components dir for storyblok user created components
    addComponentsDir({ path: '~/storyblok', global: true, pathPrefix: false })

    //add storyblok helper components
    addComponent({
      name: 'StoryblokComponent',
      filePath: `${resolve(runtimeDir, 'components')}/storyblok-component.vue`,
      global: true
    })
    addComponent({
      name: 'StoryblokRichtext',
      filePath: `${resolve(runtimeDir, 'components')}/storyblok-richtext.vue`,
      global: true
    })

    // Optimize axios
    extendViteConfig((config) => {
      config.optimizeDeps = config.optimizeDeps || {}
      config.optimizeDeps.include = config.optimizeDeps.include || []
      if (!config.optimizeDeps.include.includes('axios')) { config.optimizeDeps.include.push('axios') }
    })
  }
})
