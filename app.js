import { auth, db } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    doc, 
    deleteDoc, 
    setDoc, 
    serverTimestamp,
    orderBy,
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


window.handleLogout = handleLogout;

let currentUser = null;
let activityTimer = null; 

// State for Modal Actions
let pendingDeleteId = null;
let pendingLoadId = null;

onAuthStateChanged(auth, async (user) => {
    const currentPage = window.location.pathname.split('/').pop().toLowerCase();
    const protectedPages = ["homepage.html", "about.html", "services.html"];
    
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.email);
        
        const profileNameEl = document.getElementById("userProfileName");
        if (profileNameEl) {
            profileNameEl.innerText = user.displayName || user.email.split('@')[0];
        }
        
        if (currentPage === "index.html" || currentPage === "") {
            await updateUserActivity(); 
            window.location.href = "homepage.html";
        }
       
        if (currentPage.includes("homepage")) displayDashboardMetrics();
        if (currentPage.includes("services")) loadSavedDiagramsList();

    } else {
        if (protectedPages.some(page => currentPage.includes(page))) {
            window.location.href = "index.html";
        }
    }
});

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");
const googleBtn = document.getElementById("googleBtn");
const msg = document.getElementById("authMessage");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("reg-username").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const terms = document.getElementById("terms").checked;

        if(!terms) {
            showError("Please agree to the Terms & Conditions.");
            return;
        }

        showMessage("Creating account...", "var(--neon-blue)");

        try {
            const q = query(collection(db, "users"), where("username", "==", username));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                throw new Error("Username already taken.");
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            await updateProfile(user, { displayName: username });
            
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                email: email,
                lastActive: serverTimestamp(),
                createdAt: serverTimestamp()
            });

            showMessage("Account created! Redirecting...", "var(--neon-green)");
        } catch (error) {
            console.error(error);
            showError(cleanError(error.message));
        }
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;

        showMessage("Authenticating...", "var(--neon-blue)");

        try {
            let emailToLogin = usernameInput;

            if (!usernameInput.includes("@")) {
                const q = query(collection(db, "users"), where("username", "==", usernameInput));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    throw new Error("Username not found.");
                }
                
                querySnapshot.forEach((doc) => {
                    emailToLogin = doc.data().email;
                });
            }

            await signInWithEmailAndPassword(auth, emailToLogin, password);
        } catch (error) {
            console.error(error);
            showError(cleanError(error.message));
        }
    });
}

if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        const provider = new GoogleAuthProvider();
        showMessage("Connecting to Google...", "var(--neon-blue)");
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);

            if (!userSnap.exists()) {
                await setDoc(userDocRef, {
                    username: user.displayName, 
                    email: user.email,
                    lastActive: serverTimestamp(),
                    createdAt: serverTimestamp()
                });
            }
            await updateUserActivity();
        } catch (error) {
            showError(cleanError(error.message));
        }
    });
}


function showMessage(text, color) {
    if(msg) {
        msg.innerText = text;
        msg.style.color = color;
    }
}
function showError(text) {
    showMessage(text, "#ef4444");
}
function cleanError(msg) {
    return msg.replace("Firebase: ", "").replace("auth/", "").replace(/-/g, " ");
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout Error", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const protectedPages = ["homepage.html", "about.html", "services.html"];
    const currentPage = window.location.pathname.split('/').pop().toLowerCase();

    if(protectedPages.some(page => currentPage.includes(page))) {
        insertNavbar(currentPage);
        insertFooter();
    }

    if (currentPage.includes("services")) {
        const saveBtn = document.getElementById("saveDiagramBtn");
        const tracerouteBtn = document.getElementById("startSimulationBtn"); // MANUAL SIM BUTTON
        const realtimeBtn = document.getElementById("realtimeSimBtn"); // AUTO SIM BUTTON
        const createNewBtn = document.getElementById("createNewDiagramBtn");
    
        if(window.initDiagram) {
            window.initDiagram();
        }

        if (saveBtn) saveBtn.addEventListener("click", handleSaveDiagram);
        
        // Listener for Manual Traceroute
        if (tracerouteBtn) tracerouteBtn.addEventListener("click", async () => {
             if(window.startTracerouteMode) {
                 window.startTracerouteMode(); 
                 await updateUserActivity(); 
             }
        });

        // Listener for Automatic Realtime Simulation
        if (realtimeBtn) realtimeBtn.addEventListener("click", async () => {
            if(window.startRealtimeSim) {
                window.startRealtimeSim(); 
                await updateUserActivity(); 
            }
       });

        if (createNewBtn) createNewBtn.addEventListener("click", () => {
             if(window.initDiagram) window.initDiagram();
        });
        
        const urlParams = new URLSearchParams(window.location.search);
        const loadId = urlParams.get('load');
        if (loadId && window.loadDiagramModel) {
            loadDiagramFromFirebase(loadId);
        }
    }
});

function insertNavbar(currentPage) {
    const displayName = currentUser && currentUser.displayName ? currentUser.displayName : (currentUser ? currentUser.email.split('@')[0] : 'User');
    const navHTML = `
        <header class="navbar-header">
            <div class="logo-group">
                <i class="fas fa-route logo-icon"></i>
                <span class="logo-text">RouteVision</span>
            </div>
            <nav class="main-nav">
                <a href="homepage.html" class="nav-link ${currentPage.includes('homepage') ? 'active' : ''}">
                    <i class="fas fa-home"></i> HOME
                </a>
                <a href="about.html" class="nav-link ${currentPage.includes('about') ? 'active' : ''}">
                    <i class="fas fa-info-circle"></i> ABOUT
                </a>
                <a href="services.html" class="nav-link ${currentPage.includes('services') ? 'active' : ''}">
                    <i class="fas fa-tools"></i> SERVICES
                </a>
            </nav>
            <div class="user-control">
                <button class="user-avatar-btn" id="userAvatarBtn">
                    <i class="fas fa-user-circle"></i>
                    <span id="userProfileName">${displayName}</span>
                </button>
                <div class="dropdown-menu" id="userDropdown">
                    <button onclick="handleLogout()" class="dropdown-item">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        </header>
    `;
    document.body.insertAdjacentHTML('afterbegin', navHTML);
    
    const avatarBtn = document.getElementById("userAvatarBtn");
    const dropdown = document.getElementById("userDropdown");
    if (avatarBtn && dropdown) {
        avatarBtn.addEventListener('click', () => dropdown.classList.toggle('show'));
        document.addEventListener('click', (e) => {
            if (!avatarBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }
}

async function updateUserActivity() {
    if (!currentUser) return;
    try {
        const userRef = doc(db, "users", currentUser.uid);
        await setDoc(userRef, {
            email: currentUser.email,
            lastActive: serverTimestamp()
        }, { merge: true }); 
    } catch (e) { console.error("Activity Error:", e); }
}

// --- RECORD SIMULATION SUCCESS ---
window.recordSimulationSuccess = async function() {
    if (!currentUser) return;
    try {
        const userRef = doc(db, "users", currentUser.uid);
        await setDoc(userRef, {
            lastSimulationSuccess: serverTimestamp()
        }, { merge: true });
        console.log("Recorded Simulation Success");
    } catch (e) { console.error("Error recoding sim success:", e); }
};

// --- GLOBAL MODAL HELPERS ---
window.closeAllModals = function() {
    document.querySelectorAll('.config-modal-overlay').forEach(el => el.style.display = 'none');
    document.getElementById('save-diagram-title').value = ''; 
};

// --- SAVE LOGIC ---
function handleSaveDiagram() {
    if (!currentUser) return alert("Log in to save.");
    if (!window.getDiagramJSON) return;
    
    window.closeAllModals();
    const modal = document.getElementById('saveProjectModal');
    const input = document.getElementById('save-diagram-title');
    
    modal.style.display = 'flex';
    input.focus();

    input.onkeydown = (e) => { if (e.key === "Enter") executeSaveProcess(); };

    const confirmBtn = document.getElementById('confirmSaveBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', executeSaveProcess);
}

async function executeSaveProcess() {
    const titleInput = document.getElementById('save-diagram-title');
    const diagramTitle = titleInput.value.trim();
    if (!diagramTitle) { alert("Please enter a title."); return; }

    window.closeAllModals();

    const progressModal = document.getElementById('saveProgressModal');
    const circle = document.getElementById('saveProgressCircle');
    const text = document.getElementById('saveProgressText');
    const status = document.getElementById('saveProgressStatus');
    
    progressModal.style.display = 'flex';
    progressModal.classList.remove('progress-complete'); 
    
    let percentage = 0;
    const interval = setInterval(async () => {
        percentage += Math.floor(Math.random() * 6) + 3; 
        
        if (percentage > 90) {
            clearInterval(interval);
            status.innerText = "Writing to database...";
            
            try {
                const modelData = window.getDiagramJSON(); 
                const nodeCount = JSON.parse(modelData).nodeDataArray.length;
                const diagramsRef = collection(db, "users", currentUser.uid, "diagrams");
                
                await addDoc(diagramsRef, {
                    title: diagramTitle,
                    modelData: modelData,
                    nodeCount: nodeCount,
                    updatedAt: serverTimestamp()
                });
                await updateUserActivity();
                
                // Finish
                text.innerText = "100%";
                status.innerText = "Save Complete!";
                progressModal.classList.add('progress-complete');
                circle.style.background = `conic-gradient(var(--neon-green) 360deg, #1e293b 0deg)`;
                
                loadSavedDiagramsList();
                
                setTimeout(() => {
                    progressModal.style.display = 'none';
                    const msg = document.getElementById("simulationMessage");
                    if(msg) {
                        msg.innerText = `Project "${diagramTitle}" saved.`;
                        msg.style.color = "var(--neon-green)";
                    }
                }, 1200);

            } catch (e) {
                progressModal.style.display = 'none';
                alert("Error: " + e.message);
            }
        } else {
            text.innerText = percentage + "%";
            circle.style.background = `conic-gradient(var(--neon-purple) ${percentage * 3.6}deg, #1e293b 0deg)`;
            if(percentage > 30) status.innerText = "Serializing topology...";
            if(percentage > 60) status.innerText = "Compressing nodes...";
        }
    }, 30); 
}

// --- LOAD LOGIC ---
function handleConfirmLoad(docId) {
    pendingLoadId = docId;
    window.closeAllModals();
    document.getElementById('loadConfirmModal').style.display = 'flex';
    
    const confirmBtn = document.getElementById('confirmLoadBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.addEventListener('click', () => {
        window.closeAllModals();
        loadDiagramFromFirebase(pendingLoadId);
    });
}

// --- DELETE LOGIC ---
function handleConfirmDelete(docId) {
    pendingDeleteId = docId;
    window.closeAllModals();
    document.getElementById('deleteConfirmModal').style.display = 'flex';
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.addEventListener('click', executeDeleteProcess);
}

async function executeDeleteProcess() {
    window.closeAllModals();
    
    const progressModal = document.getElementById('deleteProgressModal');
    const circle = document.getElementById('deleteProgressCircle');
    const text = document.getElementById('deleteProgressText');
    const status = document.getElementById('deleteProgressStatus');

    progressModal.style.display = 'flex';
    progressModal.classList.remove('progress-complete'); 

    let percentage = 0;
    const interval = setInterval(async () => {
        percentage += Math.floor(Math.random() * 8) + 4; 
        
        if (percentage > 90) {
            clearInterval(interval);
            status.innerText = "Removing from database...";
            
            try {
                await deleteDoc(doc(db, "users", currentUser.uid, "diagrams", pendingDeleteId));
                await updateUserActivity(); 
                
                text.innerText = "100%";
                status.innerText = "Deleted Successfully.";
                progressModal.classList.add('progress-complete');
                circle.style.background = `conic-gradient(var(--neon-green) 360deg, #1e293b 0deg)`;

                loadSavedDiagramsList();

                setTimeout(() => {
                    progressModal.style.display = 'none';
                }, 1200);

            } catch (e) {
                progressModal.style.display = 'none';
                alert("Delete failed: " + e.message);
            }
        } else {
            text.innerText = percentage + "%";
            // Red gradient for delete
            circle.style.background = `conic-gradient(var(--neon-red) ${percentage * 3.6}deg, #1e293b 0deg)`;
            if(percentage > 40) status.innerText = "Cleaning records...";
        }
    }, 40);
}

// --- DIAGRAM LIST MANAGEMENT ---
async function loadSavedDiagramsList() {
    const listContainer = document.getElementById("savedDiagramsList");
    if (!listContainer || !currentUser) return;
    listContainer.innerHTML = '<p style="color:#ccc">Loading...</p>';

    try {
        const q = query(
            collection(db, "users", currentUser.uid, "diagrams"),
            orderBy("updatedAt", "desc")
        );
        const querySnapshot = await getDocs(q);

        listContainer.innerHTML = '';
        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p style="color: #6b7280;">No diagrams saved.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dateStr = data.updatedAt ? data.updatedAt.toDate().toLocaleDateString() : 'N/A';
            
            const card = document.createElement('div');
            card.className = 'saved-diagram-card';
            
            card.innerHTML = `
                <div class="card-glow-effect"></div>
                <div class="card-content-wrapper">
                    <p class="diagram-title">${data.title}</p>
                    <p class="diagram-meta"><i class="fas fa-microchip"></i> ${data.nodeCount} Devices &nbsp;|&nbsp; <i class="far fa-calendar-alt"></i> ${dateStr}</p>
                    <div class="diagram-actions">
                        <button class="load-btn" data-id="${docSnap.id}">
                            <i class="fas fa-edit"></i> Edit / Load
                        </button>
                        <button class="delete-btn" data-id="${docSnap.id}">
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            listContainer.appendChild(card);
        });

        // Attach listeners that open modals instead of native confirms
        document.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleConfirmLoad(e.currentTarget.dataset.id));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleConfirmDelete(e.currentTarget.dataset.id));
        });

        const totalEl = document.getElementById('totalDiagrams');
        if (totalEl) totalEl.innerText = querySnapshot.size;

    } catch (e) { console.error(e); }
}

async function loadDiagramFromFirebase(docId) {
    if(!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "diagrams", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(window.loadDiagramModel) {
                window.loadDiagramModel(data.modelData);
                const msg = document.getElementById("simulationMessage");
                if (msg) {
                    msg.innerText = `Loaded: ${data.title}`;
                    msg.style.color = "#3b82f6";
                }
            }
        }
    } catch(e) { console.error(e); }
}

// --- UPDATED DASHBOARD METRICS ---
async function displayDashboardMetrics() {
    if (!currentUser) return;
    const q = query(collection(db, "users", currentUser.uid, "diagrams"));
    const snapshot = await getDocs(q);
    const totalProjects = snapshot.size;
    let totalDevices = 0;
    snapshot.forEach(doc => totalDevices += (doc.data().nodeCount || 0));

    const projectsEl = document.getElementById('dashTotalSaved');
    if (projectsEl) projectsEl.textContent = totalProjects;

    const devicesEl = document.getElementById('dashActiveDevices');
    if (devicesEl) devicesEl.textContent = totalDevices; 
   
    // Fetch User Profile for Activity & Sim Success
    const userDocRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userDocRef);
    
    // 1. Handle Last Activity
    const activityEl = document.getElementById('dashLastActivity');
    if (activityEl) {
        let lastActiveDate = null;
        if (userSnap.exists() && userSnap.data().lastActive) {
            lastActiveDate = userSnap.data().lastActive.toDate();
        } else {
            lastActiveDate = new Date();
        }
        updateTimeText(activityEl, lastActiveDate);
        if (activityTimer) clearInterval(activityTimer);
        activityTimer = setInterval(() => updateTimeText(activityEl, lastActiveDate), 60000);
    }

    // 2. Handle Last Simulation Success (NEW)
    const simSuccessEl = document.getElementById('dashLastSim');
    if (simSuccessEl && userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.lastSimulationSuccess) {
            const simDate = userData.lastSimulationSuccess.toDate();
            // Format nicely: "Dec 6, 6:30 PM"
            const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            simSuccessEl.textContent = simDate.toLocaleDateString('en-US', options);
            simSuccessEl.style.fontSize = "1.6rem";
        } else {
            simSuccessEl.textContent = "N/A";
        }
    }
}

// Helper for relative time text
function updateTimeText(element, date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    let text = "Just Now";
    if (diffInSeconds >= 60 && diffInSeconds < 3600) {
        const mins = Math.floor(diffInSeconds / 60);
        text = `${mins} min${mins > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds >= 3600 && diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        text = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds >= 86400) {
        text = date.toLocaleDateString();
    }
    element.innerText = text;
    if (text.length > 10) element.style.fontSize = "1.4rem";
}

function insertFooter() {
    const footerHTML = `
        <footer class="main-footer">
            <div class="footer-left">
                <span class="footer-copy">&copy; 2025 RouteVision App</span>
                <span class="footer-separator">|</span>
                <span class="footer-tagline">Web Based Network Visualization</span>
            </div>
            
            <div class="footer-center">
                <a href="#" class="footer-link"><i class="fab fa-github"></i></a>
                <a href="#" class="footer-link"><i class="fab fa-discord"></i></a>
                <span class="footer-version"><i class="fas fa-code-branch"></i> v1.0 (Stable)</span>
            </div>

            <div class="footer-right">
                <div class="system-status">
                    <span class="status-dot"></span>
                    <span class="status-text">SYSTEM OPERATIONAL</span>
                </div>
            </div>
        </footer>
    `;
    document.body.insertAdjacentHTML('beforeend', footerHTML);
}

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('toggle-password')) {
        const input = e.target.previousElementSibling.previousElementSibling || e.target.parentElement.querySelector('input');
        if (input && (input.type === 'password' || input.type === 'text')) {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            e.target.classList.toggle('fa-eye');
            e.target.classList.toggle('fa-eye-slash');
        }
    }
});