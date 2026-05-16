export const EmptyState = ({ icon: Icon, title, description, testId }) => (
  <div data-testid={testId} className="rounded-3xl border border-dashed border-sky-200 bg-sky-50/80 p-8 text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-sky-600 shadow-sm">
      <Icon className="h-5 w-5" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
  </div>
);
