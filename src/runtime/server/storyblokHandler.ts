import { eventHandler, H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'

export default eventHandler((event: H3Event) => {
  const { storyblok } = useRuntimeConfig().public
  // Bug in h3???: check when fixed -> getRequestHeader(event, 'host') currently not working
  const host = event.req.rawHeaders.includes('host') ? event.req.rawHeaders[event.req.rawHeaders.indexOf('host') + 1] : ''
  const previewURL = host?.includes('localhost') ? `http://${host}` : storyblok.editor.previewUrl
  const isLocalDev = !!host?.includes('localhost')
  const forcePreviewUrl = storyblok.editor.previewUrl !== ''
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
                ${isLocalDev || forcePreviewUrl ? 'STORYBLOK_PREVIEW_URL = previewURL;' : ''}
            </script>
            <script src="https://app.storyblok.com/f/app-latest.js" type="text/javascript"></script>
        </body>
    </html>`)
})
