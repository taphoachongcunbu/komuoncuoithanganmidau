import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// === BIẾN THỜI GIAN & LỌC ===
let currentFilter = 'month'; 
let viewDate = new Date(); 
const currentMonthStr = new Date().getFullYear() + '-' + (new Date().getMonth() + 1).toString().padStart(2, '0');

function getWeekBoundaries(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Đẩy về thứ 2
    const start = new Date(d.setDate(diff));
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23,59,59,999);
    return { start, end };
}

function updateTimeUI() {
    const lbl = document.getElementById('lbl-time-display');
    const lblHist = document.getElementById('lbl-history-time');
    let text = "";
    if (currentFilter === 'day') {
        text = `Ngày ${viewDate.getDate()}/${viewDate.getMonth()+1}/${viewDate.getFullYear()}`;
    } else if (currentFilter === 'week') {
        const { start, end } = getWeekBoundaries(viewDate);
        text = `Tuần: ${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}`;
    } else if (currentFilter === 'month') {
        text = `Tháng ${viewDate.getMonth()+1}/${viewDate.getFullYear()}`;
    }
    if (lbl) lbl.innerText = text;
    if (lblHist) lblHist.innerText = text;
    loadAllData();
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
        viewDate = new Date();
        updateTimeUI();
    });
});
document.getElementById('btn-prev-time').addEventListener('click', () => {
    if(currentFilter === 'day') viewDate.setDate(viewDate.getDate() - 1);
    else if(currentFilter === 'week') viewDate.setDate(viewDate.getDate() - 7);
    else if(currentFilter === 'month') viewDate.setMonth(viewDate.getMonth() - 1);
    updateTimeUI();
});
document.getElementById('btn-next-time').addEventListener('click', () => {
    if(currentFilter === 'day') viewDate.setDate(viewDate.getDate() + 1);
    else if(currentFilter === 'week') viewDate.setDate(viewDate.getDate() + 7);
    else if(currentFilter === 'month') viewDate.setMonth(viewDate.getMonth() + 1);
    updateTimeUI();
});

function isDateInRange(timestamp) {
    if(!timestamp) return true;
    const d = timestamp.toDate();
    if (currentFilter === 'day') {
        return d.getDate() === viewDate.getDate() && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    } else if (currentFilter === 'week') {
        const { start, end } = getWeekBoundaries(viewDate);
        return d >= start && d <= end;
    } else if (currentFilter === 'month') {
        return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    }
    return true;
}

// === TOAST, XÓA & CUSTOM PROMPT ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = (type === 'success' ? '<i class="fa-solid fa-check-circle" style="color:#10b981"></i>' : '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444"></i>') + ` <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

let itemToDelete = null;
document.getElementById('cancel-delete').onclick = () => { document.getElementById('confirm-modal').style.display = 'none'; };
document.getElementById('confirm-delete').onclick = async () => {
    if(itemToDelete) {
        await deleteDoc(doc(db, 'users', currentUser.uid, itemToDelete.type, itemToDelete.id));
        showToast("Đã xóa dữ liệu!"); document.getElementById('confirm-modal').style.display = 'none'; loadAllData();
    }
};
window.requestDelete = (type, id) => { itemToDelete = { type, id }; document.getElementById('confirm-modal').style.display = 'flex'; };

function openCustomPrompt(title, defaultVal) {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-modal');
        const input = document.getElementById('prompt-input');
        document.getElementById('prompt-title').innerText = title;
        input.value = Number(defaultVal).toLocaleString('vi-VN');
        input.dataset.raw = defaultVal;
        modal.style.display = 'flex';

        document.getElementById('cancel-prompt').onclick = () => { modal.style.display = 'none'; resolve(null); };
        document.getElementById('confirm-prompt').onclick = () => { modal.style.display = 'none'; resolve(input.dataset.raw); };
    });
}

// === FIX Ô NHẬP TIỀN HOÀN HẢO ===
function handleAmountInput(e) {
    let rawVal = e.target.value.replace(/\D/g, ""); 
    e.target.dataset.raw = rawVal || "0";
    e.target.value = rawVal; 
}

function handleAmountBlur(e) {
    let rawVal = e.target.dataset.raw || "0";
    if (rawVal !== "0" && rawVal !== "") {
        e.target.value = Number(rawVal).toLocaleString('vi-VN'); 
    }
}

function handleAmountFocus(e) {
    let rawVal = e.target.dataset.raw || "";
    e.target.value = rawVal === "0" ? "" : rawVal; 
}

document.querySelectorAll('.amount-input').forEach(input => {
    input.addEventListener('input', handleAmountInput);
    input.addEventListener('blur', handleAmountBlur);
    input.addEventListener('focus', handleAmountFocus);
});

const formatVND = (amount) => Number(amount).toLocaleString('vi-VN') + ' đ';

// Auth
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
    if (user) { currentUser = user; document.getElementById('login-btn').style.display = 'none'; document.getElementById('logout-btn').style.display = 'inline-block'; document.getElementById('login-message').style.display = 'none'; document.getElementById('app-content').style.display = 'block'; updateTimeUI(); } 
    else { currentUser = null; document.getElementById('login-btn').style.display = 'inline-block'; document.getElementById('logout-btn').style.display = 'none'; document.getElementById('login-message').style.display = 'block'; document.getElementById('app-content').style.display = 'none'; }
});

function handleSelectOther(selectId, inputId) {
    document.getElementById(selectId).addEventListener('change', (e) => { document.getElementById(inputId).style.display = e.target.value === 'Khác' ? 'block' : 'none'; if(e.target.value !== 'Khác') document.getElementById(inputId).value = ''; });
}
handleSelectOther('income-source', 'income-other'); handleSelectOther('expense-category', 'expense-other');
document.getElementById('recur-type').addEventListener('change', (e) => { document.getElementById('recur-months').style.display = e.target.value === 'installment' ? 'block' : 'none'; });

// Chatbot Smart Input
document.getElementById('btn-smart-submit').addEventListener('click', processSmartInput);
async function processSmartInput() {
    const text = document.getElementById('smart-input').value.trim().toLowerCase();
    if(!text) return;
    let amount = 0; const match = text.match(/(\d+)\s*(k|tr|đ|d)/i) || text.match(/(\d+)/);
    if (match) { let num = parseInt(match[1]); let unit = match[2] || ''; if (unit === 'k') amount = num * 1000; else if (unit === 'tr') amount = num * 1000000; else amount = num; }
    if(amount === 0) { showToast("Vui lòng ghi rõ số tiền (VD: 50k)", "error"); return; }
    let type = text.includes('thu') || text.includes('lương') ? 'income' : 'expense';
    const cleanText = text.replace(/[.,!?]/g, " "); const words = cleanText.split(/\s+/);
    let category = 'Khác';
    if (words.some(w => ['ăn', 'uống', 'cafe', 'cà', 'phê', 'matcha', 'phở', 'cơm', 'bún', 'trà'].includes(w))) category = 'Ăn uống';
    else if (words.some(w => ['xăng', 'xe', 'grab', 'taxi', 'bus', 'be'].includes(w))) category = 'Di chuyển';
    else if (words.some(w => ['áo', 'quần', 'giày', 'shopee', 'lazada', 'tiktok', 'mỹ'].includes(w))) category = 'Mua sắm';
    else if (words.some(w => ['điện', 'nước', 'nhà', 'trọ', 'wifi'].includes(w))) category = 'Tiền nhà/Điện nước';

    const dataObj = { amount: amount, createdAt: new Date() };
    if (type === 'expense') dataObj.category = category; else dataObj.source = category;
    await addDoc(collection(db, 'users', currentUser.uid, type), dataObj);
    showToast(`Đã ghi Chi: ${formatVND(amount)} vào nhóm "${category}"`); document.getElementById('smart-input').value = ''; loadAllData();
}

async function saveTransaction(type, amountId, selectId, otherId) {
    const amount = Number(document.getElementById(amountId).dataset.raw || 0);
    if(amount === 0) return showToast("Chưa nhập số tiền!", "error");
    let label = document.getElementById(selectId).value; if (label === 'Khác') label = document.getElementById(otherId).value || 'Khác';
    const dataObj = { amount: amount, createdAt: new Date() };
    if (type === 'expense') dataObj.category = label; else dataObj.source = label;
    await addDoc(collection(db, 'users', currentUser.uid, type), dataObj); showToast(`Đã lưu khoản ${type === 'expense' ? 'chi' : 'thu'}!`); loadAllData();
}
document.getElementById('income-form').addEventListener('submit', (e) => { e.preventDefault(); saveTransaction('income', 'income-amount', 'income-source', 'income-other'); e.target.reset(); document.getElementById('income-amount').dataset.raw = "0"; });
document.getElementById('expense-form').addEventListener('submit', (e) => { e.preventDefault(); saveTransaction('expense', 'expense-amount', 'expense-category', 'expense-other'); e.target.reset(); document.getElementById('expense-amount').dataset.raw = "0";});

// Nợ Bạn Bè
document.getElementById('tab-d-debt').addEventListener('click', (e) => { e.target.classList.add('active'); document.getElementById('tab-d-recur').classList.remove('active'); document.getElementById('view-d-debt').style.display='block'; document.getElementById('view-d-recur').style.display='none'; });
document.getElementById('tab-d-recur').addEventListener('click', (e) => { e.target.classList.add('active'); document.getElementById('tab-d-debt').classList.remove('active'); document.getElementById('view-d-debt').style.display='none'; document.getElementById('view-d-recur').style.display='block'; });

document.getElementById('borrow-form').addEventListener('submit', async (e) => { e.preventDefault(); await addDoc(collection(db, 'users', currentUser.uid, 'debt'), { type: 'vay', amount: Number(document.getElementById('borrow-amount').dataset.raw||0), person: document.getElementById('borrow-person').value, createdAt: new Date() }); showToast('Đã lưu!'); e.target.reset(); document.getElementById('borrow-amount').dataset.raw = "0"; loadAllData(); });
document.getElementById('lend-form').addEventListener('submit', async (e) => { e.preventDefault(); await addDoc(collection(db, 'users', currentUser.uid, 'lend'), { type: 'cho_vay', amount: Number(document.getElementById('lend-amount').dataset.raw||0), person: document.getElementById('lend-person').value, createdAt: new Date() }); showToast('Đã lưu!'); e.target.reset(); document.getElementById('lend-amount').dataset.raw = "0"; loadAllData(); });

// Trả nợ
window.payDebt = async (debtId, type, amount, person) => {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'debt', debtId));
    if (type === 'vay') { await addDoc(collection(db, 'users', currentUser.uid, 'expense'), { amount: amount, category: `Trả nợ (${person})`, createdAt: new Date() }); showToast("Đã trả tiền! Ghi vào khoản Chi."); } 
    else { await addDoc(collection(db, 'users', currentUser.uid, 'income'), { amount: amount, source: `Thu nợ (${person})`, createdAt: new Date() }); showToast("Đã đòi được! Ghi vào khoản Thu."); }
    loadAllData();
};

// Hóa Đơn & Định Kỳ
document.getElementById('recur-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const type = document.getElementById('recur-type').value;
    await addDoc(collection(db, 'users', currentUser.uid, 'recurring'), {
        name: document.getElementById('recur-name').value, type: type, baseAmount: Number(document.getElementById('recur-amount').dataset.raw || 0), totalMonths: type === 'installment' ? Number(document.getElementById('recur-months').value || 0) : null, paidMonths: 0, lastPaidMonth: "", isCompleted: false, createdAt: new Date()
    });
    showToast('Đã thiết lập hóa đơn!'); e.target.reset(); document.getElementById('recur-amount').dataset.raw = "0"; document.getElementById('recur-months').style.display='none'; loadAllData();
});

window.payRecurring = async (id, type, baseAmount, name, totalMonths, paidMonths) => {
    let finalAmount = baseAmount;
    if (type === 'variable') {
        const inputVal = await openCustomPrompt(`Tiền [${name}] tháng này:`, baseAmount);
        if (inputVal === null) return;
        finalAmount = Number(inputVal);
    }
    
    await addDoc(collection(db, 'users', currentUser.uid, 'expense'), { amount: finalAmount, category: `Thanh toán Hóa đơn: ${name}`, createdAt: new Date() });
    
    let updateData = { lastPaidMonth: currentMonthStr };
    if (type === 'installment') {
        updateData.paidMonths = paidMonths + 1;
        if (updateData.paidMonths >= totalMonths) updateData.isCompleted = true;
    }
    
    await updateDoc(doc(db, 'users', currentUser.uid, 'recurring', id), updateData);
    showToast(`Đã thanh toán ${name}!`); loadAllData();
};

// Wishlist
document.getElementById('tab-w-active').addEventListener('click', (e) => { e.target.classList.add('active'); document.getElementById('tab-w-bought').classList.remove('active'); document.getElementById('view-w-active').style.display = 'block'; document.getElementById('view-w-bought').style.display = 'none'; });
document.getElementById('tab-w-bought').addEventListener('click', (e) => { e.target.classList.add('active'); document.getElementById('tab-w-active').classList.remove('active'); document.getElementById('view-w-active').style.display = 'none'; document.getElementById('view-w-bought').style.display = 'block'; });
document.getElementById('wishlist-form').addEventListener('submit', async (e) => { e.preventDefault(); await addDoc(collection(db, 'users', currentUser.uid, 'wishlist'), { name: document.getElementById('wish-name').value, price: Number(document.getElementById('wish-price').dataset.raw || 0), link: document.getElementById('wish-link').value, priority: Number(document.getElementById('wish-priority').value), isBought: false, createdAt: new Date() }); showToast('Đã thêm Wishlist!'); e.target.reset(); document.getElementById('wish-price').dataset.raw = "0"; loadAllData(); });
window.calcWishlistTotal = () => { let total = 0; const checkedBoxes = document.querySelectorAll('.wish-check:checked'); checkedBoxes.forEach(cb => { total += Number(cb.dataset.price); }); document.getElementById('wishlist-selected-total').innerText = formatVND(total); document.getElementById('btn-mark-bought').style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none'; };
document.getElementById('btn-mark-bought').addEventListener('click', async () => { const checkedBoxes = document.querySelectorAll('.wish-check:checked'); for(let cb of checkedBoxes) { await updateDoc(doc(db, 'users', currentUser.uid, 'wishlist', cb.dataset.id), { isBought: true }); } showToast("Đã chốt đơn thành công! 🎉"); loadAllData(); });

// RENDER DỮ LIỆU
async function loadAllData() {
    if (!currentUser) return;
    const [incSnap, expSnap, debtSnap, recurSnap, wishSnap, budgetDoc] = await Promise.all([
        getDocs(query(collection(db, 'users', currentUser.uid, 'income'), orderBy('createdAt', 'desc'))), 
        getDocs(query(collection(db, 'users', currentUser.uid, 'expense'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users', currentUser.uid, 'debt')), 
        getDocs(collection(db, 'users', currentUser.uid, 'recurring')), 
        getDocs(query(collection(db, 'users', currentUser.uid, 'wishlist'), orderBy('priority', 'asc'))), 
        getDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'))
    ]);

    let totalInc = 0, totalExp = 0, livingExp = 0, catExp = {};
    
    // MẢNG CHỨA TẤT CẢ GIAO DỊCH ĐỂ GOM NHÓM
    let allTransactions = [];

    incSnap.forEach(d => { 
        if(isDateInRange(d.data().createdAt)) {
            totalInc += d.data().amount; 
            allTransactions.push({ id: d.id, type: 'income', name: d.data().source, amount: d.data().amount, createdAt: d.data().createdAt });
        }
    });
    
    expSnap.forEach(d => { 
        if(isDateInRange(d.data().createdAt)) {
            let amt = d.data().amount; let cat = d.data().category; 
            totalExp += amt; catExp[cat] = (catExp[cat] || 0) + amt;
            
            if (!cat.startsWith('Trả nợ') && !cat.startsWith('Thanh toán Hóa đơn')) {
                livingExp += amt;
            }

            allTransactions.push({ id: d.id, type: 'expense', name: cat, amount: amt, createdAt: d.data().createdAt });
        }
    });

    // === XỬ LÝ GOM NHÓM LỊCH SỬ THEO NGÀY (LẤY 3 NGÀY GẦN NHẤT) ===
    allTransactions.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    let groupedByDate = {};
    allTransactions.forEach(item => {
        const d = item.createdAt.toDate();
        const dateKey = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
        if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
        groupedByDate[dateKey].push(item);
    });

    // Lấy tối đa 3 ngày gần nhất có giao dịch
    const recentDateKeys = Object.keys(groupedByDate).slice(0, 3);
    
    let historyHtml = '';
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
    
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${(yesterday.getMonth()+1).toString().padStart(2,'0')}-${yesterday.getDate().toString().padStart(2,'0')}`;

    if (recentDateKeys.length === 0) {
        historyHtml = '<p style="color:#94a3b8; text-align:center; padding: 20px;">Chưa có giao dịch nào gần đây.</p>';
    } else {
        recentDateKeys.forEach(dateKey => {
            let labelDate = dateKey.split('-').reverse().slice(0, 2).join('/'); // DD/MM
            if (dateKey === todayStr) labelDate = "Hôm nay (" + labelDate + ")";
            else if (dateKey === yesterdayStr) labelDate = "Hôm qua (" + labelDate + ")";
            else labelDate = "Ngày " + labelDate;

            let dayItems = groupedByDate[dateKey];
            let dayHtml = `<div style="margin-top:15px; margin-bottom:8px; font-weight:bold; color:var(--primary-color); border-bottom:1px solid var(--border-color); padding-bottom:4px; font-size:0.95rem;">📅 ${labelDate}</div>`;
            
            dayItems.forEach(item => {
                const timeStr = `${item.createdAt.toDate().getHours().toString().padStart(2,'0')}:${item.createdAt.toDate().getMinutes().toString().padStart(2,'0')}`;
                const isInc = item.type === 'income';
                dayHtml += `
                    <li style="margin-bottom:8px;">
                        <div>
                            <strong>${item.name}</strong>
                            <small style="color:#64748b; font-size:0.8rem; display:block;"><i class="fa-regular fa-clock"></i> ${timeStr}</small>
                        </div> 
                        <div class="action-btns">
                            <span style="color:${isInc ? '#10b981' : '#ef4444'}; font-weight:bold;">${isInc ? '+' : '-'}${formatVND(item.amount)}</span> 
                            <button class="btn-icon" onclick="requestDelete('${item.type}','${item.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </li>`;
            });
            historyHtml += dayHtml;
        });
    }

    document.getElementById('total-income').innerText = formatVND(totalInc);
    document.getElementById('total-expense').innerText = formatVND(totalExp);
    document.getElementById('history-list').innerHTML = historyHtml;

    // CẢNH BÁO HẠN MỨC SINH HOẠT
    let budget = budgetDoc.exists() ? budgetDoc.data().limit : 0;
    if(budget > 0) {
        let inputB = document.getElementById('budget-limit');
        if (document.activeElement !== inputB) {
            inputB.value = Number(budget).toLocaleString('vi-VN');
            inputB.dataset.raw = budget;
        }
        const warningDiv = document.getElementById('budget-warning'); 
        const percent = (livingExp / budget) * 100;
        if(percent >= 100) { warningDiv.style.display = 'block'; warningDiv.innerText = `🚨 Đã tiêu sinh hoạt vượt hạn mức (${Math.round(percent)}%)`; }
        else if (percent >= 80) { warningDiv.style.display = 'block'; warningDiv.style.background = '#fef08a'; warningDiv.style.color = '#854d0e'; warningDiv.innerText = `⚠️ Cảnh báo: Đã dùng ${Math.round(percent)}% sinh hoạt phí.`; }
        else warningDiv.style.display = 'none';
    }
    drawChart(catExp);

    let vayHtml = '', choVayHtml = '';
    debtSnap.forEach(d => { const data = d.data(); const html = `<li><div><strong>${data.person}</strong><br><small>${formatVND(data.amount)}</small></div> <div class="action-btns"><button class="btn-icon pay" onclick="payDebt('${d.id}', '${data.type}', ${data.amount}, '${data.person}')"><i class="fa-solid fa-check"></i></button> <button class="btn-icon" onclick="requestDelete('debt','${d.id}')"><i class="fa-solid fa-trash"></i></button></div></li>`; if(data.type === 'vay') vayHtml += html; else choVayHtml += html; });
    document.getElementById('list-vay').innerHTML = vayHtml || 'Trống.'; document.getElementById('list-cho-vay').innerHTML = choVayHtml || 'Trống.';

    let dueHtml = '', paidHtml = '';
    recurSnap.forEach(d => {
        const data = d.data(); const isDue = data.lastPaidMonth !== currentMonthStr && !data.isCompleted; const statusText = data.type === 'installment' ? `Trả góp (${data.paidMonths}/${data.totalMonths} tháng)` : (data.type === 'variable' ? 'Linh hoạt' : 'Cố định');
        const html = `<li><div><strong>${data.name}</strong><br><small style="color:#64748b">${statusText} | ~${formatVND(data.baseAmount)}</small></div> <div class="action-btns">${isDue ? `<button class="btn-icon pay" style="background:#8b5cf6; color:white; border-radius:15px; padding:6px 15px;" onclick="payRecurring('${d.id}', '${data.type}', ${data.baseAmount}, '${data.name}', ${data.totalMonths}, ${data.paidMonths})">Thanh toán</button>` : ''} <button class="btn-icon" onclick="requestDelete('recurring','${d.id}')"><i class="fa-solid fa-trash"></i></button></div></li>`;
        if (data.isCompleted) paidHtml += html; else if (isDue) dueHtml += html; else paidHtml += html;
    });
    document.getElementById('recur-due-list').innerHTML = dueHtml || '<p style="color:#10b981;">Tuyệt vời! Tháng này đã thanh toán hết các loại hóa đơn. 🎉</p>'; document.getElementById('recur-paid-list').innerHTML = paidHtml || '';

    let wishPrio1 = '', wishPrio2 = '', wishPrio3 = '', wishBought = '';
    wishSnap.forEach((d) => {
        const data = d.data();
        if (data.isBought) { wishBought += `<li><div>${data.name}<br><small>${formatVND(data.price)}</small></div> <div class="action-btns"><button class="btn-icon" onclick="requestDelete('wishlist','${d.id}')"><i class="fa-solid fa-trash"></i></button></div></li>`; } 
        else { const html = `<div class="wish-card prio-${data.priority}"><input type="checkbox" class="wish-check" data-price="${data.price || 0}" data-id="${d.id}" onchange="calcWishlistTotal()"><div><h4 style="margin:0 0 5px 0; padding-right:20px;">${data.name}</h4>${data.price ? `<p style="font-weight:bold; margin:0; color:var(--text-color)">${formatVND(data.price)}</p>` : ''}</div><div style="display:flex; justify-content:space-between; margin-top:15px; align-items:center;">${data.link ? `<a href="${data.link}" target="_blank" style="font-size:0.85rem; color:#8b5cf6; text-decoration:none; font-weight:bold">🛒 Mua ngay</a>` : `<span></span>`}<button class="icon-btn" onclick="requestDelete('wishlist','${d.id}')" style="color:#ef4444; padding:0"><i class="fa-solid fa-trash"></i></button></div></div>`;
            if(data.priority == 1) wishPrio1 += html; else if(data.priority == 2) wishPrio2 += html; else wishPrio3 += html;
        }
    });
    document.getElementById('wish-prio-1').innerHTML = wishPrio1 || '<p style="color:#94a3b8; grid-column: 1 / -1;">Chưa có mục nào.</p>'; document.getElementById('wish-prio-2').innerHTML = wishPrio2 || '<p style="color:#94a3b8; grid-column: 1 / -1;">Chưa có mục nào.</p>'; document.getElementById('wish-prio-3').innerHTML = wishPrio3 || '<p style="color:#94a3b8; grid-column: 1 / -1;">Chưa có mục nào.</p>'; document.getElementById('wish-bought-list').innerHTML = wishBought || '<li><p style="color:#94a3b8; margin:0;">Chưa chốt được món nào.</p></li>';
    calcWishlistTotal();
}

document.getElementById('save-budget').addEventListener('click', async () => { await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'), { limit: Number(document.getElementById('budget-limit').dataset.raw || 0) }); showToast("Đã lưu hạn mức chi tiêu!"); loadAllData(); });
function drawChart(catExp) {
    const ctx = document.getElementById('expenseChart').getContext('2d'); const labels = Object.keys(catExp); const data = Object.values(catExp); const isDark = document.body.classList.contains('dark-mode');
    if (expenseChartInstance) expenseChartInstance.destroy();
    if(data.length === 0) { labels.push("Chưa có"); data.push(1); }
    expenseChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#f87171', '#60a5fa', '#34d399', '#facc15', '#c084fc', '#fb923c'], borderWidth: isDark ? 4 : 2, borderColor: isDark ? '#1e293b' : '#fff' }] }, options: { plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#f1f5f9' : '#334155', font: { family: 'Quicksand', weight: 600 } } } }, cutout: '65%' } });
}
