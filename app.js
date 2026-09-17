import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  increment,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAW4KHaVfcWpDO2qNNHqdkz90hrD_IdxGU",
  authDomain: "games-forum-82a51.firebaseapp.com",
  projectId: "games-forum-82a51",
  storageBucket: "games-forum-82a51.firebasestorage.app",
  messagingSenderId: "1082742788932",
  appId: "1:1082742788932:web:3fa22d61930b2eda5ffd11",
  measurementId: "G-LVBGPSR8WV"
};

const ALLOWED = new Set([
  "30copallock@pulaskischools.org",
  "blueberryggames@gmail.com"
]);

const ADMINS = new Set([
  "30copallock@pulaskischools.org",
  "blueberryggames@gmail.com"
]);

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (_) {}

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let allPosts = [];
let activeCategory = "all";
let searchTerm = "";

const $ = (s) => document.querySelector(s);

function emailOf(user = currentUser) {
  return (user?.email || "").toLowerCase();
}

function isApproved() {
  return !!currentUser && ALLOWED.has(emailOf());
}

function isAdmin() {
  return !!currentUser && ADMINS.has(emailOf());
}

function toast(message, type = "info") {
  const old = document.querySelector(".toast");
  if (old) old.remove();

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="material-icons">${type === "error" ? "error" : type === "success" ? "check_circle" : "info"}</span><span>${escapeHtml(message)}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(ts) {
  if (!ts) return "Just now";
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return "Just now";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function categoryLabel(category) {
  return category ? category.charAt(0).toUpperCase() + category.slice(1) : "General";
}

function filteredPosts() {
  return allPosts
    .filter(p => activeCategory === "all" || (p.category || "").toLowerCase() === activeCategory)
    .filter(p => {
      if (!searchTerm) return true;
      const hay = `${p.title || ""} ${p.content || ""} ${p.authorName || ""} ${p.category || ""}`.toLowerCase();
      return hay.includes(searchTerm);
    })
    .sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return bt - at;
    });
}

function renderPosts() {
  const list = $("#posts") || $("#postList") || $(".posts-list");
  if (!list) return;

  const posts = filteredPosts();
  if (!posts.length) {
    list.innerHTML = `
      <div class="empty-state glass-card">
        <span class="material-icons">forum</span>
        <h3>No posts found</h3>
        <p>Try another category or search.</p>
      </div>`;
    return;
  }

  list.innerHTML = posts.map(post => {
    const liked = Array.isArray(post.likedBy) && currentUser && post.likedBy.includes(currentUser.uid);
    const avatar = post.authorPhoto
      ? `<img class="post-avatar-img" src="${escapeHtml(post.authorPhoto)}" alt="">`
      : `<span class="material-icons">account_circle</span>`;

    return `
      <article class="post-card glass-card ${post.pinned ? "pinned" : ""}" data-post-id="${escapeHtml(post.id)}">
        <div class="post-head">
          <button class="author-link post-author" data-profile="${escapeHtml(post.authorEmail || "")}">
            ${avatar}
            <span>
              <strong>${escapeHtml(post.authorName || "User")}</strong>
              <small>${escapeHtml(formatDate(post.createdAt))}</small>
            </span>
          </button>
          ${post.pinned ? `<span class="pinned-tag"><span class="material-icons">push_pin</span>Pinned</span>` : ""}
        </div>

        <div class="post-category">${escapeHtml(categoryLabel(post.category))}</div>
        <h2>${escapeHtml(post.title || "Untitled")}</h2>
        <div class="post-content">${escapeHtml(post.content || "").replaceAll("\n", "<br>")}</div>
        ${post.imageBase64 ? `<img class="post-image" src="${post.imageBase64}" alt="Post image" loading="lazy">` : ""}

        <div class="post-actions">
          <button class="action-btn like-btn ${liked ? "liked" : ""}" data-like="${escapeHtml(post.id)}">
            <span class="material-icons">${liked ? "favorite" : "favorite_border"}</span>
            <span>${post.likesCount || 0}</span>
          </button>

          ${isApproved() && emailOf() === (post.authorEmail || "").toLowerCase() ? `
            <button class="action-btn pin-btn" data-pin="${escapeHtml(post.id)}">
              <span class="material-icons">push_pin</span>
              <span>${post.pinned ? "Unpin" : "Pin"}</span>
            </button>` : ""}

          ${isAdmin() ? `
            <button class="action-btn delete-btn" data-delete="${escapeHtml(post.id)}">
              <span class="material-icons">delete</span>
              <span>Delete</span>
            </button>` : ""}
        </div>
      </article>`;
  }).join("");

  list.querySelectorAll("[data-like]").forEach(btn => {
    btn.addEventListener("click", () => toggleLike(btn.dataset.like));
  });
  list.querySelectorAll("[data-pin]").forEach(btn => {
    btn.addEventListener("click", () => togglePin(btn.dataset.pin));
  });
  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => deletePost(btn.dataset.delete));
  });
  list.querySelectorAll("[data-profile]").forEach(btn => {
    btn.addEventListener("click", () => showProfile(btn.dataset.profile));
  });
}

async function toggleLike(postId) {
  if (!currentUser) {
    toast("Sign in to like posts.", "error");
    return;
  }

  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  const liked = Array.isArray(post.likedBy) && post.likedBy.includes(currentUser.uid);
  try {
    await updateDoc(doc(db, "posts", postId), {
      likesCount: increment(liked ? -1 : 1),
      likedBy: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
  } catch (e) {
    console.error(e);
    toast("Could not update the like.", "error");
  }
}

async function togglePin(postId) {
  if (!isApproved()) {
    toast("Sign in with an approved account to pin posts.", "error");
    return;
  }

  const post = allPosts.find(p => p.id === postId);
  if (!post || emailOf() !== (post.authorEmail || "").toLowerCase()) {
    toast("Only the post author can pin their post.", "error");
    return;
  }

  try {
    await updateDoc(doc(db, "posts", postId), { pinned: !post.pinned });
    toast(post.pinned ? "Post unpinned." : "Post pinned.", "success");
  } catch (e) {
    console.error(e);
    toast("Could not update the pin.", "error");
  }
}

async function deletePost(postId) {
  if (!isAdmin()) {
    toast("Only admins can delete posts.", "error");
    return;
  }

  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  if (!window.confirm(`Delete "${post.title || "this post"}"? This cannot be undone.`)) return;

  try {
    await deleteDoc(doc(db, "posts", postId));
    toast("Post deleted.", "success");
  } catch (e) {
    console.error(e);
    toast("Could not delete the post.", "error");
  }
}

function openLogin() {
  signIn();
}

async function signIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
    toast("Sign-in was cancelled or failed.", "error");
  }
}

async function signOutUser() {
  try {
    await signOut(auth);
    toast("Signed out.", "success");
  } catch (e) {
    console.error(e);
    toast("Could not sign out.", "error");
  }
}

function openPostModal() {
  if (!currentUser) {
    signIn();
    return;
  }
  if (!isApproved()) {
    toast("This Google account is not approved to post.", "error");
    return;
  }

  const modal = $("#postModal") || $("#newPostModal");
  if (modal) {
    modal.classList.add("open");
    modal.classList.remove("hidden");
    const title = modal.querySelector("input[name='title'], #postTitle");
    title?.focus();
  }
}

function closePostModal() {
  const modal = $("#postModal") || $("#newPostModal");
  if (modal) {
    modal.classList.remove("open");
    modal.classList.add("hidden");
  }
}

async function submitPost(event) {
  event?.preventDefault();

  if (!isApproved()) {
    toast("Only approved Google accounts can post.", "error");
    return;
  }

  const form = event?.currentTarget || $("#postForm") || $("#newPostForm");
  if (!form) return;

  const title = (form.querySelector("[name='title'], #postTitle")?.value || "").trim();
  const content = (form.querySelector("[name='content'], #postContent")?.value || "").trim();
  const category = (form.querySelector("[name='category'], #postCategory")?.value || "general").toLowerCase();
  const file = form.querySelector("[name='image'], #postImage")?.files?.[0];

  if (!title || !content) {
    toast("Add a title and post content.", "error");
    return;
  }

  let imageBase64 = "";
  if (file) {
    if (file.size > 900 * 1024) {
      toast("Image must be under 900 KB.", "error");
      return;
    }
    imageBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  try {
    await addDoc(collection(db, "posts"), {
      title,
      content,
      category,
      imageBase64,
      authorName: currentUser.displayName || emailOf().split("@")[0],
      authorEmail: emailOf(),
      authorPhoto: currentUser.photoURL || "",
      createdAt: serverTimestamp(),
      likesCount: 0,
      likedBy: [],
      pinned: false
    });

    form.reset();
    closePostModal();
    toast("Post published.", "success");
  } catch (e) {
    console.error(e);
    toast("Could not publish the post.", "error");
  }
}

async function showProfile(email) {
  const posts = allPosts.filter(p => (p.authorEmail || "").toLowerCase() === email.toLowerCase());
  const userPost = posts[0];

  const modal = document.createElement("div");
  modal.className = "profile-modal modal-overlay open";
  modal.innerHTML = `
    <div class="profile-card glass-card">
      <button class="modal-close" aria-label="Close"><span class="material-icons">close</span></button>
      <div class="profile-hero">
        ${userPost?.authorPhoto
          ? `<img class="profile-avatar" src="${escapeHtml(userPost.authorPhoto)}" alt="">`
          : `<div class="profile-avatar"><span class="material-icons">account_circle</span></div>`}
        <h2>${escapeHtml(userPost?.authorName || email.split("@")[0])}</h2>
        <p>${escapeHtml(email)}</p>
      </div>
      <div class="profile-stat"><strong>${posts.length}</strong><span>Posts</span></div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.closest(".modal-close")) modal.remove();
  });
}

function wireUI() {
  // Category/sidebar tabs
  document.querySelectorAll("[data-category]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = (btn.dataset.category || "all").toLowerCase();
      document.querySelectorAll("[data-category]").forEach(x => x.classList.toggle("active", x === btn));
      renderPosts();
    });
  });

  // Common IDs/classes from the original UI.
  ["newPostBtn", "new-post-btn", "createPostBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", openPostModal);
  });
  document.querySelectorAll(".new-post-btn").forEach(el => el.addEventListener("click", openPostModal));

  ["loginBtn", "signInBtn", "signinBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", signIn);
  });
  ["logoutBtn", "signOutBtn", "signoutBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", signOutUser);
  });

  document.querySelectorAll("[data-close-modal], .modal-close").forEach(el => {
    el.addEventListener("click", closePostModal);
  });

  const postForm = $("#postForm") || $("#newPostForm");
  if (postForm) postForm.addEventListener("submit", submitPost);

  const search = $("#searchInput") || $("#search");
  if (search) {
    search.addEventListener("input", e => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderPosts();
    });
  }

  const theme = $("#themeToggle") || $("#darkModeToggle");
  if (theme) {
    theme.addEventListener("click", () => {
      document.body.classList.toggle("light");
      document.body.classList.toggle("dark");
      localStorage.setItem("pineapple-theme", document.body.classList.contains("dark") ? "dark" : "light");
    });
  }

  const savedTheme = localStorage.getItem("pineapple-theme");
  if (savedTheme) document.body.classList.add(savedTheme);

  // Generic nav links: if they carry data-category, handled above.
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const category = (btn.dataset.tab || "all").toLowerCase();
      activeCategory = category;
      document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === btn));
      renderPosts();
    });
  });
}

function startPostsListener() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snapshot => {
    allPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPosts();
  }, error => {
    console.error(error);
    const list = $("#posts") || $("#postList") || $(".posts-list");
    if (list) list.innerHTML = `<div class="empty-state glass-card"><span class="material-icons">error</span><h3>Could not load posts</h3><p>Check your Firestore rules and database connection.</p></div>`;
    toast("Could not load posts from Firestore.", "error");
  });
}

function updateAccountUI() {
  const account = $("#accountArea") || $("#account");
  if (account) {
    if (currentUser) {
      account.innerHTML = `
        <div class="account-user">
          ${currentUser.photoURL ? `<img class="post-avatar-img" src="${escapeHtml(currentUser.photoURL)}" alt="">` : ""}
          <span>${escapeHtml(currentUser.displayName || currentUser.email)}</span>
        </div>`;
    } else {
      account.innerHTML = `<button class="primary-btn" id="accountLoginBtn"><span class="material-icons">login</span>Sign in</button>`;
      $("#accountLoginBtn")?.addEventListener("click", signIn);
    }
  }

  document.querySelectorAll(".new-post-btn, #newPostBtn, #createPostBtn").forEach(el => {
    el.disabled = false;
  });
  renderPosts();
}

window.addEventListener("DOMContentLoaded", () => {
  wireUI();
  startPostsListener();

  onAuthStateChanged(auth, async user => {
    currentUser = user;

    if (user && !ALLOWED.has(emailOf(user))) {
      toast("This Google account is not approved for posting.", "error");
    }

    updateAccountUI();
  });
});
