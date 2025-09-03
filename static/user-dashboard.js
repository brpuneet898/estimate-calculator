// User Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    checkAuthStatus();
    
    // Patient form handling
    const patientForm = document.getElementById('patient-form');
    const patientInputs = patientForm.querySelectorAll('input, select');
    
    patientInputs.forEach(input => {
        input.addEventListener('change', updatePatientSummary);
        input.addEventListener('input', updatePatientSummary);
    });

    // Basic estimate button
    const generateBtn = document.getElementById('generate-basic-estimate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateBasicEstimate);
    }

    // Auth check
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/user-info');
            if (response.ok) {
                const userData = await response.json();
                document.getElementById('user-name').textContent = userData.username;
                
                // Check if user is approved and is regular user
                if (!userData.approved) {
                    window.location.href = '/dashboard'; // Will redirect to pending page
                } else if (userData.is_admin || userData.is_manager) {
                    window.location.href = '/dashboard'; // Redirect to their proper dashboard
                }
            } else {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/login';
        }
    }

    // Patient summary update
    function updatePatientSummary() {
        const fields = [
            ['patient-name', 'summary-name', 'Not specified'],
            ['patient-uhid', 'summary-uhid', 'Not specified'], 
            ['patient-category', 'summary-category', 'Not selected'],
            ['patient-stay', 'summary-stay', '1']
        ];
        
        fields.forEach(([inputId, summaryId, defaultVal]) => {
            document.getElementById(summaryId).textContent = 
                document.getElementById(inputId).value || defaultVal;
        });
    }

    // Generate basic estimate
    function generateBasicEstimate() {
        const patientName = document.getElementById('patient-name').value;
        const patientUhid = document.getElementById('patient-uhid').value;
        const patientCategory = document.getElementById('patient-category').value;
        const patientStay = document.getElementById('patient-stay').value;

        if (!patientName || !patientUhid || !patientCategory) {
            showMessage('Please fill in all patient information', 'error');
            return;
        }

        // Basic estimate calculation (simplified)
        const baseRate = {
            'charity': 500,
            'general_nc_a': 1000,
            'general_nc_b': 1500,
            'general': 2000,
            'deluxe': 3000,
            'super_deluxe': 5000
        };

        const dailyRate = baseRate[patientCategory] || 1000;
        const totalEstimate = dailyRate * parseInt(patientStay);

        showMessage(`Basic estimate: ₹${totalEstimate.toLocaleString()} for ${patientStay} day(s)`, 'success');
    }

    // Global logout function
    window.logout = async function() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                showMessage('Logged out successfully!', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1000);
            } else {
                showMessage('Error logging out', 'error');
            }
        } catch (error) {
            console.error('Logout error:', error);
            showMessage('Network error during logout', 'error');
        }
    };

    // Utility function to show messages
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
});