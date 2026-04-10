(() => {
  const SESSION_KEY = "crm_auth_user";
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:8084/api`;
  const toLocalISODate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

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

  const pipelineStages = [
    { key: "order_received", label: "Поступление заказа" },
    { key: "contract_preparation", label: "Формировка договора" },
    { key: "prepayment_received", label: "Получение предоплаты" },
    { key: "production_ready", label: "Создание товара" },
    { key: "transport_ready_notice", label: "Готовность транспортировки" },
    { key: "contract_closed", label: "Завершение договора" },
  ];

  const stageMeta = {
    order_received: { playbook: "Принимаем заказ, уточняем запрос клиента и фиксируем базовые условия." },
    contract_preparation: { playbook: "Готовим договор, согласовываем условия, сроки и состав поставки." },
    prepayment_received: { playbook: "Контролируем получение предоплаты и подтверждаем запуск работ." },
    production_ready: { playbook: "Запускаем изготовление и отмечаем готовность товара." },
    transport_ready_notice: { playbook: "Подтверждаем готовность к отгрузке и информируем по логистике." },
    contract_closed: { playbook: "Закрываем договор, фиксируем исполнение и переводим материалы в архив." },
  };

  const priorityMeta = {
    low: { label: "Низкий", className: "priority-low" },
    medium: { label: "Средний", className: "priority-medium" },
    high: { label: "Высокий", className: "priority-high" },
    critical: { label: "Критичный", className: "priority-critical" },
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
  const createCalendarNoteBtn = q("[data-create-calendar-note]");
  const createCompanyFileBtn = q("[data-create-company-file]");
  const dealFilterForm = q("[data-deal-filter-form]");
  const diskFilterForm = q("[data-disk-filter-form]");

  const attendanceFilterForm = q("[data-attendance-filter-form]");
  const attendanceReportForm = q("[data-attendance-report-form]");
  const productionFilterForm = q("[data-production-filter-form]");
  const calendarMonthForm = q("[data-calendar-month-form]");
  const clientsBody = q("[data-clients-body]");
  const workersBody = q("[data-workers-body]");
  const attendanceBody = q("[data-attendance-body]");
  const productionsBody = q("[data-productions-body]");
  const calendarGrid = q("[data-calendar-grid]");
  const calendarDayList = q("[data-calendar-day-list]");
  const calendarDayTitle = q("[data-calendar-day-title]");
  const companyFilesBody = q("[data-company-files-body]");

  const overviewCards = q("[data-overview-cards]");
  const overviewLead = q("[data-overview-lead]");
  const overviewFocus = q("[data-overview-focus]");
  const overviewDeadlines = q("[data-overview-deadlines]");
  const overviewClients = q("[data-overview-clients]");
  const overviewTodo = q("[data-overview-todo]");
  const funnelCards = q("[data-funnel-cards]");
  const workersTotalEl = q("[data-workers-total]");
  const kanbanBoard = q("[data-kanban-board]");

  const attendanceDateInput = q("[data-attendance-date]");
  const attendanceReportMonthInput = q("[data-attendance-report-month]");
  const productionDateInput = q("[data-production-date]");
  const calendarMonthInput = q("[data-calendar-month]");
  const calendarPrevBtn = q("[data-calendar-prev]");
  const calendarNextBtn = q("[data-calendar-next]");
  const dealSearchInput = q("[data-deal-search]");
  const dealStatusFilter = q("[data-deal-status-filter]");
  const dealRiskFilter = q("[data-deal-risk-filter]");
  const diskSearchInput = q("[data-disk-search]");

  const stageChartCanvas = q("[data-stage-chart]");
  const activityChartCanvas = q("[data-activity-chart]");
  const overviewCreateDealBtn = q("[data-overview-create-deal]");
  const overviewOpenCalendarBtn = q("[data-overview-open-calendar]");
  const overviewOpenDiskBtn = q("[data-overview-open-disk]");

  const editModal = q("[data-edit-modal]");
  const editModalCard = editModal ? editModal.querySelector(".modal-card") : null;
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

  let currentUser = null;
  try {
    currentUser = JSON.parse(sessionRaw);
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("login.html");
    return;
  }

  if (userInfo) {
    const who = currentUser.user || currentUser.login || "Неизвестно";
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
    console.error("[CRM]", context, error);
  };

  const todayISO = toLocalISODate(new Date());
  const currentMonth = todayISO.slice(0, 7);

  const filters = {
    attendanceDate: todayISO,
    productionDate: todayISO,
    calendarMonth: currentMonth,
    dealSearch: "",
    dealStatus: "all",
    dealRisk: "all",
    diskSearch: "",
  };
  let selectedCalendarDate = todayISO;

  if (attendanceDateInput) attendanceDateInput.value = filters.attendanceDate;
  if (attendanceReportMonthInput) attendanceReportMonthInput.value = currentMonth;
  if (productionDateInput) productionDateInput.value = filters.productionDate;
  if (calendarMonthInput) calendarMonthInput.value = filters.calendarMonth;
  if (dealSearchInput) dealSearchInput.value = filters.dealSearch;
  if (dealStatusFilter) dealStatusFilter.value = filters.dealStatus;
  if (dealRiskFilter) dealRiskFilter.value = filters.dealRisk;
  if (diskSearchInput) diskSearchInput.value = filters.diskSearch;

  let state = {
    clients: [],
    workers: [],
    deals: [],
    attendance: [],
    productions: [],
    calendar_notes: [],
    company_files: [],
  };

  const apiRequest = async (path, options = {}) => {
    const requestUrl = `${API_BASE}/${path}`;
    let response;
    try {
      response = await fetch(requestUrl, options);
    } catch (networkError) {
      throw new Error(`Сетевая ошибка (${requestUrl}): ${formatError(networkError)}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      if (!response.ok) {
        throw new Error(`Ошибка API (${requestUrl}, HTTP ${response.status})`);
      }
      return null;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(`API вернул не JSON (${requestUrl}, HTTP ${response.status})`);
    }

    if (!response.ok || !data?.ok) {
      const base = data?.message || "Ошибка API";
      throw new Error(`${base} (${requestUrl}, HTTP ${response.status})`);
    }

    return data;
  };

  const loadData = async () => {
    const params = new URLSearchParams({
      attendance_date: filters.attendanceDate,
      production_date: filters.productionDate,
      calendar_month: filters.calendarMonth,
      user_id: String(currentUser.id || 0),
    });
    const data = await apiRequest(`crm.php?${params.toString()}`);
    if (data?.data) {
      state = {
        ...state,
        ...data.data,
      };
    }
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
    }).format(Number(value || 0));

  const formatDate = (isoDate) => {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("ru-RU");
  };

  const formatDateTime = (isoDate) => {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    const size = Number(bytes || 0);
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
    return `${(size / (1024 * 1024)).toFixed(2)} МБ`;
  };

  const normalizeReportMonth = (rawValue) => {
    const value = String(rawValue || "").trim();
    if (/^\d{4}-\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
    return "";
  };

  const clientById = (id) => state.clients.find((item) => Number(item.id) === Number(id));
  const workerById = (id) => state.workers.find((item) => Number(item.id) === Number(id));
  const pipelineLabel = (stageKey) => pipelineStages.find((stage) => stage.key === stageKey)?.label || "Сделка";

  const daysBetween = (fromDate, toDate = todayISO) => {
    if (!fromDate) return 0;
    const from = new Date(String(fromDate).slice(0, 10));
    const to = new Date(String(toDate).slice(0, 10));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
    return Math.max(0, Math.round((to - from) / 86400000));
  };

  const getFilteredDeals = () => {
    const search = filters.dealSearch.trim().toLowerCase();
    return state.deals.filter((deal) => {
      if (Number(deal.is_archived) === 1) return false;
      const client = clientById(deal.client_id);
      const worker = workerById(deal.worker_id);
      const baseText = [
        deal.order_name,
        deal.details,
        client?.name,
        worker?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (search && !baseText.includes(search)) return false;
      if (filters.dealStatus !== "all" && deal.status !== filters.dealStatus) return false;
      if (filters.dealRisk === "unassigned" && Number(deal.worker_id || 0) > 0) return false;
      if (filters.dealRisk === "high_priority" && !["high", "critical"].includes(String(deal.priority || ""))) return false;
      return true;
    });
  };

  const getFilteredCompanyFiles = () => {
    const search = filters.diskSearch.trim().toLowerCase();
    if (!search) return state.company_files;
    return state.company_files.filter((file) =>
      [file.file_name, file.category, file.mime_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  };

  const stageGuideHtml = () =>
    `
      <div class="deal-stage-guide">
        <p><strong>Что означает этап сделки:</strong></p>
        <ul>
          ${pipelineStages
            .map((stage) => `<li><strong>${stage.label}:</strong> ${escapeHtml(stageMeta[stage.key]?.playbook || "")}</li>`)
            .join("")}
        </ul>
      </div>
    `;

  const dealCountForClient = (clientId) =>
    state.deals.filter((deal) => Number(deal.client_id) === Number(clientId)).length;

  const isActiveDeal = (deal) => Number(deal.is_archived) !== 1 && (deal.status === "new" || deal.status === "in_progress");

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

  const closeEditModal = () => {
    if (!editModal || !editForm) return;
    editModal.hidden = true;
    editForm.innerHTML = "";
    editForm.className = "modal-form";
    if (editModalCard instanceof HTMLElement) {
      editModalCard.classList.remove("modal-card-wide");
    }
    document.body.classList.remove("modal-open");
  };

  const openEditModal = ({ title, html, onSubmit, className = "", wide = false }) => {
    if (!editModal || !editTitle || !editForm) return;
    editTitle.textContent = title;
    editForm.innerHTML = html;
    editForm.className = `modal-form ${className}`.trim();
    if (editModalCard instanceof HTMLElement) {
      editModalCard.classList.toggle("modal-card-wide", wide);
    }
    editModal.hidden = false;
    document.body.classList.add("modal-open");

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

  const pipelineOptionsHtml = (selectedStage = "order_received") =>
    pipelineStages
      .map(
        (stage) =>
          `<option value="${stage.key}" ${stage.key === selectedStage ? "selected" : ""}>${stage.label}</option>`
      )
      .join("");

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
          headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: Number(formData.get("clientId") || 0),
            name: String(formData.get("name") || "").trim(),
            contact: String(formData.get("contact") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
          }),
        }),
    });
  };

  const openClientDealsModal = (clientId) => {
    const client = state.clients.find((item) => Number(item.id) === Number(clientId));
    if (!client) return;

    const clientDeals = state.deals
      .filter((deal) => Number(deal.client_id) === Number(clientId))
      .sort((a, b) => Number(b.id) - Number(a.id));
    const activeDeals = clientDeals.filter((deal) => Number(deal.is_archived) !== 1);
    const archivedDeals = clientDeals.filter((deal) => Number(deal.is_archived) === 1);
    const activeSum = activeDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
    const archivedSum = archivedDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);

    const renderClientDealCard = (deal) => {
      const worker = workerById(deal.worker_id);
      const status = statusMeta[deal.status] || statusMeta.in_progress;
      return `
        <article class="client-deal-card ${Number(deal.is_archived) === 1 ? "is-archived" : ""}">
          <div class="client-deal-head">
            <div>
              <h4>${escapeHtml(deal.order_name || "Без названия")}</h4>
              <p>${escapeHtml(pipelineLabel(deal.pipeline_stage))}</p>
            </div>
            <span class="badge ${status.className}">${status.label}</span>
          </div>
          <div class="client-deal-meta">
            <p>Ответственный: <strong>${escapeHtml(worker?.name || "не назначен")}</strong></p>
            <p>Сумма: <strong>${formatMoney(deal.amount)}</strong></p>
            <p>Срок договора: <strong>${deal.expected_date ? formatDate(deal.expected_date) : "не указан"}</strong></p>
          </div>
          <div class="client-deal-actions">
            <button class="btn btn-line btn-small" type="button" data-edit-deal="${deal.id}">Открыть сделку</button>
          </div>
        </article>
      `;
    };

    openEditModal({
      title: `Клиент: ${client.name}`,
      className: "client-modal-content",
      wide: true,
      html: `
        <section class="client-profile-shell">
          <div class="client-profile-head">
            <article class="client-profile-card">
              <strong>${escapeHtml(client.name || "-")}</strong>
              <p>Контакт: ${escapeHtml(client.contact || "не указан")}</p>
              <p>Телефон: ${escapeHtml(client.phone || "не указан")}</p>
            </article>
            <article class="client-profile-card">
              <strong>${activeDeals.length}</strong>
              <p>Активные работы</p>
              <span>${formatMoney(activeSum)}</span>
            </article>
            <article class="client-profile-card">
              <strong>${archivedDeals.length}</strong>
              <p>В архиве</p>
              <span>${formatMoney(archivedSum)}</span>
            </article>
          </div>

          <section class="client-deals-section">
            <div class="client-deals-section-head">
              <h4>Активные работы</h4>
              <span>${activeDeals.length} шт.</span>
            </div>
            <div class="client-deals-list">
              ${
                activeDeals.length
                  ? activeDeals.map(renderClientDealCard).join("")
                  : '<p class="empty-state">По этой фирме активных работ нет.</p>'
              }
            </div>
          </section>

          <section class="client-deals-section">
            <div class="client-deals-section-head">
              <h4>Завершенные сделки</h4>
              <span>${archivedDeals.length} шт.</span>
            </div>
            <div class="client-deals-list">
              ${
                archivedDeals.length
                  ? archivedDeals.map(renderClientDealCard).join("")
                  : '<p class="empty-state">По этой фирме завершенных сделок пока нет.</p>'
              }
            </div>
          </section>
        </section>
      `,
      onSubmit: async () => {},
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
          headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
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
        <label class="modal-field">
          <span>Клиент</span>
          <select name="clientId" required>${clientOptionsHtml()}</select>
        </label>
        <label class="modal-field">
          <span>Ответственный сотрудник</span>
          <select name="workerId">${workerOptionsHtml("", "Выберите сотрудника")}</select>
        </label>
        <label class="modal-field">
          <span>Название заказа или договора</span>
          <input type="text" name="orderName" placeholder="Например: Поставка партии продукции" required />
        </label>
        <label class="modal-field">
          <span>Сумма договора, руб.</span>
          <input type="number" min="0" step="1000" name="amount" placeholder="Сумма сделки" required />
        </label>
        <label class="modal-field">
          <span>Этап сделки</span>
          <select name="pipelineStage" required>${pipelineOptionsHtml("order_received")}</select>
        </label>
        ${stageGuideHtml()}
        <label class="modal-field">
          <span>Статус сделки</span>
          <select name="status" required>
            <option value="new">Новая</option>
            <option value="in_progress">В работе</option>
            <option value="won">Завершена</option>
          </select>
        </label>
        <label class="modal-field">
          <span>Приоритет</span>
          <select name="priority" required>
            <option value="low">Низкий приоритет</option>
            <option value="medium" selected>Средний приоритет</option>
            <option value="high">Высокий приоритет</option>
            <option value="critical">Критичный приоритет</option>
          </select>
        </label>
        <label class="modal-field">
          <span>Плановая дата завершения договора</span>
          <input type="date" name="expectedDate" />
        </label>
        <label class="modal-field">
          <span>Комментарий по сделке</span>
          <textarea name="details" rows="3" placeholder="Что согласовано, какие условия и особенности заказа"></textarea>
        </label>
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Создать</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: Number(formData.get("clientId") || 0),
            workerId: Number(formData.get("workerId") || 0),
            orderName: String(formData.get("orderName") || "").trim(),
            amount: Number(formData.get("amount") || 0),
            pipelineStage: String(formData.get("pipelineStage") || "order_received"),
            status: String(formData.get("status") || "new"),
            priority: String(formData.get("priority") || "medium"),
            expectedDate: String(formData.get("expectedDate") || "").trim(),
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
        <label class="modal-field">
          <span>Клиент</span>
          <select name="clientId" required>${clientOptionsHtml(deal.client_id)}</select>
        </label>
        <label class="modal-field">
          <span>Ответственный сотрудник</span>
          <select name="workerId">${workerOptionsHtml(deal.worker_id, "Выберите сотрудника")}</select>
        </label>
        <label class="modal-field">
          <span>Название заказа или договора</span>
          <input type="text" name="orderName" value="${escapeHtml(deal.order_name || "")}" required />
        </label>
        <label class="modal-field">
          <span>Сумма договора, руб.</span>
          <input type="number" min="0" step="1000" name="amount" value="${Number(deal.amount || 0)}" required />
        </label>
        <label class="modal-field">
          <span>Этап сделки</span>
          <select name="pipelineStage" required>${pipelineOptionsHtml(deal.pipeline_stage || "order_received")}</select>
        </label>
        ${stageGuideHtml()}
        <label class="modal-field">
          <span>Статус сделки</span>
          <select name="status" required>
            <option value="new" ${deal.status === "new" ? "selected" : ""}>Новая</option>
            <option value="in_progress" ${deal.status === "in_progress" ? "selected" : ""}>В работе</option>
            <option value="won" ${deal.status === "won" ? "selected" : ""}>Завершена</option>
          </select>
        </label>
        <label class="modal-field">
          <span>Приоритет</span>
          <select name="priority" required>
            <option value="low" ${deal.priority === "low" ? "selected" : ""}>Низкий приоритет</option>
            <option value="medium" ${!deal.priority || deal.priority === "medium" ? "selected" : ""}>Средний приоритет</option>
            <option value="high" ${deal.priority === "high" ? "selected" : ""}>Высокий приоритет</option>
            <option value="critical" ${deal.priority === "critical" ? "selected" : ""}>Критичный приоритет</option>
          </select>
        </label>
        <label class="modal-field">
          <span>Плановая дата завершения договора</span>
          <input type="date" name="expectedDate" value="${escapeHtml(deal.expected_date || "")}" />
        </label>
        <label class="modal-field">
          <span>Комментарий по сделке</span>
          <textarea name="details" rows="3" placeholder="Комментарий">${escapeHtml(deal.details || "")}</textarea>
        </label>
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Сохранить</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId: Number(formData.get("dealId") || 0),
            clientId: Number(formData.get("clientId") || 0),
            workerId: Number(formData.get("workerId") || 0),
            orderName: String(formData.get("orderName") || "").trim(),
            amount: Number(formData.get("amount") || 0),
            pipelineStage: String(formData.get("pipelineStage") || "order_received"),
            status: String(formData.get("status") || "new"),
            priority: String(formData.get("priority") || "medium"),
            expectedDate: String(formData.get("expectedDate") || "").trim(),
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
          headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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

  const openCreateCalendarModal = () => {
    openEditModal({
      title: "Новая памятка",
      html: `
        <input type="date" name="noteDate" value="${selectedCalendarDate}" required />
        <input type="text" name="title" placeholder="Название памятки" required />
        <textarea name="description" rows="4" placeholder="Описание"></textarea>
        <label class="modal-checkbox">
          <input type="checkbox" name="isDone" value="1" /> Выполнено
        </label>
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Сохранить</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=calendar_notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: Number(currentUser.id || 0),
            noteDate: String(formData.get("noteDate") || "").trim(),
            title: String(formData.get("title") || "").trim(),
            description: String(formData.get("description") || "").trim(),
            isDone: formData.get("isDone") ? 1 : 0,
          }),
        }),
    });
  };

  const openCreateCompanyFileModal = () => {
    openEditModal({
      title: "Загрузка файла",
      html: `
        <label class="modal-field">
          <span>Категория документа</span>
          <input type="text" name="category" placeholder="Например: Договор, Счет, Акт" />
        </label>
        <label class="modal-field">
          <span>Выберите файл</span>
          <input type="file" name="file" required />
        </label>
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Загрузить</button>
        </div>
      `,
      onSubmit: async (formData) => {
        const file = formData.get("file");
        if (!(file instanceof File) || !file.name) {
          throw new Error("Выберите файл для загрузки.");
        }
        formData.append("uploadedBy", String(currentUser.id || 0));
        await apiRequest("crm.php?entity=company_files", {
          method: "POST",
          body: formData,
        });
      },
    });
  };

  const openEditCalendarModal = (noteId) => {
    const note = state.calendar_notes.find((item) => Number(item.id) === Number(noteId));
    if (!note) return;

    openEditModal({
      title: "Изменение памятки",
      html: `
        <input type="hidden" name="noteId" value="${note.id}" />
        <input type="date" name="noteDate" value="${escapeHtml(note.note_date || todayISO)}" required />
        <input type="text" name="title" value="${escapeHtml(note.title || "")}" required />
        <textarea name="description" rows="4" placeholder="Описание">${escapeHtml(note.description || "")}</textarea>
        <label class="modal-checkbox">
          <input type="checkbox" name="isDone" value="1" ${Number(note.is_done) === 1 ? "checked" : ""} /> Выполнено
        </label>
        <div class="modal-actions">
          <button class="btn btn-fill" type="submit">Сохранить</button>
        </div>
      `,
      onSubmit: (formData) =>
        apiRequest("crm.php?entity=calendar_notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId: Number(formData.get("noteId") || 0),
            userId: Number(currentUser.id || 0),
            noteDate: String(formData.get("noteDate") || "").trim(),
            title: String(formData.get("title") || "").trim(),
            description: String(formData.get("description") || "").trim(),
            isDone: formData.get("isDone") ? 1 : 0,
          }),
        }),
    });
  };

  const shiftMonth = (monthStr, delta) => {
    if (!/^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
    const [y, m] = monthStr.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const getNextStage = (stage) => {
    const index = pipelineStages.findIndex((item) => item.key === stage);
    if (index === -1 || index >= pipelineStages.length - 1) return "";
    return pipelineStages[index + 1].key;
  };

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
          <tr class="client-row" data-open-client-deals-row="${client.id}">
            <td class="client-row-hotspot">${escapeHtml(client.name || "-")}</td>
            <td class="client-row-hotspot">${escapeHtml(client.contact || "-")}</td>
            <td class="client-row-hotspot">${escapeHtml(client.phone || "-")}</td>
            <td class="client-row-hotspot">${dealCount}</td>
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

  const renderFunnelCards = (deals) => {
    if (!funnelCards) return;
    const activeDeals = deals.filter((deal) => deal.status !== "won" && deal.status !== "lost");
    const totalPipeline = activeDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
    const completedDeals = state.deals.filter((deal) => deal.status === "won" && Number(deal.is_archived) !== 1).length;
    const archivedDeals = state.deals.filter((deal) => Number(deal.is_archived) === 1).length;

    funnelCards.innerHTML = [
      { value: formatMoney(totalPipeline), label: "Сумма сделок в работе" },
      { value: activeDeals.length, label: "Сделок в работе" },
      { value: completedDeals, label: "Завершено" },
      { value: archivedDeals, label: "В архиве" },
    ]
      .map(
        (card) => `
          <article>
            <strong>${card.value}</strong>
            <p>${card.label}</p>
          </article>
        `
      )
      .join("");
  };

  const renderKanban = () => {
    if (!kanbanBoard) return;

    const filteredDeals = getFilteredDeals();
    renderFunnelCards(filteredDeals);

    kanbanBoard.innerHTML = pipelineStages
      .map((stage) => {
        const deals = filteredDeals.filter((deal) => (deal.pipeline_stage || "order_received") === stage.key);
        const amount = deals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
        const meta = stageMeta[stage.key] || { playbook: "" };

        return `
          <article class="kanban-column" data-stage-drop="${stage.key}">
            <header class="kanban-col-head">
              <div class="kanban-col-top">
                <span>${stage.label}</span>
                <span class="kanban-total">${formatMoney(amount)}</span>
              </div>
              <div class="kanban-col-meta">
                <span class="kanban-count">${deals.length} сдел.</span>
              </div>
              <p class="kanban-stage-note">${escapeHtml(meta.playbook || "")}</p>
            </header>
            <div class="kanban-list">
              ${
                deals.length
                  ? deals
                      .map((deal) => {
                        const client = clientById(deal.client_id);
                        const worker = workerById(deal.worker_id);
                        const status = statusMeta[deal.status] || statusMeta.new;
                        const nextStage = getNextStage(deal.pipeline_stage || "order_received");
                        const priority = priorityMeta[deal.priority] || priorityMeta.medium;
                        const stageAge = daysBetween(deal.stage_updated_at || deal.created_at);
                        const canReject = ["order_received", "contract_preparation"].includes(String(deal.pipeline_stage || ""));
                        const canArchive =
                          String(deal.pipeline_stage || "") === "contract_closed" &&
                          deal.status === "won" &&
                          Number(deal.is_archived) !== 1;
                        return `
                          <article class="deal-card" draggable="true" data-drag-deal="${deal.id}">
                            <div class="deal-card-top">
                              <h4>${escapeHtml(deal.order_name || "Без названия")}</h4>
                              <span class="priority-badge ${priority.className}">${priority.label}</span>
                            </div>
                            <div class="deal-card-tags">
                              <span class="badge ${status.className}">${status.label}</span>
                            </div>
                            <p class="deal-line">Клиент: ${escapeHtml(client?.name || "Удаленный клиент")}</p>
                            <p class="deal-line">Ответственный: <strong>${escapeHtml(worker?.name || "не назначен")}</strong></p>
                            <p class="deal-line">Сумма: <strong>${formatMoney(deal.amount)}</strong></p>
                            <p class="deal-line">Срок договора: ${deal.expected_date ? formatDate(deal.expected_date) : "не указан"}</p>
                            <p class="deal-line">В этапе: ${stageAge} дн.</p>
                            <div class="deal-actions">
                              ${
                                nextStage
                                  ? `<button class="btn btn-line btn-small" type="button" data-advance-deal="${deal.id}" data-next-stage="${nextStage}">След. этап</button>`
                                  : ""
                              }
                              <button class="btn btn-line btn-small" type="button" data-edit-deal="${deal.id}">Изменить</button>
                              ${canReject ? `<button class="btn btn-line btn-small btn-danger" type="button" data-mark-lost="${deal.id}">В отказ</button>` : ""}
                              ${canArchive ? `<button class="btn btn-fill btn-small" type="button" data-archive-deal="${deal.id}">В архив</button>` : ""}
                            </div>
                          </article>
                        `;
                      })
                      .join("")
                  : '<p class="empty-state">Нет сделок</p>'
              }
            </div>
          </article>
        `;
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
          <td colspan="4" class="table-empty">За выбранную дату выпусков нет.</td>
        </tr>`;
      return;
    }

    productionsBody.innerHTML = state.productions
      .map((row) => {
        return `
          <tr>
            <td>${formatDate(row.produced_date)}</td>
            <td>${escapeHtml(row.product_name || "-")}</td>
            <td>${Number(row.quantity || 0)}</td>
            <td class="actions-cell">
              <button class="btn btn-line btn-small btn-danger" type="button" data-remove-production="${row.id}">Удалить</button>
            </td>
          </tr>`;
      })
      .join("");
  };

  const renderCalendar = () => {
    if (!calendarGrid || !calendarDayList || !calendarDayTitle) return;

    const [year, month] = filters.calendarMonth.split("-").map(Number);
    if (!year || !month) return;

    if (!selectedCalendarDate.startsWith(filters.calendarMonth)) {
      selectedCalendarDate = `${filters.calendarMonth}-01`;
    }

    const firstOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const weekDayMon0 = (firstOfMonth.getDay() + 6) % 7;
    const totalCells = Math.ceil((weekDayMon0 + daysInMonth) / 7) * 7;
    const startDate = new Date(year, month - 1, 1 - weekDayMon0);

    const notesByDate = state.calendar_notes.reduce((acc, note) => {
      const key = String(note.note_date || "");
      if (!acc[key]) acc[key] = [];
      acc[key].push(note);
      return acc;
    }, {});

    const dealDeadlinesByDate = state.deals.reduce((acc, deal) => {
      const key = String(deal.expected_date || "").trim();
      if (!key || Number(deal.is_archived) === 1) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        id: `deal-${deal.id}`,
        deal_id: deal.id,
        order_name: deal.order_name || "Сделка без названия",
        amount: deal.amount,
        status: deal.status,
        pipeline_stage: deal.pipeline_stage,
        client_id: deal.client_id,
      });
      return acc;
    }, {});

    calendarGrid.innerHTML = Array.from({ length: totalCells }, (_, idx) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + idx);
      const dateIso = toLocalISODate(d);
      const isCurrentMonth = dateIso.startsWith(filters.calendarMonth);
      const isToday = dateIso === todayISO;
      const isSelected = dateIso === selectedCalendarDate;
      const dayNotes = notesByDate[dateIso] || [];
      const dayDeals = dealDeadlinesByDate[dateIso] || [];
      const noteCount = dayNotes.length;
      const dealCount = dayDeals.length;
      const doneCount = dayNotes.filter((note) => Number(note.is_done) === 1).length;

      return `
        <button
          class="calendar-cell ${isCurrentMonth ? "" : "is-other-month"} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}"
          type="button"
          data-calendar-pick="${dateIso}"
        >
          <span class="calendar-day-top">
            <span class="calendar-day-num">${d.getDate()}</span>
            ${noteCount + dealCount > 0 ? `<span class="calendar-day-count">${noteCount + dealCount}</span>` : ""}
          </span>
          <span class="calendar-markers">
            ${noteCount ? `<span class="calendar-marker is-note">Памятки ${noteCount}</span>` : ""}
            ${dealCount ? `<span class="calendar-marker is-deal">Сделки ${dealCount}</span>` : ""}
            ${doneCount ? `<span class="calendar-marker is-done">Готово ${doneCount}</span>` : ""}
          </span>
          <span class="calendar-dots">
            ${dayNotes
              .slice(0, 3)
              .map((note) => `<i class="calendar-dot ${Number(note.is_done) === 1 ? "is-done" : ""}"></i>`)
              .join("")}
            ${dayDeals.slice(0, 2).map(() => `<i class="calendar-dot is-deal"></i>`).join("")}
          </span>
        </button>
      `;
    }).join("");

    const dayNotes = (notesByDate[selectedCalendarDate] || []).sort((a, b) => Number(a.id) < Number(b.id) ? 1 : -1);
    const dayDeals = (dealDeadlinesByDate[selectedCalendarDate] || []).sort((a, b) => Number(a.deal_id) < Number(b.deal_id) ? 1 : -1);
    calendarDayTitle.textContent = `События на ${formatDate(selectedCalendarDate)}`;

    if (!dayNotes.length && !dayDeals.length) {
      calendarDayList.innerHTML = `<p class="empty-state">На выбранный день задач и сроков нет.</p>`;
      return;
    }

    const noteCardsHtml = dayNotes
      .map((note) => {
        const isDone = Number(note.is_done) === 1;
        return `
          <article class="calendar-note-card">
            <div class="calendar-note-head">
              <span class="calendar-note-type is-note">Памятка</span>
              <span class="badge ${isDone ? "badge-done" : "badge-pending"}">${isDone ? "Выполнено" : "В работе"}</span>
            </div>
            <h4>${escapeHtml(note.title || "-")}</h4>
            <p>${escapeHtml(note.description || "Без описания")}</p>
            <div class="calendar-note-actions">
              <button class="btn btn-line btn-small" type="button" data-toggle-note="${note.id}">${isDone ? "Вернуть" : "Закрыть"}</button>
              <button class="btn btn-line btn-small" type="button" data-edit-note="${note.id}">Изменить</button>
              <button class="btn btn-line btn-small btn-danger" type="button" data-remove-note="${note.id}">Удалить</button>
            </div>
          </article>
        `;
      })
      .join("");

    const dealCardsHtml = dayDeals
      .map((deal) => {
        const client = clientById(deal.client_id);
        const status = statusMeta[deal.status] || statusMeta.in_progress;
        return `
          <article class="calendar-note-card is-deal-deadline">
            <div class="calendar-note-head">
              <span class="calendar-note-type is-deal">Срок договора</span>
              <span class="badge ${status.className}">${status.label}</span>
            </div>
            <h4>${escapeHtml(deal.order_name || "-")}</h4>
            <p>Этап: ${escapeHtml(pipelineLabel(deal.pipeline_stage))}</p>
            <p>Клиент: ${escapeHtml(client?.name || "Не указан")}</p>
            <p>Сумма: <strong>${formatMoney(deal.amount)}</strong></p>
            <div class="calendar-note-actions">
              <button class="btn btn-line btn-small" type="button" data-edit-deal="${deal.deal_id}">Открыть сделку</button>
            </div>
          </article>
        `;
      })
      .join("");

    calendarDayList.innerHTML = `${noteCardsHtml}${dealCardsHtml}`;
  };

  const renderCompanyFiles = () => {
    if (!companyFilesBody) return;
    const files = getFilteredCompanyFiles();

    if (!files.length) {
      companyFilesBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">Файлы не найдены.</td>
        </tr>`;
      return;
    }

    companyFilesBody.innerHTML = files
      .map((file) => {
        return `
          <tr>
            <td>${escapeHtml(file.file_name || "-")}</td>
            <td>${escapeHtml(file.category || "-")}</td>
            <td>${formatFileSize(file.file_size)}</td>
            <td>${formatDate(file.created_at)}</td>
            <td class="actions-cell">
              <button class="btn btn-line btn-small" type="button" data-download-file="${file.id}">Скачать</button>
              <button class="btn btn-line btn-small btn-danger" type="button" data-remove-file="${file.id}">Удалить</button>
            </td>
          </tr>
        `;
      })
      .join("");
  };

  const withCanvasCtx = (canvas, drawFn) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawFn(ctx, rect.width, rect.height);
  };

  const drawAxes = (ctx, width, height, margin = 28) => {
    ctx.strokeStyle = "rgba(30, 54, 84, 0.26)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
  };

  const renderStageChart = () => {
    withCanvasCtx(stageChartCanvas, (ctx, width, height) => {
      const margin = 34;
      const labelsWidth = 178;
      const chartWidth = width - margin * 2 - labelsWidth;
      const barAreaHeight = height - margin * 2;
      const rowHeight = barAreaHeight / pipelineStages.length;
      const counts = pipelineStages.map((stage) =>
        state.deals.filter((deal) => Number(deal.is_archived) !== 1 && (deal.pipeline_stage || "order_received") === stage.key).length
      );
      const max = Math.max(...counts, 1);

      pipelineStages.forEach((stage, index) => {
        const count = counts[index];
        const ratio = count / max;
        const y = margin + index * rowHeight + 10;
        const barHeight = Math.max(18, rowHeight - 20);
        const x = margin + labelsWidth;
        const barWidth = Math.max(6, chartWidth * ratio);

        ctx.fillStyle = "#35506f";
        ctx.font = "12px Commissioner, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(stage.label, margin, y + barHeight / 2);

        ctx.fillStyle = "rgba(31, 120, 216, 0.12)";
        ctx.fillRect(x, y, chartWidth, barHeight);

        const grd = ctx.createLinearGradient(x, y, x + barWidth, y);
        grd.addColorStop(0, "#1f78d8");
        grd.addColorStop(1, "#44b27a");
        ctx.fillStyle = grd;
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = "#1e2c3a";
        ctx.font = "700 12px Commissioner, sans-serif";
        ctx.fillText(`${count}`, x + barWidth + 8, y + barHeight / 2);
      });
    });
  };

  const renderActivityChart = () => {
    withCanvasCtx(activityChartCanvas, (ctx, width, height) => {
      const margin = 34;
      const chartWidth = width - margin * 2;
      const chartHeight = height - margin * 2;
      const items = [
        { label: "Новые", value: state.deals.filter((deal) => deal.status === "new" && Number(deal.is_archived) !== 1).length, color: "#3c8df0" },
        { label: "В работе", value: state.deals.filter((deal) => deal.status === "in_progress" && Number(deal.is_archived) !== 1).length, color: "#f0a21b" },
        { label: "Завершены", value: state.deals.filter((deal) => deal.status === "won" && Number(deal.is_archived) !== 1).length, color: "#3fab73" },
        { label: "В архиве", value: state.deals.filter((deal) => Number(deal.is_archived) === 1).length, color: "#74849a" },
      ];
      const max = Math.max(...items.map((item) => item.value), 1);
      const barWidth = chartWidth / items.length - 18;

      drawAxes(ctx, width, height, margin);

      items.forEach((item, index) => {
        const ratio = item.value / max;
        const x = margin + index * (barWidth + 18) + 9;
        const barH = Math.max(8, chartHeight * ratio);
        const y = height - margin - barH;

        ctx.fillStyle = item.color;
        ctx.fillRect(x, y, barWidth, barH);

        ctx.fillStyle = "#1e2c3a";
        ctx.font = "700 12px Commissioner, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(item.value), x + barWidth / 2, y - 8);

        ctx.fillStyle = "#35506f";
        ctx.font = "12px Commissioner, sans-serif";
        ctx.fillText(item.label, x + barWidth / 2, height - margin + 16);
      });

      ctx.textAlign = "start";
    });
  };

  const renderOverview = () => {
    if (!overviewCards) return;
    const activeDeals = state.deals.filter((deal) => isActiveDeal(deal));
    const archivedDeals = state.deals.filter((deal) => Number(deal.is_archived) === 1);
    const totalDeals = state.deals.length;
    const doneDeals = state.deals.filter((deal) => deal.status === "won").length;
    const pipeline = activeDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
    const todayDeadlines = activeDeals.filter((deal) => String(deal.expected_date || "") === todayISO).length;
    const noOwnerDeals = activeDeals.filter((deal) => !deal.worker_id).length;
    const currentMonthLabel = new Date(`${filters.calendarMonth}-01`).toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
    const monthCreatedDeals = state.deals.filter((deal) => String(deal.created_at || "").slice(0, 7) === filters.calendarMonth).length;

    if (overviewLead) {
      overviewLead.textContent = `В ${currentMonthLabel} в работе ${activeDeals.length} сделок на ${formatMoney(pipeline)}. Сегодня ближайший контроль — ${todayDeadlines} сроков договоров.`;
    }

    overviewCards.innerHTML = [
      { value: formatMoney(pipeline), label: "Портфель в работе" },
      { value: activeDeals.length, label: "Активные сделки" },
      { value: doneDeals, label: "Завершенные договоры" },
      { value: state.clients.length, label: "Клиенты" },
      { value: state.workers.length, label: "Сотрудники" },
      { value: monthCreatedDeals, label: "Новых сделок за месяц" },
    ]
      .map(
        (card) => `
        <article>
          <strong>${card.value}</strong>
          <p>${card.label}</p>
        </article>`
      )
      .join("");

    if (overviewFocus) {
      overviewFocus.innerHTML = `
        <div class="overview-focus-copy">
          <p class="overview-focus-kicker">Главный фокус дня</p>
          <h3>${noOwnerDeals > 0 ? "Требуют назначения ответственного" : "Воронка под контролем"}</h3>
          <p>${
            noOwnerDeals > 0
              ? `Сейчас ${noOwnerDeals} ${noOwnerDeals === 1 ? "сделка осталась" : "сделки остались"} без ответственного. Это главный риск потери темпа.`
              : `Все активные сделки уже закреплены за сотрудниками. Можно фокусироваться на сроках и завершении договоров.`
          }</p>
        </div>
        <div class="overview-focus-stats">
          <div>
            <strong>${todayDeadlines}</strong>
            <span>сроков сегодня</span>
          </div>
          <div>
            <strong>${archivedDeals.length}</strong>
            <span>в архиве</span>
          </div>
          <div>
            <strong>${state.workers.length}</strong>
            <span>сотрудников в CRM</span>
          </div>
        </div>
      `;
    }

    if (overviewDeadlines) {
      const upcomingDeals = activeDeals
        .filter((deal) => String(deal.expected_date || "").trim() !== "")
        .sort((a, b) => String(a.expected_date).localeCompare(String(b.expected_date)))
        .slice(0, 5);

      overviewDeadlines.innerHTML = upcomingDeals.length
        ? upcomingDeals
            .map((deal) => {
              const client = clientById(deal.client_id);
              return `
                <button class="overview-mini-item" type="button" data-edit-deal="${deal.id}">
                  <strong>${escapeHtml(deal.order_name || "Сделка")}</strong>
                  <span>${escapeHtml(client?.name || "Клиент не указан")}</span>
                  <em>${formatDate(deal.expected_date)}</em>
                </button>
              `;
            })
            .join("")
        : '<p class="empty-state">Ближайших сроков по договорам пока нет.</p>';
    }

    if (overviewClients) {
      const topClients = state.clients
        .map((client) => {
          const clientDeals = state.deals.filter((deal) => Number(deal.client_id) === Number(client.id));
          const sum = clientDeals.reduce((acc, deal) => acc + Number(deal.amount || 0), 0);
          return { client, sum, count: clientDeals.length };
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.sum - a.sum)
        .slice(0, 5);

      overviewClients.innerHTML = topClients.length
        ? topClients
            .map(
              ({ client, sum, count }) => `
                <button class="overview-mini-item" type="button" data-open-client-deals="${client.id}">
                  <strong>${escapeHtml(client.name || "-")}</strong>
                  <span>${count} ${count === 1 ? "сделка" : "сделок"}</span>
                  <em>${formatMoney(sum)}</em>
                </button>
              `
            )
            .join("")
        : '<p class="empty-state">Клиенты со сделками появятся здесь автоматически.</p>';
    }

    if (overviewTodo) {
      const todoItems = [
        {
          title: "Календарь сроков",
          meta: `${todayDeadlines} на сегодня`,
          action: "calendar",
        },
        {
          title: "Документы компании",
          meta: `${state.company_files.length} в диске`,
          action: "disk",
        },
        {
          title: "Сделки без ответственного",
          meta: `${noOwnerDeals} под контролем`,
          action: "deals",
        },
      ];

      overviewTodo.innerHTML = todoItems
        .map(
          (item) => `
            <button class="overview-mini-item" type="button" data-overview-nav="${item.action}">
              <strong>${item.title}</strong>
              <em>${item.meta}</em>
            </button>
          `
        )
        .join("");
    }

    renderStageChart();
    renderActivityChart();
  };

  const renderAll = () => {
    renderClients();
    renderWorkers();
    renderKanban();
    renderAttendance();
    renderProductions();
    renderCalendar();
    renderCompanyFiles();
    renderOverview();
  };

  if (createClientBtn) createClientBtn.addEventListener("click", openCreateClientModal);
  if (createWorkerBtn) createWorkerBtn.addEventListener("click", openCreateWorkerModal);
  if (createDealBtn) createDealBtn.addEventListener("click", openCreateDealModal);
  if (createAttendanceBtn) createAttendanceBtn.addEventListener("click", openCreateAttendanceModal);
  if (createProductionBtn) createProductionBtn.addEventListener("click", openCreateProductionModal);
  if (createCalendarNoteBtn) createCalendarNoteBtn.addEventListener("click", openCreateCalendarModal);
  if (createCompanyFileBtn) createCompanyFileBtn.addEventListener("click", openCreateCompanyFileModal);
  if (overviewCreateDealBtn) overviewCreateDealBtn.addEventListener("click", openCreateDealModal);
  if (overviewOpenCalendarBtn) overviewOpenCalendarBtn.addEventListener("click", () => setActiveTab("calendar"));
  if (overviewOpenDiskBtn) overviewOpenDiskBtn.addEventListener("click", () => setActiveTab("disk"));

  if (calendarMonthForm) {
    calendarMonthForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(calendarMonthForm);
      const month = normalizeReportMonth(formData.get("calendarMonth"));
      if (!month) {
        setMessage("Укажите месяц в формате ГГГГ-ММ.", "is-error");
        return;
      }
      filters.calendarMonth = month;
      if (calendarMonthInput) calendarMonthInput.value = month;
      if (!selectedCalendarDate.startsWith(month)) {
        selectedCalendarDate = `${month}-01`;
      }

      try {
        await refreshAndRender();
        setMessage(`Календарь за ${month} загружен.`, "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    });
  }

  if (dealFilterForm) {
    dealFilterForm.addEventListener("input", () => {
      filters.dealSearch = String(dealSearchInput?.value || "").trim();
      filters.dealStatus = String(dealStatusFilter?.value || "all");
      filters.dealRisk = String(dealRiskFilter?.value || "all");
      renderKanban();
    });
    dealFilterForm.addEventListener("change", () => {
      filters.dealSearch = String(dealSearchInput?.value || "").trim();
      filters.dealStatus = String(dealStatusFilter?.value || "all");
      filters.dealRisk = String(dealRiskFilter?.value || "all");
      renderKanban();
    });
  }

  if (calendarPrevBtn) {
    calendarPrevBtn.addEventListener("click", async () => {
      filters.calendarMonth = shiftMonth(filters.calendarMonth, -1);
      if (calendarMonthInput) calendarMonthInput.value = filters.calendarMonth;
      selectedCalendarDate = `${filters.calendarMonth}-01`;
      try {
        await refreshAndRender();
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    });
  }

  if (calendarNextBtn) {
    calendarNextBtn.addEventListener("click", async () => {
      filters.calendarMonth = shiftMonth(filters.calendarMonth, 1);
      if (calendarMonthInput) calendarMonthInput.value = filters.calendarMonth;
      selectedCalendarDate = `${filters.calendarMonth}-01`;
      try {
        await refreshAndRender();
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    });
  }

  if (diskFilterForm) {
    diskFilterForm.addEventListener("input", () => {
      filters.diskSearch = String(diskSearchInput?.value || "").trim();
      renderCompanyFiles();
    });
  }

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

  if (attendanceReportForm) {
    attendanceReportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(attendanceReportForm);
      const month = normalizeReportMonth(formData.get("attendanceMonth"));
      if (!/^\d{4}-\d{2}$/.test(month)) {
        setMessage("Укажите месяц отчета в формате ГГГГ-ММ.", "is-error");
        return;
      }

      const url = `${API_BASE}/crm.php?entity=attendance_report&month=${encodeURIComponent(month)}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Не удалось сформировать отчет (HTTP ${response.status}).`);
        }
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `attendance_report_${month}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);
        setMessage(`Отчет за ${month} скачан.`, "is-success");
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

    const pickDateBtn = target.closest("[data-calendar-pick]");
    const pickDate = pickDateBtn instanceof HTMLElement ? pickDateBtn.dataset.calendarPick : "";
    if (pickDate) {
      selectedCalendarDate = pickDate;
      renderCalendar();
      return;
    }

    if (target.dataset.editClient) {
      openEditClientModal(target.dataset.editClient);
      return;
    }

    if (target.dataset.openClientDeals) {
      openClientDealsModal(target.dataset.openClientDeals);
      return;
    }

    const overviewNav = target.dataset.overviewNav;
    if (overviewNav) {
      setActiveTab(overviewNav);
      return;
    }

    const clientRow = target.closest("[data-open-client-deals-row]");
    if (clientRow instanceof HTMLElement && !target.closest(".actions-cell")) {
      openClientDealsModal(clientRow.dataset.openClientDealsRow);
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

    if (target.dataset.editNote) {
      openEditCalendarModal(target.dataset.editNote);
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

    const markLostId = target.dataset.markLost;
    if (markLostId) {
      try {
        await apiRequest(`crm.php?entity=deals&id=${encodeURIComponent(markLostId)}`, { method: "DELETE" });
        await refreshAndRender();
        setMessage("Сделка отменена и удалена.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
      return;
    }

    const advanceDealId = target.dataset.advanceDeal;
    const nextStage = target.dataset.nextStage;
    if (advanceDealId && nextStage) {
      const deal = state.deals.find((item) => Number(item.id) === Number(advanceDealId));
      if (!deal) return;
      try {
        await apiRequest("crm.php?entity=deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId: Number(deal.id),
            clientId: Number(deal.client_id),
            workerId: Number(deal.worker_id || 0),
            orderName: String(deal.order_name || "").trim(),
            amount: Number(deal.amount || 0),
            pipelineStage: nextStage,
            expectedDate: String(deal.expected_date || ""),
            priority: String(deal.priority || "medium"),
            details: String(deal.details || ""),
            isArchived: Number(deal.is_archived) === 1 ? 1 : 0,
            status: nextStage === "contract_closed" ? "won" : deal.status === "new" ? "in_progress" : deal.status,
          }),
        });
        await refreshAndRender();
        setMessage("Этап сделки обновлен.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
      return;
    }

    const archiveDealId = target.dataset.archiveDeal;
    if (archiveDealId) {
      const deal = state.deals.find((item) => Number(item.id) === Number(archiveDealId));
      if (!deal) return;
      try {
        await apiRequest("crm.php?entity=deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId: Number(deal.id),
            clientId: Number(deal.client_id),
            workerId: Number(deal.worker_id || 0),
            orderName: String(deal.order_name || "").trim(),
            amount: Number(deal.amount || 0),
            pipelineStage: "contract_closed",
            expectedDate: String(deal.expected_date || ""),
            priority: String(deal.priority || "medium"),
            details: String(deal.details || ""),
            status: "won",
            isArchived: 1,
          }),
        });
        await refreshAndRender();
        setMessage("Сделка переведена в архив.", "is-success");
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
      return;
    }

    const toggleNoteId = target.dataset.toggleNote;
    if (toggleNoteId) {
      const note = state.calendar_notes.find((item) => Number(item.id) === Number(toggleNoteId));
      if (!note) return;
      try {
        await apiRequest("crm.php?entity=calendar_notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId: Number(note.id),
            userId: Number(currentUser.id || 0),
            noteDate: String(note.note_date || ""),
            title: String(note.title || ""),
            description: String(note.description || ""),
            isDone: Number(note.is_done) === 1 ? 0 : 1,
          }),
        });
        await refreshAndRender();
        setMessage("Статус памятки обновлен.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
      return;
    }

    const removeNoteId = target.dataset.removeNote;
    if (removeNoteId) {
      try {
        await apiRequest(
          `crm.php?entity=calendar_notes&id=${encodeURIComponent(removeNoteId)}&user_id=${encodeURIComponent(
            String(currentUser.id || 0)
          )}`,
          { method: "DELETE" }
        );
        await refreshAndRender();
        setMessage("Памятка удалена.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
      return;
    }

    const downloadFileId = target.dataset.downloadFile;
    if (downloadFileId) {
      window.open(`${API_BASE}/crm.php?entity=company_file_download&id=${encodeURIComponent(downloadFileId)}`, "_blank");
      return;
    }

    const removeFileId = target.dataset.removeFile;
    if (removeFileId) {
      try {
        await apiRequest(`crm.php?entity=company_files&id=${encodeURIComponent(removeFileId)}`, { method: "DELETE" });
        await refreshAndRender();
        setMessage("Файл удален из диска.", "is-success");
      } catch (error) {
        setMessage(error.message, "is-error");
      }
    }
  });

  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const card = target.closest("[data-drag-deal]");
    if (!(card instanceof HTMLElement)) return;
    event.dataTransfer?.setData("text/plain", card.dataset.dragDeal || "");
    event.dataTransfer.effectAllowed = "move";
  });

  document.addEventListener("dragover", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const stageColumn = target.closest("[data-stage-drop]");
    if (!stageColumn) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });

  document.addEventListener("drop", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const stageColumn = target.closest("[data-stage-drop]");
    if (!(stageColumn instanceof HTMLElement)) return;
    event.preventDefault();
    const dealId = event.dataTransfer?.getData("text/plain") || "";
    const nextStage = stageColumn.dataset.stageDrop || "";
    const deal = state.deals.find((item) => Number(item.id) === Number(dealId));
    if (!deal || !nextStage || nextStage === deal.pipeline_stage) return;

    try {
      await apiRequest("crm.php?entity=deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: Number(deal.id),
          clientId: Number(deal.client_id),
          workerId: Number(deal.worker_id || 0),
          orderName: String(deal.order_name || "").trim(),
          amount: Number(deal.amount || 0),
          pipelineStage: nextStage,
          expectedDate: String(deal.expected_date || ""),
          priority: String(deal.priority || "medium"),
          details: String(deal.details || ""),
          isArchived: Number(deal.is_archived) === 1 ? 1 : 0,
          status: nextStage === "contract_closed" ? "won" : deal.status === "new" ? "in_progress" : deal.status,
        }),
      });
      await refreshAndRender();
      setMessage("Сделка перенесена по воронке.", "is-success");
    } catch (error) {
      setMessage(error.message, "is-error");
    }
  });

  window.addEventListener("resize", () => {
    renderStageChart();
    renderActivityChart();
  });

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
