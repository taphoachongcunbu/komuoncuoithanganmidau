import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Config Firebase của bà đã được tích hợp vào đây:
const firebaseConfig = {
  apiKey: "AIzaSyCGvyVRdZ3as6H5cq3bZkimHbp68K1nFpw",
  authDomain: "khongmuoncuoithanghettie-dcae6.firebaseapp.com",
  projectId: "khongmuoncuoithanghettie-dcae6",
  storageBucket: "khongmuoncuoithanghettie-dcae6.firebasestorage.app",
  messagingSenderId: "742594403029",
  appId: "1:742594403029:web:167279a43012b1347ae05c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// UI Controls
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginMessage = document.getElementById('login-message');
const appContent = document.getElementById('app-content');
const themeToggle = document.getElementById('theme-toggle');

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    themeToggle.innerText = document.body.classList.contains('dark-mode') ? '☀️ Light Mode' : '🌙 Dark Mode';
});

// Chuyển Tab
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-target')).classList.add('active');
    });
});

// Auth Listener
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        loginMessage.style.display = 'none';
        appContent.style.display = 'block';
        loadAllData();
    } else {
        currentUser = null;
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        loginMessage.style.display = 'block';
        appContent.style.display = 'none';
    }
});

// Hàm định dạng tiền tệ VND
const formatVND = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// --- XỬ LÝ THU ---
document.getElementById('income-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('income-amount').value);
    const source = document.getElementById('income-source').value;

    await addDoc(collection(db, 'users', currentUser.uid, 'income'), {
        amount, source, createdAt: new Date()
    });
    alert('Đã lưu khoản thu!');
    e.target.reset();
    loadOverview();
});

// --- XỬ LÝ CHI ---
document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('expense-amount').value);
    const category = document.getElementById('expense-category').value;

    await addDoc(collection(db, 'users', currentUser.uid, 'expense'), {
        amount, category, createdAt: new Date()
    });
    alert('Đã lưu khoản chi!');
    e.target.reset();
    loadOverview();
});

// --- XỬ LÝ NỢ ---
document.getElementById('debt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('debt-type').value;
    const amount = Number(document.getElementById('debt-amount').value);
    const person = document.getElementById('debt-person').value;

    await addDoc(collection(db, 'users', currentUser.uid, 'debt'), {
        type, amount, person, createdAt: new Date()
    });
    alert('Đã lưu ghi chép nợ!');
    e.target.reset();
    loadOverview();
});

// --- XỬ LÝ WISHLIST ---
document.getElementById('wishlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('wish-name').value;
    const link = document.getElementById('wish-link').value;
    const priority = Number(document.getElementById('wish-priority').value);

    await addDoc(collection(db, 'users', currentUser.uid, 'wishlist'), {
        name, link, priority, createdAt: new Date()
    });
    alert('Đã thêm vào Wishlist!');
    e.target.reset();
    loadWishlist();
});

// --- HÀM LOAD TỔNG QUAN ---
async function loadOverview() {
    if (!currentUser) return;

    // Load Thu
    const incomeSnap = await getDocs(collection(db, 'users', currentUser.uid, 'income'));
    let totalIncome = 0;
    incomeSnap.forEach(doc => totalIncome += doc.data().amount);
    document.getElementById('total-income').innerText = formatVND(totalIncome);

    // Load Chi
    const expenseSnap = await getDocs(collection(db, 'users', currentUser.uid, 'expense'));
    let totalExpense = 0;
    expenseSnap.forEach(doc => totalExpense += doc.data().amount);
    document.getElementById('total-expense').innerText = formatVND(totalExpense);

    // Load Nợ
    const debtSnap = await getDocs(collection(db, 'users', currentUser.uid, 'debt'));
    let totalDebt = 0;
    debtSnap.forEach(doc => {
        const data = doc.data();
        if (data.type === 'vay') totalDebt += data.amount; // Tiền mình nợ người ta
    });
    document.getElementById('total-debt').innerText = formatVND(totalDebt);
}

// --- HÀM LOAD WISHLIST ---
async function loadWishlist() {
    if (!currentUser) return;
    const wishlistItems = document.getElementById('wishlist-items');
    wishlistItems.innerHTML = 'Đang tải...';

    const q = query(collection(db, 'users', currentUser.uid, 'wishlist'), orderBy('priority', 'asc'));
    const snap = await getDocs(q);
    
    wishlistItems.innerHTML = '';
    snap.forEach(doc => {
        const data = doc.data();
        const priorityText = data.priority === 1 ? '🔥 Must have' : (data.priority === 2 ? '✨ Có cũng được' : '🤷‍♀️ Chưa cần');
        
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${data.name}</strong> <br>
                <small>${priorityText}</small>
            </div>
            ${data.link ? `<a href="${data.link}" target="_blank" style="color: var(--primary-color); font-weight: bold;">Xem link</a>` : ''}
        `;
        wishlistItems.appendChild(li);
    });
}

function loadAllData() {
    loadOverview();
    loadWishlist();
}
