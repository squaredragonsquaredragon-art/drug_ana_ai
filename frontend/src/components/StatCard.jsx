import { Card, CardContent } from "@/components/ui/card";

export const StatCard = ({ title, value, helper, icon: Icon, testId }) => (
  <Card data-testid={testId} className="border-sky-100 bg-white/85 shadow-sm backdrop-blur-sm">
    <CardContent className="flex items-start justify-between gap-4 p-5">
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{helper}</p>
      </div>
      <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);
