// User Approvals Management

async function loadPendingUsers() {
    try {
        console.log('fetching pending users...');
        const response = await fetch('/api/pending-users');
        if (!response.ok) {
            console.error('pending-users fetch failed', response.status);
            const err = await response.json().catch(() => ({}));
            showMessage(err.error || 'Failed to load pending users', 'error');
            return;
        }
        const users = await response.json();
        console.log('pending users:', users);
        
        const tbody = document.getElementById('pending-users-tbody');
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">No pending user requests</td>
                </tr>
            `;
            // update badge/count on approvals button
            const approvalBtn = document.getElementById('user-approvals-btn');
            if (approvalBtn) {
                approvalBtn.dataset.count = 0;
                approvalBtn.querySelector('.pending-count')?.remove();
            }
            // show debug info
            showPendingDebug({ status: 'ok', count: 0, raw: users });
            return;
        }
        
        users.forEach(user => {
            const row = document.createElement('tr');
            const createdAt = new Date(user.created_at).toLocaleString();
            row.innerHTML = `
                <td>${user.username}</td>
                <td><span class="badge ${user.role === 'admin' ? 'badge-danger' : user.role === 'manager' ? 'badge-info' : 'badge-success'}">${user.role}</span></td>
                <td>${createdAt}</td>
                <td>
                    <button class="btn btn-outline-success btn-sm" onclick="approveUser(${user.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Approve
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="rejectUser(${user.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Reject
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        // show pending count on approvals button
        const approvalBtn = document.getElementById('user-approvals-btn');
        if (approvalBtn) {
            approvalBtn.dataset.count = users.length;
            // attach small count badge
            let badge = approvalBtn.querySelector('.pending-count');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'pending-count';
                badge.style.marginLeft = '0.5rem';
                badge.style.background = 'var(--danger)';
                badge.style.color = '#fff';
                badge.style.padding = '0.15rem 0.4rem';
                badge.style.borderRadius = '999px';
                badge.style.fontSize = '0.75rem';
                approvalBtn.appendChild(badge);
            }
            badge.textContent = users.length;
        }
        // show debug info
        showPendingDebug({ status: 'ok', count: users.length, raw: users });
    } catch (error) {
        console.error('Error loading pending users:', error);
        showMessage('Error loading pending users', 'error');
        showPendingDebug({ status: 'error', error: String(error) });
    }
}

function ensurePendingDebugPanel() {
    const container = document.getElementById('user-approvals-tab');
    if (!container) return null;
    let panel = container.querySelector('#pending-debug');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'pending-debug';
        panel.style.margin = '0.5rem 0 1rem 0';
        panel.style.fontSize = '0.85rem';
        panel.innerHTML = `
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <button id="pending-refresh-btn" class="btn btn-outline btn-sm">Refresh</button>
                <div id="pending-debug-msg" style="color:var(--muted-foreground);">Pending users debug</div>
            </div>
            <pre id="pending-debug-raw" style="background:var(--muted); padding:0.5rem; margin-top:0.5rem; display:none; white-space:pre-wrap; max-height:200px; overflow:auto;"></pre>
        `;
        container.insertBefore(panel, container.firstChild.nextSibling);
        const refreshBtn = panel.querySelector('#pending-refresh-btn');
        refreshBtn.addEventListener('click', () => loadPendingUsers());
    }
    return panel;
}

function showPendingDebug(obj) {
    const panel = ensurePendingDebugPanel();
    if (!panel) return;
    const msg = panel.querySelector('#pending-debug-msg');
    const raw = panel.querySelector('#pending-debug-raw');
    if (obj.status === 'ok') {
        msg.textContent = `Fetched ${obj.count} pending user(s)`;
        raw.style.display = 'block';
        raw.textContent = JSON.stringify(obj.raw, null, 2);
    } else {
        msg.textContent = `Error: ${obj.error}`;
        raw.style.display = 'none';
    }
}

async function approveUser(userId) {
    try {
        const response = await fetch(`/api/users/${userId}/approve`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showMessage('User approved successfully', 'success');
            loadPendingUsers();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Error approving user', 'error');
        }
    } catch (error) {
        console.error('Error approving user:', error);
        showMessage('Network error while approving user', 'error');
    }
}

async function rejectUser(userId) {
    if (!confirm('Are you sure you want to reject this user? This will delete their account.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}/reject`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showMessage('User rejected successfully', 'success');
            loadPendingUsers();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Error rejecting user', 'error');
        }
    } catch (error) {
        console.error('Error rejecting user:', error);
        showMessage('Network error while rejecting user', 'error');
    }
}

// Add to masters.js initialization
document.addEventListener('DOMContentLoaded', function() {
    // Show approval tab only for admin users
    fetch('/api/user-info')
        .then(response => response.json())
        .then(data => {
            if (data.is_admin) {
                const approvalBtn = document.getElementById('user-approvals-btn');
                if (approvalBtn) {
                    approvalBtn.style.display = 'block';
                    // Load pending users initially if we're on the approvals tab
                    if (approvalBtn.classList.contains('active')) {
                        loadPendingUsers();
                    }
                }
            }
        })
        .catch(error => console.error('Error:', error));
});
