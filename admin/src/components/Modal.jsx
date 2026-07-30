import { Icon } from '@shared/ui.jsx'

export default function Modal({ titel, onClose, children, breite = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className={`bg-white w-full ${breite} rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{titel}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
