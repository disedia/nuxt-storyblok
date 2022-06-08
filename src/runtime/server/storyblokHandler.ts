import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  const previewURL = event.req.headers.host.includes('localhost') ? `http://${event.req.headers.host}` : `https://${event.req.headers.host}`
  event.res.statusCode = 200
  event.res.end(`<!DOCTYPE html>
        <html>
            <head>
                <title>Storyblok Admin</title>
            </head>
            <body>
                <div id="app"></div>
                <script type="text/javascript">
                    STORYBLOK_PREVIEW_URL = "${previewURL}/"
                </script>
                <script src="https://app.storyblok.com/f/app-latest.js" type="text/javascript"></script>
            </body>
        </html>`)
})
