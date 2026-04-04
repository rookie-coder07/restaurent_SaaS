import { CheckCircle, AlertCircle } from 'lucide-react';

export default function Toast({ type = 'success', message }) {
  const config = {
    success: {
      icon: CheckCircle,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    error: {
      icon: AlertCircle,
      className: 'border-red-200 bg-red-50 text-red-700',
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className={`flex w-full items-start gap-3 rounded-2xl border p-4 shadow-sm ${config.className}`}>
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="min-w-0 break-words text-sm font-medium leading-6">{message}</p>
    </div>
  );
}
