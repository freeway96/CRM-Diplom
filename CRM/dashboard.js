(() => {
  const SESSION_KEY = "crm_auth_user";
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:8084/api`;

  const statusMeta = {
    new: { label: "Новая", className: "badge-new" },
    in_progress: { label: "В работе", className: "badge-progress" },
    won: { label: "Завершена", className: "badge-won" },
    lost: { label: "Отменена", className: "badge-lost" },
  };

  const q = (selector) => document.querySelector(selector);

  const userInfo = q("[data-user-info]");
  const messageEl = q("[data-dashboard-message]");
  const logoutBtn = q("[data-logout-btn]");
  const tabButtons = Array.from(document.querySelectorAll("[data-tab-btn]"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));

  const clientForm = q("[data-client-form]");
  const workerForm = q("[data-worker-form]");
  const dealForm = q("[data-deal-form]");
  const clientsBody = q("[data-clients-body]");
  const workersBody = q("[data-workers-body]");
  const dealsBody = q("[data-deals-body]");
  const performanceBody = q("[data-performance-body]");
  const overviewCards = q("[data-overview-cards]");
  const progressCards = q("[data-progress-cards]");
  const clientSelect = q("[data-client-select]");
  const workerSelect = q("[data-worker-select]");

  const sessionRaw = sessionStorage.getItem(SESSION_KEY);
  if (!sessionRaw) {
    window.location.replace("login.html");
    return;
  }

  let sessionUser;
  try {
    sessionUser = JSON.parse(sessionRaw);
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("login.html");
    return;
  }

  if (userInfo) {
    const who = sessionUser.user || sessionUser.login || "Неизвестно";
    userInfo.textContent = "Пользователь: " + who;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("login.html");
    });
  }

  const setMessage = (text, type = "") => {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.classList.remove("is-error", "is-success");
    if (type) messageEl.classList.add(type);
  };

  let state = {
    clients: [],
    workers: [],
    deals: [],
  };

  const apiRequest = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}/${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Ошибка API");
    }
    return data;
  };

  const loadData = async () => {
    const data = await apiRequest("crm.php");
    state = data.data;
  };

  const formatMoney = (value) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formatDate = (isoDate) => {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("ru-RU");
  };

  const clientById = (id) => state.clients.find((item) => Number(item.id) === Number(id));
  const workerById = (id) => state.workers.find((item) => Number(item.id) === Number(id));

  const dealCountForClient = (clientId) =>
    state.deals.filter((deal) => Number(deal.client_id) === Number(clientId)).length;
  const dealCountForWorker = (workerId) =>
    state.deals.filter((deal) => Number(deal.worker_id) === Number(workerId)).length;

  const renderClientOptions = () => {
    if (!clientSelect) return;
    clientSelect.innerHTML = '<option value="">Выберите клиента</option>';
    state.clients.forEach((client) => {
      const option = document.createElement("option");
      option.value = String(client.id);
      option.textContent = client.name;
      clientSelect.appendChild(option);
    });
  };

  const renderWorkerOptions = () => {
    if (!workerSelect) return;
    workerSelect.innerHTML = '<option value="">Ответственный сотрудник</option>';
    state.workers.forEach((worker) => {
      const option = document.createElement("option");
      option.value = String(worker.id);
      option.textContent = worker.name;
      workerSelect.appendChild(option);
    });
  };

  const renderClients = () => {
    if (!clientsBody) return;
    if (state.clients.length === 0) {
      clientsBody.innerHTML =
        '<tr><td colspan="5" class="empty-state">Клиентов пока нет.</td></tr>';
      return;
    }

    clientsBody.innerHTML = state.clients
      .map(
        (client) => `
        <tr>
          <td>${client.name}</td>
          <td>${client.contact}</td>
          <td>${client.phone}</td>
          <td>${dealCountForClient(client.id)}</td>
          <td><button class="btn btn-line btn-small" type="button" data-remove-client="${client.id}">Удалить</button></td>
        </tr>`
      )
      .join("");
  };

  const renderWorkers = () => {
    if (!workersBody) return;
    if (state.workers.length === 0) {
      workersBody.innerHTML =
        '<tr><td colspan="4" class="empty-state">Сотрудников пока нет.</td></tr>';
      return;
    }

    workersBody.innerHTML = state.workers
      .map(
        (worker) => `
        <tr>
          <td>${worker.name}</td>
          <td>${worker.role}</td>
          <td>${dealCountForWorker(worker.id)}</td>
          <td><button class="btn btn-line btn-small" type="button" data-remove-worker="${worker.id}">Удалить</button></td>
        </tr>`
      )
      .join("");
  };

  const renderDeals = () => {
    if (!dealsBody) return;
    if (state.deals.length === 0) {
      dealsBody.innerHTML =
        '<tr><td colspan="6" class="empty-state">Сделок пока нет.</td></tr>';
      return;
    }

    dealsBody.innerHTML = state.deals
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((deal) => {
        const client = clientById(deal.client_id);
        const worker = workerById(deal.worker_id);
        const status = statusMeta[deal.status] || statusMeta.new;
        return `
        <tr>
          <td>${client ? client.name : "Удаленный клиент"}</td>
          <td>${worker ? worker.name : "Удаленный сотрудник"}</td>
          <td>${formatMoney(Number(deal.amount || 0))}</td>
          <td><span class="badge ${status.className}">${status.label}</span></td>
          <td>${formatDate(deal.created_at)}</td>
          <td><button class="btn btn-line btn-small" type="button" data-remove-deal="${deal.id}">Удалить</button></td>
        </tr>`;
      })
      .join("");
  };

  const calcSummary = () => {
    const totalDeals = state.deals.length;
    const activeDeals = state.deals.filter((deal) => deal.status === "new" || deal.status === "in_progress").length;
    const doneDeals = state.deals.filter((deal) => deal.status === "won").length;
    const lostDeals = state.deals.filter((deal) => deal.status === "lost").length;
    const revenueDone = state.deals
      .filter((deal) => deal.status === "won")
      .reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
    const pipeline = state.deals
      .filter((deal) => deal.status === "new" || deal.status === "in_progress")
      .reduce((sum, deal) => sum + Number(deal.amount || 0), 0);

    return {
      totalDeals,
      activeDeals,
      doneDeals,
      lostDeals,
      revenueDone,
      pipeline,
    };
  };

  const renderCards = (container, cards) => {
    if (!container) return;
    container.innerHTML = cards
      .map(
        (card) => `
        <article>
          <strong>${card.value}</strong>
          <p>${card.label}</p>
        </article>`
      )
      .join("");
  };

  const renderProgressTable = () => {
    if (!performanceBody) return;
    if (state.workers.length === 0) {
      performanceBody.innerHTML =
        '<tr><td colspan="4" class="empty-state">Нет сотрудников для аналитики.</td></tr>';
      return;
    }

    performanceBody.innerHTML = state.workers
      .map((worker) => {
        const workerDeals = state.deals.filter((deal) => Number(deal.worker_id) === Number(worker.id));
        const done = workerDeals.filter((deal) => deal.status === "won");
        const doneRevenue = done.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
        return `
        <tr>
          <td>${worker.name}</td>
          <td>${workerDeals.length}</td>
          <td>${done.length}</td>
          <td>${formatMoney(doneRevenue)}</td>
        </tr>`;
      })
      .join("");
  };

  const renderDashboard = () => {
    const summary = calcSummary();
    renderCards(overviewCards, [
      { value: state.clients.length, label: "Клиенты" },
      { value: state.workers.length, label: "Сотрудники" },
      { value: summary.totalDeals, label: "Всего сделок" },
      { value: formatMoney(summary.pipeline), label: "Текущий pipeline" },
    ]);

    renderCards(progressCards, [
      { value: summary.doneDeals, label: "Завершено сделок" },
      { value: summary.activeDeals, label: "Сделки в работе" },
      { value: summary.lostDeals, label: "Отменено" },
      { value: formatMoney(summary.revenueDone), label: "Выручка по завершенным" },
    ]);
  };

  const rerender = () => {
    renderClientOptions();
    renderWorkerOptions();
    renderClients();
    renderWorkers();
    renderDeals();
    renderProgressTable();
    renderDashboard();
  };

  const refreshAndRender = async () => {
    await loadData();
    rerender();
  };

  const setActiveTab = (tabName) => {
    tabButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tabTarget === tabName);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
    });
  };

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tabTarget);
    });
  });

  if (clientForm) {
    clientForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(clientForm);
      const name = String(formData.get("name") || "").trim();
      const contact = String(formData.get("contact") || "").trim();
      const phone = String(formData.get("phone") || "").trim();
      if (!name || !contact || !phone) return;

      try {
        await apiRequest("crm.php?entity=clients", {
          method: "POST",
          body: JSON.stringify({ name, contact, phone }),
        });
        clientForm.reset();
        await refreshAndRender();
        setMessage("Клиент добавлен.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    });
  }

  if (workerForm) {
    workerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(workerForm);
      const name = String(formData.get("name") || "").trim();
      const role = String(formData.get("role") || "").trim();
      if (!name || !role) return;

      try {
        await apiRequest("crm.php?entity=workers", {
          method: "POST",
          body: JSON.stringify({ name, role }),
        });
        workerForm.reset();
        await refreshAndRender();
        setMessage("Сотрудник добавлен.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    });
  }

  if (dealForm) {
    dealForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(dealForm);
      const clientId = Number(formData.get("clientId") || 0);
      const workerId = Number(formData.get("workerId") || 0);
      const status = String(formData.get("status") || "new");
      const amount = Number(formData.get("amount") || 0);
      if (clientId <= 0 || workerId <= 0 || amount < 0) return;

      try {
        await apiRequest("crm.php?entity=deals", {
          method: "POST",
          body: JSON.stringify({ clientId, workerId, status, amount }),
        });
        dealForm.reset();
        await refreshAndRender();
        setMessage("Сделка добавлена.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    });
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const removeClientId = target.dataset.removeClient;
    if (removeClientId) {
      try {
        await apiRequest(`crm.php?entity=clients&id=${encodeURIComponent(removeClientId)}`, {
          method: "DELETE",
        });
        await refreshAndRender();
        setMessage("Клиент удален.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
      return;
    }

    const removeWorkerId = target.dataset.removeWorker;
    if (removeWorkerId) {
      try {
        await apiRequest(`crm.php?entity=workers&id=${encodeURIComponent(removeWorkerId)}`, {
          method: "DELETE",
        });
        await refreshAndRender();
        setMessage("Сотрудник удален.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
      return;
    }

    const removeDealId = target.dataset.removeDeal;
    if (removeDealId) {
      try {
        await apiRequest(`crm.php?entity=deals&id=${encodeURIComponent(removeDealId)}`, {
          method: "DELETE",
        });
        await refreshAndRender();
        setMessage("Сделка удалена.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    }
  });

  const init = async () => {
    setActiveTab("overview");
    try {
      await refreshAndRender();
      setMessage("Данные синхронизированы с БД.");
    } catch (error) {
      setMessage("API недоступен. Проверьте контейнер backend на порту 8084.", "is-error");
    }
  };

  init();
})();

