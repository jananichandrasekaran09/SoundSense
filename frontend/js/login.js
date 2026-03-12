// login.js

document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const switchRegisterBtn = document.getElementById('switch-to-register');
    const switchLoginBtn = document.getElementById('switch-to-login');
    const messageBox = document.getElementById('auth-message');

    // Toggle Forms
    switchRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
        messageBox.classList.add('hidden');
    });

    switchLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
        messageBox.classList.add('hidden');
    });

    function showMessage(text, type) {
        messageBox.textContent = text;
        messageBox.className = `auth-message ${type}`;
    }

    // Login Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('button');
        
        btn.disabled = true;
        btn.textContent = 'Signing in...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Login successful! Redirecting...', 'success');
                // Store simulated token (Ideally this is a real JWT)
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user_name', data.name);
                
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 1000);
            } else {
                showMessage(data.error || 'Login failed', 'error');
                btn.disabled = false;
                btn.innerHTML = 'Sign In <span class="arrow">→</span>';
            }
        } catch (error) {
            showMessage('Network error. Please try again.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Sign In <span class="arrow">→</span>';
        }
    });

    // Registration Form Submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const btn = registerForm.querySelector('button');

        btn.disabled = true;
        btn.textContent = 'Creating Account...';

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Account created successfully! Please sign in.', 'success');
                registerForm.reset();
                
                // Switch back to login after short delay
                setTimeout(() => {
                    registerFormContainer.classList.add('hidden');
                    loginFormContainer.classList.remove('hidden');
                    document.getElementById('login-email').value = email;
                    messageBox.classList.add('hidden');
                }, 2000);
                
            } else {
                showMessage(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            showMessage('Network error. Please try again.', 'error');
        } finally {
            if(btn.textContent === 'Creating Account...') {
                btn.disabled = false;
                btn.textContent = 'Create Account';
            }
        }
    });
});
