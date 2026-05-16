import { Pill, AlertTriangle, ClipboardPlus, Bell, Plus, Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { severityStyles } from "@/constants";

export const DashboardPage = ({
  dashboard,
  medicineForm,
  setMedicineForm,
  onAddMedicine,
  onMarkTaken,
  onDeleteMedicine,
}) => (
  <div className="space-y-6">
    <section className="glass-panel overflow-hidden p-6 lg:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge data-testid="dashboard-hero-badge" className="bg-sky-100 text-sky-700 hover:bg-sky-100">
            Live medicine safety overview
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Welcome back, {dashboard.user?.name?.split(" ")[0]}.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            Monitor your active medicines, upcoming reminders, recent prescriptions, and interaction alerts from a single care dashboard.
          </p>
        </div>
        <div data-testid="dashboard-adherence-card" className="rounded-[2rem] bg-white/90 p-5 shadow-sm lg:w-80">
          <p className="text-sm text-slate-500">Adherence outlook</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">{dashboard.summary?.adherence_score || 0}%</p>
          <p className="mt-2 text-sm text-slate-500">Improves when reminders are checked and risky combinations are reduced.</p>
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard testId="dashboard-stat-medicines" title="Current medicines" value={dashboard.summary?.medicine_count || 0} helper="Actively tracked in your regimen" icon={Pill} />
      <StatCard testId="dashboard-stat-alerts" title="Interaction alerts" value={dashboard.summary?.alert_count || 0} helper="Color-coded safety checks" icon={AlertTriangle} />
      <StatCard testId="dashboard-stat-records" title="Medical records" value={dashboard.summary?.record_count || 0} helper="Past treatments and prescriptions" icon={ClipboardPlus} />
      <StatCard testId="dashboard-stat-reminders" title="Reminder windows" value={dashboard.reminders?.length || 0} helper="Daily medicine touchpoints" icon={Bell} />
    </section>

    <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <Card className="border-sky-100 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Quick add medicine</CardTitle>
          <CardDescription>Add medicine manually and trigger fresh interaction analysis instantly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input data-testid="quick-add-medicine-name-input" placeholder="Medicine name" value={medicineForm.medicine_name} onChange={(event) => setMedicineForm((current) => ({ ...current, medicine_name: event.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input data-testid="quick-add-dosage-input" placeholder="Dosage" value={medicineForm.dosage} onChange={(event) => setMedicineForm((current) => ({ ...current, dosage: event.target.value }))} />
            <Input data-testid="quick-add-start-date-input" type="date" value={medicineForm.start_date} onChange={(event) => setMedicineForm((current) => ({ ...current, start_date: event.target.value }))} />
          </div>
          <Input data-testid="quick-add-frequency-input" placeholder="Frequency" value={medicineForm.frequency} onChange={(event) => setMedicineForm((current) => ({ ...current, frequency: event.target.value }))} />
          <Input data-testid="quick-add-reminders-input" placeholder="Reminder times, comma separated (08:00,20:00)" value={medicineForm.reminder_times.join(",")} onChange={(event) => setMedicineForm((current) => ({ ...current, reminder_times: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) }))} />
          <Textarea data-testid="quick-add-notes-input" placeholder="Notes or instructions" value={medicineForm.notes} onChange={(event) => setMedicineForm((current) => ({ ...current, notes: event.target.value }))} />
          <Button data-testid="quick-add-submit-button" className="w-full bg-sky-600 hover:bg-sky-700" onClick={() => onAddMedicine({ ...medicineForm, source: "manual" })}>
            <Plus className="mr-2 h-4 w-4" />
            Add medicine
          </Button>
        </CardContent>
      </Card>

      <Card className="border-sky-100 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Interaction alerts</CardTitle>
          <CardDescription>Hybrid safety engine showing severe, moderate, and mild medication conflicts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard.alerts?.length ? (
            dashboard.alerts.map((alert) => (
              <div key={alert.id} data-testid={`dashboard-alert-${alert.id}`} className={`rounded-3xl border p-4 ${severityStyles[alert.severity_level] || severityStyles.mild}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">{alert.severity_level}</p>
                  <Badge variant="outline" className="border-current bg-transparent text-current">{alert.source}</Badge>
                </div>
                <p className="mt-3 text-lg font-semibold">{alert.medicine_combination.join(" + ")}</p>
                <p className="mt-2 text-sm leading-7">{alert.explanation}</p>
                <p className="mt-3 text-sm font-medium">Recommendation: {alert.safety_recommendation}</p>
              </div>
            ))
          ) : (
            <EmptyState testId="dashboard-alerts-empty" icon={Check} title="No active interaction alerts" description="Your current medicine list does not show stored conflicts right now." />
          )}
        </CardContent>
      </Card>
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <Card className="border-sky-100 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Current medicines & reminders</CardTitle>
          <CardDescription>Mark doses as taken and keep timing under control.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard.medicines?.length ? (
            dashboard.medicines.map((medicine) => {
              const takenToday = medicine.taken_log?.includes(new Date().toISOString().slice(0, 10));
              return (
                <div key={medicine.id} data-testid={`medicine-card-${medicine.id}`} className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{medicine.medicine_name}</p>
                      <p className="mt-1 text-sm text-slate-500">{medicine.dosage} • {medicine.frequency}</p>
                      <p className="mt-2 text-sm text-slate-500">Reminders: {medicine.reminder_times?.join(", ") || "Not set"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button data-testid={`mark-taken-button-${medicine.id}`} size="sm" className="bg-sky-600 hover:bg-sky-700" onClick={() => onMarkTaken(medicine.id)}>
                        <Check className="mr-2 h-4 w-4" />
                        {takenToday ? "Taken today" : "Mark taken"}
                      </Button>
                      <Button data-testid={`delete-medicine-button-${medicine.id}`} size="sm" variant="outline" className="border-red-200 text-red-600" onClick={() => onDeleteMedicine(medicine.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState testId="dashboard-medicines-empty" icon={Pill} title="No medicines added yet" description="Use quick add or scanning tools to populate your treatment list." />
          )}
        </CardContent>
      </Card>

      <Card className="border-sky-100 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Recent prescriptions and records</CardTitle>
          <CardDescription>Newly uploaded items appear here for fast review before doctor visits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard.records?.length ? (
            dashboard.records.map((record) => (
              <div key={record.id} data-testid={`dashboard-record-${record.id}`} className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-semibold text-slate-900">{record.title}</p>
                  <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{record.report_type}</Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-500">{record.past_treatments}</p>
                {record.prescription_text ? <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">OCR: {record.prescription_text}</p> : null}
              </div>
            ))
          ) : (
            <EmptyState testId="dashboard-records-empty" icon={ClipboardPlus} title="No records stored yet" description="Prescription scans, history notes, and uploaded treatments will appear here." />
          )}
        </CardContent>
      </Card>
    </section>
  </div>
);
