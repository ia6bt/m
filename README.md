# Portfolio + CMS (HTML/CSS/JS + Supabase)

Static site, no build step. `index.html` is the public portfolio, `admin.html` is the private dashboard.

```
index.html  admin.html
css/style.css
js/config.js   <- your Supabase URL + anon key
js/lib.js  js/app.js (public)  js/admin.js (CMS)
supabase/schema.sql  <- tables, security policies, storage, seed content
```

## 1. Supabase setup
1. Create a free project at supabase.com.
2. **SQL Editor** > paste all of `supabase/schema.sql` > Run. This creates the tables, Row Level Security, the `portfolio` storage bucket (JPG/PNG/WebP/PDF, 10 MB max) and your initial content.
3. **Project Settings > API**: copy the Project URL and the `anon` public key into `js/config.js`. Never put the `service_role` key anywhere in this project.

## 2. Authentication (the admin account)
1. **Authentication > Users > Add user**: your email and a strong password, tick *Auto Confirm User*.
2. **Authentication > Sign In / Providers**: turn **off** "Allow new users to sign up".
3. In SQL Editor, authorize that user as admin (replace the email):
   `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`
4. **Authentication > URL Configuration**: set Site URL to your deployed address (step 4).

Even if signups were left open, only users listed in `public.admins` can write: every policy checks `is_admin()`.

## 3. Security model
- Visitors (anon key): read-only, published rows only; profile and settings are readable.
- Admin: full write on all tables and on the storage bucket. Public file URLs work for visitors; listing/uploading/deleting files needs the admin session.
- Text is HTML-escaped when rendered and links must start with http(s).

## 4. Deploy on GitHub Pages
1. Create a GitHub repository and upload these files (keep the folder structure).
2. Repository **Settings > Pages**: Source = *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. After a minute the site is at `https://<user>.github.io/<repo>/`; the dashboard is at `.../admin.html`.
Netlify and Cloudflare Pages also work: drag the folder in, no settings needed.

## 5. Test locally and on your phone
ES modules do not run from `file://`. From this folder run `python -m http.server 8080` and open `http://localhost:8080`.
For a phone on the same Wi-Fi open `http://<your-computer-IP>:8080`, or simply test the deployed URL.
Checklist: sign in, add a project with a photo taken on the phone, reload, open the site on another device, hide the project, delete it (confirm dialog), check Media is empty again.

## Using the dashboard
Personal info and Settings edit single records. Projects, Certificates and Experience have Add / Edit / Delete (with confirmation), Publish / Unpublish, ▲▼ ordering and Preview (opens the public site on that item; the admin sees drafts marked "Draft" when signed in on the same browser). Images are resized to max 1600 px and converted to WebP in the browser before upload.
