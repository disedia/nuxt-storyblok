import { fileURLToPath } from 'url'
import { defineNuxtModule, addPlugin, addServerHandler, createResolver, addComponentsDir } from '@nuxt/kit'

export interface ModuleOptions {

    /**
     * Storyblok API Key
     * @default '''
     * @example '123456789'
     * @type string
     * @docs https://www.storyblok.com/tp/add-a-headless-CMS-to-nuxt-3-in-5-minutes
     */
    accessToken: string

    /**
     * Path of storyblok v2 app for localhost and server
     * @default /storyblok
     * @example '/storyblok'
     * @type string
     * @docs
     */
    appPath: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'storyblok-nuxt',
    configKey: 'storyblok',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    accessToken: '' as string,
    appPath: '/storyblok' as string
  },
  setup (options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    if (!options.accessToken) {
      // eslint-disable-next-line no-console
      console.warn('Missing Storyblok Access Token in nuxt.config.js/ts')
    }

    // Transpile runtime
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir)

    // Add supabase session endpoint to store the session on server-side
    addServerHandler({
      route: options.appPath,
      handler: resolve(runtimeDir, 'server/storyblokHandler.ts')
    })

    // Add richtext vue plugin --> cc: https://github.com/MarvinRudolph/storyblok-rich-text-renderer
    addPlugin(resolve(runtimeDir, 'richtext', 'plugin.ts'))

    // add components dir for storyblok helper components
    addComponentsDir({
      path: resolve(runtimeDir, 'components'),
      pathPrefix: false,
      global: true
    })
  }
})
