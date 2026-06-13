path = r"C:\Users\User\keelung-sbir-portal\DEPLOY_LOG.txt"
build = r"""
> keelung-sbir-portal@0.1.0 build
> next build

▲ Next.js 16.1.6 (Turbopack)
- Environments: .env.local, .env

⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
  Creating an optimized production build ...
✓ Compiled successfully in 15.3s
  Running TypeScript ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/26) ...
  Generating static pages using 7 workers (6/26) 
  Generating static pages using 7 workers (12/26) 
  Generating static pages using 7 workers (19/26) 
✓ Generating static pages using 7 workers (26/26) in 691.1ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /admin
├ ƒ /admin/accounts-overview
├ ƒ /admin/application/[id]
├ ƒ /admin/application/[id]/form-view
├ ƒ /admin/dashboard
├ ƒ /admin/users
├ ƒ /api/admin/applications/[id]/attachments
├ ƒ /api/admin/applications/[id]/draft-view
├ ƒ /api/admin/applications/[id]/regenerate-online-pdf
├ ƒ /api/admin/dashboard
├ ƒ /api/admin/export
├ ƒ /api/applications/me
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/draft
├ ƒ /api/draft/debug
├ ƒ /api/drive/auth
├ ƒ /api/drive/callback
├ ƒ /api/drive/status
├ ƒ /api/pdf
├ ƒ /api/postal
├ ƒ /api/registry/ensure
├ ƒ /api/submit
├ ƒ /api/upload
├ ƒ /api/upload-proposal
├ ƒ /api/upload-proposal/chunk
├ ƒ /api/upload-proposal/finalize
├ ƒ /api/upload-proposal/session
├ ○ /apple-icon.png
├ ○ /auth/applicant-denied
├ ƒ /committee/application/[id]
├ ƒ /committee/dashboard
├ ○ /icon.png
├ ○ /privacy
├ ○ /terms
├ ƒ /workshop/admin
├ ƒ /workshop/student
└ ƒ /workshop/workspace/[groupId]


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

"""
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
start = text.index("=== 6. npm run build ===\n") + len("=== 6. npm run build ===\n")
end = text.index("\nnpm run build exit code: 0")
text = text[:start] + build + text[end:]
with open(path, "w", encoding="utf-8") as f:
    f.write(text)
print("patched")
