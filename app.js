import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// THÊM: doc, deleteDoc để xử lý tính năng xóa
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let expenseChartInstance = null; // Biến lưu biểu đồ

// === HỆ THỐNG THÔNG BÁO (TOAST) THAY THẾ ALERT() ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle" style="color:#27ae60"></i>' : '<i class="fa-solid fa-triangle-exclamation" style="color:#e74c3c"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// UI Controls
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if(expenseChartInstance) updateChartColors(); // Cập nhật màu biểu đồ nếu đổi theme
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.getAttribute('data-target')).classList.add('active');
    });
});

// Auth
document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        document.getElementById('login-message').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        loadAllData();
    } else {
        currentUser = null;
        document.getElementById('login-btn').style.display = 'inline-block';
        document.getElementById('logout-btn').style.display = 'none';
        document.getElementById('login-message').style.display = 'block';
        document.getElementById('app-content').style.display = 'none';
    }
});

const formatVND = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// === CHATBOT (SMART INPUT) ===
document.getElementById('btn-smart-submit').addEventListener('click', processSmartInput);
document.getElementById('smart-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') processSmartInput();
});

async function processSmartInput() {
    const text = document.getElementById('smart-input').value.trim().toLowerCase();
    if(!text) return;
    
    // Tìm số tiền (VD: 50k, 2tr, 100000)
    let amount = 0;
    const match = text.match(/(\d+)\s*(k|tr|đ|d)/i) || text.match(/(\d+)/);
    if (match) {
        let num = parseInt(match[1]);
        let unit = match[2] || '';
        if (unit === 'k') amount = num * 1000;
        else if (unit === 'tr') amount = num * 1000000;
        else amount = num;
    }

    if(amount === 0) {
        showToast("Máy không hiểu số tiền. Vui lòng ghi rõ (VD: 50k, 2tr)", "error");
        return;
    }

    let type = text.includes('thu') || text.includes('lương') ? 'income' : 'expense';
    let label = text.replace(match[0], '').replace(/(thu|chi|mua)/g, '').trim() || 'Khác';

    try {
        await addDoc(collection(db, 'users', currentUser.uid, type), {
            amount: amount,
            category: type === 'expense' ? label : undefined,
            source: type === 'income' ? label : undefined,
            createdAt: new Date()
        });
        showToast(`Đã tự động ghi ${type === 'income' ? 'Thu' : 'Chi'}: ${formatVND(amount)} (${label})`);
        document.getElementById('smart-input').value = '';
        loadAllData();
    } catch(e) {
        showToast("Lỗi hệ thống", "error");
    }
}

// === LƯU THỦ CÔNG ===
async function saveTransaction(type, amountId, labelId) {
    const amount = Number(document.getElementById(amountId).value);
    const label = document.getElementById(labelId).value;
    const data = type === 'expense' ? { amount, category: label, createdAt: new Date() } : { amount, source: label, createdAt: new Date() };
    
    await addDoc(collection(db, 'users', currentUser.uid, type), data);
    showToast(`Đã lưu ${type === 'expense' ? 'khoản chi' : 'khoản thu'}!`);
    loadAllData();
}

document.getElementById('income-form').addEventListener('submit', (e) => { e.preventDefault(); saveTransaction('income', 'income-amount', 'income-source'); e.target.reset(); });
document.getElementById('expense-form').addEventListener('submit', (e) => { e.preventDefault(); saveTransaction('expense', 'expense-amount', 'expense-category'); e.target.reset(); });

// XÓA DỮ LIỆU CHUNG
window.deleteData = async (type, id) => {
    if(confirm("Xóa mục này nhé?")) {
        await deleteDoc(doc(db, 'users', currentUser.uid, type, id));
        showToast("Đã xóa thành công!");
        loadAllData();
    }
};

// === RENDER DỮ LIỆU & BIỂU ĐỒ ===
async function loadAllData() {
    if (!currentUser) return;

    // Load Data
    const [incSnap, expSnap, debtSnap, wishSnap, budgetDoc] = await Promise.all([
        getDocs(collection(db, 'users', currentUser.uid, 'income')),
        getDocs(collection(db, 'users', currentUser.uid, 'expense')),
        getDocs(collection(db, 'users', currentUser.uid, 'debt')),
        getDocs(query(collection(db, 'users', currentUser.uid, 'wishlist'), orderBy('priority', 'asc'))),
        getDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'))
    ]);

    let totalInc = 0, totalExp = 0, catExp = {};
    let historyHtml = '';

    incSnap.forEach(d => { totalInc += d.data().amount; historyHtml += `<li>Thu: ${d.data().source} <span>+${formatVND(d.data().amount)}</span> <button class="del-btn" onclick="deleteData('income','${d.id}')">X</button></li>`; });
    expSnap.forEach(d => { 
        let amt = d.data().amount; let cat = d.data().category;
        totalExp += amt; catExp[cat] = (catExp[cat] || 0) + amt;
        historyHtml += `<li>Chi: ${cat} <span style="color:#e74c3c">-${formatVND(amt)}</span> <button class="del-btn" onclick="deleteData('expense','${d.id}')">X</button></li>`; 
    });

    document.getElementById('total-income').innerText = formatVND(totalInc);
    document.getElementById('total-expense').innerText = formatVND(totalExp);
    document.getElementById('history-list').innerHTML = historyHtml;

    // Budget Warning
    let budget = budgetDoc.exists() ? budgetDoc.data().limit : 0;
    if(budget > 0) {
        document.getElementById('budget-limit').value = budget;
        const warningDiv = document.getElementById('budget-warning');
        const percent = (totalExp / budget) * 100;
        if(percent >= 100) { warningDiv.style.display = 'block'; warningDiv.innerText = `🚨 CẢNH BÁO: Đã tiêu vượt hạn mức (${Math.round(percent)}%)`; }
        else if (percent >= 80) { warningDiv.style.display = 'block'; warningDiv.style.background = '#ffeaa7'; warningDiv.style.color = '#d35400'; warningDiv.innerText = `⚠️ Nhắc nhở: Đã tiêu ${Math.round(percent)}% hạn mức tháng.`; }
        else { warningDiv.style.display = 'none'; }
    }

    // Vẽ Biểu Đồ
    drawChart(catExp);

    // Debt
    let vayHtml = '', choVayHtml = '';
    debtSnap.forEach(d => {
        const data = d.data();
        const html = `<li>${data.person} <span>${formatVND(data.amount)}</span> <button class="del-btn" onclick="deleteData('debt','${d.id}')">X</button></li>`;
        if(data.type === 'vay') vayHtml += html; else choVayHtml += html;
    });
    document.getElementById('list-vay').innerHTML = vayHtml;
    document.getElementById('list-cho-vay').innerHTML = choVayHtml;

    // Wishlist Grid
    let wishHtml = '';
    wishSnap.forEach((d, index) => {
        const data = d.data();
        const prio = data.priority == 1 ? '🔥 Must have' : (data.priority == 2 ? '✨ Có cũng được' : '🤷‍♀️ Chưa cần');
        const img = data.image ? `<img src="${data.image}" alt="wish">` : `<div style="height:100px; background:#e9ecef; display:flex; align-items:center; justify-content:center"><i class="fa-solid fa-image"></i></div>`;
        wishHtml += `
            <div class="wish-card">
                <span class="badge">#${index + 1} | ${prio}</span>
                ${img}
                <div class="info">
                    <h4>${data.name}</h4>
                    ${data.price ? `<p style="font-weight:bold; color:var(--primary-color)">${formatVND(data.price)}</p>` : ''}
                    <div style="display:flex; justify-content:space-between; margin-top:10px;">
                        ${data.link ? `<a href="${data.link}" target="_blank" style="font-size:0.8rem; color:#8e44ad">🛒 Mua ngay</a>` : `<span></span>`}
                        <button class="icon-btn" onclick="deleteData('wishlist','${d.id}')" style="color:#e74c3c"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
    document.getElementById('wishlist-grid').innerHTML = wishHtml;
}

// Lưu Hạn mức
document.getElementById('save-budget').addEventListener('click', async () => {
    const limit = Number(document.getElementById('budget-limit').value);
    await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'), { limit });
    showToast("Đã lưu hạn mức chi tiêu!");
    loadAllData();
});

// Xử lý nợ & Wishlist thêm mới
document.getElementById('debt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'users', currentUser.uid, 'debt'), {
        type: document.getElementById('debt-type').value, amount: Number(document.getElementById('debt-amount').value), person: document.getElementById('debt-person').value, createdAt: new Date()
    });
    showToast('Đã lưu sổ nợ!'); e.target.reset(); loadAllData();
});

document.getElementById('wishlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'users', currentUser.uid, 'wishlist'), {
        name: document.getElementById('wish-name').value, price: Number(document.getElementById('wish-price').value), image: document.getElementById('wish-image').value, link: document.getElementById('wish-link').value, priority: Number(document.getElementById('wish-priority').value), createdAt: new Date()
    });
    showToast('Đã thêm Wishlist!'); e.target.reset(); loadAllData();
});

// --- CHART.JS ---
function drawChart(catExp) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const labels = Object.keys(catExp);
    const data = Object.values(catExp);
    const isDark = document.body.classList.contains('dark-mode');

    if (expenseChartInstance) expenseChartInstance.destroy();

    if(data.length === 0) {
        labels.push("Chưa có dữ liệu"); data.push(1); // Placeholder
    }

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe'],
                borderWidth: isDark ? 2 : 0, borderColor: isDark ? '#1e1e1e' : '#fff'
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: isDark ? '#e0e0e0' : '#2c3e50', font: { family: 'Be Vietnam Pro' } } }
            },
            cutout: '65%'
        }
    });
}

function updateChartColors() { loadAllData(); }
