import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

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
    const matchesFilter = activeFilter === "all" || p.category === activeFilter || (activeFilter==="popular" && (p.likes||0)>0) || (activeFilter==="recent" && Date.now()-(p.createdAt?.toDate?.()||new Date()).getTime()<7*86400000);
    return matchesSearch && matchesFilter;
  });
  postsEl.innerHTML = posts.map(p => `
    <article class="post glass">
      <div class="post-avatar">${esc((p.authorName||"?")[0].toUpperCase())}</div>
      <div>
        <div class="post-meta"><span class="tag">${esc(p.category||"general")}</span><span>${esc(p.authorName||"Member")}</span><span>·</span><span>${formatDate(p.createdAt)}</span></div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.content)}</p>
        ${p.imageBase64 ? `<img class="post-image" src="${p.imageBase64}" alt="Post image">` : ""}
      </div>
    </article>`).join("");
  emptyEl.classList.toggle("hidden", posts.length > 0);
  document.querySelector("#postCount").textContent = allPosts.length;
}
searchEl.oninput = render;
document.querySelectorAll(".nav-item").forEach(b => b.onclick = () => {
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); activeFilter=b.dataset.filter; render();
});

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
      likes: 0
    });
    e.target.reset();
    imagePreview.classList.add("hidden");
    imagePreview.innerHTML="";
    closeModal(postModal);
  } catch(err) {
    console.error(err);
    postError.textContent = "Could not publish. Check your Firestore rules.";
  }
};
