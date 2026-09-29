export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}
