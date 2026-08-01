import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Đã gỡ bỏ firebase-storage.js hoàn toàn

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
let expenseChartInstance = null;

// === TOAST & MODAL ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle" style="color:#10b981"></i>' : '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

let itemToDelete = null;
document.getElementById('cancel-delete').onclick = () => { document.getElementById('confirm-modal').style.display = 'none'; };
document.getElementById('confirm-delete').onclick = async () => {
    if(itemToDelete) {
        await deleteDoc(doc(db, 'users', currentUser.uid, itemToDelete.type, itemToDelete.id));
        showToast("Đã xóa dữ liệu!");
        document.getElementById('confirm-modal').style.display = 'none';
        loadAllData();
    }
};
window.requestDelete = (type, id) => {
    itemToDelete = { type, id };
    document.getElementById('confirm-modal').style.display = 'flex';
};

// === FORMAT SỐ TIỀN CÓ DẤU CHẤM ===
function formatCurrencyInput(e) {
    let val = e.target.value.replace(/\D/g, ""); // Xóa mọi ký tự không phải số
    if (val) {
        e.target.value = Number(val).toLocaleString('vi-VN');
        e.target.dataset.raw = val; // Lưu số thật ẩn ở phía sau
    } else {
        e.target.value = "";
        e.target.dataset.raw = "0";
    }
}
document.querySelectorAll('.amount-input').forEach(input => input.addEventListener('input', formatCurrencyInput));

const formatVND = (amount) => Number(amount).toLocaleString('vi-VN') + ' đ';

// UI Controls & Auth
document.getElementById('theme-toggle').addEventListener('click', () => { document.body.classList.toggle('dark-mode'); if(expenseChartInstance) loadAllData(); });
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active'); document.getElementById(e.target.getAttribute('data-target')).classList.add('active');
    });
});
document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user; document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        document.getElementById('login-message').style.display = 'none';
        document.getElementById('app-content').style.display = 'block'; loadAllData();
    } else {
        currentUser = null; document.getElementById('login-btn').style.display = 'inline-block';
        document.getElementById('logout-btn').style.display = 'none';
        document.getElementById('login-message').style.display = 'block'; document.getElementById('app-content').style.display = 'none';
    }
});

// === ẨN/HIỆN MỤC "KHÁC" ===
function handleSelectOther(selectId, inputId) {
    document.getElementById(selectId).addEventListener('change', (e) => {
        document.getElementById(inputId).style.display = e.target.value === 'Khác' ? 'block' : 'none';
        if(e.target.value !== 'Khác') document.getElementById(inputId).value = '';
    });
}
handleSelectOther('income-source', 'income-other');
handleSelectOther('expense-category', 'expense-other');

// === CHATBOT SMART INPUT ===
document.getElementById('btn-smart-submit').addEventListener('click', processSmartInput);
async function processSmartInput() {
    const text = document.getElementById('smart-input').value.trim().toLowerCase();
    if(!text) return;
    let amount = 0;
    const match = text.match(/(\d+)\s*(k|tr|đ|d)/i) || text.match(/(\d+)/);
    if (match) {
        let num = parseInt(match[1]); let unit = match[2] || '';
        if (unit === 'k') amount = num * 1000; else if (unit === 'tr') amount = num * 1000000; else amount = num;
    }
    if(amount === 0) { showToast("Vui lòng ghi rõ số tiền (VD: 50k, 2tr)", "error"); return; }

    let type = text.includes('thu') || text.includes('lương') ? 'income' : 'expense';
    let label = text.replace(match[0], '').replace(/(thu|chi|mua)/g, '').trim() || 'Khác';

    const dataObj = { amount: amount, createdAt: new Date() };
    if (type === 'expense') dataObj.category = label; else dataObj.source = label;

    await addDoc(collection(db, 'users', currentUser.uid, type), dataObj);
    showToast(`Đã tự động ghi ${type === 'income' ? 'Thu' : 'Chi'}: ${formatVND(amount)}`);
    document.getElementById('smart-input').value = ''; loadAllData();
}

// LƯU THU/CHI
async function saveTransaction(type, amountId, selectId, otherId) {
    const amount = Number(document.getElementById(amountId).dataset.raw || 0);
    if(amount === 0) return showToast("Chưa nhập số tiền!", "error");
    
    let label = document.getElementById(selectId).value;
    if (label === 'Khác') label = document.getElementById(otherId).value || 'Khác';

    const dataObj = { amount: amount, createdAt: new Date() };
    if (type === 'expense') dataObj.category = label; else dataObj.source = label;
    
    await addDoc(collection(db, 'users', currentUser.uid, type), dataObj);
    showToast(`Đã lưu khoản ${type === 'expense' ? 'chi' : 'thu'}!`);
    loadAllData();
}
document.getElementById('income-form').addEventListener('submit', (e) => { e.preventDefault(); saveTransaction('income', 'income-amount', 'income-source', 'income-other'); e.target.reset(); document.getElementById('income-other').style.display='none'; document.getElementById('income-amount').dataset.raw = "0"; });
document.getElementById('expense-form').addEventListener('submit', (e) => { e.preventDefault(); saveTransaction('expense', 'expense-amount', 'expense-category', 'expense-other'); e.target.reset(); document.getElementById('expense-other').style.display='none'; document.getElementById('expense-amount').dataset.raw = "0";});

// === LOGIC NỢ: THANH TOÁN ===
window.payDebt = async (debtId, type, amount, person) => {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'debt', debtId));
    if (type === 'vay') {
        await addDoc(collection(db, 'users', currentUser.uid, 'expense'), { amount: amount, category: `Trả tiền mượn (${person})`, createdAt: new Date() });
        showToast("Đã thanh toán! Tự động ghi vào khoản Chi.");
    } else {
        await addDoc(collection(db, 'users', currentUser.uid, 'income'), { amount: amount, source: `Thu tiền cho mượn (${person})`, createdAt: new Date() });
        showToast("Đã đòi được tiền! Tự động ghi vào khoản Thu.");
    }
    loadAllData();
};

document.getElementById('debt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('debt-amount').dataset.raw || 0);
    await addDoc(collection(db, 'users', currentUser.uid, 'debt'), {
        type: document.getElementById('debt-type').value, amount: amount, person: document.getElementById('debt-person').value, createdAt: new Date()
    });
    showToast('Đã ghi vào sổ!'); e.target.reset(); document.getElementById('debt-amount').dataset.raw = "0"; loadAllData();
});

// === XỬ LÝ WISHLIST KHI KHÔNG DÙNG STORAGE ===
document.getElementById('wishlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-add-wish');
    btn.disabled = true;

    const price = Number(document.getElementById('wish-price').dataset.raw || 0);
    const imageUrl = document.getElementById('wish-image').value; // Chỉ lấy link text bình thường

    await addDoc(collection(db, 'users', currentUser.uid, 'wishlist'), {
        name: document.getElementById('wish-name').value, price: price, image: imageUrl, link: document.getElementById('wish-link').value, priority: Number(document.getElementById('wish-priority').value), createdAt: new Date()
    });
    
    showToast('Đã thêm Wishlist!'); e.target.reset(); 
    document.getElementById('wish-price').dataset.raw = "0";
    btn.disabled = false;
    loadAllData();
});

// === WISHLIST CHECKBOX TOTAL ===
window.calcWishlistTotal = () => {
    let total = 0;
    document.querySelectorAll('.wish-check:checked').forEach(cb => { total += Number(cb.dataset.price); });
    document.getElementById('wishlist-selected-total').innerText = formatVND(total);
};

// === RENDER DỮ LIỆU ===
async function loadAllData() {
    if (!currentUser) return;
    const [incSnap, expSnap, debtSnap, wishSnap, budgetDoc] = await Promise.all([
        getDocs(collection(db, 'users', currentUser.uid, 'income')), getDocs(collection(db, 'users', currentUser.uid, 'expense')),
        getDocs(collection(db, 'users', currentUser.uid, 'debt')), getDocs(query(collection(db, 'users', currentUser.uid, 'wishlist'), orderBy('priority', 'asc'))),
        getDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'))
    ]);

    let totalInc = 0, totalExp = 0, catExp = {}, historyHtml = '';

    incSnap.forEach(d => { totalInc += d.data().amount; historyHtml += `<li><div>${d.data().source}</div> <div class="action-btns"><span style="color:#10b981">+${formatVND(d.data().amount)}</span> <button class="btn-icon" onclick="requestDelete('income','${d.id}')"><i class="fa-solid fa-trash"></i></button></div></li>`; });
    expSnap.forEach(d => { 
        let amt = d.data().amount; let cat = d.data().category; totalExp += amt; catExp[cat] = (catExp[cat] || 0) + amt;
        historyHtml += `<li><div>${cat}</div> <div class="action-btns"><span style="color:#ef4444">-${formatVND(amt)}</span> <button class="btn-icon" onclick="requestDelete('expense','${d.id}')"><i class="fa-solid fa-trash"></i></button></div></li>`; 
    });

    document.getElementById('total-income').innerText = formatVND(totalInc);
    document.getElementById('total-expense').innerText = formatVND(totalExp);
    document.getElementById('history-list').innerHTML = historyHtml;

    let budget = budgetDoc.exists() ? budgetDoc.data().limit : 0;
    if(budget > 0) {
        let inputB = document.getElementById('budget-limit');
        inputB.value = Number(budget).toLocaleString('vi-VN'); inputB.dataset.raw = budget;
        const warningDiv = document.getElementById('budget-warning'); const percent = (totalExp / budget) * 100;
        if(percent >= 100) { warningDiv.style.display = 'block'; warningDiv.innerText = `🚨 Đã tiêu vượt hạn mức (${Math.round(percent)}%)`; }
        else if (percent >= 80) { warningDiv.style.display = 'block'; warningDiv.style.background = '#fef08a'; warningDiv.style.color = '#854d0e'; warningDiv.innerText = `⚠️ Nhắc nhở: Đã tiêu ${Math.round(percent)}% hạn mức.`; }
        else warningDiv.style.display = 'none';
    }

    drawChart(catExp);

    let vayHtml = '', choVayHtml = '', totalVay = 0, totalChoVay = 0;
    debtSnap.forEach(d => {
        const data = d.data();
        const html = `<li><div>${data.person}<br><small>${formatVND(data.amount)}</small></div> <div class="action-btns"><button class="btn-icon pay" title="Đã thanh toán" onclick="payDebt('${d.id}', '${data.type}', ${data.amount}, '${data.person}')"><i class="fa-solid fa-check"></i></button> <button class="btn-icon" onclick="requestDelete('debt','${d.id}')"><i class="fa-solid fa-trash"></i></button></div></li>`;
        if(data.type === 'vay') { vayHtml += html; totalVay += data.amount; } else { choVayHtml += html; totalChoVay += data.amount; }
    });
    document.getElementById('list-vay').innerHTML = vayHtml; document.getElementById('list-cho-vay').innerHTML = choVayHtml;
    document.getElementById('overview-vay').innerText = formatVND(totalVay); document.getElementById('overview-cho-vay').innerText = formatVND(totalChoVay);

    let wishHtml = '';
    wishSnap.forEach((d, index) => {
        const data = d.data();
        // Nếu có link ảnh thì hiện, không thì hiện placeholder icon
        const img = data.image ? `<img src="${data.image}" alt="wish">` : `<div style="height:140px; background:var(--border-color); display:flex; align-items:center; justify-content:center; color:#94a3b8"><i class="fa-solid fa-image fa-2x"></i></div>`;
        wishHtml += `
            <div class="wish-card">
                <span class="badge">#${index + 1}</span>
                <input type="checkbox" class="wish-check" data-price="${data.price || 0}" onchange="calcWishlistTotal()">
                ${img}
                <div class="info">
                    <h4 style="margin:0 0 5px 0">${data.name}</h4>
                    ${data.price ? `<p style="font-weight:bold; margin:0; color:var(--primary-color)">${formatVND(data.price)}</p>` : ''}
                    <div style="display:flex; justify-content:space-between; margin-top:15px;">
                        ${data.link ? `<a href="${data.link}" target="_blank" style="font-size:0.85rem; color:#8b5cf6; text-decoration:none; font-weight:bold">🛒 Tới nơi mua</a>` : `<span></span>`}
                        <button class="icon-btn" onclick="requestDelete('wishlist','${d.id}')" style="color:#ef4444; padding:0"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
    document.getElementById('wishlist-grid').innerHTML = wishHtml;
    calcWishlistTotal();
}

document.getElementById('save-budget').addEventListener('click', async () => {
    const limit = Number(document.getElementById('budget-limit').dataset.raw || 0);
    await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'), { limit });
    showToast("Đã lưu hạn mức chi tiêu!"); loadAllData();
});

function drawChart(catExp) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const labels = Object.keys(catExp); const data = Object.values(catExp);
    const isDark = document.body.classList.contains('dark-mode');
    if (expenseChartInstance) expenseChartInstance.destroy();
    if(data.length === 0) { labels.push("Chưa có"); data.push(1); }
    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#f87171', '#60a5fa', '#34d399', '#facc15', '#c084fc', '#fb923c'], borderWidth: isDark ? 4 : 2, borderColor: isDark ? '#1e293b' : '#fff' }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#f1f5f9' : '#334155', font: { family: 'Quicksand', weight: 600 } } } }, cutout: '65%' }
    });
}
