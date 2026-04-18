export const statusMeta = {
  new: { label: "Новая", className: "badge-new" },
  in_progress: { label: "В работе", className: "badge-progress" },
  won: { label: "Завершена", className: "badge-won" },
  lost: { label: "Отменена", className: "badge-lost" },
};

export const attendanceStatusMeta = {
  present: { label: "На смене", className: "badge-won" },
  absent: { label: "Отсутствовал", className: "badge-lost" },
  sick: { label: "Больничный", className: "badge-progress" },
  vacation: { label: "Отпуск", className: "badge-new" },
};

export const pipelineStages = [
  { key: "order_received", label: "Поступление заказа" },
  { key: "contract_preparation", label: "Формировка договора" },
  { key: "prepayment_received", label: "Получение предоплаты" },
  { key: "production_ready", label: "Создание товара" },
  { key: "transport_ready_notice", label: "Готовность транспортировки" },
  { key: "contract_closed", label: "Завершение договора" },
];

export const stageMeta = {
  order_received: { playbook: "Принимаем заказ, уточняем запрос клиента и фиксируем базовые условия." },
  contract_preparation: { playbook: "Готовим договор, согласовываем условия, сроки и состав поставки." },
  prepayment_received: { playbook: "Контролируем получение предоплаты и подтверждаем запуск работ." },
  production_ready: { playbook: "Запускаем изготовление и отмечаем готовность товара." },
  transport_ready_notice: { playbook: "Подтверждаем готовность к отгрузке и информируем по логистике." },
  contract_closed: { playbook: "Закрываем договор, фиксируем исполнение и переводим материалы в архив." },
};

export const priorityMeta = {
  low: { label: "Низкий", className: "priority-low" },
  medium: { label: "Средний", className: "priority-medium" },
  high: { label: "Высокий", className: "priority-high" },
  critical: { label: "Критичный", className: "priority-critical" },
};
