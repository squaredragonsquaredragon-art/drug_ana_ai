import { useState } from "react";
import { Share2, ExternalLink, FileBadge } from "lucide-react";
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
import { EmptyState } from "@/components/EmptyState";
import { copyTextToClipboard, makePdf } from "@/lib/medical-utils";

export const SharingPage = ({ reports, onCreateReport }) => {
  const [form, setForm] = useState({ doctor_name: "", doctor_email: "", notes: "" });

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 lg:p-8">
        <Badge data-testid="sharing-page-badge" className="bg-sky-100 text-sky-700 hover:bg-sky-100">Doctor collaboration</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">Generate clean summaries for consultations.</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">Build a shareable report that combines your medicine list, alerts, and medical history, then export it as a PDF for your doctor.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
        <Card className="border-sky-100 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Create report</CardTitle>
            <CardDescription>Prepare a doctor-ready summary in one click.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input data-testid="doctor-name-input" placeholder="Doctor name" value={form.doctor_name} onChange={(event) => setForm((current) => ({ ...current, doctor_name: event.target.value }))} />
            <Input data-testid="doctor-email-input" placeholder="Doctor email" value={form.doctor_email} onChange={(event) => setForm((current) => ({ ...current, doctor_email: event.target.value }))} />
            <Textarea data-testid="doctor-notes-input" placeholder="Notes to include" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            <Button data-testid="generate-report-button" className="w-full bg-sky-600 hover:bg-sky-700" onClick={() => onCreateReport(form, () => setForm({ doctor_name: "", doctor_email: "", notes: "" }))}>
              <Share2 className="mr-2 h-4 w-4" />
              Generate shareable report
            </Button>
          </CardContent>
        </Card>

        <Card className="border-sky-100 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Shared report history</CardTitle>
            <CardDescription>Track every report you generated for doctors or care teams.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reports.length ? (
              reports.map((report) => {
                const shareUrl = `${window.location.origin}/report/${report.share_token}`;
                return (
                  <div key={report.id} data-testid={`report-card-${report.id}`} className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{report.doctor_name}</p>
                        <p className="mt-1 text-sm text-slate-500">{report.doctor_email}</p>
                        <p className="mt-3 text-sm leading-7 text-slate-500">{report.notes || "No note added."}</p>
                      </div>
                      <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{new Date(report.created_at).toLocaleDateString()}</Badge>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Share URL:</span> {shareUrl}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button data-testid={`copy-share-link-button-${report.id}`} variant="outline" className="border-sky-200" onClick={() => copyTextToClipboard(shareUrl)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Copy link
                      </Button>
                      <Button data-testid={`download-report-button-${report.id}`} className="bg-sky-600 hover:bg-sky-700" onClick={() => makePdf(report, `medi-track-report-${report.id}.pdf`)}>
                        <FileBadge className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState testId="reports-empty-state" icon={Share2} title="No reports shared yet" description="Generate a report to prepare for your next doctor discussion." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
