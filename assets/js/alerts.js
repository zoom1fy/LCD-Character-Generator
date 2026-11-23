/*============ АЛЕРТЫ И УВЕДОМЛЕНИЯ (BOOTSTRAP) ============*/
const ALERT_ICONS = {
  success: { icon: 'bi-check-circle-fill', color: 'text-success' },
  error: { icon: 'bi-x-circle-fill', color: 'text-danger' },
  warning: { icon: 'bi-exclamation-triangle-fill', color: 'text-warning' },
  info: { icon: 'bi-info-circle-fill', color: 'text-info' },
};

let alertModalEl = null;
let alertResolver = null;
let alertConfirmed = false;

// Модальное окно создаётся один раз и переиспользуется для всех алертов
function createAlertModal() {
  if (alertModalEl) return alertModalEl;

  alertModalEl = document.createElement('div');
  alertModalEl.className = 'modal fade';
  alertModalEl.id = 'app-alert-modal';
  alertModalEl.tabIndex = -1;
  alertModalEl.setAttribute('aria-labelledby', 'app-alert-modal-title');
  alertModalEl.setAttribute('aria-describedby', 'app-alert-modal-text');
  alertModalEl.setAttribute('aria-hidden', 'true');
  alertModalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="app-alert-modal-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body d-flex align-items-start gap-3">
          <i class="app-alert-icon bi" aria-hidden="true"></i>
          <p class="app-alert-text mb-0" id="app-alert-modal-text"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary app-alert-cancel" data-bs-dismiss="modal"></button>
          <button type="button" class="btn btn-primary app-alert-confirm"></button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(alertModalEl);

  alertModalEl.querySelector('.app-alert-confirm').addEventListener('click', () => {
    alertConfirmed = true;
    bootstrap.Modal.getOrCreateInstance(alertModalEl).hide();
  });

  // Закрытие крестиком, кнопкой отмены, кликом по фону или Esc
  alertModalEl.addEventListener('hidden.bs.modal', () => {
    if (!alertResolver) return;
    const resolve = alertResolver;
    alertResolver = null;
    resolve(alertConfirmed);
  });

  return alertModalEl;
}

// Показывает алерт и возвращает промис с true, если пользователь подтвердил
function showAlert({ icon = 'info', title = '', text = '', confirmText, cancelText = null }) {
  const modalEl = createAlertModal();
  const iconMeta = ALERT_ICONS[icon] || ALERT_ICONS.info;

  modalEl.querySelector('.modal-title').textContent = title;
  const textEl = modalEl.querySelector('.app-alert-text');
  textEl.textContent = text;
  textEl.classList.toggle('d-none', !text);
  modalEl.querySelector('.app-alert-icon').className = `app-alert-icon bi ${iconMeta.icon} ${iconMeta.color}`;
  modalEl.querySelector('.btn-close').setAttribute('aria-label', translations[userLang].close);

  const confirmBtn = modalEl.querySelector('.app-alert-confirm');
  confirmBtn.textContent = confirmText || translations[userLang].ok;
  const cancelBtn = modalEl.querySelector('.app-alert-cancel');
  cancelBtn.textContent = cancelText || '';
  cancelBtn.classList.toggle('d-none', !cancelText);

  // Если предыдущий алерт ещё открыт (например, повторное предупреждение), считаем его отклонённым
  if (alertResolver) {
    const resolve = alertResolver;
    alertResolver = null;
    resolve(false);
  }
  alertConfirmed = false;

  return new Promise((resolve) => {
    alertResolver = resolve;
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  });
}

function showConfirmationAlert(message, callback) {
  showAlert({
    icon: 'warning',
    title: translations[userLang][message],
    confirmText: translations[userLang].yes,
    cancelText: translations[userLang].no,
  }).then((confirmed) => {
    if (confirmed) callback();
  });
}

function showErrorAlert(message) {
  showAlert({
    icon: 'error',
    title: translations[userLang].error,
    text: translations[userLang][message],
    confirmText: translations[userLang].ok,
  });
}

function showWarningAlert(message) {
  showAlert({
    icon: 'warning',
    title: translations[userLang].warning || 'Warning',
    text: translations[userLang][message] || message,
    confirmText: translations[userLang].ok || 'OK',
  });
}

// Всплывающее уведомление, исчезающее само
function showToast(title, message, icon = 'success') {
  const iconMeta = ALERT_ICONS[icon] || ALERT_ICONS.info;
  let container = document.getElementById('app-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'app-toast-container';
    container.className = 'app-toast-container toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = 'toast border-0';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-start gap-2">
        <i class="bi ${iconMeta.icon} ${iconMeta.color} fs-5" aria-hidden="true"></i>
        <div>
          <div class="fw-semibold app-toast-title"></div>
          <div class="app-toast-text"></div>
        </div>
      </div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  toastEl.querySelector('.app-toast-title').textContent = title;
  toastEl.querySelector('.app-toast-text').textContent = message;
  toastEl.querySelector('.btn-close').setAttribute('aria-label', translations[userLang].close);
  container.appendChild(toastEl);

  const toast = new bootstrap.Toast(toastEl, { delay: 2500 });
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  toast.show();
}
