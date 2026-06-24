# Almnabr Qualification Portal

An Arabic RTL engineering-office qualification workflow hosted on Netlify. It stores structured submissions and private photos in Supabase, generates a branded PDF, and provides a protected stakeholder dashboard.

## Project status

The initial architecture and implementation are present:

- Preserved original form at `archive/index.original.html`
- Improved public form at `public/index.html`
- Transactional submission and signed photo-upload flow
- Server-side validation and upload verification
- Supabase schema, storage bucket, RLS policies, status history, and notes
- Background Arabic HTML-to-PDF generator
- Protected admin dashboard with search, status management, notes, photo preview, PDF download, and regeneration

The project still needs a real Supabase project, environment variables, installed dependencies, and end-to-end deployment testing before production use.

## Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/migrations/001_initial_schema.sql`.
3. Create the first stakeholder in Supabase Authentication.
4. Insert that user's UUID into `public.admin_users`:

   ```sql
   insert into public.admin_users (user_id, display_name)
   values ('AUTH-USER-UUID', 'Stakeholder name');
   ```

5. Copy `.env.example` to `.env` and set all values.
6. Install dependencies with `pnpm install`.
7. Run `pnpm dev`.
8. Open `/` for the public form and `/admin/` for the dashboard.

## Netlify environment variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose it in HTML)
- `INTERNAL_FUNCTION_SECRET`
- `SITE_URL`
- `MAX_PHOTO_BYTES` (default 5 MB)
- `MAX_PHOTOS` (default 5)

## Submission lifecycle

1. `create-submission` validates the answers and creates a draft.
2. It generates unique storage paths and short-lived signed upload URLs.
3. The browser uploads each photo directly to private Supabase Storage.
4. `finalize-submission` verifies every expected object exists.
5. Only then is the record marked `submitted`.
6. `generate-pdf-background` renders and stores the PDF.
7. Administrators access signed, expiring photo and PDF URLs from `/admin/`.

## Production checklist

- Keep the bundled IBM Plex Sans Arabic font at `public/assets/ibm-plex-sans-arabic.ttf`.
- Add Cloudflare Turnstile or equivalent server-verified spam protection.
- Restrict the CORS origin in `netlify/functions/_shared/http.mjs` to the production domain.
- Configure email notifications without attaching private documents.
- Confirm the desired data-retention period.
- Run the full upload and PDF tests on a Netlify deploy preview.
- Verify the generated PDF visually with portrait, landscape, and very tall images.
- Keep the archived original outside `public/` so it is not deployed.

## Security notes

The Supabase service-role key is used only in Netlify Functions. The storage bucket is private. Public users cannot query the database directly. Administrative API functions validate both the Supabase session and membership in `admin_users`.
