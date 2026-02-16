(() => {
  const SESSION_KEY = "crm_auth_user";
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:8084/api`;

  const statusMeta = {
    new: { label: "Новая", className: "badge-new" },
    in_progress: { label: "В работе", className: "badge-progress" },
    won: { label: "Завершена", className: "badge-won" },
    lost: { label: "Отменена", className: "badge-lost" },
  };

  const attendanceStatusMeta = {
    present: { label: "На смене", className: "badge-won" },
    absent: { label: "Отсутствовал", className: "badge-lost" },
    sick: { label: "Больничный", className: "badge-progress" },
    vacation: { label: "Отпуск", className: "badge-new" },
  };

  const q = (selector) => document.querySelector(selector);

  const userInfo = q("[data-user-info]");
  const messageEl = q("[data-dashboard-message]");
  const logoutBtn = q("[data-logout-btn]");

  const tabButtons = Array.from(document.querySelectorAll("[data-tab-btn]"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));

  const createClientBtn = q("[data-create-client]");
  const createWorkerBtn = q("[data-create-worker]");
  const createDealBtn = q("[data-create-deal]");
  const createAttendanceBtn = q("[data-create-attendance]");
  const createProductionBtn = q("[data-create-production]");

  const attendanceFilterForm = q("[data-attendance-filter-form]");
  const productionFilterForm = q("[data-production-filter-form]");

  const clientsBody = q("[data-clients-body]");
  const workersBody = q("[data-workers-body]");
  const dealsBody = q("[data-deals-body]");
  const attendanceBody = q("[data-attendance-body]");
  const productionsBody = q("[data-productions-body]");

  const overviewCards = q("[data-overview-cards]");
  const progressCards = q("[data-progress-cards]");
  const workersTotalEl = q("[data-workers-total]");

  const attendanceDateInput = q("[data-attendance-date]");
  const productionDateInput = q("[data-production-date]");

  const editModal = q("[data-edit-modal]");
  const editTitle = q("[data-edit-title]");
  const editForm = q("[data-edit-form]");
  const editCloseBtn = q("[data-edit-close]");

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const sessionRaw = sessionStorage.getItem(SESSION_KEY);
  if (!sessionRaw) {
    window.location.replace("login.html");
    return;
  }

  try {
    const sessionUser = JSON.parse(sessionRaw);
    if (userInfo) {
      const who = sessionUser.user || sessionUser.login || "Неизвестно";
      userInfo.textContent = "Пользователь: " + who;
    }
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("login.html");
    return;
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

  const formatError = (error) => {
    if (!error) return "Неизвестная ошибка";
    if (error instanceof Error) return error.message || error.name || "Ошибка";
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch (_) {
      return String(error);
    }
  };

  const reportError = (context, error) => {
    const details = `${context}: ${formatError(error)}`;
    setMessage(details, "is-error");
    console.error("[CRM]", context, {
      apiBase: API_BASE,
      details,
      error,
    });
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  const filters = {
    attendanceDate: todayISO,
    productionDate: todayISO,
  };

  if (attendanceDateInput) attendanceDateInput.value = filters.attendanceDate;
  if (productionDateInput) productionDateInput.value = filters.productionDate;

  let state = {
    clients: [],
    workers: [],
    deals: [],
    attendance: [],
    productions: [],
  };

  const apiRequest = async (path, options = {}) => {
    const requestUrl = `${API_BASE}/${path}`;
    let response;
    try {
      response = await fetch(requestUrl, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
    } catch (networkError) {
      throw new Error(`Сетевая ошибка (${requestUrl}): ${formatError(networkError)}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const rawBody = await response.text().catch(() => "");
      const shortBody = rawBody.slice(0, 120).trim();
      const bodyInfo = shortBody ? `, ответ: ${shortBody}` : "";
      throw new Error(`API вернул не JSON (${requestUrl}, HTTP ${response.status}${bodyInfo})`);
    }

    if (!response.ok || !data.ok) {
      const base = data.message || "Ошибка API";
      throw new Error(`${base} (${requestUrl}, HTTP ${response.status})`);
    }

    return data;
  };

  const loadData = async () => {
    const params = new URLSearchParams({
      attendance_date: filters.attendanceDate,
      production_date: filters.productionDate,
    });
    const data = await apiRequest(`crm.php?${params.toString()}`);
    state = data.data;
  };

  const refreshAndRender = async () => {
    await loadData();
    renderAll();
  };

  const formatMoney = (value) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formatDate = (isoDate) => {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("ru-RU");
  };

  const clientById = (id) => state.clients.find((item) => Number(item.id) === Number(id));
  const workerById = (id) => state.workers.find((item) => Number(item.id) === Number(id));

  const dealCountForClient = (clientId) =>
    state.deals.filter((deal) => Number(deal.client_id) === Number(clientId)).length;

  const setActiveTab = (tabName) => {
    tabButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tabTarget === tabName);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
    });
  };

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
  });

  const clientOptionsHtml = (selectedId = "") =>
    ['<option value="">Выберите клиента</option>']
      .concat(
        state.clients.map(
          (client) =>
            `<option value="${client.id}" ${Number(client.id) === Number(selectedId) ? "selected" : ""}>${escapeHtml(
              client.name
            )}</option>`
        )
      )
      .join("");

  const workerOptionsHtml = (selectedId = "", label = "Сотрудник") =>
    [`<option value="">${label}</option>`]
      .concat(
        state.workers.map(
          (worker) =>
            `<option value="${worker.id}" ${Number(worker.id) === Number(selectedId) ? "selected" : ""}>${escapeHtml(
              worker.name
            )}</option>`
        )
      )
      .join("");

  const closeEditModal = () => {
    if (!editModal || !editForm) return;
    editModal.hidden = true;
    editForm.innerHTML = "";
  };

  const openEditModal = ({ title, html, onSubmit }) => {
    if (!editModal || !editTitle || !editForm) return;
    editTitle.textContent = title;
    editForm.innerHTML = html;
    editModal.hidden = false;

    editForm.onsubmit = async (event) => {
      event.preventDefault();
      const formData = new FormData(editForm);
      try {
        await onSubmit(formData);
        closeEditModal();
        await refreshAndRender();
        setMessage("Изменения сохранены.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    };
  };

  if (editCloseBtn) {
    editCloseBtn.addEventListener("click", closeEditModal);
  }

  if (editModal) {
    editModal.addEventListener("click", (event) => {
      if (event.target === editModal) closeEditModal();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editModal && !editModal.hidden) {
      closeEditModal();
    }
  });

  const openCreateClientModal = () => {
    openEditModal({
      title: "Создание клиента",
      html: `
        <input type="text" name="name" placeholder="Название клиента" required />
        <input type="text" name="contact" placeholder="Контактное лицо" required />
        <input type="tel" name="phone" placeholder="+7..." required />
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Создать</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=clients", {
          method: "POST",
          body: JSON.stringify({
            name: String(formData.get("name") || "").trim(),
            contact: String(formData.get("contact") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
          }),
        }),
    });
  };

  const openEditClientModal = (clientId) => {
    const client = state.clients.find((item) => Number(item.id) === Number(clientId));
    if (!client) return;
    openEditModal({
      title: "Редактирование клиента",
      html: `
        <input type="hidden" name="clientId" value="${client.id}" />
        <input type="text" name="name" value="${escapeHtml(client.name)}" required />
        <input type="text" name="contact" value="${escapeHtml(client.contact)}" required />
        <input type="tel" name="phone" value="${escapeHtml(client.phone)}" required />
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Сохранить</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=clients", {
          method: "POST",
          body: JSON.stringify({
            clientId: Number(formData.get("clientId") || 0),
            name: String(formData.get("name") || "").trim(),
            contact: String(formData.get("contact") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
          }),
        }),
    });
  };

  const openCreateWorkerModal = () => {
    openEditModal({
      title: "Создание сотрудника",
      html: `
        <input type="text" name="name" placeholder="ФИО сотрудника" required />
        <input type="text" name="role" placeholder="Должность" required />
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Создать</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=workers", {
          method: "POST",
          body: JSON.stringify({
            name: String(formData.get("name") || "").trim(),
            role: String(formData.get("role") || "").trim(),
          }),
        }),
    });
  };

  const openEditWorkerModal = (workerId) => {
    const worker = state.workers.find((item) => Number(item.id) === Number(workerId));
    if (!worker) return;
    openEditModal({
      title: "Редактирование сотрудника",
      html: `
        <input type="hidden" name="workerId" value="${worker.id}" />
        <input type="text" name="name" value="${escapeHtml(worker.name)}" required />
        <input type="text" name="role" value="${escapeHtml(worker.role)}" required />
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Сохранить</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=workers", {
          method: "POST",
          body: JSON.stringify({
            workerId: Number(formData.get("workerId") || 0),
            name: String(formData.get("name") || "").trim(),
            role: String(formData.get("role") || "").trim(),
          }),
        }),
    });
  };

  const openCreateDealModal = () => {
    openEditModal({
      title: "Создание сделки",
      html: `
        <select name="clientId" required>${clientOptionsHtml()}</select>
        <input type="text" name="orderName" placeholder="Название заказа" required />
        <input type="number" min="0" step="1000" name="amount" placeholder="Сумма (руб.)" required />
        <select name="status" required>
          <option value="new">Новая</option>
          <option value="in_progress">В работе</option>
          <option value="won">Завершена</option>
          <option value="lost">Отменена</option>
        </select>
        <textarea name="details" rows="3" placeholder="Комментарий"></textarea>
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Создать</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=deals", {
          method: "POST",
          body: JSON.stringify({
            clientId: Number(formData.get("clientId") || 0),
            orderName: String(formData.get("orderName") || "").trim(),
            amount: Number(formData.get("amount") || 0),
            status: String(formData.get("status") || "new"),
            details: String(formData.get("details") || "").trim(),
          }),
        }),
    });
  };

  const openEditDealModal = (dealId) => {
    const deal = state.deals.find((item) => Number(item.id) === Number(dealId));
    if (!deal) return;

    openEditModal({
      title: "Редактирование сделки",
      html: `
        <input type="hidden" name="dealId" value="${deal.id}" />
        <select name="clientId" required>${clientOptionsHtml(deal.client_id)}</select>
        <input type="text" name="orderName" value="${escapeHtml(deal.order_name || "")}" required />
        <input type="number" min="0" step="1000" name="amount" value="${Number(deal.amount || 0)}" required />
        <select name="status" required>
          <option value="new" ${deal.status === "new" ? "selected" : ""}>Новая</option>
          <option value="in_progress" ${deal.status === "in_progress" ? "selected" : ""}>В работе</option>
          <option value="won" ${deal.status === "won" ? "selected" : ""}>Завершена</option>
          <option value="lost" ${deal.status === "lost" ? "selected" : ""}>Отменена</option>
        </select>
        <textarea name="details" rows="3" placeholder="Комментарий">${escapeHtml(deal.details || "")}</textarea>
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Сохранить</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=deals", {
          method: "POST",
          body: JSON.stringify({
            dealId: Number(formData.get("dealId") || 0),
            clientId: Number(formData.get("clientId") || 0),
            orderName: String(formData.get("orderName") || "").trim(),
            amount: Number(formData.get("amount") || 0),
            status: String(formData.get("status") || "new"),
            details: String(formData.get("details") || "").trim(),
          }),
        }),
    });
  };

  const openCreateAttendanceModal = () => {
    openEditModal({
      title: "Заполнение табеля",
      html: `
        <select name="workerId" required>${workerOptionsHtml("", "Сотрудник")}</select>
        <input type="date" name="workDate" value="${filters.attendanceDate}" required />
        <select name="status" required>
          <option value="present">На смене</option>
          <option value="absent">Отсутствовал</option>
          <option value="sick">Больничный</option>
          <option value="vacation">Отпуск</option>
        </select>
        <input type="number" min="0" step="0.5" name="overtimeHours" value="0" placeholder="Сверхурочно, ч" />
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Сохранить</button>
        </div>
      `,
      onSubmit: async (formData) => {
        const workDate = String(formData.get("workDate") || "").trim();
        await apiRequest("crm.php?entity=attendance", {
          method: "POST",
          body: JSON.stringify({
            workerId: Number(formData.get("workerId") || 0),
            workDate,
            status: String(formData.get("status") || "present"),
            overtimeHours: Number(formData.get("overtimeHours") || 0),
          }),
        });
        if (workDate) {
          filters.attendanceDate = workDate;
          if (attendanceDateInput) attendanceDateInput.value = workDate;
        }
      },
    });
  };

  const openCreateProductionModal = () => {
    openEditModal({
      title: "Добавление выпуска",
      html: `
        <select name="workerId" required>${workerOptionsHtml("", "Сотрудник")}</select>
        <input type="text" name="productName" placeholder="Изделие" required />
        <input type="number" min="1" step="1" name="quantity" placeholder="Количество, шт" required />
        <input type="date" name="producedDate" value="${filters.productionDate}" required />
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Сохранить</button>
        </div>
      `,
      onSubmit: async (formData) => {
        const producedDate = String(formData.get("producedDate") || "").trim();
        await apiRequest("crm.php?entity=productions", {
          method: "POST",
          body: JSON.stringify({
            workerId: Number(formData.get("workerId") || 0),
            productName: String(formData.get("productName") || "").trim(),
            quantity: Number(formData.get("quantity") || 0),
            producedDate,
          }),
        });
        if (producedDate) {
          filters.productionDate = producedDate;
          if (productionDateInput) productionDateInput.value = producedDate;
        }
      },
    });
  };

  if (createClientBtn) createClientBtn.addEventListener("click", openCreateClientModal);
  if (createWorkerBtn) createWorkerBtn.addEventListener("click", openCreateWorkerModal);
  if (createDealBtn) createDealBtn.addEventListener("click", openCreateDealModal);
  if (createAttendanceBtn) createAttendanceBtn.addEventListener("click", openCreateAttendanceModal);
  if (createProductionBtn) createProductionBtn.addEventListener("click", openCreateProductionModal);

  if (attendanceFilterForm) {
    attendanceFilterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(attendanceFilterForm);
      const picked = String(formData.get("attendanceDate") || "").trim();
      if (!picked) return;
      filters.attendanceDate = picked;
      if (attendanceDateInput) attendanceDateInput.value = picked;
      try {
        await refreshAndRender();
        setMessage(`Табель на ${formatDate(picked)} загружен.`);
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    });
  }

  if (productionFilterForm) {
    productionFilterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(productionFilterForm);
      const picked = String(formData.get("productionDate") || "").trim();
      if (!picked) return;
      filters.productionDate = picked;
      if (productionDateInput) productionDateInput.value = picked;
      try {
        await refreshAndRender();
        setMessage(`Выпуск изделий на ${formatDate(picked)} загружен.`);
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    });
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.editClient) {
      openEditClientModal(target.dataset.editClient);
      return;
    }

    if (target.dataset.editWorker) {
      openEditWorkerModal(target.dataset.editWorker);
      return;
    }

    if (target.dataset.editDeal) {
      openEditDealModal(target.dataset.editDeal);
      return;
    }

    const removeClientId = target.dataset.removeClient;
    if (removeClientId) {
      try {
        await apiRequest(`crm.php?entity=clients&id=${encodeURIComponent(removeClientId)}`, { method: "DELETE" });
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
        await apiRequest(`crm.php?entity=workers&id=${encodeURIComponent(removeWorkerId)}`, { method: "DELETE" });
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
        await apiRequest(`crm.php?entity=deals&id=${encodeURIComponent(removeDealId)}`, { method: "DELETE" });
        await refreshAndRender();
        setMessage("Сделка удалена.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
      return;
    }

    const removeAttendanceId = target.dataset.removeAttendance;
    if (removeAttendanceId) {
      try {
        await apiRequest(`crm.php?entity=attendance&id=${encodeURIComponent(removeAttendanceId)}`, {
          method: "DELETE",
        });
        await refreshAndRender();
        setMessage("Запись табеля удалена.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
      return;
    }

    const removeProductionId = target.dataset.removeProduction;
    if (removeProductionId) {
      try {
        await apiRequest(`crm.php?entity=productions&id=${encodeURIComponent(removeProductionId)}`, {
          method: "DELETE",
        });
        await refreshAndRender();
        setMessage("Запись выпуска удалена.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    }
  });

  const renderClients = () => {
    if (!clientsBody) return;

    if (!state.clients.length) {
      clientsBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">Клиенты еще не добавлены.</td>
        </tr>`;
      return;
    }

    clientsBody.innerHTML = state.clients
      .map((client) => {
        const dealCount = dealCountForClient(client.id);
        return `
          <tr>
            <td>${escapeHtml(client.name || "-")}</td>
            <td>${escapeHtml(client.contact || "-")}</td>
            <td>${escapeHtml(client.phone || "-")}</td>
            <td>${dealCount}</td>
            <td class="actions-cell">
              <button class="btn btn-line btn-small" type="button" data-edit-client="${client.id}">Изменить</button>
              <button class="btn btn-line btn-small btn-danger" type="button" data-remove-client="${client.id}">Удалить</button>
            </td>
          </tr>`;
      })
      .join("");
  };

  const renderWorkers = () => {
    if (workersTotalEl) workersTotalEl.textContent = String(state.workers.length);
    if (!workersBody) return;

    if (!state.workers.length) {
      workersBody.innerHTML = `
        <tr>
          <td colspan="3" class="table-empty">Сотрудники еще не добавлены.</td>
        </tr>`;
      return;
    }

    workersBody.innerHTML = state.workers
      .map(
        (worker) => `
          <tr>
            <td>${escapeHtml(worker.name || "-")}</td>
            <td>${escapeHtml(worker.role || "-")}</td>
            <td class="actions-cell">
              <button class="btn btn-line btn-small" type="button" data-edit-worker="${worker.id}">Изменить</button>
              <button class="btn btn-line btn-small btn-danger" type="button" data-remove-worker="${worker.id}">Удалить</button>
            </td>
          </tr>`
      )
      .join("");
  };

  const renderDeals = () => {
    if (!dealsBody) return;

    if (!state.deals.length) {
      dealsBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty">Сделки еще не добавлены.</td>
        </tr>`;
      return;
    }

    dealsBody.innerHTML = state.deals
      .map((deal) => {
        const client = clientById(deal.client_id);
        const status = statusMeta[deal.status] || { label: deal.status || "-", className: "badge-new" };
        const details = escapeHtml(deal.details || "");
        return `
          <tr>
            <td title="${escapeHtml(deal.order_name || "-")}">${escapeHtml(deal.order_name || "-")}</td>
            <td>${escapeHtml(client?.name || "Удаленный клиент")}</td>
            <td>${formatMoney(Number(deal.amount || 0))}</td>
            <td><span class="badge ${status.className}">${status.label}</span></td>
            <td>${formatDate(deal.created_at)}</td>
            <td class="actions-cell">
              ${details ? `<span title="${details}">Комментарий</span>` : ""}
              <button class="btn btn-line btn-small" type="button" data-edit-deal="${deal.id}">Изменить</button>
              <button class="btn btn-line btn-small btn-danger" type="button" data-remove-deal="${deal.id}">Удалить</button>
            </td>
          </tr>`;
      })
      .join("");
  };

  const renderAttendance = () => {
    if (!attendanceBody) return;

    if (!state.attendance.length) {
      attendanceBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">За выбранную дату записей нет.</td>
        </tr>`;
      return;
    }

    attendanceBody.innerHTML = state.attendance
      .map((row) => {
        const worker = workerById(row.worker_id);
        const status = attendanceStatusMeta[row.status] || { label: row.status || "-", className: "badge-new" };
        return `
          <tr>
            <td>${formatDate(row.work_date)}</td>
            <td>${escapeHtml(worker?.name || "Удаленный сотрудник")}</td>
            <td><span class="badge ${status.className}">${status.label}</span></td>
            <td>${Number(row.overtime_hours || 0)}</td>
            <td class="actions-cell">
              <button class="btn btn-line btn-small btn-danger" type="button" data-remove-attendance="${row.id}">Удалить</button>
            </td>
          </tr>`;
      })
      .join("");
  };

  const renderProductions = () => {
    if (!productionsBody) return;

    if (!state.productions.length) {
      productionsBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">За выбранную дату выпусков нет.</td>
        </tr>`;
      return;
    }

    productionsBody.innerHTML = state.productions
      .map((row) => {
        const worker = workerById(row.worker_id);
        return `
          <tr>
            <td>${formatDate(row.produced_date)}</td>
            <td>${escapeHtml(worker?.name || "Удаленный сотрудник")}</td>
            <td>${escapeHtml(row.product_name || "-")}</td>
            <td>${Number(row.quantity || 0)}</td>
            <td class="actions-cell">
              <button class="btn btn-line btn-small btn-danger" type="button" data-remove-production="${row.id}">Удалить</button>
            </td>
          </tr>`;
      })
      .join("");
  };

  const renderAll = () => {
    renderClients();
    renderWorkers();
    renderDeals();
    renderAttendance();
    renderProductions();
    renderOverview();
    renderProgress();
  };

  const renderOverview = () => {
    if (!overviewCards) return;
    const totalDeals = state.deals.length;
    const doneDeals = state.deals.filter((deal) => deal.status === "won").length;
    const pipeline = state.deals
      .filter((deal) => deal.status === "new" || deal.status === "in_progress")
      .reduce((sum, deal) => sum + Number(deal.amount || 0), 0);

    overviewCards.innerHTML = [
      { value: state.clients.length, label: "Клиенты" },
      { value: state.workers.length, label: "Сотрудники" },
      { value: totalDeals, label: "Всего сделок" },
      { value: doneDeals, label: "Завершено" },
      { value: formatMoney(pipeline), label: "Текущий pipeline" },
    ]
      .map(
        (card) => `
        <article>
          <strong>${card.value}</strong>
          <p>${card.label}</p>
        </article>`
      )
      .join("");
  };

  const renderProgress = () => {
    if (!progressCards) return;
    const qty = state.productions.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    progressCards.innerHTML = `
      <article>
        <strong>${qty}</strong>
        <p>Изделий за ${formatDate(filters.productionDate)}</p>
      </article>`;
  };

  const init = async () => {
    setActiveTab("overview");
    try {
      await refreshAndRender();
      setMessage("Данные синхронизированы с БД.");
    } catch (error) {
      reportError("Ошибка инициализации", error);
    }
  };

  window.addEventListener("error", (event) => {
    reportError("Глобальная JS ошибка", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError("Необработанный Promise reject", event.reason);
  });

  init();
})();
