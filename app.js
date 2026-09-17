import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, increment, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAW4KHaVfcWpDO2qNNHqdkz90hrD_IdxGU",
  authDomain: "games-forum-82a51.firebaseapp.com",
  projectId: "games-forum-82a51",
  storageBucket: "games-forum-82a51.firebasestorage.app",
  messagingSenderId: "1082742788932",
  appId: "1:1082742788932:web:3fa22d61930b2eda5ffd11",
  measurementId: "G-LVBGPSR8WV"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch {}
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ALLOWED = new Set(["30copallock@pulaskischools.org", "blueberryggames@gmail.com"]);
const postsEl = document.querySelector("#posts");
const emptyEl = document.querySelector("#empty");
const searchEl = document.querySelector("#search");
const accountText = document.querySelector("#accountText");
const loginBtn = document.querySelector("#loginBtn");
const loginModal = document.querySelector("#loginModal");
const postModal = document.querySelector("#postModal");
const loginError = document.querySelector("#loginError");
const postError = document.querySelector("#postError");
const imageInput = document.querySelector("#postImage");
const imagePreview = document.querySelector("#imagePreview");

let currentUser = null;
let allPosts = [];
let activeFilter = "all";

const esc = (s="") => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));

function openModal(el){ el.classList.remove("hidden"); }
function closeModal(el){ el.classList.add("hidden"); }

document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => closeModal(document.getElementById(b.dataset.close)));
[loginModal, postModal].forEach(m => m.addEventListener("click", e => { if(e.target === m) closeModal(m); }));

document.querySelector("#themeBtn").onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("arcadia-theme", document.body.classList.contains("dark") ? "dark" : "light");
};
if(localStorage.getItem("arcadia-theme")==="dark") document.body.classList.add("dark");

loginBtn.onclick = () => currentUser ? signOut(auth) : openModal(loginModal);

document.querySelector("#googleBtn").onclick = async () => {
  loginError.textContent = "";
  try {
    const result = await signInWithPopup(auth, provider);
    if(!ALLOWED.has(result.user.email?.toLowerCase())) {
      await signOut(auth);
      loginError.textContent = "That Google account is not approved for posting.";
      return;
    }
    closeModal(loginModal);
    toast("Signed in successfully.");
  } catch(e) {
    loginError.textContent = e?.message || "Sign-in failed.";
  }
};

document.querySelector("#newPostBtn").onclick = () => {
  if(!currentUser) return openModal(loginModal);
  if(!ALLOWED.has(currentUser.email.toLowerCase())) return;
  postError.textContent = "";
  openModal(postModal);
};

onAuthStateChanged(auth, user => {
  currentUser = user;
  if(user && ALLOWED.has(user.email?.toLowerCase())) {
    accountText.textContent = user.displayName || "Account";
    loginBtn.querySelector(".avatar").textContent = (user.displayName || user.email)[0].toUpperCase();
  } else if(user) {
    accountText.textContent = "Restricted";
    loginBtn.querySelector(".avatar").textContent = "?";
  } else {
    accountText.textContent = "Sign in";
    loginBtn.querySelector(".avatar").textContent = "?";
  }
});

const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
onSnapshot(postsQuery, snap => {
  allPosts = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  render();
}, err => {
  console.error(err);
  postsEl.innerHTML = `<div class="post glass"><div class="post-avatar">!</div><div><h3>Could not load posts</h3><p>Check your Firestore rules and configuration.</p></div></div>`;
});

function formatDate(ts){
  if(!ts) return "Just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(d);
}
function render(){
  const term = searchEl.value.trim().toLowerCase();
  let posts = allPosts.filter(p => {
    const matchesSearch = !term || `${p.title} ${p.content} ${p.authorName} ${p.category}`.toLowerCase().includes(term);
    const matchesFilter = activeFilter === "all" || p.category === activeFilter ||
      (activeFilter==="popular" && (p.likesCount||0)>0) ||
      (activeFilter==="recent" && Date.now()-(p.createdAt?.toDate?.()||new Date()).getTime()<7*86400000);
    return matchesSearch && matchesFilter;
  });

  posts.sort((a,b) => Number(b.pinned)-Number(a.pinned) || ((b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));

  postsEl.innerHTML = posts.map(p => {
    const liked = currentUser && Array.isArray(p.likedBy) && p.likedBy.includes(currentUser.uid);
    const avatar = p.authorPhoto
      ? `<img class="post-avatar-img" src="${esc(p.authorPhoto)}" alt="">`
      : esc((p.authorName||"?")[0].toUpperCase());

    return `
    <article class="post glass ${p.pinned ? "pinned" : ""}">
      <button class="post-avatar" data-profile="${esc(p.authorEmail||"")}" title="View profile">${avatar}</button>
      <div>
        <div class="post-topline">
          <div class="post-meta">
            ${p.pinned ? `<span class="pinned-tag"><span class="material-icons-round">push_pin</span>Pinned</span>` : ""}
            <span class="tag">${esc(p.category||"general")}</span>
            <button class="author-link" data-profile="${esc(p.authorEmail||"")}">${esc(p.authorName||"Member")}</button>
            <span>·</span><span>${formatDate(p.createdAt)}</span>
          </div>
        </div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.content)}</p>
        ${p.imageBase64 ? `<img class="post-image" src="${p.imageBase64}" alt="Post image">` : ""}
        <div class="post-actions">
          <button class="action-btn ${liked ? "liked":""}" data-like="${p.id}">
            <span class="material-icons-round">${liked ? "favorite" : "favorite_border"}</span>
            <span>${p.likesCount||0}</span>
          </button>
          ${currentUser && ALLOWED.has(currentUser.email?.toLowerCase()) && p.authorEmail === currentUser.email.toLowerCase()
            ? `<button class="action-btn" data-pin="${p.id}"><span class="material-icons-round">${p.pinned ? "push_pin" : "push_pin"}</span>${p.pinned ? "Unpin" : "Pin"}</button>` : ""}
        </div>
      </div>
    </article>`;
  }).join("");

  emptyEl.classList.toggle("hidden", posts.length > 0);
  document.querySelector("#postCount").textContent = allPosts.length;

  document.querySelectorAll("[data-like]").forEach(b => b.onclick = () => toggleLike(b.dataset.like));
  document.querySelectorAll("[data-pin]").forEach(b => b.onclick = () => togglePin(b.dataset.pin));
  document.querySelectorAll("[data-profile]").forEach(b => b.onclick = () => showProfile(b.dataset.profile));
}

searchEl.oninput = render;
document.querySelectorAll(".nav-item").forEach(b => b.onclick = () => {
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); activeFilter=b.dataset.filter; render();
});


function toast(message, type="info"){
  let box = document.querySelector("#toast");
  if(!box){
    box = document.createElement("div");
    box.id = "toast";
    box.className = "toast";
    document.body.appendChild(box);
  }
  box.innerHTML = `<span class="material-icons-round">${type==="error" ? "error" : "check_circle"}</span><span>${esc(message)}</span>`;
  box.classList.add("show");
  clearTimeout(box._timer);
  box._timer = setTimeout(() => box.classList.remove("show"), 2800);
}

async function toggleLike(postId){
  if(!currentUser){ openModal(loginModal); return; }
  const ref = doc(db,"posts",postId);
  const post = allPosts.find(p=>p.id===postId);
  if(!post) return;
  const liked = Array.isArray(post.likedBy) && post.likedBy.includes(currentUser.uid);
  try{
    await updateDoc(ref,{
      likesCount: increment(liked ? -1 : 1),
      likedBy: liked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
  }catch(e){ console.error(e); toast("Could not update like.", "error"); }
}

async function togglePin(postId){
  const post = allPosts.find(p=>p.id===postId);
  if(!post || !currentUser || post.authorEmail !== currentUser.email.toLowerCase()) return;
  try{
    await updateDoc(doc(db,"posts",postId), { pinned: !post.pinned });
    toast(post.pinned ? "Post unpinned." : "Post pinned.");
  }catch(e){ console.error(e); toast("Could not update pin.", "error"); }
}

async function showProfile(email){
  const post = allPosts.find(p=>p.authorEmail===email);
  if(!post) return;
  const existing = document.querySelector("#profileModal");
  if(existing) existing.remove();

  const profile = document.createElement("div");
  profile.id = "profileModal";
  profile.className = "modal";
  profile.innerHTML = `
    <div class="modal-card glass profile-card">
      <button class="close icon-btn"><span class="material-icons-round">close</span></button>
      <div class="profile-hero">
        ${post.authorPhoto ? `<img src="${esc(post.authorPhoto)}" class="profile-avatar" alt="">` : `<div class="profile-avatar">${esc((post.authorName||"?")[0].toUpperCase())}</div>`}
        <div><h2>${esc(post.authorName||"Member")}</h2><p class="muted">${esc(email)}</p></div>
      </div>
      <div class="profile-stat"><strong>${allPosts.filter(p=>p.authorEmail===email).length}</strong><span>Posts</span></div>
    </div>`;
  document.body.appendChild(profile);
  profile.querySelector(".close").onclick=()=>profile.remove();
  profile.onclick=e=>{if(e.target===profile)profile.remove()};
}


imageInput.onchange = () => {
  const file = imageInput.files?.[0];
  if(!file){ imagePreview.classList.add("hidden"); imagePreview.innerHTML=""; return; }
  if(file.size > 900_000){ postError.textContent = "Please use an image smaller than 900 KB."; imageInput.value=""; return; }
  const reader = new FileReader();
  reader.onload = () => { imagePreview.innerHTML=`<img src="${reader.result}" alt="Preview">`; imagePreview.classList.remove("hidden"); };
  reader.readAsDataURL(file);
};

document.querySelector("#postForm").onsubmit = async e => {
  e.preventDefault();
  postError.textContent="";
  if(!currentUser || !ALLOWED.has(currentUser.email.toLowerCase())) {
    postError.textContent="You must be signed in with an approved account.";
    return;
  }
  const file = imageInput.files?.[0];
  let imageBase64 = "";
  if(file){
    if(file.size > 900_000){ postError.textContent="Image is too large."; return; }
    imageBase64 = await new Promise((resolve,reject)=>{
      const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file);
    });
  }
  try {
    await addDoc(collection(db,"posts"), {
      title: document.querySelector("#postTitle").value.trim(),
      content: document.querySelector("#postContent").value.trim(),
      category: document.querySelector("#postCategory").value,
      imageBase64,
      authorName: currentUser.displayName || currentUser.email.split("@")[0],
      authorEmail: currentUser.email.toLowerCase(),
      createdAt: serverTimestamp(),
      likesCount: 0,
      likedBy: [],
      pinned: false,
      authorPhoto: currentUser.photoURL || ""
    });
    e.target.reset();
    imagePreview.classList.add("hidden");
    imagePreview.innerHTML="";
    closeModal(postModal);
    toast("Post published.");
  } catch(err) {
    console.error(err);
    postError.textContent = "Could not publish. Check your Firestore rules.";
  }
};
