export const toLocalISODate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const q = (selector) => document.querySelector(selector);

export const debounce = (fn, delay = 140) => {
  let timerId = 0;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => fn(...args), delay);
  };
};

export const formatError = (error) => {
  if (!error) return "Неизвестная ошибка";
  if (error instanceof Error) return error.message || error.name || "Ошибка";
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
};
