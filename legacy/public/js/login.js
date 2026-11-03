document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const alerta = document.getElementById('alerta');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const btn = e.target.querySelector('button[type="submit"]');
  
  alerta.classList.add('d-none');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Iniciando sesión...';
  
  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }
    
    window.location.href = '/dashboard.html';
  } catch (err) {
    alerta.className = 'alert alert-danger';
    alerta.textContent = err.message;
    alerta.classList.remove('d-none');
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Iniciar Sesión';
  }
});
