// Authentication JavaScript for Hospital Estimate Builder

document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    // Helper functions
    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
        if (successMessage) {
            successMessage.style.display = 'none';
        }
    }

    function showSuccess(message) {
        if (successMessage) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
        }
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    }

    function hideMessages() {
        if (errorMessage) errorMessage.style.display = 'none';
        if (successMessage) successMessage.style.display = 'none';
    }

    function setLoading(button, isLoading) {
        button.disabled = isLoading;
        button.classList.toggle('loading', isLoading);
        if (isLoading) {
            button.textContent = button.textContent.includes('Create') ? 'Creating...' : 'Signing in...';
        } else {
            button.textContent = button.textContent.includes('Creating') ? 'Create Account' : 'Sign In';
        }
    }

    // Signup form handler
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            hideMessages();

            const formData = new FormData(signupForm);
            const username = formData.get('username').trim();
            const password = formData.get('password').trim();
            const submitBtn = document.getElementById('signup-btn');

            // Basic validation
            if (!username || !password) {
                showError('Please fill in all fields');
                return;
            }

            if (username.length < 3) {
                showError('Username must be at least 3 characters long');
                return;
            }

            if (password.length < 4) {
                showError('Password must be at least 4 characters long');
                return;
            }

            setLoading(submitBtn, true);

            try {
                const roleSelect = document.getElementById('role');
                const role = roleSelect ? roleSelect.value : 'user';
                
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password, role })
                });

                const data = await response.json();

                if (response.ok) {
                    showSuccess(data.message || 'Account created successfully!');
                    // Only redirect if the user is auto-approved (admin created the account)
                    if (!data.message.includes('approval')) {
                        setTimeout(() => window.location.href = '/dashboard', 1500);
                    }
                } else {
                    showError(data.error || 'Failed to create account');
                }
            } catch (error) {
                console.error('Signup error:', error);
                showError('Network error. Please try again.');
            } finally {
                setLoading(submitBtn, false);
            }
        });
    }

    // Login form handler
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            hideMessages();

            const formData = new FormData(loginForm);
            const username = formData.get('username').trim();
            const password = formData.get('password').trim();
            const submitBtn = document.getElementById('login-btn');

            // Basic validation
            if (!username || !password) {
                showError('Please fill in all fields');
                return;
            }

            setLoading(submitBtn, true);

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    showSuccess('Login successful! Redirecting...');
                    setTimeout(() => window.location.href = '/dashboard', 1000);
                } else {
                    showError(data.error || 'Invalid credentials');
                }
            } catch (error) {
                console.error('Login error:', error);
                showError('Network error. Please try again.');
            } finally {
                setLoading(submitBtn, false);
            }
        });
    }

    // Input validation feedback
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('input', () => {
            hideMessages();
            input.style.borderColor = input.value.trim() ? 'var(--primary)' : '';
        });
        input.addEventListener('blur', () => {
            if (!input.value.trim()) input.style.borderColor = 'var(--destructive)';
        });
    });
});