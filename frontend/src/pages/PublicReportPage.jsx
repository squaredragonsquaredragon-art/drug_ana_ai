import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LoaderCircle, FileBadge } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { makePdf } from "@/lib/medical-utils";

export const PublicReportPage = () => {
  const { token } = useParams();
  const [report, setReport] = useState(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const response = await apiRequest({ method: "get", url: `/public/reports/${token}` });
        setReport(response.report);
      } catch {
        toast.error("Shared report could not be loaded.");
      }
    };
    loadReport();
  }, [token]);

  if (!report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle className="h-6 w-6 animate-spin text-sky-600" />
      </div>
    );
  }

  const payload = report.payload;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.65),_transparent_30%),linear-gradient(180deg,_#f7fdff_0%,_#eff8ff_45%,_#ffffff_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="glass-panel p-6 lg:p-8">
          <Badge data-testid="public-report-badge" className="bg-sky-100 text-sky-700 hover:bg-sky-100">
            Shared medical report
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Patient summary for {report.doctor_name}
          </h1>
          <p data-testid="public-report-patient-name" className="mt-4 text-base leading-8 text-slate-600 md:text-lg">
            Patient: {payload.user?.name} • Email: {payload.user?.email} • Blood Group: {payload.user?.blood_group}
          </p>
          <div className="mt-6">
            <Button data-testid="public-report-download-button" className="bg-sky-600 hover:bg-sky-700" onClick={() => makePdf(report, `shared-report-${report.id}.pdf`)}>
              <FileBadge className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-sky-100 bg-white/90">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Medicines</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{payload.medicines?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-sky-100 bg-white/90">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Alerts</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{payload.alerts?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-sky-100 bg-white/90">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Records</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{payload.records?.length || 0}</p>
            </CardContent>
          </Card>
        </div>
        <Card className="border-sky-100 bg-white/90">
          <CardHeader>
            <CardTitle>Medicines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload.medicines?.map((medicine) => (
              <div key={medicine.id} className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                <p className="font-semibold text-slate-900">{medicine.medicine_name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {medicine.dosage} • {medicine.frequency}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
