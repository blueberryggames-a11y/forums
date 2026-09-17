# Pineapple Forums Community Forum

A static GitHub Pages forum using Firebase Authentication + Firestore.

## Included
- Modern pill / liquid-glass responsive UI
- Google sign-in
- Only `30copallock@pulaskischools.org` and `blueberryggames@gmail.com` can create posts
- Firestore-backed posts
- Optional post images stored directly as Base64 strings in Firestore
- Search and category filters
- Material Icons
- Light/dark appearance toggle

## Firebase setup
1. In Firebase Console, enable **Authentication → Google**.
2. Create/enable **Cloud Firestore**.
3. Paste `firestore.rules` into Firestore Rules and publish.
4. In Firebase Authentication → Settings → Authorized domains, add your GitHub Pages domain (for example `YOURNAME.github.io`).
5. Deploy the repository with GitHub Pages.

## Important Base64 note
Firestore documents have a 1 MiB maximum size. This demo therefore limits uploaded images to 900 KB. Base64 also increases the image data size, so this approach is best for small images. For larger images, Firebase Storage is the more appropriate option.

## GitHub Pages
Upload these files to a repository:
- `index.html`
- `styles.css`
- `app.js`
- `firestore.rules`

Then enable GitHub Pages from the repository's Settings → Pages.


## Added features
- Likes with per-user like tracking
- Google profile photo/name shown on posts
- Click an author to view their basic profile
- Pinned posts
- Toast notifications for sign-in/publishing/errors


### Admin post deletion
Only emails listed in `isAdmin()` in `firestore.rules` can delete posts. The frontend also only shows the Delete button to those admins.

The current admins are:
- `30copallock@pulaskischools.org`
- `blueberryggames@gmail.com`

If you change the admin list, update both `ADMINS` in `app.js` and `isAdmin()` in `firestore.rules`. Publish the updated Firestore rules after changing them.
