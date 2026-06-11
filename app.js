const app = {
    state: {
        users: JSON.parse(localStorage.getItem('users')) || [
            { id: 1, name: 'Main Manager', username: 'admin', roleId: 'r-admin', password: '123' },
            { id: 2, name: 'Standard User', username: 'user', roleId: 'r-user', password: '123' },
            { id: 3, name: 'Janab', username: 'janab', roleId: 'r-janab', password: '123' }
        ],
        roles: JSON.parse(localStorage.getItem('roles')) || [
            { id: 'r-admin', name: 'Manager', type: 'admin' },
            { id: 'r-janab', name: 'Janab', type: 'janab' },
            { id: 'r-user', name: 'Staff', type: 'user' }
        ],
        plans: JSON.parse(localStorage.getItem('plans')) || [],
        notifications: JSON.parse(localStorage.getItem('notifications')) || [],
        currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
        activeView: 'dashboard',
        selectedPlanId: null,
        viewingPlanId: null,
        editingUserId: null
    },

    init() {
        this.migrateJanabRole();
        if (this.state.currentUser) {
            this.showApp();
        }
        this.render();
        lucide.createIcons();
    },

    migrateJanabRole() {
        let changed = false;
        if (!this.state.roles.some(r => r.type === 'janab')) {
            this.state.roles.push({ id: 'r-janab', name: 'Janab', type: 'janab' });
            changed = true;
        }
        const janabUser = this.state.users.find(u => u.username === 'janab' || u.name === 'Janab');
        if (janabUser && this.getRole(janabUser.roleId).type !== 'janab') {
            janabUser.roleId = 'r-janab';
            changed = true;
        }
        if (changed) this.save();
    },

    save() {
        localStorage.setItem('users', JSON.stringify(this.state.users));
        localStorage.setItem('roles', JSON.stringify(this.state.roles));
        localStorage.setItem('plans', JSON.stringify(this.state.plans));
        localStorage.setItem('notifications', JSON.stringify(this.state.notifications));
        localStorage.setItem('currentUser', JSON.stringify(this.state.currentUser));
        this.savePlansLog();
    },

    buildPlansLogText() {
        const lines = [
            '========================================',
            'PLAN APPROVAL SYSTEM - VERIFICATION LOG',
            `Last Updated: ${new Date().toLocaleString()}`,
            `Total Plans: ${this.state.plans.length}`,
            '========================================',
            ''
        ];

        [...this.state.plans].sort((a, b) => b.id - a.id).forEach((plan, index) => {
            lines.push(`--- PLAN ${index + 1} ---`);
            lines.push(`ID: ${plan.id}`);
            lines.push(`Title: ${plan.title}`);
            lines.push(`Requester: ${plan.requesterName}`);
            lines.push(`Budget: PKR ${plan.cost.toLocaleString()}`);
            lines.push(`Status: ${(plan.status || 'pending').toUpperCase()}`);
            lines.push(`Submitted: ${plan.timestamp}`);
            lines.push(`Description: ${plan.description || 'N/A'}`);

            const reviews = this.getPlanReviews(plan);
            if (reviews.length) {
                lines.push('Reviews:');
                reviews.forEach(r => {
                    lines.push(`  - ${r.adminName} (${r.status}): ${r.remarks} [${r.timestamp || ''}]`);
                });
            } else {
                lines.push('Reviews: None');
            }
            lines.push('');
        });

        if (!this.state.plans.length) {
            lines.push('No plans recorded yet.');
        }

        return lines.join('\n');
    },

    async savePlansLog() {
        const text = this.buildPlansLogText();
        try {
            const res = await fetch('/api/plans/save', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                body: text
            });
            return res.ok;
        } catch (_) {
            return false;
        }
    },

    downloadPlansLog(text) {
        const logText = text || this.buildPlansLogText();
        const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plans-log.txt';
        link.click();
        URL.revokeObjectURL(url);
    },

    getRole(roleId) {
        return this.state.roles.find(r => r.id === roleId) || { name: 'Unknown', type: 'user' };
    },

    isAdmin() {
        const role = this.getRole(this.state.currentUser?.roleId);
        return role.type === 'admin' || role.type === 'janab';
    },

    isJanab() {
        const role = this.getRole(this.state.currentUser?.roleId);
        return role.type === 'janab' || this.state.currentUser?.name === 'Janab';
    },

    isJanabAccount(user) {
        const role = this.getRole(user?.roleId);
        return role.type === 'janab' || user?.name === 'Janab' || user?.username === 'janab';
    },

    isRegularAdmin() {
        const role = this.getRole(this.state.currentUser?.roleId);
        return role.type === 'admin';
    },

    canManageUserPassword(user) {
        if (this.isRegularAdmin()) return true;
        if (this.isJanab() && Number(user.id) === Number(this.state.currentUser?.id)) return true;
        return false;
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
        document.getElementById('fab-add-plan').style.display = 'flex';
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
            dashboard: this.isAdmin() ? 'Managed Plans' : 'My Plans',
            approvals: this.isJanab() ? 'Review & Override Queue' : 'Review Queue',
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

        if (Number(plan.requesterId) === Number(this.state.currentUser.id)) {
            return alert('You cannot approve or reject your own plan. It must be reviewed by Janab or another admin.');
        }

        if (!plan.reviews) plan.reviews = [];

        const isHighCost = plan.cost > 25000;
        const isJanab = this.isJanab();
        const previousStatus = plan.status;
        const isOverride = isJanab && (previousStatus === 'approved' || previousStatus === 'rejected');

        if (isHighCost && !isJanab && statusType !== 'remark') {
            return alert('This plan exceeds PKR 25,000 and can only be final-approved or rejected by Janab. You may only add remarks.');
        }

        plan.reviews.push({
            adminName: this.state.currentUser.name,
            remarks: remarks || '(No remarks provided)',
            status: isOverride ? `override-${statusType}` : statusType,
            timestamp: new Date().toLocaleString()
        });

        if (statusType !== 'remark') {
            if (!isHighCost || isJanab) {
                plan.status = statusType === 'approve' ? 'approved' : 'rejected';
                const message = isOverride
                    ? `Janab overrode the admin decision on "${plan.title}" — now ${plan.status} (was ${previousStatus}).`
                    : `Your plan "${plan.title}" was ${plan.status}.`;
                this.addNotification(plan.requesterId, message);
            }
        }

        this.save();
        this.closeModal();
        this.render();
        if (statusType === 'remark') {
            this.showToast('Remark added!');
        } else if (isOverride) {
            this.showToast(`Admin decision overwritten — plan is now ${plan.status}.`);
        } else {
            this.showToast(`Plan ${plan.status}!`);
        }
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

    showEditPasswordModal(userId) {
        const user = this.state.users.find(u => u.id === userId);
        if (!user || !this.canManageUserPassword(user)) {
            return alert('You cannot modify this account\'s password.');
        }

        this.state.editingUserId = userId;
        document.getElementById('edit-password-user-label').textContent = `Account: ${user.name} (@${user.username})`;
        document.getElementById('edit-password-value').value = user.password || '';
        this.openModal('form-edit-password');
    },

    savePassword() {
        const user = this.state.users.find(u => u.id === this.state.editingUserId);
        const password = document.getElementById('edit-password-value').value.trim();

        if (!user || !this.canManageUserPassword(user)) {
            return alert('You cannot modify this account\'s password.');
        }
        if (!password) return alert('Password cannot be empty.');

        user.password = password;
        this.save();
        this.closeModal();
        this.render();
        this.showToast(`Password updated for ${user.name}.`);
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
        const approvedList = document.getElementById('approved-plans-list');
        const pendingList = document.getElementById('pending-plans-list');
        const rejectedList = document.getElementById('rejected-plans-list');
        if (!approvedList || !pendingList || !rejectedList) return;

        const filtered = isAdmin
            ? this.state.plans
            : this.state.plans.filter(p => Number(p.requesterId) === Number(this.state.currentUser.id));

        const sortNewest = (a, b) => b.id - a.id;
        const byStatus = status => filtered.filter(p => (p.status || 'pending') === status).sort(sortNewest);

        const renderSection = (list, plans, emptyMsg) => {
            list.innerHTML = plans.length
                ? plans.map(p => this.templatePlan(p)).join('')
                : `<p class="empty-state">${emptyMsg}</p>`;
        };

        renderSection(approvedList, byStatus('approved'), 'No approved plans.');
        renderSection(pendingList, byStatus('pending'), 'No pending plans.');
        renderSection(rejectedList, byStatus('rejected'), 'No rejected plans.');
    },

    getPlanReviews(plan) {
        return plan.reviews || [];
    },

    escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    formatPlanPrintHtml(plan) {
        const reviews = this.getPlanReviews(plan);
        const cost = Number(plan.cost) || 0;
        const status = (plan.status || 'pending').toUpperCase();
        const reviewsTable = reviews.length
            ? `<table>
                <thead><tr><th>Reviewer</th><th>Action</th><th>Remarks</th><th>Date</th></tr></thead>
                <tbody>${reviews.map(r => `
                    <tr>
                        <td>${this.escapeHtml(r.adminName)}</td>
                        <td>${this.escapeHtml(r.status)}</td>
                        <td>${this.escapeHtml(r.remarks)}</td>
                        <td>${this.escapeHtml(r.timestamp || '')}</td>
                    </tr>
                `).join('')}</tbody>
               </table>`
            : '<p>No reviews recorded.</p>';

        return `
            <div class="print-page">
                <div class="print-header">
                    <h1>Plan Application Record</h1>
                    <p>Plan Approval System — Official Document</p>
                </div>
                <dl class="print-meta">
                    <div><dt>Plan Title</dt><dd>${this.escapeHtml(plan.title || 'Untitled Plan')}</dd></div>
                    <div><dt>Reference ID</dt><dd>${plan.id}</dd></div>
                    <div><dt>Requester</dt><dd>${this.escapeHtml(plan.requesterName || 'Unknown')}</dd></div>
                    <div><dt>Submitted</dt><dd>${this.escapeHtml(plan.timestamp || 'N/A')}</dd></div>
                    <div><dt>Budget (PKR)</dt><dd>${cost.toLocaleString()}</dd></div>
                    <div><dt>Status</dt><dd><span class="print-status">${status}</span></dd></div>
                </dl>
                <div class="print-section">
                    <h2>Description / Justification</h2>
                    <p>${this.escapeHtml(plan.description || 'No description provided.')}</p>
                </div>
                <div class="print-section print-reviews">
                    <h2>Review History</h2>
                    ${reviewsTable}
                </div>
                <div class="print-footer">
                    Printed on ${new Date().toLocaleString()} — A4 Format
                </div>
            </div>
        `;
    },

    printPlan() {
        const plan = this.state.plans.find(p => p.id === this.state.viewingPlanId);
        if (!plan) return;

        const sheet = document.getElementById('plan-print-sheet');
        if (!sheet) return;

        sheet.innerHTML = this.formatPlanPrintHtml(plan);
        sheet.setAttribute('aria-hidden', 'false');
        window.print();
        sheet.setAttribute('aria-hidden', 'true');
    },

    formatPlanDetailsHtml(plan, { showHighCostWarning = false } = {}) {
        const reviews = this.getPlanReviews(plan);
        const cost = Number(plan.cost) || 0;
        const status = plan.status || 'pending';
        const isHighCost = cost > 25000;
        const historyHtml = reviews.map(r => `
            <div style="font-size:12px; margin-bottom:10px; padding:8px; background:rgba(0,0,0,0.2); border-radius:8px;">
                <b style="color:var(--primary)">${r.adminName} (${r.status}):</b> ${r.remarks}
                <div style="font-size:10px; opacity:0.6; margin-top:4px;">${r.timestamp || ''}</div>
            </div>
        `).join('');

        return `
            <div style="font-weight:700; font-size:18px;">${plan.title || 'Untitled Plan'}</div>
            <div style="font-size:12px; opacity:0.6; margin: 6px 0;">${plan.requesterName || 'Unknown'} • ${plan.timestamp || ''}</div>
            <div style="color:var(--secondary); font-weight:700; margin: 5px 0;">Budget: PKR ${cost.toLocaleString()}</div>
            <span class="status-badge status-${status}" style="display:inline-block; margin-bottom:12px;">${status.toUpperCase()}</span>
            ${showHighCostWarning && isHighCost ? '<div style="color:var(--danger); font-size:11px; font-weight:700; margin-bottom:10px;">⚠️ HIGH BUDGET: FINAL APPROVAL BY JANAB ONLY</div>' : ''}
            <div style="font-size:14px; line-height:1.5; opacity:0.9; margin-bottom:15px; white-space:pre-wrap;">${plan.description || 'No description provided.'}</div>
            <div style="border-top:1px solid var(--border); padding-top:15px;">
                <label style="font-size:10px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:10px;">REVIEW HISTORY</label>
                ${historyHtml || '<p style="font-size:12px; opacity:0.5;">No reviews yet.</p>'}
            </div>
        `;
    },

    showPlanModal(planId) {
        const plan = this.state.plans.find(p => p.id === planId);
        if (!plan) return;

        this.state.viewingPlanId = planId;
        document.getElementById('view-plan-details').innerHTML = this.formatPlanDetailsHtml(plan);
        this.openModal('form-view-plan');
    },

    templatePlan(p) {
        const reviewCount = this.getPlanReviews(p).length;
        const status = p.status || 'pending';
        const cost = Number(p.cost) || 0;

        return `
            <div class="plan-card plan-card-clickable" onclick="app.showPlanModal(${p.id})">
                <div class="plan-header">
                    <div>
                        <div class="plan-title">${p.title || 'Untitled Plan'}</div>
                        <div style="font-size:12px; opacity:0.6">${p.requesterName || 'Unknown'} • ${p.timestamp || ''}</div>
                    </div>
                    <div class="plan-cost">PKR ${cost.toLocaleString()}</div>
                </div>
                <div class="plan-desc-preview">${p.description || 'No description provided.'}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                    ${reviewCount ? `<span style="font-size:11px; opacity:0.6;">${reviewCount} review${reviewCount > 1 ? 's' : ''}</span>` : ''}
                </div>
                <div class="plan-tap-hint">View details →</div>
            </div>
        `;
    },

    renderApprovals() {
        const list = document.getElementById('pending-approvals-list');
        if (!list) return;

        const isJanab = this.isJanab();
        const isOwnPlan = p => Number(p.requesterId) === Number(this.state.currentUser.id);

        const reviewable = this.state.plans.filter(p => {
            if (isOwnPlan(p)) return false;
            if (p.status === 'pending') return true;
            return isJanab && (p.status === 'approved' || p.status === 'rejected');
        });

        list.innerHTML = reviewable.length ? '' : '<p class="empty-state">No reviews needed.</p>';
        reviewable.forEach(p => {
            const isOverride = p.status === 'approved' || p.status === 'rejected';
            const actionLabel = isOverride ? 'Override Admin Decision' : 'Review Application';
            const statusNote = isOverride
                ? `<span class="status-badge status-${p.status}" style="margin-top:8px; display:inline-block;">Currently ${p.status.toUpperCase()}</span>`
                : '';

            list.innerHTML += `
                <div class="plan-card plan-card-clickable" onclick="app.showReviewModal(${p.id})">
                    <div class="plan-header">
                        <div class="plan-title">${p.title}</div>
                        <div class="plan-cost">PKR ${p.cost.toLocaleString()}</div>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted)">By ${p.requesterName}</div>
                    ${statusNote}
                    <div class="plan-desc-preview">${p.description || 'No description provided.'}</div>
                    <button type="button" class="btn btn-primary" style="margin-top:12px; width:100%;"
                        onclick="event.stopPropagation(); app.showReviewModal(${p.id})">${actionLabel}</button>
                </div>
            `;
        });
    },

    renderManagement() {
        const uList = document.getElementById('users-list');
        const rList = document.getElementById('roles-list');
        if (uList) {
            uList.innerHTML = this.state.users.map(u => {
                const canManage = this.canManageUserPassword(u);
                const passwordRow = canManage
                    ? `<div class="user-password-row">
                        <span>Password: <strong>${u.password || '123'}</strong></span>
                        <button type="button" class="btn-link" onclick="app.showEditPasswordModal(${u.id})">Change</button>
                       </div>`
                    : '';

                return `
                <div class="plan-card user-card">
                    <div class="user-card-main">
                        <div>
                            <div style="font-weight:600">${u.name}</div>
                            <div style="font-size:12px; opacity:0.6">@${u.username}</div>
                            ${passwordRow}
                        </div>
                        <div class="status-badge" style="background:rgba(99,102,241,0.1); color:var(--primary)">${this.getRole(u.roleId).name}</div>
                    </div>
                </div>
            `;
            }).join('');
        }
        if (rList) {
            rList.innerHTML = this.state.roles.map(r => `
                <div class="plan-card user-card">
                    <div style="font-weight:600">${r.name}</div>
                    <div class="status-badge ${r.type === 'janab' ? 'status-approved' : r.type === 'admin' ? 'status-pending' : ''}">${r.type}</div>
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
        ['form-add-plan', 'form-view-plan', 'form-approve-plan', 'form-edit-password', 'form-add-user', 'form-add-role'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
        document.getElementById(formId).style.display = 'block';
    },

    closeModal() { document.getElementById('modal-container').classList.remove('active'); },

    showReviewModal(planId) {
        const plan = this.state.plans.find(p => p.id === planId);
        if (!plan) return;

        if (Number(plan.requesterId) === Number(this.state.currentUser.id)) {
            return alert('You cannot review your own plan. It must be approved by Janab or another admin.');
        }

        this.state.selectedPlanId = planId;
        const isHighCost = plan.cost > 25000;
        const isJanab = this.isJanab();
        const isOverride = isJanab && (plan.status === 'approved' || plan.status === 'rejected');

        document.getElementById('review-plan-details').innerHTML = `
            ${isOverride ? '<div style="color:var(--danger); font-size:12px; font-weight:700; margin-bottom:12px;">⚠️ OVERRIDE: This plan was already decided by an admin. Your decision will replace theirs.</div>' : ''}
            ${this.formatPlanDetailsHtml(plan, { showHighCostWarning: true })}
        `;
        document.getElementById('approval-remarks').value = '';

        const btnContainer = document.getElementById('approval-buttons');
        if (!btnContainer) return;

        if (isHighCost && !isJanab) {
            btnContainer.innerHTML = `<button type="button" class="btn btn-primary" onclick="app.processApproval('remark')">Add Remark Only</button>`;
        } else {
            const approveLabel = isOverride ? 'Override & Approve' : 'Approve';
            const rejectLabel = isOverride ? 'Override & Reject' : 'Reject';
            btnContainer.innerHTML = `
                <button type="button" class="btn btn-primary" style="flex:2;" onclick="app.processApproval('approve')">${approveLabel}</button>
                <button type="button" class="btn" style="flex:1; border:1px solid var(--danger); color:var(--danger);" onclick="app.processApproval('reject')">${rejectLabel}</button>
                <button type="button" class="btn" style="flex:1; border:1px solid var(--border);" onclick="app.processApproval('remark')">Note</button>
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
