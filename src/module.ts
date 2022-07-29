import { defu } from 'defu'
import { defineNuxtModule, addPlugin, addServerHandler, createResolver, addComponentsDir, addComponent, extendViteConfig } from '@nuxt/kit'
import { runtimeDir } from './utils'

export type RichtextResolver = {
  paragraph?: string
  heading?: string
  image?: string
  ordered_list?: string
  bullet_list?: string
  list_item?: string
  code_block?: string
  link?: string
  components?: Record<string, string>
}

export type RichtextClassesHeadings = {
  '1'?: string
  '2'?: string
  '3'?: string
  '4'?: string
  '5'?: string
  '6'?: string
}

export type RichtextClasses = {
  paragraph?: string
  heading?: RichtextClassesHeadings
  image?: string
  ordered_list?: string
  bullet_list?: string
  list_item?: string
  code_block?: string
  link?: string
  components?: Record < string, string >
}

export interface ModuleOptions {

    /**
     * Storyblok Public API Key
     * @default ''
     * @example '123456789'
     * @type string
     * @docs https://www.storyblok.com/tp/add-a-headless-CMS-to-nuxt-3-in-5-minutes
     */
    accessToken: string

    /**
    * Forces a specific version of the Storyblok API to be used. Normally, the version is determined if you are in editor and preview mode (draft) or not (published).
    * Be careful, it is not possible to use version 'draft' with a public access token.
    */
    version?: 'draft' | 'published'

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

    }

    bridge?: {
      /**
       * Enable bridge mode -> in production always false, in dev mode true but can be overwritten by this option
       * @default nuxt.options.dev
       * @type boolean
       * @docs
       */
      enabled?: boolean
    }

    richtext?: {
      resolvers?: RichtextResolver
      classes?: RichtextClasses
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
    version: 'published' as 'draft' | 'published',
    editor: {
      path: '/editor' as string,
      previewUrl: '' as string
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
      version: options.version,
      editor: {
        path: options.editor?.path,
        previewUrl: options.editor?.previewUrl
      },
      bridge: {
        enabled: options.bridge?.enabled || nuxt.options.dev
      },
      richtext: {
        resolvers: options.richtext?.resolvers || {},
        classes: options.richtext?.classes || {}
      }
    })
    /*
    * PreviewToken should be kept secret and should only be exposed in editor mode, use accessToken as backup
    */
    nuxt.options.runtimeConfig.storyblokPreviewToken = options.editor?.previewToken || options.accessToken

    // Transpile runtime
    nuxt.options.build.transpile.push(runtimeDir)

    // Add supabase session endpoint to store the session on server-side
    addServerHandler({
      route: options.editor?.path,
      handler: resolve(runtimeDir, 'server/storyblokHandler')
    })

    nuxt.hook('autoImports:dirs', (dirs) => {
      dirs.push(resolve(runtimeDir, 'composables'))
    })

    // Add richtext vue plugin --> cc: https://github.com/MarvinRudolph/storyblok-rich-text-renderer
    addPlugin(resolve(runtimeDir, 'plugins', 'storyblok'))

    // add app components dir for storyblok user created components
    addComponentsDir({ path: '~/storyblok', global: true, pathPrefix: true })

    // add storyblok helper components
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
