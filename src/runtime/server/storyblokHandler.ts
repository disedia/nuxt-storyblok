import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler((event) => {
  const { storyblok } = useRuntimeConfig().public
  const previewURL = event.req.headers.host.includes('localhost') ? `http://${event.req.headers.host}` : storyblok.editor.previewUrl
  const isLocalDev = event.req.headers.host.includes('localhost') ? true : false
  const forcePreviewUrl = storyblok.editor.previewUrl !== '' ? true : false 
  event.res.statusCode = 200
  event.res.end(`<!DOCTYPE html>
    <html>
        <head>
            <title>Storyblok Admin</title>
        </head>
        <body>
            <div id="app"></div>
            <script type="text/javascript">
                var previewURL = "${previewURL}/";
                ${ isLocalDev || forcePreviewUrl ? "STORYBLOK_PREVIEW_URL = previewURL;" : "" }
            </script>
            <script src="https://app.storyblok.com/f/app-latest.js" type="text/javascript"></script>
        </body>
    </html>`)
})
