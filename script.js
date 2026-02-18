// --- State Management ---
let state = {
    currentUser: null,
    leads: [],
    tasks: [],
    invoices: [],
    employees: [],
    attendance: [],
    catalog: [],
    chatMessages: [],
    settings: {
        googleSheetUrl: "",
        bizName: "DoorFlow Services",
        bizAddress: "123, Industrial Area, Hapur",
        bizPhone: "9999999999",
        bizEmail: "info@doorflow.com",
        bizGst: "22ABCDE1234F1Z5",
        gstRate: 18,
        crmWebhook: ""
    }
};

// --- Firebase Integration ---
const firebaseConfig = {
    apiKey: "AIzaSyCRObpPsRVlUsC5hH4HqPC2rFb6K5WNxeY",
    authDomain: "dashboard-98ae5.firebaseapp.com",
    databaseURL: "https://dashboard-98ae5-default-rtdb.firebaseio.com",
    projectId: "dashboard-98ae5",
    storageBucket: "dashboard-98ae5.firebasestorage.app",
    messagingSenderId: "183263318221",
    appId: "1:183263318221:web:b84d2fb58431f209559984"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

// --- Initial Mock Data & Firebase Sync ---
const initMockData = () => {
    showToast("Connecting to Cloud Database...", "info");

    // Fetch state from Firebase
    db.ref('crm_state').on('value', (snapshot) => {
        const cloudData = snapshot.val();
        if (cloudData) {
            // Keep local currentUser if exists (to prevent logout on update)
            const localUser = state.currentUser;
            state = { ...state, ...cloudData };
            state.currentUser = localUser;

            // Re-render current view if logged in
            if (state.currentUser) {
                const currentActiveNav = document.querySelector('.nav-item.active');
                if (currentActiveNav) {
                    renderView(currentActiveNav.dataset.view);
                } else {
                    renderDashboard();
                }
            }
        } else {
            // Initial setup if DB is empty
            state.employees = [
                { id: 'ADM001', name: 'Vishal (Admin)', password: 'admin', role: 'admin', isManager: true },
                { id: 'SAL001', name: 'Rohan (Sales)', password: '123', role: 'sales', isManager: true },
                { id: 'DES001', name: 'Sonia (Design)', password: '123', role: 'design', isManager: false },
                { id: 'PRO001', name: 'Rahul (Prod)', password: '123', role: 'production', isManager: false },
                { id: 'DEL001', name: 'Vikram (Delivery)', password: '123', role: 'delivery', isManager: false }
            ];
            saveState();
        }
        showToast("Synchronized with Cloud", "success");
    });
};

const saveState = () => {
    // Save to LocalStorage (Fallback)
    localStorage.setItem('doorflow_crm_state', JSON.stringify(state));

    // Sync to Firebase (Live)
    // Create a copy without the currentUser to avoid storing sensitive session data globally
    const dataToSync = { ...state };
    delete dataToSync.currentUser;

    db.ref('crm_state').set(dataToSync)
        .then(() => console.log("Cloud Sync Successful"))
        .catch(err => {
            console.error("Cloud Sync Failed:", err);
            showToast("Sync Error: " + err.message, "danger");
        });
};

// --- Role Definitions ---
const ROLES = {
    admin: { name: 'Main Admin', permissions: ['all'] },
    sales: { name: 'Sales Team', permissions: ['leads', 'catalog', 'tasks'] },
    design: { name: 'Design Team', permissions: ['tasks', 'catalog'] },
    production: { name: 'Production Team', permissions: ['tasks'] },
    delivery: { name: 'Delivery Team', permissions: ['tasks'] }
};

// --- DOM Elements ---
const loginOverlay = document.getElementById('login-overlay');
const mainContainer = document.getElementById('main-container');
const contentBody = document.getElementById('content-body');
const viewTitle = document.getElementById('view-title');
const navItems = document.querySelectorAll('.nav-item');
const toastContainer = document.getElementById('toast-container');
const modalContainer = document.getElementById('modal-container');
const modalBody = document.getElementById('modal-body');

// --- Notification System ---
const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- Authentication Logic ---
const handleLogin = () => {
    const id = document.getElementById('login-id').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    const user = state.employees.find(e => e.id === id && e.password === pass);

    if (user) {
        login(user);
    } else {
        showToast("Invalid ID or Password!", "danger");
    }
};

const login = (user) => {
    state.currentUser = user;
    const role = user.role;
    const roleName = ROLES[role].name;
    document.getElementById('current-user-name').textContent = user.name;
    document.getElementById('current-user-role').textContent = roleName + (user.isManager ? ' (Manager)' : '');
    document.getElementById('user-avatar-initial').textContent = user.name.charAt(0).toUpperCase();

    loginOverlay.classList.add('hidden');

    // Check for today's attendance
    checkAttendanceStatus();
    mainContainer.classList.remove('hidden');

    // Role based navigation visibility
    const leadsNav = document.getElementById('nav-leads');
    const adminSec = document.getElementById('nav-admin-section');
    const catalogNav = document.getElementById('nav-catalog');

    if (role === 'admin') {
        leadsNav.classList.remove('hidden');
        adminSec.classList.remove('hidden');
        catalogNav.classList.remove('hidden');
    } else if (role === 'sales' || role === 'design') {
        leadsNav.classList.toggle('hidden', role !== 'sales'); // Leads only for sales
        adminSec.classList.add('hidden');
        catalogNav.classList.remove('hidden'); // Both can see catalog
    } else {
        leadsNav.classList.add('hidden');
        adminSec.classList.add('hidden');
        catalogNav.classList.add('hidden');
    }

    // Invoice Nav Visibility
    const invNav = document.getElementById('nav-invoices');
    if (role === 'admin' || role === 'sales') {
        invNav.classList.remove('hidden');
    } else {
        invNav.classList.add('hidden');
    }

    // Track Nav Visibility
    const trackNav = document.getElementById('nav-tracking');
    if (role === 'admin' || role === 'sales' || user.isManager) {
        trackNav.classList.remove('hidden');
    } else {
        trackNav.classList.add('hidden');
    }

    // Settings Nav Visibility
    const settingsNav = document.getElementById('nav-settings');
    if (role === 'admin') {
        settingsNav.classList.remove('hidden');
    } else {
        settingsNav.classList.add('hidden');
    }

    renderView('dashboard');
    renderChat();
    showToast(`Logged in as ${ROLES[role].name}`, 'success');
};

const logout = () => {
    state.currentUser = null;
    loginOverlay.classList.remove('hidden');
    mainContainer.classList.add('hidden');
};

// --- View Rendering Logic ---
const renderView = (view) => {
    navItems.forEach(item => item.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (activeNav) activeNav.classList.add('active');

    switch (view) {
        case 'dashboard': renderDashboard(); break;
        case 'leads': renderLeads(); break;
        case 'tasks': renderTasks(); break;
        case 'tasks': renderTasks(); break;
        case 'catalog': renderCatalog(); break;
        case 'invoices': renderInvoices(); break;
        case 'tracking': renderTracking(); break;
        case 'teams': renderTeams(); break;
        case 'settings': renderSettings(); break;
    }
};

const renderSettings = () => {
    viewTitle.textContent = "Global CRM Settings & Integrations";
    contentBody.innerHTML = `
        <div class="grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem;">
            <div class="card">
                <h3>Business Identity</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px;">
                    <div class="form-group">
                        <label>Business Name</label>
                        <input type="text" id="s-biz-name" class="login-input" value="${state.settings.bizName}">
                    </div>
                    <div class="form-group">
                        <label>Business Phone</label>
                        <input type="text" id="s-biz-phone" class="login-input" value="${state.settings.bizPhone}">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Address</label>
                        <input type="text" id="s-biz-address" class="login-input" value="${state.settings.bizAddress}">
                    </div>
                    <div class="form-group">
                        <label>Business Email</label>
                        <input type="email" id="s-biz-email" class="login-input" value="${state.settings.bizEmail}">
                    </div>
                    <div class="form-group">
                        <label>GSTIN Number</label>
                        <input type="text" id="s-biz-gst" class="login-input" value="${state.settings.bizGst}">
                    </div>
                </div>
                <button class="btn btn-primary" style="margin-top:20px; width:100%" onclick="saveGlobalSettings()">Save Identity Settings</button>
            </div>

            <div class="card">
                <h3>CRM & Webhook Integration</h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:15px;">Connect your dashboard to external CRM or Automation tools (n8n, Zapier etc.)</p>
                
                <div class="form-group">
                    <label>CRM Webhook URL</label>
                    <input type="text" id="s-crm-webhook" class="login-input" placeholder="https://n8n.example.com/webhook/..." value="${state.settings.crmWebhook || ''}">
                </div>
                
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    <button class="btn btn-outline" style="justify-content:center" onclick="testWebhook()">
                        <i class="fas fa-plug"></i> Test Connection
                    </button>
                    <button class="btn btn-success" style="justify-content:center; background:#4f46e5; color:white;" onclick="syncAllData()">
                        <i class="fas fa-sync"></i> Sync All Data to CRM
                    </button>
                </div>

                <div style="margin-top:30px; padding:15px; background:var(--bg-main); border-radius:10px;">
                    <h4 style="font-size:0.9rem; margin-bottom:10px;">Sync Statistics</h4>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
                        <span>Leads Count:</span>
                        <strong>${state.leads.length}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-top:5px;">
                        <span>Tasks Count:</span>
                        <strong>${state.tasks.length}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-top:5px;">
                        <span>Invoices Count:</span>
                        <strong>${state.invoices.length}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const saveGlobalSettings = () => {
    state.settings.bizName = document.getElementById('s-biz-name').value;
    state.settings.bizPhone = document.getElementById('s-biz-phone').value;
    state.settings.bizAddress = document.getElementById('s-biz-address').value;
    state.settings.bizEmail = document.getElementById('s-biz-email').value;
    state.settings.bizGst = document.getElementById('s-biz-gst').value;
    state.settings.crmWebhook = document.getElementById('s-crm-webhook').value;
    saveState();
    showToast("Global Settings updated successfully!", "success");
};

const testWebhook = async () => {
    const url = document.getElementById('s-crm-webhook').value;
    if (!url) {
        showToast("Enter a webhook URL first", "warning");
        return;
    }
    showToast("Sending test payload...", "info");
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'test', time: new Date().toISOString() })
        });
        if (res.ok) showToast("Webhook Live! Test successful.", "success");
        else showToast("Webhook responded with error: " + res.status, "danger");
    } catch (e) {
        showToast("Connection failed. Check CORS or URL.", "danger");
    }
};

const syncAllData = async () => {
    const url = state.settings.crmWebhook;
    if (!url) {
        showToast("Configure CRM Webhook in Settings first", "danger");
        return;
    }

    showToast("Syncing all data to CRM...", "info");
    const payload = {
        timestamp: new Date().toISOString(),
        business: state.settings.bizName,
        data: {
            leads: state.leads,
            tasks: state.tasks,
            invoices: state.invoices
        }
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) showToast("All data successfully synced to CRM!", "success");
        else showToast("Sync failed: Webhook returned " + res.status, "danger");
    } catch (e) {
        showToast("Sync Error: " + e.message, "danger");
    }
};

const renderDashboard = () => {
    viewTitle.textContent = "Dashboard Overview";

    // Stats calculation
    const pendingTasks = state.tasks.filter(t => t.stage < 4).length;
    const completedTasks = state.tasks.filter(t => t.stage === 4).length;
    const totalLeads = state.leads.length;

    contentBody.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon primary"><i class="fas fa-users"></i></div>
                <div class="stat-info"><h3>${totalLeads}</h3><span>Total Leads</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning"><i class="fas fa-clock"></i></div>
                <div class="stat-info"><h3>${pendingTasks}</h3><span>Active Tasks</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success"><i class="fas fa-check-double"></i></div>
                <div class="stat-info"><h3>${completedTasks}</h3><span>Completed</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon danger"><i class="fas fa-chart-line"></i></div>
                <div class="stat-info"><h3>₹${completedTasks * 12500}</h3><span>Revenue Est.</span></div>
            </div>
        </div>

        <div class="grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Recent Activity</h3>
                    <button class="btn btn-sm btn-outline">View All</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Task / Lead</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${state.tasks.slice(0, 5).map(task => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 600;">${task.customer}</div>
                                        <small>${task.team.toUpperCase()} Team</small>
                                    </td>
                                    <td><span class="status-badge status-active">${task.status}</span></td>
                                    <td>${task.history[task.history.length - 1].time}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Workflow Status</h3>
                </div>
                <div class="workflow-summary">
                   ${['Sales', 'Design', 'Production', 'Delivery'].map((s, i) => `
                        <div style="margin-bottom: 1rem;">
                            <div style="display:flex; justify-content:space-between; font-size: 0.8rem; margin-bottom: 0.3rem;">
                                <span>${s}</span>
                                <span>${state.tasks.filter(t => t.stage === i).length} active</span>
                            </div>
                            <div style="height: 6px; background: var(--border); border-radius: 3px;">
                                <div style="width: ${(state.tasks.filter(t => t.stage === i).length / (state.tasks.length || 1)) * 100}%; height: 100%; background: var(--primary); border-radius: 3px;"></div>
                            </div>
                        </div>
                   `).join('')}
                </div>
            </div>
        </div>
    `;
};

const renderLeads = () => {
    viewTitle.textContent = "Leads Management";

    let html = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h3 class="card-title">Fetch from Google Sheets</h3>
                    <p style="font-size: 0.8rem; color: var(--text-muted)">Paste your Google Sheet CSV export link below</p>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <input type="text" id="sheet-url" value="${state.settings.googleSheetUrl || ''}" placeholder="Paste Google Sheet Link here..." style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px; width: 300px;">
                    <button class="btn btn-primary" onclick="handleFetchLeads()"><i class="fas fa-sync"></i> Fetch</button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Contact</th>
                            <th>Requirement</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.leads.map(lead => `
                            <tr>
                                <td style="font-weight: 600;">${lead.name}</td>
                                <td>
                                    <div>${lead.phone}</div>
                                    <small>${lead.address}</small>
                                </td>
                                <td>${lead.requirement}</td>
                                <td>${lead.date}</td>
                                <td><span class="status-badge status-pending">${lead.status}</span></td>
                                <td>
                                    <div class="lead-actions">
                                        <div class="action-icon wa-icon" onclick="openWhatsApp('${lead.phone}')"><i class="fab fa-whatsapp"></i></div>
                                        <div class="action-icon call-icon" onclick="window.open('tel:${lead.phone}')"><i class="fas fa-phone"></i></div>
                                        <button class="btn btn-sm btn-outline" onclick="openLeadDetails('${lead.id}')">Details</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    contentBody.innerHTML = html;
};

const renderTasks = () => {
    viewTitle.textContent = "Task Tracking Workflow";

    // Filter tasks based on role
    let filteredTasks = state.tasks;
    if (state.currentUser.role !== 'admin') {
        filteredTasks = state.tasks.filter(t => t.team === state.currentUser.role);
    }

    contentBody.innerHTML = `
        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer</th>
                            <th>Responsible</th>
                            <th>Progress</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredTasks.map(task => {
        const progress = (task.stage / 4) * 100;
        return `
                                <tr>
                                    <td>#${task.id}</td>
                                    <td><strong>${task.customer}</strong></td>
                                    <td><span class="status-badge status-active">${task.team.toUpperCase()}</span></td>
                                    <td>
                                        <div style="width: 100px; height: 6px; background: var(--border); border-radius: 3px; margin-bottom: 5px;">
                                            <div style="width: ${progress}%; height: 100%; background: var(--success); border-radius: 3px;"></div>
                                        </div>
                                        <small>${progress}% Complete</small>
                                    </td>
                                    <td><span class="status-badge status-pending">${task.isAccepted ? (task.status === 'pending' ? 'Accepted' : task.status) : 'Awaiting Acceptance'}</span></td>
                                    <td>
                                        ${!task.isAccepted ?
                `<button class="btn btn-sm btn-success" onclick="acceptTask('${task.id}')"><i class="fas fa-check"></i> Accept</button>` :
                `<button class="btn btn-sm btn-primary" onclick="openTaskManagement('${task.id}')">Manage</button>`
            }
                                    </td>
                                </tr>
                            `;
    }).join('')}
                        ${filteredTasks.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No active tasks for your team.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

const renderCatalog = () => {
    viewTitle.textContent = "Product Catalog & Selection";
    contentBody.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Uploaded Catalog</h3>
                <button class="btn btn-primary" onclick="handleAddCatalog()"><i class="fas fa-plus"></i> Upload Image</button>
            </div>
            <div class="catalog-grid">
                ${state.catalog.map(item => `
                    <div class="catalog-item" onclick="toggleCatalogSelect(this, ${item.id})">
                        <img src="${item.url}" alt="${item.name}">
                        <div style="padding: 5px; font-size: 0.7rem; background: rgba(0,0,0,0.5); color: white; position:absolute; bottom:0; width:100%;">
                            ${item.name}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="btn btn-outline" onclick="clearSelection()">Clear Selection</button>
                <button class="btn btn-success" style="background:#25d366; color:white;" onclick="sendCatalogViaWhatsApp()">
                    <i class="fab fa-whatsapp"></i> Send Selected
                </button>
            </div>
        </div>
    `;
};


// --- Interactions & Modals ---

let selectedCatalog = [];
const toggleCatalogSelect = (el, id) => {
    el.classList.toggle('selected');
    if (el.classList.contains('selected')) {
        selectedCatalog.push(id);
    } else {
        selectedCatalog = selectedCatalog.filter(sid => sid !== id);
    }
};

const clearSelection = () => {
    selectedCatalog = [];
    renderCatalog();
};

const renderInvoices = (prefillData = null) => {
    viewTitle.textContent = "Invoices & Billing";
    const isAdmin = state.currentUser.role === 'admin';
    const isSales = state.currentUser.role === 'sales';

    // Invoice filtering
    const searchTerm = document.getElementById('inv-search')?.value.toLowerCase() || '';
    const filteredInvoices = state.invoices.filter(inv =>
        inv.customer.toLowerCase().includes(searchTerm) ||
        inv.id.toLowerCase().includes(searchTerm)
    );

    // Settings Section (Only visible to Admin)
    const settingsHtml = isAdmin ? `
        <div class="card" style="margin-bottom:20px;">
            <h3 class="card-title">Business & GST Settings</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                <input type="text" id="set-biz-name" class="form-control" placeholder="Business Name" value="${state.settings.bizName || ''}">
                <input type="text" id="set-biz-gst" class="form-control" placeholder="Business GSTIN" value="${state.settings.bizGst || ''}">
                <input type="text" id="set-biz-phone" class="form-control" placeholder="Phone" value="${state.settings.bizPhone || ''}">
                <input type="email" id="set-biz-email" class="form-control" placeholder="Email" value="${state.settings.bizEmail || ''}">
                <input type="text" id="set-biz-addr" class="form-control" placeholder="Address" value="${state.settings.bizAddress || ''}">
                <div>
                   <label>GST Rate (%)</label>
                   <input type="number" id="set-gst-rate" class="form-control" value="${state.settings.gstRate || 18}">
                </div>
            </div>
            <button class="btn btn-primary" style="margin-top:10px;" onclick="saveInvoiceSettings()">Save Settings</button>
        </div>
    ` : '';

    const invoiceList = filteredInvoices.map(inv => `
        <tr>
            <td>#${inv.id}</td>
            <td>${inv.customer}</td>
            <td>${inv.date}</td>
            <td>
                <div>₹${inv.total}</div>
                <small style="color:var(--text-muted); font-size:0.7rem;">(GST: ₹${inv.gstAmount})</small>
            </td>
            <td><span class="badge ${inv.paid === 'paid' ? 'status-active' : (inv.paid === 'advance' ? 'status-active' : 'status-pending')}" style="background:${inv.paid === 'advance' ? '#f59e0b' : ''}">${inv.paid === 'paid' ? 'Full Paid' : (inv.paid === 'advance' ? 'Advance' : 'Pending')}</span></td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-sm btn-success" style="background:#25d366" onclick="sendInvoiceWhatsApp('${inv.id}')"><i class="fab fa-whatsapp"></i></button>
                    <button class="btn btn-sm btn-pdf" style="background:#e11d48; color:white;" onclick="downloadInvoicePDF('${inv.id}')"><i class="fas fa-file-pdf"></i> PDF</button>
                </div>
            </td>
        </tr>
    `).join('');

    contentBody.innerHTML = `
        <div class="grid" style="display:grid; grid-template-columns: 1.2fr 1fr; gap:2rem;">
            <div class="card">
                <h3>Create Start-to-Finish GST Invoice</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                    <div class="form-group">
                        <label>Customer Name</label>
                        <input type="text" id="inv-name" class="form-control" placeholder="Enter Name" value="${prefillData?.name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="text" id="inv-phone" class="form-control" placeholder="98XXXXXXXX" value="${prefillData?.phone || ''}">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Customer GSTIN (Optional)</label>
                        <input type="text" id="inv-gstin" class="form-control" placeholder="e.g. 29ABCDE1234F1Z5">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                         <label>Customer Address</label>
                         <input type="text" id="inv-addr" class="form-control" placeholder="Full Billing Address" value="${prefillData?.address || ''}">
                    </div>
                    <div class="form-group">
                        <label>Payment Status</label>
                        <select id="inv-status" class="form-control">
                            <option value="pending">Payment Pending</option>
                            <option value="advance">Advance Received</option>
                            <option value="paid">Fully Paid</option>
                        </select>
                    </div>
                </div>
                
                <div style="margin-top:1rem;">
                    <h4>Products / Services</h4>
                    <div id="inv-items-container">
                        ${prefillData && prefillData.items ? prefillData.items.map(item => `
                            <div class="inv-item-row" style="display:grid; grid-template-columns:2fr 0.5fr 1fr 0.3fr; gap:5px; margin-bottom:5px;">
                                <input type="text" placeholder="Item Description" class="form-control item-desc" value="${item.desc}">
                                <input type="number" placeholder="Qty" class="form-control item-qty" oninput="calcInvoiceTotal()" value="${item.qty}">
                                <input type="number" placeholder="Price" class="form-control item-price" oninput="calcInvoiceTotal()" value="${item.price}">
                                <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); calcInvoiceTotal()">x</button>
                            </div>
                        `).join('') : `
                            <div class="inv-item-row" style="display:grid; grid-template-columns:2fr 0.5fr 1fr 0.3fr; gap:5px; margin-bottom:5px;">
                                <input type="text" placeholder="Item Description" class="form-control item-desc">
                                <input type="number" placeholder="Qty" class="form-control item-qty" oninput="calcInvoiceTotal()">
                                <input type="number" placeholder="Price" class="form-control item-price" oninput="calcInvoiceTotal()">
                                <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); calcInvoiceTotal()">x</button>
                            </div>
                        `}
                    </div>
                    <button class="btn btn-sm btn-outline" style="margin-top:5px;" onclick="addInvoiceItemRow()">+ Add Item</button>
                </div>

                <div style="margin-top:1.5rem; background:var(--bg-main); padding:10px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span> <span id="inv-subtotal">₹0.00</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>GST (${state.settings.gstRate}%):</span> <span id="inv-gst">₹0.00</span></div>
                    <hr>
                    <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.1rem;"><span>Total:</span> <span id="inv-total">₹0.00</span></div>
                </div>

                <button class="btn btn-primary" style="width:100%; margin-top:1rem;" onclick="generateInvoice()">Generate Invoice</button>
            </div>

            <div>
                ${settingsHtml}
                <div class="card">
                    <h3>Invoice History</h3>
                    <div style="margin-bottom:10px;">
                        <input type="text" id="inv-search" class="form-control" placeholder="Search by Name or Invoice ID..." oninput="renderInvoices()">
                    </div>
                    <div class="table-container">
                        <table>
                            <thead><tr><th>ID</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>${invoiceList}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Recalculate totals if prefilled data exists
    if (prefillData) calcInvoiceTotal();
};

const saveInvoiceSettings = () => {
    state.settings.bizName = document.getElementById('set-biz-name').value;
    state.settings.bizGst = document.getElementById('set-biz-gst').value;
    state.settings.bizPhone = document.getElementById('set-biz-phone').value;
    state.settings.bizEmail = document.getElementById('set-biz-email').value;
    state.settings.bizAddress = document.getElementById('set-biz-addr').value;
    state.settings.gstRate = parseFloat(document.getElementById('set-gst-rate').value) || 18;
    saveState();
    renderInvoices();
    showToast("Business Settings Saved", "success");
};

const addInvoiceItemRow = () => {
    const div = document.createElement('div');
    div.className = 'inv-item-row';
    div.style.cssText = "display:grid; grid-template-columns:2fr 0.5fr 1fr 0.3fr; gap:5px; margin-bottom:5px;";
    div.innerHTML = `
        <input type="text" placeholder="Item Description" class="form-control item-desc">
        <input type="number" placeholder="Qty" class="form-control item-qty" oninput="calcInvoiceTotal()">
        <input type="number" placeholder="Price" class="form-control item-price" oninput="calcInvoiceTotal()">
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); calcInvoiceTotal()">x</button>
    `;
    document.getElementById('inv-items-container').appendChild(div);
};

const calcInvoiceTotal = () => {
    let subtotal = 0;
    const items = document.querySelectorAll('.inv-item-row');

    if (items.length === 0) {
        if (document.getElementById('inv-subtotal')) {
            document.getElementById('inv-subtotal').textContent = `₹0.00`;
            document.getElementById('inv-gst').textContent = `₹0.00`;
            document.getElementById('inv-total').textContent = `₹0.00`;
        }
        return { subtotal: 0, gst: 0, total: 0 };
    }

    items.forEach(row => {
        let qty = parseFloat(row.querySelector('.item-qty').value);
        let price = parseFloat(row.querySelector('.item-price').value);

        if (isNaN(qty)) qty = 0;
        if (isNaN(price)) price = 0;

        subtotal += qty * price;
    });

    subtotal = Math.max(0, subtotal);

    const rate = parseFloat(state.settings.gstRate) || 18;
    const gst = subtotal * (rate / 100);
    const total = subtotal + gst;

    if (document.getElementById('inv-subtotal')) {
        document.getElementById('inv-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('inv-gst').textContent = `₹${gst.toFixed(2)}`;
        document.getElementById('inv-total').textContent = `₹${total.toFixed(2)}`;
    }

    return { subtotal, gst, total };
};

const generateInvoice = () => {
    const name = document.getElementById('inv-name').value;
    const phone = document.getElementById('inv-phone').value;
    const gstin = document.getElementById('inv-gstin').value;
    const address = document.getElementById('inv-addr').value;
    const paymentStatus = document.getElementById('inv-status').value;
    const { subtotal, gst, total } = calcInvoiceTotal();

    // FAILSAFE: strict check for Business GST
    if (!state.settings.bizGst) {
        showToast("⚠️ Billing Blocked: Please add GST Number in Admin Settings first.", "danger");
        return;
    }

    if (!name || total === 0) {
        showToast("Please fill customer details and add items with valid prices", "warning");
        return;
    }

    if (total <= 0) {
        showToast("Invoice Total cannot be zero.", "warning");
        return;
    }

    // Capture items for the invoice record
    const items = [];
    document.querySelectorAll('.inv-item-row').forEach(row => {
        const desc = row.querySelector('.item-desc').value || 'Item';
        let qty = parseFloat(row.querySelector('.item-qty').value);
        let price = parseFloat(row.querySelector('.item-price').value);

        if (isNaN(qty)) qty = 0;
        if (isNaN(price)) price = 0;

        if (qty > 0 && price >= 0) {
            items.push({ desc, qty, price, rowTotal: (qty * price).toFixed(2) });
        }
    });

    if (items.length === 0) {
        showToast("Please add at least one valid item.", "warning");
        return;
    }

    const newInv = {
        id: 'INV' + (1000 + state.invoices.length),
        customer: name,
        phone: phone,
        gstin: gstin || 'N/A',
        address: address || '',
        date: new Date().toLocaleDateString('en-GB'),
        subtotal: subtotal.toFixed(2),
        gstAmount: gst.toFixed(2),
        total: total.toFixed(2),
        paid: paymentStatus,
        bizGst: state.settings.bizGst, // Snapshot of business GST at time of invoice
        items: items
    };

    state.invoices.unshift(newInv);
    saveState();
    renderInvoices();
    showToast("GST Invoice Generated!", "success");
};

const fillInvoiceTemplate = (inv) => {
    // Fill Template
    document.getElementById('pdf-biz-name').textContent = state.settings.bizName || 'Business Name';
    document.getElementById('pdf-biz-address').textContent = state.settings.bizAddress || '';
    document.getElementById('pdf-biz-phone').textContent = "Phone: " + (state.settings.bizPhone || '');
    document.getElementById('pdf-biz-email').textContent = "Email: " + (state.settings.bizEmail || '');
    document.getElementById('pdf-biz-gst').textContent = (inv.bizGst || state.settings.bizGst || 'N/A');

    document.getElementById('pdf-cust-name').textContent = inv.customer || 'Valued Customer';
    document.getElementById('pdf-cust-phone').textContent = "Phone: " + (inv.phone || '-');
    document.getElementById('pdf-cust-address').textContent = inv.address || '-';
    document.getElementById('pdf-cust-gst').textContent = inv.gstin || 'Unregistered';

    document.getElementById('pdf-inv-id').textContent = inv.id;
    document.getElementById('pdf-inv-date').textContent = inv.date;
    document.getElementById('pdf-inv-status').textContent = inv.paid === 'paid' ? 'Paid' : (inv.paid === 'advance' ? 'Advance Received' : 'Payment Pending');

    const tbody = document.getElementById('pdf-items-body');
    tbody.innerHTML = inv.items.map((item, i) => `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px;">${i + 1}</td>
            <td style="padding:8px;">${item.desc}</td>
            <td style="padding:8px; text-align:center;">${item.qty}</td>
            <td style="padding:8px; text-align:right;">₹${item.price}</td>
            <td style="padding:8px; text-align:right;">₹${item.rowTotal}</td>
        </tr>
    `).join('');

    document.getElementById('pdf-subtotal').textContent = `₹${inv.subtotal}`;

    // Split GST for display (CGST/SGST)
    const rate = state.settings.gstRate || 18;
    const halfRate = rate / 2;
    const halfGst = (parseFloat(inv.gstAmount) / 2).toFixed(2);

    document.querySelectorAll('.pdf-gst-rate').forEach(el => el.textContent = halfRate);
    document.getElementById('pdf-cgst').textContent = `₹${halfGst}`;
    document.getElementById('pdf-sgst').textContent = `₹${halfGst}`;
    document.getElementById('pdf-total').textContent = `₹${inv.total}`;

    // Add signature footer
    const invTemplate = document.getElementById('invoice-template');
    const oldFooter = document.getElementById('pdf-footer-auth');
    if (oldFooter) oldFooter.remove();

    const authFooter = document.createElement('div');
    authFooter.id = 'pdf-footer-auth';
    authFooter.style.marginTop = '40px';
    authFooter.style.textAlign = 'right';
    authFooter.innerHTML = `
        <div style="display:inline-block; text-align:center;">
            <p style="margin-bottom:40px; font-weight:bold;">For ${state.settings.bizName}</p>
            <p style="border-top:1px solid #333; padding-top:5px; width:150px; margin-left:auto;">Authorized Signatory</p>
        </div>
    `;
    invTemplate.appendChild(authFooter);
};

const downloadInvoicePDF = (id) => {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;

    fillInvoiceTemplate(inv);

    // Generate PDF
    const { jsPDF } = window.jspdf;
    const element = document.getElementById('invoice-template');

    // Temporarily bring it into view properly for capture
    const originalPos = element.style.position;
    const originalTop = element.style.top;
    const originalZ = element.style.zIndex;

    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0'; // Ensure left alignment
    element.style.zIndex = '99999';

    // Scroll to top to ensure capture works correctly
    window.scrollTo(0, 0);

    html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${inv.id}_Invoice.pdf`);

        // Restore original styles
        element.style.position = originalPos;
        element.style.top = originalTop;
        element.style.zIndex = originalZ;

        showToast("PDF Downloaded successfully", "success");
    }).catch(err => {
        console.error("PDF generation failed:", err);
        showToast("PDF Generation Failed: " + err.message, "danger");
        // Restore styles even on error
        element.style.position = originalPos;
        element.style.top = originalTop;
        element.style.zIndex = originalZ;
    });
};

const renderTracking = () => {
    viewTitle.textContent = "Order Tracking & Workflow";

    const searchTerm = document.getElementById('track-search')?.value.toLowerCase() || '';

    // Merge Leads, Tasks, and Invoices to create a unified view
    // Start with tasks as they represent active orders
    let workflowItems = state.tasks.map(task => {
        // Find related lead
        const lead = state.leads.find(l => l.id === task.leadId);
        // Find related invoices (matched by customer name mostly as IDs might differ in simple setup)
        const invoices = state.invoices.filter(inv => inv.customer.toLowerCase() === task.customer.toLowerCase());

        // Determine overall status
        let status = 'Processing';
        let progress = 0;

        if (task.stage === 0) { status = 'Sales Phase'; progress = 20; }
        else if (task.stage === 1) { status = 'Design & Measure'; progress = 40; }
        else if (task.stage === 2) { status = 'Manufacturing'; progress = 60; }
        else if (task.stage === 3) { status = 'Out for Delivery'; progress = 80; }
        else if (task.stage === 4) { status = 'Completed'; progress = 100; }

        const paymentStatus = invoices.length > 0
            ? (invoices.every(i => i.paid === 'paid') ? 'Paid' : (invoices.some(i => i.paid === 'advance') ? 'Partially Paid' : 'Pending'))
            : 'Not Invoiced';

        return {
            id: task.id,
            customer: task.customer,
            leadDate: lead ? lead.date : 'N/A',
            taskStage: task.stage, // 0-4
            status: status,
            progress: progress,
            payment: paymentStatus,
            invoices: invoices
        };
    }).filter(item => item.customer.toLowerCase().includes(searchTerm) || item.id.toLowerCase().includes(searchTerm));

    const trackingList = workflowItems.map(item => `
        <div class="card" style="margin-bottom:1rem; border-left: 5px solid ${item.progress === 100 ? '#10b981' : '#3b82f6'};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="margin:0;">${item.customer} <small style="color:var(--text-muted); font-weight:normal;">(${item.id})</small></h4>
                    <small>Started: ${item.leadDate}</small>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${item.payment === 'Paid' ? 'status-active' : (item.payment === 'Not Invoiced' ? 'status-pending' : 'status-active')}" style="background:${item.payment === 'Partially Paid' ? '#f59e0b' : (item.payment === 'Not Invoiced' ? '#9ca3af' : '')}">${item.payment}</span>
                </div>
            </div>
            
            <div style="margin-top:1rem; position:relative;">
                <div style="height:6px; background:#e5e7eb; border-radius:3px; overflow:hidden;">
                    <div style="width:${item.progress}%; background:${item.progress === 100 ? '#10b981' : '#3b82f6'}; height:100%;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:0.75rem; color:var(--text-muted);">
                    <span style="color:${item.taskStage >= 0 ? 'var(--text-color)' : ''}; font-weight:${item.taskStage >= 0 ? 'bold' : 'normal'}">Sales</span>
                    <span style="color:${item.taskStage >= 1 ? 'var(--text-color)' : ''}; font-weight:${item.taskStage >= 1 ? 'bold' : 'normal'}">Design</span>
                    <span style="color:${item.taskStage >= 2 ? 'var(--text-color)' : ''}; font-weight:${item.taskStage >= 2 ? 'bold' : 'normal'}">Production</span>
                    <span style="color:${item.taskStage >= 3 ? 'var(--text-color)' : ''}; font-weight:${item.taskStage >= 3 ? 'bold' : 'normal'}">Delivery</span>
                    <span style="color:${item.taskStage >= 4 ? 'var(--text-color)' : ''}; font-weight:${item.taskStage >= 4 ? 'bold' : 'normal'}">Done</span>
                </div>
            </div>

            <div style="margin-top:1rem; display:flex; gap:10px;">
                <button class="btn btn-sm btn-outline" onclick="openTaskManagement('${item.id}')">View Details</button>
                ${item.invoices.length > 0 ?
            `<div style="display:flex; gap:5px;">
                        <button class="btn btn-sm btn-success" style="background:#25d366; border-color:#25d366; color:white;" onclick="sendInvoiceWhatsApp('${item.invoices[0].id}')"><i class="fab fa-whatsapp"></i> Send on WA</button>
                        <button class="btn btn-sm btn-pdf" onclick="downloadInvoicePDF('${item.invoices[0].id}')"><i class="fas fa-file-pdf"></i> Download PDF</button>
                     </div>` :
            `<button class="btn btn-sm btn-success" onclick="generateInvoiceFromTask('${item.id}')">Create Invoice</button>`
        }
            </div>
        </div>
    `).join('');

    contentBody.innerHTML = `
        <div style="max-width:900px; margin:0 auto;">
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3>Live Order Tracking</h3>
                    <input type="text" id="track-search" class="form-control" style="width:250px;" placeholder="Search Customer..." oninput="renderTracking()">
                </div>
                <div style="max-height:600px; overflow-y:auto; padding-right:5px;">
                    ${trackingList.length ? trackingList : '<p style="text-align:center; padding:2rem; color:var(--text-muted);">No active orders found.</p>'}
                </div>
            </div>
        </div>
    `;
};

const sendInvoiceWhatsApp = async (id) => {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;

    showToast("Generating PDF and Secure Link...", "info");

    try {
        // 1. Prepare Template with data
        fillInvoiceTemplate(inv);

        const element = document.getElementById('invoice-template');
        const originalPos = element.style.position;
        const originalTop = element.style.top;
        const originalZ = element.style.zIndex;

        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.zIndex = '99999';

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        // Restore UI
        element.style.position = originalPos;
        element.style.top = originalTop;
        element.style.zIndex = originalZ;

        // 2. Convert to Blob
        const pdfBlob = pdf.output('blob');

        // 3. Upload to Firebase Storage
        const storageRef = storage.ref(`invoices/${inv.id}_${Date.now()}.pdf`);
        const snapshot = await storageRef.put(pdfBlob);
        const downloadUrl = await snapshot.ref.getDownloadURL();

        // 4. Send Professional Message with the Link
        const msg = `*📄 DOORFLOW OFFICIAL INVOICE: ${inv.id}*%0A%0A` +
            `Hello ${inv.customer},%0A` +
            `Please find your official GST invoice below. Click the link to view/download the PDF:%0A%0A` +
            `${downloadUrl}%0A%0A` +
            `*Amount:* ₹${inv.total}%0A` +
            `*Date:* ${inv.date}%0A%0A` +
            `Thank you for choosing *DoorFlow Services*!`;

        openWhatsApp(inv.phone, msg);
        showToast("PDF Link sent successfully!", "success");

    } catch (err) {
        console.error("Failed to generate/upload PDF:", err);
        showToast("Error sending PDF link: " + err.message, "danger");
    }
};

const sendCatalogViaWhatsApp = () => {
    if (selectedCatalog.length === 0) {
        showToast("Select at least one image first", "warning");
        return;
    }
    const items = state.catalog.filter(i => selectedCatalog.includes(i.id));
    const message = "Check out these designs:\n" + items.map(i => `- ${i.name}`).join('\n');
    openWhatsApp('', message);
};

const openWhatsApp = (phone = '', message = '') => {
    const baseUrl = "https://wa.me/";
    const phoneClean = (phone || "919999999999").replace(/\D/g, "");
    const url = `${baseUrl}${phoneClean}?text=${encodeURIComponent(message || "Hello from DoorFlow CRM!")}`;
    window.open(url, '_blank');
};

// --- CSV Parser Helpers ---
const parseCSVLine = (row) => {
    let result = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
        let char = row[i];
        if (char === '"') {
            if (inQuotes && row[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(cell.trim());
            cell = '';
        } else {
            cell += char;
        }
    }
    result.push(cell.trim());
    return result;
};

const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map(line => parseCSVLine(line));
};

const handleFetchLeads = async () => {
    const urlInput = document.getElementById('sheet-url');
    const url = urlInput.value.trim();

    if (!url) {
        showToast("Please enter a Google Sheet URL", "warning");
        return;
    }

    // Extract Sheet ID
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
        showToast("Invalid Google Sheet URL", "danger");
        return;
    }

    const sheetId = match[1];
    // Using the /export endpoint which is more reliable for local file access
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    showToast("Connecting to Google Sheets...", "info");

    try {
        const response = await fetch(csvUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        const rows = parseCSV(text);

        if (rows.length < 2) {
            showToast("Sheet found but appears empty or has only headers.", "warning");
            return;
        }

        // Auto-detect columns
        const headers = rows[0].map(h => h.toLowerCase().replace(/['"]/g, ''));
        let nameIdx = headers.findIndex(h => h.includes('name'));
        let phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
        let reqIdx = headers.findIndex(h => h.includes('requirement') || h.includes('detail') || h.includes('desc'));
        let dateIdx = headers.findIndex(h => h.includes('date'));
        let addrIdx = headers.findIndex(h => h.includes('address') || h.includes('location'));

        // FALLBACK: If no clear headers found (like in the user's sheet), assume column 0 is Name and column 1 is Phone
        let dataRows = rows.slice(1);
        if (nameIdx === -1 && phoneIdx === -1) {
            nameIdx = 0;
            phoneIdx = 1;
            dataRows = rows; // Use all rows if first row isn't a header
        }

        const newLeads = dataRows.map((row, index) => {
            // Remove wrapping quotes from gviz output if any remain
            const clean = (val) => val ? val.replace(/^"|"$/g, '').trim() : '';

            const name = (nameIdx > -1 && row[nameIdx] ? row[nameIdx] : (row[0] || 'Unknown'));
            const phone = (phoneIdx > -1 && row[phoneIdx] ? row[phoneIdx] : (row[1] || ''));
            const requirement = (reqIdx > -1 && row[reqIdx] ? row[reqIdx] : (row[2] || 'No details'));
            const date = (dateIdx > -1 && row[dateIdx] ? row[dateIdx] : (row[3] || new Date().toISOString().split('T')[0]));
            const address = (addrIdx > -1 && row[addrIdx] ? row[addrIdx] : (row[4] || 'No address'));

            return {
                id: 'L' + (Date.now() + index),
                name: clean(name),
                phone: clean(phone),
                address: clean(address),
                requirement: clean(requirement),
                date: clean(date),
                status: 'new',
                measurements: { w: '', h: '', t: '', color: '', category: 'Main Door', doorType: '', material: '', budget: '' },
                selectedImages: []
            };
        });

        state.leads = newLeads;
        state.settings.googleSheetUrl = url;
        saveState();
        renderLeads();

        showToast(`Successfully fetched ${newLeads.length} leads!`, "success");

    } catch (error) {
        console.error("Fetch error:", error);
        showToast("Access Blocked by Browser (CORS)! To fix: 1. Publish Sheet to Web (File > Share > Publish), 2. Use the 'Web Link' instead.", "danger");
    }
};

const openLeadDetails = (id) => {
    const lead = state.leads.find(l => l.id === id);
    if (!lead.measurements) lead.measurements = { w: '', h: '', t: '', color: '', category: 'Main Door', doorType: '', material: '', budget: '' };
    if (!lead.selectedImages) lead.selectedImages = [];

    modalBody.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2>Lead Details: ${lead.name}</h2>
            <i class="fas fa-times" onclick="closeModal()" style="cursor:pointer; font-size:1.5rem;"></i>
        </div>
        <hr style="margin: 1rem 0; border:0; border-top:1px solid var(--border);">
        
        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:1.5rem;">
            <!-- Left Panel -->
            <div>
                <div class="card" style="margin-bottom:1rem;">
                    <h4>Measurement & Requirement Tool</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; margin-top:0.5rem;">
                        <div><label style="font-size:0.7rem;">Width</label><input type="text" id="m-width" value="${lead.measurements.w}" class="form-control" style="width:100%; padding:5px; border-radius:5px; border:1px solid var(--border);"></div>
                        <div><label style="font-size:0.7rem;">Height</label><input type="text" id="m-height" value="${lead.measurements.h}" class="form-control" style="width:100%; padding:5px; border-radius:5px; border:1px solid var(--border);"></div>
                        <div><label style="font-size:0.7rem;">Thickness</label><input type="text" id="m-thick" value="${lead.measurements.t}" class="form-control" style="width:100%; padding:5px; border-radius:5px; border:1px solid var(--border);"></div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.8rem;">
                        <div>
                            <label style="font-size:0.7rem;">Category</label>
                            <select id="m-category" class="form-control" style="width:100%; padding:5px; border-radius:5px; border:1px solid var(--border);">
                                <option ${lead.measurements.category === 'Main Door' ? 'selected' : ''}>Main Door</option>
                                <option ${lead.measurements.category === 'Bedroom' ? 'selected' : ''}>Bedroom</option>
                                <option ${lead.measurements.category === 'Kitchen' ? 'selected' : ''}>Kitchen</option>
                                <option ${lead.measurements.category === 'Washroom' ? 'selected' : ''}>Washroom</option>
                                <option ${lead.measurements.category === 'Other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div><label style="font-size:0.7rem;">Material Preference</label><input type="text" id="m-material" value="${lead.measurements.material || ''}" placeholder="e.g. Teak, Ply, Steel" class="form-control" style="width:100%; padding:5px; border-radius:5px; border:1px solid var(--border);"></div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.8rem;">
                        <div><label style="font-size:0.7rem;">Door Type</label><input type="text" id="m-doorType" value="${lead.measurements.doorType || ''}" placeholder="e.g. Single Panel" class="form-control" style="width:100%; padding:5px; border-radius:5px; border:1px solid var(--border);"></div>
                        <div><label style="font-size:0.7rem;">Color / Finish</label><input type="text" id="m-color" value="${lead.measurements.color || ''}" placeholder="e.g. Glossy Walnut" class="form-control" style="width:100%; padding:5px; border-radius:5px; border:1px solid var(--border);"></div>
                    </div>
                    <div style="margin-top:0.8rem;">
                        <label style="font-size:0.7rem;">Customer Budget (Approx)</label>
                        <input type="text" id="m-budget" value="${lead.measurements.budget || ''}" placeholder="e.g. 15,000 - 20,000" class="form-control" style="width:100%; padding:5px; border-radius:5px; border:1px solid var(--border);">
                    </div>
                </div>
                
                <div class="card">
                    <h4>Select Catalog Designs</h4>
                    <div class="catalog-grid-mini" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:10px; margin-top:10px; max-height:200px; overflow-y:auto;">
                        ${state.catalog.map(item => `
                            <div class="catalog-item-mini ${lead.selectedImages.includes(item.id) ? 'selected' : ''}" 
                                 onclick="toggleLeadImage('${lead.id}', ${item.id}, this)"
                                 style="border-radius:8px; overflow:hidden; border:2px solid ${lead.selectedImages.includes(item.id) ? 'var(--primary)' : 'transparent'}; cursor:pointer; aspect-ratio:1/1;">
                                <img src="${item.url}" style="width:100%; height:100%; object-fit:cover;">
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-sm btn-success btn-block" style="margin-top:0.8rem; background:#25d366; width:100%;" onclick="sendLeadCatalogWhatsApp('${lead.id}')">
                        <i class="fab fa-whatsapp"></i> Send Selected to Customer
                    </button>
                </div>
            </div>

            <!-- Right Panel -->
            <div>
                <div class="card" style="background:var(--bg-main);">
                    <h4>Customer Info</h4>
                    <p style="font-size:0.9rem;"><strong>Phone:</strong> ${lead.phone}</p>
                    <p style="font-size:0.9rem;"><strong>Address:</strong> ${lead.address}</p>
                    <textarea id="sales-notes" placeholder="Add notes for Design team..." style="width:100%; height:100px; margin-top:0.5rem; padding:0.5rem; border-radius:8px; border:1px solid var(--border);">${lead.requirement}</textarea>
                    
                    <button class="btn btn-primary btn-block" style="margin-top:1rem; width:100%;" onclick="confirmOrderWithDetails('${lead.id}')">Confirm & Forward to Design</button>
                </div>
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');
};

const toggleLeadImage = (leadId, imgId, el) => {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead.selectedImages) lead.selectedImages = [];

    if (lead.selectedImages.includes(imgId)) {
        lead.selectedImages = lead.selectedImages.filter(id => id !== imgId);
        el.style.borderColor = 'transparent';
    } else {
        lead.selectedImages.push(imgId);
        el.style.borderColor = 'var(--primary)';
    }
};

const sendLeadCatalogWhatsApp = (leadId) => {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead.selectedImages || lead.selectedImages.length === 0) {
        showToast("Select images first!", "warning");
        return;
    }
    const selected = state.catalog.filter(i => lead.selectedImages.includes(i.id));
    const msg = `Dear ${lead.name}, please check these door designs for your requirement: \n` + selected.map(s => `- ${s.name}`).join('\n');
    openWhatsApp(lead.phone, msg);
};

const confirmOrderWithDetails = (leadId) => {
    const lead = state.leads.find(l => l.id === leadId);
    const m = {
        w: document.getElementById('m-width').value,
        h: document.getElementById('m-height').value,
        t: document.getElementById('m-thick').value,
        category: document.getElementById('m-category').value,
        color: document.getElementById('m-color').value,
        doorType: document.getElementById('m-doorType').value,
        material: document.getElementById('m-material').value,
        budget: document.getElementById('m-budget').value
    };
    const notes = document.getElementById('sales-notes').value;

    lead.status = 'confirmed';
    lead.measurements = m;
    lead.requirement = notes;

    const newTask = {
        id: 'T' + (state.tasks.length + 1),
        leadId: lead.id,
        customer: lead.name,
        team: 'design',
        status: 'pending',
        stage: 1,
        history: [{ stage: 0, time: new Date().toLocaleString(), note: 'Order confirmed with measurements & designs' }],
        notes: notes,
        measurements: m,
        selectedImages: lead.selectedImages
    };

    state.tasks.push(newTask);
    saveState();
    closeModal();
    renderLeads();
    showToast("Task forwarded to Design Team with details", "success");
};

const openTaskManagement = (id) => {
    const task = state.tasks.find(t => t.id === id);
    const stages = ['Sales', 'Design', 'Production', 'Delivery', 'Completed'];

    // Display selected images
    const selectedImagesHTML = (task.selectedImages && task.selectedImages.length > 0) ? `
        <div style="margin-top:1rem;">
            <h4>Design Selection:</h4>
            <div style="display:flex; gap:10px; overflow-x:auto; padding:10px 0;">
                ${task.selectedImages.map(imgId => {
        const item = state.catalog.find(c => c.id === imgId);
        return item ? `<img src="${item.url}" style="height:80px; border-radius:8px; border:1px solid var(--border);">` : '';
    }).join('')}
            </div>
        </div>
    ` : '<p style="font-size:0.8rem; color:var(--text-muted);">No designs selected yet.</p>';

    const lead = state.leads.find(l => l.id === task.leadId);

    modalBody.innerHTML = `
         <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2>Manage Task: #${task.id} - ${task.customer}</h2>
            <i class="fas fa-times" onclick="closeModal()" style="cursor:pointer; font-size:1.5rem;"></i>
        </div>
        
        <div class="workflow-tracker">
            ${stages.map((s, i) => `
                <div class="step ${task.stage > i ? 'completed' : (task.stage === i ? 'active' : '')}">
                    <div class="step-circle">${task.stage > i ? '<i class="fas fa-check"></i>' : i + 1}</div>
                    <div class="step-label">${s}</div>
                </div>
            `).join('')}
        </div>

        <div style="display:grid; grid-template-columns:1fr 1.5fr; gap:2rem;">
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h3>Task Info</h3>
                    <div style="display:flex; gap:5px;">
                        <button class="btn btn-sm btn-outline" style="padding:5px 8px;" onclick="openWhatsApp('${lead?.phone || ''}', 'Hello ${task.customer}, regarding your door order #${task.id}...')"><i class="fab fa-whatsapp"></i></button>
                        <button class="btn btn-sm btn-outline" style="padding:5px 8px;" onclick="window.open('tel:${lead?.phone || ''}')"><i class="fas fa-phone"></i></button>
                    </div>
                </div>
                <p><strong>Status:</strong> <span class="status-badge status-active">${task.isAccepted ? (task.status.replace('-', ' ')) : 'Awaiting Acceptance'}</span></p>
                
                <div style="background:var(--bg-main); padding:10px; border-radius:8px; margin:1rem 0;">
                    <p style="font-size:0.9rem;"><strong>Customer Address:</strong> ${lead?.address || 'N/A'}</p>
                    <hr style="margin:5px 0; border-top:1px dashed var(--border);">
                    <p style="font-size:0.9rem;"><strong>Area/Cat:</strong> ${task.measurements?.category || 'N/A'} | <strong>Material:</strong> ${task.measurements?.material || 'N/A'}</p>
                    <p style="font-size:0.9rem;"><strong>Type:</strong> ${task.measurements?.doorType || 'N/A'} | <strong>Color:</strong> ${task.measurements?.color || 'N/A'}</p>
                    <p style="font-size:0.9rem;"><strong>Size:</strong> W: ${task.measurements?.w || 'N/A'} x H: ${task.measurements?.h || 'N/A'} (T: ${task.measurements?.t || 'N/A'})</p>
                    <p style="font-size:0.9rem;"><strong>Budget:</strong> ₹${task.measurements?.budget || 'N/A'}</p>
                    <p style="font-size:0.9rem;"><strong>Notes:</strong> ${task.notes || 'No notes'}</p>
                </div>

                ${selectedImagesHTML}

                <div style="margin-top:2rem;">
                    ${renderRoleSpecificActions(task)}
                </div>
            </div>
            <div class="card">
                <h3>Activity Logs</h3>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${[...task.history].reverse().map(h => `
                        <div style="padding: 10px; border-left: 2px solid var(--primary); margin-bottom: 10px; background:var(--bg-main);">
                            <small>${h.time}</small>
                            <div><strong>${stages[h.stage]}</strong>: ${h.note}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');
};

const acceptTask = (id) => {
    const task = state.tasks.find(t => t.id === id);
    task.isAccepted = true;
    task.status = 'accepted';
    task.history.push({
        stage: task.stage,
        time: new Date().toLocaleString(),
        note: `Task accepted by ${state.currentUser.role.toUpperCase()} Team`
    });
    saveState();
    renderTasks();
    showToast("Task Accepted! You can now manage it.", "success");
    openTaskManagement(id);
};

const renderRoleSpecificActions = (task) => {
    const role = state.currentUser.role;

    if (role === 'design' && task.stage === 1) {
        return `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn btn-primary" onclick="forwardTask('${task.id}', 2, 'Design approved by customer and finalized.')">
                    <i class="fas fa-check-circle"></i> Approve & Send to Production
                </button>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <button class="btn btn-outline" onclick="uploadDesign('${task.id}')">
                        <i class="fas fa-upload"></i> Custom Design
                    </button>
                    <button class="btn btn-success" style="background:#25d366" onclick="sendWhatsAppPreview('${task.id}')">
                        <i class="fab fa-whatsapp"></i> WhatsApp Preview
                    </button>
                </div>
                <p style="font-size:0.7rem; color:var(--text-muted); text-align:center;">Note: Ensure all designs are uploaded before production.</p>
            </div>
        `;
    }

    if (role === 'production' && task.stage === 2) {
        return `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">Current Status:</label>
                    <select id="prod-status" class="form-control" style="margin-top:4px; padding:10px;">
                        <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>⏳ Awaiting Raw Material</option>
                        <option value="manufacturing" ${task.status === 'manufacturing' ? 'selected' : ''}>🔨 In Manufacturing (Cutting/Fitting)</option>
                        <option value="finishing" ${task.status === 'finishing' ? 'selected' : ''}>✨ Finishing & Polishing</option>
                        <option value="qc-ready" ${task.status === 'qc-ready' ? 'selected' : ''}>🔍 Ready for Quality Check</option>
                    </select>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <button class="btn btn-outline" onclick="updateProductionStatusOnly('${task.id}')">
                        <i class="fas fa-save"></i> Save Status
                    </button>
                    <button class="btn btn-success" onclick="markQCAndForward('${task.id}')">
                        <i class="fas fa-truck"></i> Pass QC & Forward
                    </button>
                </div>
                
                <p style="font-size:0.7rem; color:var(--text-muted); text-align:center;">
                    Note: Complete manufacturing and polishing before Passing Quality Check.
                </p>
            </div>
        `;
    }

    if (role === 'delivery' && task.stage === 3) {
        return `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">Delivery Status:</label>
                    <select id="del-status" class="form-control" style="margin-top:4px; padding:10px;">
                        <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>⏳ Awaiting Collection</option>
                        <option value="dispatched" ${task.status === 'dispatched' ? 'selected' : ''}>🚚 Dispatched / In Transit</option>
                        <option value="out-for-delivery" ${task.status === 'out-for-delivery' ? 'selected' : ''}>🏠 Out for Delivery</option>
                        <option value="fitting-in-progress" ${task.status === 'fitting-in-progress' ? 'selected' : ''}>🔧 Installation/Fitting Started</option>
                    </select>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <button class="btn btn-outline" onclick="updateDeliveryStatusOnly('${task.id}')">
                        <i class="fas fa-save"></i> Update
                    </button>
                    <button class="btn btn-success" onclick="markDeliveredAndComplete('${task.id}')">
                        <i class="fas fa-check-double"></i> Complete & Close
                    </button>
                </div>
                
                <p style="font-size:0.7rem; color:var(--text-muted); text-align:center;">
                    Note: "Complete & Close" marks the door as delivered and installed.
                </p>
            </div>
        `;
    }

    if (role === 'admin') {
        return `
            <button class="btn btn-danger btn-block" onclick="deleteTask('${task.id}')">Delete Task</button>
        `;
    }

    return `<p style="color:var(--text-muted)">Awaiting next stage action...</p>`;
};

const updateProductionStatusOnly = (id) => {
    const status = document.getElementById('prod-status').value;
    const task = state.tasks.find(t => t.id === id);
    task.status = status;
    task.history.push({
        stage: 2,
        time: new Date().toLocaleString(),
        note: `Production status updated to: ${status.replace('-', ' ')}`
    });
    saveState();
    openTaskManagement(id);
    showToast("Production status updated", "success");
};

const markQCAndForward = (id) => {
    const status = document.getElementById('prod-status').value;
    if (status !== 'qc-ready') {
        if (!confirm("Status is not 'Ready for QC'. Do you still want to pass Quality Check and forward?")) return;
    }
    forwardTask(id, 3, "Quality Check Passed: Door manufactured and finished as per design. Handed over for Delivery.");
};

const forwardTask = (taskId, nextStage, note) => {
    const task = state.tasks.find(t => t.id === taskId);
    task.stage = nextStage;
    task.isAccepted = false; // Reset acceptance for the next team
    task.status = nextStage === 4 ? 'completed' : 'pending';

    // Assign team
    const teams = ['sales', 'design', 'production', 'delivery', 'completed'];
    task.team = teams[nextStage];

    task.history.push({
        stage: nextStage,
        time: new Date().toLocaleString(),
        note: note
    });

    saveState();
    closeModal();
    renderTasks();
    showToast(`Task forwarded to ${teams[nextStage]} Team. Awaiting acceptance.`, "success");
};

const closeModal = () => modalContainer.classList.add('hidden');

// --- Initialization ---

document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => login(btn.dataset.role));
});

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        if (item.id === 'dark-mode-toggle' || item.id === 'logout-btn') return;
        e.preventDefault();
        renderView(item.dataset.view);
    });
});

document.getElementById('logout-btn').addEventListener('click', logout);

document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    document.body.className = state.darkMode ? 'dark-mode' : 'light-mode';
    document.querySelector('#dark-mode-toggle i').className = state.darkMode ? 'fas fa-sun' : 'fas fa-moon';
    document.querySelector('#dark-mode-toggle span').textContent = state.darkMode ? 'Light Mode' : 'Dark Mode';
    saveState();
});

const handleAddCatalog = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const newItem = {
                    id: Date.now() + Math.random(),
                    name: file.name.split('.')[0],
                    url: event.target.result
                };
                state.catalog.push(newItem);
                saveState();
                renderCatalog();
                showToast(`Uploaded: ${file.name}`, "success");
            };
            reader.readAsDataURL(file);
        });
    };
    input.click();
};

// --- Team Chat Logic ---
const renderChat = () => {
    let chatContainer = document.getElementById('chat-window');
    if (!chatContainer) {
        chatContainer = document.createElement('div');
        chatContainer.id = 'chat-window';
        chatContainer.className = 'chat-window hidden';
        document.body.appendChild(chatContainer);
    }

    chatContainer.innerHTML = `
        <div class="chat-header">
            <span><i class="fas fa-comments"></i> Team Chat</span>
            <i class="fas fa-times" onclick="toggleChat()"></i>
        </div>
        <div class="chat-messages" id="chat-msgs">
            ${state.chatMessages.map(m => `
                <div class="chat-msg ${m.role === state.currentUser.role ? 'own' : ''}">
                    <div class="msg-meta">${m.sender} (${m.role})</div>
                    <div class="msg-text">${m.text}</div>
                    <div class="msg-time">${m.time}</div>
                </div>
            `).join('')}
        </div>
        <div class="chat-input-area">
            <input type="text" id="chat-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendChat()">
            <button onclick="sendChat()"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;

    // Add floating button if not exists
    if (!document.getElementById('chat-trigger')) {
        const trigger = document.createElement('div');
        trigger.id = 'chat-trigger';
        trigger.className = 'chat-trigger';
        trigger.innerHTML = '<i class="fas fa-comments"></i>';
        trigger.onclick = toggleChat;
        document.body.appendChild(trigger);
    }
};

const toggleChat = () => {
    const win = document.getElementById('chat-window');
    win.classList.toggle('hidden');
    if (!win.classList.contains('hidden')) {
        const msgs = document.getElementById('chat-msgs');
        msgs.scrollTop = msgs.scrollHeight;
    }
};

const sendChat = () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const msg = {
        sender: state.currentUser.name,
        role: state.currentUser.role,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    state.chatMessages.push(msg);
    saveState();
    input.value = '';
    renderChat();
    toggleChat(); // Keep open
    document.getElementById('chat-window').classList.remove('hidden');
};

const deleteTask = (id) => {
    if (confirm("Are you sure you want to delete this task?")) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveState();
        closeModal();
        renderTasks();
        showToast("Task deleted", "danger");
    }
};

const updateDeliveryStatusOnly = (id) => {
    const status = document.getElementById('del-status').value;
    const task = state.tasks.find(t => t.id === id);
    task.status = status;
    task.history.push({
        stage: 3,
        time: new Date().toLocaleString(),
        note: `Delivery status updated to: ${status.replace('-', ' ')}`
    });
    saveState();
    openTaskManagement(id);
    showToast("Delivery status updated", "info");
};

const markDeliveredAndComplete = (id) => {
    if (!confirm("Are you sure the delivery and installation are complete? This will close the task.")) return;
    forwardTask(id, 4, "Order Delivered & Installed Successfully. Task Completed.");
};

const uploadDesign = (id) => {
    const url = prompt("Enter design catalog URL:");
    if (url) {
        const task = state.tasks.find(t => t.id === id);
        task.images.push(url);
        task.history.push({
            stage: task.stage,
            time: new Date().toLocaleString(),
            note: "Design uploaded: " + url
        });
        saveState();
        openTaskManagement(id);
        showToast("Design uploaded successfully", "success");
    }
};

const sendWhatsAppPreview = (taskId) => {
    const task = state.tasks.find(t => t.id === taskId);
    const lead = state.leads.find(l => l.id === task.leadId);
    const msg = `Hi ${task.customer}, here is the design preview for your ${task.measurements.category} (${task.measurements.doorType}). Please let us know if you have any changes.`;
    openWhatsApp(lead?.phone || '', msg);
};

const generateInvoiceFromTask = (taskId) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Switch to invoices view
    renderView('invoices');

    // Create prefill data
    const prefillData = {
        name: task.customer,
        phone: '', // Needs lead lookup
        address: task.leadId ? (state.leads.find(l => l.id === task.leadId)?.address || '') : '',
        items: []
    };

    // Look up lead for phone
    if (task.leadId) {
        const lead = state.leads.find(l => l.id === task.leadId);
        if (lead) prefillData.phone = lead.phone;
    }

    // Add item based on task info
    prefillData.items.push({
        desc: `${task.measurements.category} - ${task.measurements.doorType || 'Standard'} (${task.measurements.material || 'Wood'})`,
        qty: 1,
        price: 0
    });

    renderInvoices(prefillData);
    showToast("Transferred Order Details to Invoice", "info");
};

// Start the app
initMockData();
// Disabled auto-login to prevent role confusion on refresh
// if (state.currentUser) {
//     login(state.currentUser);
// }

// --- Attendance System ---
const checkAttendanceStatus = () => {
    const today = new Date().toISOString().split('T')[0];
    const record = state.attendance.find(a => a.empId === state.currentUser.id && a.date === today);

    const statusDiv = document.getElementById('attendance-widget');
    if (statusDiv) statusDiv.remove();

    const widget = document.createElement('div');
    widget.id = 'attendance-widget';
    widget.className = 'nav-section';
    widget.style.padding = '0 1rem';
    widget.style.marginTop = '1rem';
    widget.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    widget.style.paddingTop = '1rem';

    if (record && record.checkOut) {
        widget.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem;">Today's Work: <strong>${record.duration} hrs</strong> <br> (Completed)</div>`;
    } else if (record && record.checkIn) {
        widget.innerHTML = `
            <div style="color:#10b981; font-size:0.8rem; margin-bottom:5px;">● On Duty since ${record.checkIn}</div>
            <button class="btn btn-sm btn-danger" style="width:100%" onclick="checkOut()">Check Out</button>
        `;
    } else {
        widget.innerHTML = `<button class="btn btn-sm btn-success" style="width:100%" onclick="checkIn()">Check In</button>`;
    }

    document.querySelector('.sidebar-nav').appendChild(widget);
};

const checkIn = () => {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    state.attendance.push({
        empId: state.currentUser.id,
        name: state.currentUser.name,
        role: state.currentUser.role,
        date: today,
        checkIn: time,
        checkOut: null,
        duration: 0
    });
    saveState();
    checkAttendanceStatus();
    showToast(`Welcome ${state.currentUser.name}! You are clocked in.`, "success");
};

const checkOut = () => {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const record = state.attendance.find(a => a.empId === state.currentUser.id && a.date === today);

    if (record) {
        record.checkOut = time;
        // Simple duration calc (mock)
        record.duration = ((new Date() - new Date(today + ' ' + record.checkIn)) / (1000 * 60 * 60)).toFixed(1); // Real calc would parse time strings properly
        // Fix for demo: just random 8-9 hours if checked out immediately
        if (record.duration < 0.1) record.duration = (Math.random() * 2 + 7).toFixed(1);

        saveState();
        checkAttendanceStatus();
        showToast("Checked out successfully! Good job today.", "success");
    }
};

const renderTeams = () => {
    viewTitle.textContent = "Employee & Attendance Management";

    const employeesList = state.employees.map(e => `
        <tr style="background:var(--bg-main)">
            <td>${e.id}</td>
            <td>${e.name} ${e.isManager ? '<span class="badge">Mgr</span>' : ''}</td>
            <td>${e.role.toUpperCase()}</td>
            <td>${e.password}</td> <!-- Visible for demo admin -->
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteEmployee('${e.id}')">Remove</button>
            </td>
        </tr>
    `).join('');

    const attendanceList = state.attendance.slice().reverse().map(a => `
        <tr>
            <td>${a.date}</td>
            <td>${a.name}</td>
            <td>${a.role.toUpperCase()}</td>
            <td><span style="color:green">${a.checkIn}</span></td>
            <td><span style="color:red">${a.checkOut || '-'}</span></td>
            <td>${a.duration || '-'} hrs</td>
        </tr>
    `).join('');

    contentBody.innerHTML = `
        <div class="grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem;">
            <div class="card">
                <h3>Manage Employees</h3>
                <div style="margin-bottom:1rem; padding:10px; background:var(--bg-main); border-radius:8px;">
                    <h4>Add New Employee</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                        <input type="text" id="new-emp-id" placeholder="ID (e.g. DES002)" class="form-control">
                        <input type="text" id="new-emp-name" placeholder="Full Name" class="form-control">
                        <select id="new-emp-role" class="form-control">
                            <option value="sales">Sales</option>
                            <option value="design">Design</option>
                            <option value="production">Production</option>
                            <option value="delivery">Delivery</option>
                        </select>
                        <input type="text" id="new-emp-pass" placeholder="Password" class="form-control">
                    </div>
                    <div style="margin-top:10px;">
                         <label><input type="checkbox" id="new-emp-mgr"> Is Manager?</label>
                         <button class="btn btn-primary" style="float:right" onclick="addEmployee()">Add User</button>
                    </div>
                </div>
                <div class="table-container" style="max-height:400px; overflow-y:auto;">
                    <table>
                        <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Pass</th><th>Action</th></tr></thead>
                        <tbody>${employeesList}</tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3>Attendance Log</h3>
                <div class="table-container" style="max-height:600px; overflow-y:auto;">
                    <table>
                        <thead><tr><th>Date</th><th>Employee</th><th>Role</th><th>In</th><th>Out</th><th>Hrs</th></tr></thead>
                        <tbody>${attendanceList}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

const addEmployee = () => {
    const id = document.getElementById('new-emp-id').value;
    const name = document.getElementById('new-emp-name').value;
    const role = document.getElementById('new-emp-role').value;
    const pass = document.getElementById('new-emp-pass').value;
    const isMgr = document.getElementById('new-emp-mgr').checked;

    if (id && name && pass) {
        state.employees.push({ id, name, password: pass, role, isManager: isMgr });
        saveState();
        renderTeams();
        showToast("Employee added successfully", "success");
    } else {
        showToast("Please fill all details", "warning");
    }
};

const deleteEmployee = (id) => {
    if (confirm('Remove this employee?')) {
        state.employees = state.employees.filter(e => e.id !== id);
        saveState();
        renderTeams();
    }
};
