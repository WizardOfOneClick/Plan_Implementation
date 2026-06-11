const app = {
    state: {
        users: JSON.parse(localStorage.getItem('users')) || [
            { id: 1, name: 'Main Manager', username: 'admin', roleId: 'r-admin', password: '123' },
            { id: 2, name: 'Standard User', username: 'user', roleId: 'r-user', password: '123' },
            { id: 3, name: 'Janab', username: 'janab', roleId: 'r-admin', password: '123' }
        ],
        roles: JSON.parse(localStorage.getItem('roles')) || [
            { id: 'r-admin', name: 'Manager', type: 'admin' },
            { id: 'r-user', name: 'Staff', type: 'user' }
        ],
        plans: JSON.parse(localStorage.getItem('plans')) || [],
        notifications: JSON.parse(localStorage.getItem('notifications')) || [],
        currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
        activeView: 'dashboard',
        selectedPlanId: null
    },

    init() {
        if (this.state.currentUser) {
            this.showApp();
        }
        this.render();
        lucide.createIcons();
    },

    save() {
        localStorage.setItem('users', JSON.stringify(this.state.users));
        localStorage.setItem('roles', JSON.stringify(this.state.roles));
        localStorage.setItem('plans', JSON.stringify(this.state.plans));
        localStorage.setItem('notifications', JSON.stringify(this.state.notifications));
        localStorage.setItem('currentUser', JSON.stringify(this.state.currentUser));
    },

    getRole(roleId) {
        return this.state.roles.find(r => r.id === roleId) || { name: 'Unknown', type: 'user' };
    },

    isAdmin() {
        const role = this.getRole(this.state.currentUser?.roleId);
        return role.type === 'admin' || this.state.currentUser?.name === 'Janab';
    },

    login() {
        const userInput = document.getElementById('login-username').value;
        const passInput = document.getElementById('login-password').value;
        const user = this.state.users.find(u => u.username === userInput && u.password === (passInput || '123'));

        if (user) {
            this.state.currentUser = user;
            this.save();
            this.showApp();
            this.showToast(`Welcome back, ${user.name}!`);
        } else {
            alert('Invalid credentials.');
        }
    },

    logout() {
        this.state.currentUser = null;
        this.save();
        location.reload();
    },

    showApp() {
        document.getElementById('view-login').classList.remove('active');
        document.getElementById('app').style.display = 'block';
        const admin = this.isAdmin();
        document.getElementById('nav-approvals').style.display = admin ? 'flex' : 'none';
        document.getElementById('nav-management').style.display = admin ? 'flex' : 'none';
        document.getElementById('fab-add-plan').style.display = admin ? 'none' : 'flex';
        this.switchView('dashboard');
    },

    switchView(viewId) {
        this.state.activeView = viewId;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.getElementById(`nav-${viewId}`);
        if (navItem) navItem.classList.add('active');

        const role = this.getRole(this.state.currentUser.roleId);
        const titles = {
            dashboard: role.type === 'admin' ? 'Managed Plans' : 'My Plans',
            approvals: 'Review Queue',
            management: 'Management Console',
            notifications: 'Notifications'
        };
        document.getElementById('view-title').innerText = titles[viewId];
        this.render();
    },

    showAddPlanModal() { this.openModal('form-add-plan'); },
    showAddUserModal() { this.openModal('form-add-user'); },
    showAddRoleModal() { this.openModal('form-add-role'); },

    submitPlan() {
        const title = document.getElementById('plan-title').value;
        const cost = parseFloat(document.getElementById('plan-cost').value);
        const desc = document.getElementById('plan-desc').value;

        if (!title || isNaN(cost)) return alert('Fill title and valid cost');

        const newPlan = {
            id: Date.now(),
            requesterId: this.state.currentUser.id,
            requesterName: this.state.currentUser.name,
            title,
            cost: cost,
            description: desc,
            status: 'pending',
            reviews: [], // Array of { adminName, remarks, status, timestamp }
            timestamp: new Date().toLocaleString()
        };

        this.state.plans.push(newPlan);
        this.addNotification('admin-type', `New plan request: ${title}`);
        this.save();
        this.closeModal();
        this.render();
        this.showToast('Plan submitted!');
    },

    processApproval(statusType) {
        const plan = this.state.plans.find(p => p.id === this.state.selectedPlanId);
        const remarks = document.getElementById('approval-remarks').value;

        if (!plan) return;

        // Restriction Logic
        const isHighCost = plan.cost > 25000;
        const isJanab = this.state.currentUser.name === 'Janab';

        if (isHighCost && !isJanab && statusType !== 'remark') {
            return alert('This plan exceeds $25,000 and can only be final-approved or rejected by Janab. You may only add remarks.');
        }

        // Add Review
        plan.reviews.push({
            adminName: this.state.currentUser.name,
            remarks: remarks || '(No remarks provided)',
            status: statusType,
            timestamp: new Date().toLocaleString()
        });

        // Finalize status if permitted
        if (statusType !== 'remark') {
            if (!isHighCost || isJanab) {
                plan.status = statusType === 'approve' ? 'approved' : 'rejected';
                this.addNotification(plan.requesterId, `Your plan "${plan.title}" was ${plan.status}.`);
            }
        }

        this.save();
        this.closeModal();
        this.render();
        this.showToast(statusType === 'remark' ? 'Remark added!' : `Plan ${plan.status}!`);
    },

    addUser() {
        const name = document.getElementById('new-user-name').value;
        const username = document.getElementById('new-user-username').value;
        const roleId = document.getElementById('new-user-role').value;
        if (!name || !username) return alert('Required fields');

        this.state.users.push({ id: Date.now(), name, username, roleId, password: '123' });
        this.save(); this.closeModal(); this.render();
        this.showToast(`User ${name} created!`);
    },

    addRole() {
        const name = document.getElementById('role-name').value;
        const type = document.getElementById('role-type').value;
        if (!name) return alert('Role name required');

        this.state.roles.push({ id: 'r-' + Date.now(), name, type });
        this.save(); this.closeModal(); this.render();
        this.showToast(`Role ${name} created!`);
    },

    addNotification(target, message) {
        const notification = {
            id: Date.now(), message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), read: false
        };
        if (target === 'admin-type') notification.targetType = 'admin';
        else notification.targetUserId = target;
        this.state.notifications.unshift(notification);
    },

    render() {
        if (!this.state.currentUser) return;
        const isAdmin = this.isAdmin();
        
        // Update Lists
        this.renderPlans(isAdmin);
        this.renderApprovals();
        this.renderManagement();
        this.renderNotifications();

        // Update Role Select
        const userRoleSelect = document.getElementById('new-user-role');
        if (userRoleSelect) {
            userRoleSelect.innerHTML = this.state.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        }
        lucide.createIcons();
    },

    renderPlans(isAdmin) {
        const list = document.getElementById('my-plans-list');
        if (!list) return;
        const filtered = isAdmin ? this.state.plans : this.state.plans.filter(p => p.requesterId === this.state.currentUser.id);
        list.innerHTML = filtered.length ? '' : '<p class="empty-state">No plans.</p>';
        filtered.sort((a,b) => b.id - a.id).forEach(p => {
            list.innerHTML += this.templatePlan(p);
        });
    },

    templatePlan(p) {
        const remarksHtml = p.reviews.map(r => `
            <div style="font-size:11px; margin-top:5px; border-top:1px solid var(--border); padding-top:5px;">
                <b>${r.adminName}:</b> ${r.remarks} <span style="font-size:9px; opacity:0.6">(${r.status})</span>
            </div>
        `).join('');

        return `
            <div class="plan-card">
                <div class="plan-header">
                    <div>
                        <div class="plan-title">${p.title}</div>
                        <div style="font-size:12px; opacity:0.6">${p.requesterName} • ${p.timestamp}</div>
                    </div>
                    <div class="plan-cost">$${p.cost.toLocaleString()}</div>
                </div>
                <div style="margin:10px 0; font-size:14px;">${p.description}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="status-badge status-${p.status}">${p.status.toUpperCase()}</span>
                </div>
                <div class="remarks-history">${remarksHtml}</div>
            </div>
        `;
    },

    renderApprovals() {
        const list = document.getElementById('pending-approvals-list');
        if (!list) return;
        const pending = this.state.plans.filter(p => p.status === 'pending');
        list.innerHTML = pending.length ? '' : '<p class="empty-state">No reviews needed.</p>';
        pending.forEach(p => {
            list.innerHTML += `
                <div class="plan-card" onclick="app.showReviewModal(${p.id})">
                    <div class="plan-header">
                        <div class="plan-title">${p.title}</div>
                        <div class="plan-cost">$${p.cost.toLocaleString()}</div>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted)">By ${p.requesterName}</div>
                    <div style="margin-top:10px; color:var(--primary); font-size:12px; font-weight:600">Review Application →</div>
                </div>
            `;
        });
    },

    renderManagement() {
        const uList = document.getElementById('users-list');
        const rList = document.getElementById('roles-list');
        if (uList) {
            uList.innerHTML = this.state.users.map(u => `
                <div class="plan-card user-card">
                    <div><div style="font-weight:600">${u.name}</div><div style="font-size:12px; opacity:0.6">@${u.username}</div></div>
                    <div class="status-badge" style="background:rgba(99,102,241,0.1); color:var(--primary)">${this.getRole(u.roleId).name}</div>
                </div>
            `).join('');
        }
        if (rList) {
            rList.innerHTML = this.state.roles.map(r => `
                <div class="plan-card user-card">
                    <div style="font-weight:600">${r.name}</div>
                    <div class="status-badge ${r.type === 'admin' ? 'status-approved' : 'status-pending'}">${r.type}</div>
                </div>
            `).join('');
        }
    },

    renderNotifications() {
        const list = document.getElementById('notifications-list');
        if (!list) return;
        const role = this.getRole(this.state.currentUser.roleId);
        const myNotifs = this.state.notifications.filter(n => (role.type === 'admin' && n.targetType === 'admin') || n.targetUserId === this.state.currentUser.id);
        list.innerHTML = myNotifs.length ? '' : '<p class="empty-state">No alerts.</p>';
        myNotifs.forEach(n => {
            list.innerHTML += `<div class="plan-card" style="border-left:4px solid var(--primary); padding:10px;"><div style="font-size:14px;">${n.message}</div><div style="font-size:11px; opacity:0.6">${n.timestamp}</div></div>`;
        });
    },

    openModal(formId) {
        document.getElementById('modal-container').classList.add('active');
        ['form-add-plan', 'form-approve-plan', 'form-add-user', 'form-add-role'].forEach(id => document.getElementById(id).style.display = 'none');
        document.getElementById(formId).style.display = 'block';
    },

    closeModal() { document.getElementById('modal-container').classList.remove('active'); },

    showReviewModal(planId) {
        this.state.selectedPlanId = planId;
        const plan = this.state.plans.find(p => p.id === planId);
        const isHighCost = plan.cost > 25000;
        const isJanab = this.state.currentUser.name === 'Janab';

        const historyHtml = plan.reviews.map(r => `
            <div style="font-size:12px; margin-bottom:10px; padding:8px; background:rgba(0,0,0,0.2); border-radius:8px;">
                <b style="color:var(--primary)">${r.adminName} (${r.status}):</b> ${r.remarks}
            </div>
        `).join('');

        document.getElementById('review-plan-details').innerHTML = `
            <div style="font-weight:700; font-size:18px;">${plan.title}</div>
            <div style="color:var(--secondary); font-weight:700; margin: 5px 0;">Cost: $${plan.cost.toLocaleString()}</div>
            ${isHighCost ? '<div style="color:var(--danger); font-size:11px; font-weight:700; margin-bottom:10px;">⚠️ HIGH BUDGET: FINAL APPROVAL BY JANAB ONLY</div>' : ''}
            <div style="font-size:14px; opacity:0.8; margin-bottom:15px;">${plan.description}</div>
            <div style="border-top:1px solid var(--border); padding-top:15px;">
                <label style="font-size:10px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:10px;">PREVIOUS REMARKS</label>
                ${historyHtml || '<p style="font-size:12px; opacity:0.5;">No previous remarks.</p>'}
            </div>
        `;

        // Update buttons based on permissions
        const btnContainer = document.getElementById('approval-buttons');
        if (isHighCost && !isJanab) {
            btnContainer.innerHTML = `<button class="btn btn-primary" onclick="app.processApproval('remark')">Add Remark Only</button>`;
        } else {
            btnContainer.innerHTML = `
                <button class="btn btn-primary" style="flex:2;" onclick="app.processApproval('approve')">Approve Final</button>
                <button class="btn" style="flex:1; border:1px solid var(--danger); color:var(--danger);" onclick="app.processApproval('reject')">Reject</button>
                <button class="btn" style="flex:1; border:1px solid var(--border);" onclick="app.processApproval('remark')">Note</button>
            `;
        }

        this.openModal('form-approve-plan');
    },

    showToast(msg) {
        const toast = document.getElementById('notification-toast');
        document.getElementById('toast-message').innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

window.onload = () => app.init();
