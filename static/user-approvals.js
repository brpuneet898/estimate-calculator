// User Approvals Management

async function loadPendingUsers() {
    try {
        const response = await fetch('/api/pending-users');
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            showMessage(err.error || 'Failed to load pending users', 'error');
            return;
        }
        const users = await response.json();

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
                    <button class="btn btn-outline btn-sm" onclick="approveUser(${user.id})" style="background-color: hsl(120, 85%, 97%); border-color: hsl(120, 85%, 60%); color: hsl(120, 85%, 30%); margin-right: 0.5rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Approve
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="rejectUser(${user.id})" style="background-color: hsl(0, 85%, 97%); border-color: var(--destructive); color: var(--destructive);">
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
                badge.style.background = 'var(--destructive)';
                badge.style.color = '#fff';
                badge.style.padding = '0.15rem 0.4rem';
                badge.style.borderRadius = '999px';
                badge.style.fontSize = '0.75rem';
                approvalBtn.appendChild(badge);
            }
            badge.textContent = users.length;
        }
    } catch (error) {
        console.error('Error loading pending users:', error);
        showMessage('Error loading pending users', 'error');
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

// Utility function to show messages (same as in masters.js)
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.right = '20px';
    messageDiv.style.zIndex = '9999';
    messageDiv.style.minWidth = '300px';

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

// Add to masters.js initialization
document.addEventListener('DOMContentLoaded', function () {
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
