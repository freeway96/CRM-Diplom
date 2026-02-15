(() => {
  const SESSION_KEY = "crm_auth_user";
  const SQL_PATH = "../sql/login.sql";

  const form = document.querySelector("[data-login-form]");
  const loginInput = document.querySelector("[data-login-input]");
  const passwordInput = document.querySelector("[data-password-input]");
  const messageEl = document.querySelector("[data-login-message]");

  if (!form || !loginInput || !passwordInput || !messageEl) {
    return;
  }

  if (sessionStorage.getItem(SESSION_KEY)) {
    window.location.replace("dashboard.html");
    return;
  }

  const setMessage = (text, type = "") => {
    messageEl.textContent = text;
    messageEl.classList.remove("is-error", "is-success");
    if (type) {
      messageEl.classList.add(type);
    }
  };

  const parseUsersFromSql = (sqlText) => {
    const users = [];
    const rowRegex =
      /\(\s*\d+\s*,\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*,\s*(?:NULL|'[^']*')\s*\)/g;

    let match = rowRegex.exec(sqlText);
    while (match) {
      users.push({
        user: match[1].replace(/\\'/g, "'"),
        login: match[2].replace(/\\'/g, "'"),
        password: match[3].replace(/\\'/g, "'"),
      });
      match = rowRegex.exec(sqlText);
    }

    return users;
  };

  const loadUsers = async () => {
    const response = await fetch(SQL_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Не удалось загрузить базу логинов.");
    }

    const sqlText = await response.text();
    const users = parseUsersFromSql(sqlText);
    if (users.length === 0) {
      throw new Error("Файл логинов пуст или имеет неверный формат.");
    }

    return users;
  };

  let usersPromise = loadUsers().catch((error) => {
    setMessage(error.message, "is-error");
    throw error;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("Проверяем данные...");

    const login = loginInput.value.trim();
    const password = passwordInput.value;

    try {
      const users = await usersPromise;
      const matchedUser = users.find(
        (user) => user.login === login && user.password === password
      );

      if (!matchedUser) {
        setMessage("Неверный логин или пароль.", "is-error");
        return;
      }

      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          login: matchedUser.login,
          user: matchedUser.user,
          at: new Date().toISOString(),
        })
      );
      setMessage("Вход выполнен. Перенаправление...", "is-success");
      window.location.replace("dashboard.html");
    } catch (error) {
      setMessage(
        "Ошибка входа. Проверьте доступность файла sql/login.sql.",
        "is-error"
      );
      usersPromise = loadUsers();
    }
  });
})();
