// API Configuration
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : 'https://sunburst-analytics-production.up.railway.app/api';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');

// Show/Hide Forms
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    clearMessages();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    clearMessages();
});

// Clear error/success messages
function clearMessages() {
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('registerError').style.display = 'none';
    document.getElementById('registerSuccess').style.display = 'none';
}

// Show error message
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
}

// Show success message
function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
}

// Set loading state for button
function setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    const text = button.querySelector('.btn-text');
    const loader = button.querySelector('.btn-loader');

    if (isLoading) {
        button.disabled = true;
        text.style.display = 'none';
        loader.style.display = 'inline';
    } else {
        button.disabled = false;
        text.style.display = 'inline';
        loader.style.display = 'none';
    }
}

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showError('loginError', 'Veuillez remplir tous les champs');
        return;
    }

    setButtonLoading('loginBtn', true);

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Échec de la connexion');
        }

        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirect to dashboard
        window.location.href = '/dashboard.html';
    } catch (error) {
        showError('loginError', error.message);
    } finally {
        setButtonLoading('loginBtn', false);
    }
});

// Register Form Submit
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    // Validation
    if (!name || !email || !password || !passwordConfirm) {
        showError('registerError', 'Veuillez remplir tous les champs');
        return;
    }

    if (password.length < 6) {
        showError('registerError', 'Le mot de passe doit contenir au moins 6 caractères');
        return;
    }

    if (password !== passwordConfirm) {
        showError('registerError', 'Les mots de passe ne correspondent pas');
        return;
    }

    setButtonLoading('registerBtn', true);

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, name })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Échec de l\'inscription');
        }

        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Show success and redirect
        showSuccess('registerSuccess', 'Compte créé avec succès ! Redirection...');

        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1500);
    } catch (error) {
        showError('registerError', error.message);
    } finally {
        setButtonLoading('registerBtn', false);
    }
});

// Check if already logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        // Verify token is still valid
        fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                window.location.href = '/dashboard.html';
            } else {
                // Token invalid, clear storage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        })
        .catch(err => {
            console.error('Auth check failed:', err);
        });
    }
}

// Check auth on page load
checkAuth();
