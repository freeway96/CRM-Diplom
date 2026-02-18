(() => {
  const SESSION_KEY = "crm_auth_user";
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:8084/api`;

  const form = document.querySelector("[data-login-form]");
  const loginInput = document.querySelector("[data-login-input]");
  const passwordInput = document.querySelector("[data-password-input]");
  const messageEl = document.querySelector("[data-login-message]");

  if (!form || !loginInput || !passwordInput || !messageEl) return;

  if (sessionStorage.getItem(SESSION_KEY)) {
    window.location.replace("dashboard.html");
    return;
  }

  const setMessage = (text, type = "") => {
    messageEl.textContent = text;
    messageEl.classList.remove("is-error", "is-success");
    if (type) messageEl.classList.add(type);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("Проверяем данные...");

    const login = loginInput.value.trim();
    const password = passwordInput.value;

    if (!login || !password) {
      setMessage("Введите логин и пароль.", "is-error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/login.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        setMessage(data.message || "Ошибка авторизации.", "is-error");
        return;
      }

      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          id: data.user.id,
          login: data.user.login,
          user: data.user.user,
          at: new Date().toISOString(),
        })
      );
      setMessage("Вход выполнен. Перенаправление...", "is-success");
      window.location.replace("dashboard.html");
    } catch (error) {
      setMessage("API недоступен. Проверьте контейнер backend на порту 8084.", "is-error");
    }
  });
})();

