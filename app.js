// --- Data model & persistence ------------------------------------------

const STORAGE_KEY = "customActionPointsApp_v2";

const defaultState = {
  actions: [
    {
      id: "a1",
      name: "Deep work (25 min)",
      basePoints: 10,
      category: "Focus",
      color: "#38bdf8",
      countToday: 0
    },
    {
      id: "a2",
      name: "Workout session",
      basePoints: 20,
      category: "Health",
      color: "#22c55e",
      countToday: 0
    },
    {
      id: "a3",
      name: "Social connection",
      basePoints: 8,
      category: "Social",
      color: "#f97316",
      countToday: 0
    }
  ],
  multipliers: [
    {
      id: "m1",
      name: "Power hour",
      value: 2.0,
      color: "#f97316",
      active: false
    },
    {
      id: "m2",
      name: "Flow state",
      value: 1.5,
      color: "#a855f7",
      active: false
    }
  ],
  dailyTotals: {}
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      actions: parsed.actions || structuredClone(defaultState.actions),
      multipliers:
        parsed.multipliers || structuredClone(defaultState.multipliers),
      dailyTotals:
        parsed.dailyTotals || structuredClone(defaultState.dailyTotals)
    };
  } catch (e) {
    console.warn("Failed to load state, using defaults", e);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// --- Helpers -----------------------------------------------------------

function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(key) {
  const [y, m, d] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function getTodayTotals() {
  const key = todayKey();
  if (!state.dailyTotals[key]) {
    state.dailyTotals[key] = { totalPoints: 0, categories: {} };
  }
  return state.dailyTotals[key];
}

function currentMultiplierProduct() {
  const active = state.multipliers.filter((m) => m.active);
  if (active.length === 0) return 1.0;
  return active.reduce((prod, m) => prod * Number(m.value || 1), 1);
}

function randomId(prefix) {
  return (
    prefix +
    Math.random().toString(36).slice(2, 7) +
    Date.now().toString(36).slice(-3)
  );
}

// --- DOM references ----------------------------------------------------

const todayLabelEl = document.getElementById("todayLabel");
const todayTotalPointsEl = document.getElementById("todayTotalPoints");
const todayCategoryCountEl = document.getElementById("todayCategoryCount");
const todayCategoryChipsEl = document.getElementById("todayCategoryChips");
const currentMultiplierDisplayEl = document.getElementById(
  "currentMultiplierDisplay"
);
const multiplierRowEl = document.getElementById("multiplierRow");
const actionsGridEl = document.getElementById("actionsGrid");
const dailyLogListEl = document.getElementById("dailyLogList");

const actionNameInput = document.getElementById("actionNameInput");
const actionPointsInput = document.getElementById("actionPointsInput");
const actionCategoryInput = document.getElementById("actionCategoryInput");
const actionColorInput = document.getElementById("actionColorInput");
const addActionBtn = document.getElementById("addActionBtn");
const resetActionsBtn = document.getElementById("resetActionsBtn");

const multiplierNameInput = document.getElementById("multiplierNameInput");
const multiplierValueInput = document.getElementById("multiplierValueInput");
const multiplierColorInput = document.getElementById("multiplierColorInput");
const addMultiplierBtn = document.getElementById("addMultiplierBtn");
const resetMultipliersBtn = document.getElementById("resetMultipliersBtn");

const clearAllDataBtn = document.getElementById("clearAllDataBtn");

const settingsActionsListEl = document.getElementById("settingsActionsList");
const settingsMultipliersListEl = document.getElementById(
  "settingsMultipliersList"
);

// Modal elements
const modalOverlay = document.getElementById("modalOverlay");
const modalTitleEl = document.getElementById("modalTitle");
const modalNameInput = document.getElementById("modalNameInput");
const modalPointsInput = document.getElementById("modalPointsInput");
const modalCategoryInput = document.getElementById("modalCategoryInput");
const modalColorInput = document.getElementById("modalColorInput");
const modalPointsRow = document.getElementById("modalPointsRow");
const modalCategoryRow = document.getElementById("modalCategoryRow");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalSaveBtn = document.getElementById("modalSaveBtn");

// Modal state
let modalContext = null; // { type: 'action'|'multiplier', id: string }

// --- Rendering ---------------------------------------------------------

function renderTodayHeader() {
  const d = new Date();
  todayLabelEl.textContent = d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
}

function renderTotals() {
  const today = getTodayTotals();
  todayTotalPointsEl.textContent = today.totalPoints.toFixed(0);

  const categories = today.categories || {};
  const categoryNames = Object.keys(categories);
  todayCategoryCountEl.textContent = categoryNames.length.toString();

  todayCategoryChipsEl.innerHTML = "";
  categoryNames
    .sort((a, b) => categories[b] - categories[a])
    .forEach((cat) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `
        <span class="dot"></span>
        <span>${cat}: <span class="value">${categories[
          cat
        ].toFixed(0)}</span> pts</span>
      `;
      todayCategoryChipsEl.appendChild(chip);
    });

  const multiplier = currentMultiplierProduct();
  currentMultiplierDisplayEl.textContent = `×${multiplier.toFixed(2)}`;
}

function renderMultipliers() {
  multiplierRowEl.innerHTML = "";
  if (state.multipliers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No multipliers yet. Add one in Settings.";
    multiplierRowEl.appendChild(empty);
    return;
  }

  state.multipliers.forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "multiplier-toggle" + (m.active ? " active" : "");
    btn.style.borderColor = m.active
      ? m.color || "#38bdf8"
      : "rgba(148,163,184,0.4)";
    btn.innerHTML = `
      <span class="dot" style="background:${
        m.active ? m.color || "#38bdf8" : "rgba(148,163,184,0.9)"
      }"></span>
      <span>${m.name}</span>
      <span class="value">×${Number(m.value || 1).toFixed(2)}</span>
    `;

    btn.addEventListener("click", () => {
      m.active = !m.active;
      saveState();
      renderMultipliers();
      renderTotals();
    });

    multiplierRowEl.appendChild(btn);
  });
}

function renderActions() {
  actionsGridEl.innerHTML = "";
  if (state.actions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No actions yet. Add some in Settings.";
    actionsGridEl.appendChild(empty);
    return;
  }

  state.actions.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = "action-button";
    btn.style.borderColor = a.color || "rgba(148, 163, 184, 0.35)";
    btn.style.boxShadow = `0 0 0 1px ${a.color || "transparent"}22`;
    btn.innerHTML = `
      <div class="action-main-row">
        <div class="action-name">${a.name}</div>
        <div class="action-points">+${a.basePoints} pts</div>
      </div>
      <div class="action-meta-row">
        <div class="badge">
          <span class="dot" style="background: ${
            a.color || "#38bdf8"
          }"></span>
          <span class="text">${a.category || "Uncategorized"}</span>
        </div>
        <div class="action-count">
          Used <span class="highlight">${a.countToday || 0}</span>× today
        </div>
      </div>
    `;

    btn.addEventListener("click", () => {
      const multiplier = currentMultiplierProduct();
      const gained = Number(a.basePoints || 0) * multiplier;

      const key = todayKey();
      if (!state.dailyTotals[key]) {
        state.dailyTotals[key] = { totalPoints: 0, categories: {} };
      }
      const totals = state.dailyTotals[key];
      totals.totalPoints += gained;

      const cat = a.category || "Uncategorized";
      if (!totals.categories[cat]) totals.categories[cat] = 0;
      totals.categories[cat] += gained;

      a.countToday = (a.countToday || 0) + 1;

      saveState();
      renderTotals();
      renderActions();
      renderDailyLog();
    });

    actionsGridEl.appendChild(btn);
  });
}

function renderDailyLog() {
  dailyLogListEl.innerHTML = "";

  const keys = Object.keys(state.dailyTotals);
  if (keys.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No days recorded yet. Start tapping actions!";
    dailyLogListEl.appendChild(empty);
    return;
  }

  keys
    .sort((a, b) => (a < b ? 1 : -1))
    .forEach((key) => {
      const day = state.dailyTotals[key];
      const li = document.createElement("li");
      li.className = "log-item";

      const dateLabel = formatDateLabel(key);
      const isToday = key === todayKey();

      const categories = day.categories || {};
      const categoryNames = Object.keys(categories).sort(
        (a, b) => categories[b] - categories[a]
      );

      li.innerHTML = `
        <div class="log-date-row">
          <div class="log-date">
            ${dateLabel} ${
        isToday ? '<span class="success-text">(Today)</span>' : ""
      }
          </div>
          <div class="log-total">${day.totalPoints.toFixed(0)} pts</div>
        </div>
        <div class="log-meta">
          ${
            categoryNames.length === 0
              ? "<span>No categories yet.</span>"
              : `<div class="category-list">
                  ${categoryNames
                    .map(
                      (cat) => `
                    <span class="category-pill">
                      <span class="dot"></span>
                      <span>${cat}: <span class="value">${categories[
                        cat
                      ].toFixed(0)}</span></span>
                    </span>`
                    )
                    .join("")}
                </div>`
          }
        </div>
      `;

      dailyLogListEl.appendChild(li);
    });
}

// --- Settings rendering (with drag & drop) -----------------------------

function renderSettingsActions() {
  settingsActionsListEl.innerHTML = "";
  if (state.actions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No actions yet. Add one below.";
    settingsActionsListEl.appendChild(empty);
    return;
  }

  state.actions.forEach((a, index) => {
    const row = document.createElement("div");
    row.className = "settings-row";
    row.draggable = true;
    row.dataset.index = index.toString();

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "≡";

    const info = document.createElement("div");
    info.className = "settings-info";
    info.innerHTML = `
      <strong>${a.name}</strong>
      <span>${a.basePoints} pts</span>
      <span>${a.category}</span>
    `;

    const controls = document.createElement("div");
    controls.className = "settings-controls";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost";
    editBtn.textContent = "Edit";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete";

    controls.appendChild(editBtn);
    controls.appendChild(deleteBtn);

    row.appendChild(handle);
    row.appendChild(info);
    row.appendChild(controls);

    // Drag events
    handle.addEventListener("mousedown", () => {
      row.classList.add("dragging");
    });
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      const draggingIndex = Number(
        e.dataTransfer.getData("text/plain") || "-1"
      );
      if (draggingIndex === -1) return;
      const targetIndex = Number(row.dataset.index || "-1");
      if (targetIndex === -1 || targetIndex === draggingIndex) return;

      // Reorder array
      const item = state.actions.splice(draggingIndex, 1)[0];
      state.actions.splice(targetIndex, 0, item);
      saveState();
      renderSettingsActions();
      renderActions();
    });

    // Edit
    editBtn.addEventListener("click", () => {
      openModalForAction(a);
    });

    // Delete
    deleteBtn.addEventListener("click", () => {
      if (!confirm(`Delete action "${a.name}"?`)) return;
      state.actions = state.actions.filter((x) => x.id !== a.id);
      saveState();
      renderSettingsActions();
      renderActions();
    });

    settingsActionsListEl.appendChild(row);
  });
}

function renderSettingsMultipliers() {
  settingsMultipliersListEl.innerHTML = "";
  if (state.multipliers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No multipliers yet. Add one below.";
    settingsMultipliersListEl.appendChild(empty);
    return;
  }

  state.multipliers.forEach((m, index) => {
    const row = document.createElement("div");
    row.className = "settings-row";
    row.draggable = true;
    row.dataset.index = index.toString();

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "≡";

    const info = document.createElement("div");
    info.className = "settings-info";
    info.innerHTML = `
      <strong>${m.name}</strong>
      <span>×${m.value}</span>
    `;

    const controls = document.createElement("div");
    controls.className = "settings-controls";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost";
    editBtn.textContent = "Edit";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete";

    controls.appendChild(editBtn);
    controls.appendChild(deleteBtn);

    row.appendChild(handle);
    row.appendChild(info);
    row.appendChild(controls);

    // Drag events
    handle.addEventListener("mousedown", () => {
      row.classList.add("dragging");
    });
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      const draggingIndex = Number(
        e.dataTransfer.getData("text/plain") || "-1"
      );
      if (draggingIndex === -1) return;
      const targetIndex = Number(row.dataset.index || "-1");
      if (targetIndex === -1 || targetIndex === draggingIndex) return;

      const item = state.multipliers.splice(draggingIndex, 1)[0];
      state.multipliers.splice(targetIndex, 0, item);
      saveState();
      renderSettingsMultipliers();
      renderMultipliers();
      renderTotals();
    });

    // Edit
    editBtn.addEventListener("click", () => {
      openModalForMultiplier(m);
    });

    // Delete
    deleteBtn.addEventListener("click", () => {
      if (!confirm(`Delete multiplier "${m.name}"?`)) return;
      state.multipliers = state.multipliers.filter((x) => x.id !== m.id);
      saveState();
      renderSettingsMultipliers();
      renderMultipliers();
      renderTotals();
    });

    settingsMultipliersListEl.appendChild(row);
  });
}

// --- Modal logic -------------------------------------------------------

function openModalForAction(action) {
  modalContext = { type: "action", id: action.id };
  modalTitleEl.textContent = "Edit Action";
  modalNameInput.value = action.name;
  modalPointsInput.value = action.basePoints;
  modalCategoryInput.value = action.category || "";
  modalColorInput.value = action.color || "#38bdf8";
  modalPointsRow.style.display = "flex";
  modalCategoryRow.style.display = "flex";
  showModal();
}

function openModalForMultiplier(multiplier) {
  modalContext = { type: "multiplier", id: multiplier.id };
  modalTitleEl.textContent = "Edit Multiplier";
  modalNameInput.value = multiplier.name;
  modalPointsInput.value = multiplier.value;
  modalCategoryInput.value = "";
  modalColorInput.value = multiplier.color || "#f97316";
  modalPointsRow.style.display = "flex";
  modalCategoryRow.style.display = "none";
  showModal();
}

function showModal() {
  modalOverlay.classList.remove("hidden");
  requestAnimationFrame(() => {
    modalOverlay.classList.add("visible");
  });
}

function closeModal() {
  modalOverlay.classList.remove("visible");
  setTimeout(() => {
    modalOverlay.classList.add("hidden");
  }, 200);
  modalContext = null;
}

modalCloseBtn.addEventListener("click", closeModal);
modalCancelBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay || e.target.classList.contains("modal-backdrop")) {
    closeModal();
  }
});

modalSaveBtn.addEventListener("click", () => {
  if (!modalContext) return;

  const name = modalNameInput.value.trim();
  const color = modalColorInput.value || "#38bdf8";

  if (!name) {
    alert("Name is required.");
    return;
  }

  if (modalContext.type === "action") {
    const action = state.actions.find((a) => a.id === modalContext.id);
    if (!action) return;

    const basePoints = Number(modalPointsInput.value || 0);
    if (!basePoints || basePoints <= 0) {
      alert("Base points must be a positive number.");
      return;
    }

    const category = modalCategoryInput.value.trim() || "Uncategorized";

    action.name = name;
    action.basePoints = basePoints;
    action.category = category;
    action.color = color;

    saveState();
    renderSettingsActions();
    renderActions();
  } else if (modalContext.type === "multiplier") {
    const multiplier = state.multipliers.find((m) => m.id === modalContext.id);
    if (!multiplier) return;

    const value = Number(modalPointsInput.value || 0);
    if (!value || value <= 0) {
      alert("Multiplier value must be a positive number.");
      return;
    }

    multiplier.name = name;
    multiplier.value = value;
    multiplier.color = color;

    saveState();
    renderSettingsMultipliers();
    renderMultipliers();
    renderTotals();
  }

  closeModal();
});

// --- Tab switching -----------------------------------------------------

document.querySelectorAll(".tab-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    document.getElementById("tab-dashboard").style.display =
      tab === "dashboard" ? "block" : "none";
    document.getElementById("tab-settings").style.display =
      tab === "settings" ? "block" : "none";

    if (tab === "settings") {
      renderSettingsActions();
      renderSettingsMultipliers();
    }
  });
});

// --- Event handlers ----------------------------------------------------

addActionBtn.addEventListener("click", () => {
  const name = actionNameInput.value.trim();
  const basePoints = Number(actionPointsInput.value || 0);
  const category = actionCategoryInput.value.trim();
  const color = actionColorInput.value || "#38bdf8";

  if (!name || basePoints <= 0) {
    alert("Please provide an action name and a positive base points value.");
    return;
  }

  const newAction = {
    id: randomId("a"),
    name,
    basePoints,
    category: category || "Uncategorized",
    color,
    countToday: 0
  };

  state.actions.push(newAction);
  saveState();
  renderSettingsActions();
  renderActions();

  actionNameInput.value = "";
  actionPointsInput.value = "";
  actionCategoryInput.value = "";
});

resetActionsBtn.addEventListener("click", () => {
  if (
    !confirm(
      "Reset actions to the demo defaults? This will remove your custom actions, but keep your daily scores."
    )
  ) {
    return;
  }
  state.actions = structuredClone(defaultState.actions);
  state.actions.forEach((a) => (a.countToday = 0));
  saveState();
  renderSettingsActions();
  renderActions();
});

addMultiplierBtn.addEventListener("click", () => {
  const name = multiplierNameInput.value.trim();
  const value = Number(multiplierValueInput.value || 0);
  const color = multiplierColorInput.value || "#f97316";

  if (!name || value <= 0) {
    alert("Please provide a multiplier name and a positive value.");
    return;
  }

  const newMultiplier = {
    id: randomId("m"),
    name,
    value,
    color,
    active: false
  };

  state.multipliers.push(newMultiplier);
  saveState();
  renderSettingsMultipliers();
  renderMultipliers();
  renderTotals();

  multiplierNameInput.value = "";
  multiplierValueInput.value = "";
});

resetMultipliersBtn.addEventListener("click", () => {
  if (
    !confirm(
      "Reset multipliers to the demo defaults? This will remove your custom multipliers."
    )
  ) {
    return;
  }
  state.multipliers = structuredClone(defaultState.multipliers);
  saveState();
  renderSettingsMultipliers();
  renderMultipliers();
  renderTotals();
});

clearAllDataBtn.addEventListener("click", () => {
  if (
    !confirm(
      "Clear all actions, multipliers, and daily scores? This cannot be undone."
    )
  ) {
    return;
  }
  state = structuredClone(defaultState);
  saveState();
  renderTodayHeader();
  renderTotals();
  renderMultipliers();
  renderActions();
  renderDailyLog();
  renderSettingsActions();
  renderSettingsMultipliers();
});

// --- Initialization ----------------------------------------------------

function init() {
  renderTodayHeader();
  getTodayTotals();
  saveState();
  renderTotals();
  renderMultipliers();
  renderActions();
  renderDailyLog();
}

init();
