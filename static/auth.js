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
        if (isLoading) {
            button.disabled = true;
            button.classList.add('loading');
            button.textContent = button.textContent.replace('Create Account', 'Creating...').replace('Sign In', 'Signing in...');
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            button.textContent = button.textContent.replace('Creating...', 'Create Account').replace('Signing in...', 'Sign In');
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
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    showSuccess('Account created successfully! Redirecting...');
                    setTimeout(() => {
                        if (data.is_admin) {
                            window.location.href = '/dashboard';
                        } else {
                            window.location.href = '/dashboard';
                        }
                    }, 1500);
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
                    setTimeout(() => {
                        if (data.is_admin) {
                            window.location.href = '/dashboard';
                        } else {
                            window.location.href = '/dashboard';
                        }
                    }, 1000);
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
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            hideMessages();
            
            // Remove any error styling
            this.style.borderColor = '';
            
            // Add basic validation styling
            if (this.value.trim()) {
                this.style.borderColor = 'var(--primary)';
            }
        });

        input.addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.style.borderColor = 'var(--destructive)';
            }
        });
    });
});