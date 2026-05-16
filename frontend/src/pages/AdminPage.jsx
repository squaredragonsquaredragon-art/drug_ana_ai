import { useState } from "react";
import { ShieldPlus, UserCircle, Pill, AlertTriangle, Share2, Activity } from "lucide-react";
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

export const AdminPage = ({ user, adminData, onAddRule }) => {
  const [ruleForm, setRuleForm] = useState({ medicines: "", severity_level: "moderate", explanation: "", safety_recommendation: "", organ_effects: "" });

  if (user.role !== "admin") {
    return <EmptyState testId="admin-access-locked" icon={ShieldPlus} title="Admin view is restricted" description="Sign in with the seeded admin account to manage users, system alerts, and interaction rules." />;
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 lg:p-8">
        <Badge data-testid="admin-page-badge" className="bg-sky-100 text-sky-700 hover:bg-sky-100">System control center</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">Monitor platform usage and medicine safety rules.</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard testId="admin-stat-users" title="Users" value={adminData.summary?.users || 0} helper="Registered accounts" icon={UserCircle} />
        <StatCard testId="admin-stat-medicines" title="Medicines" value={adminData.summary?.medicines || 0} helper="Tracked medicine entries" icon={Pill} />
        <StatCard testId="admin-stat-alerts" title="Alerts" value={adminData.summary?.alerts || 0} helper="Stored interaction warnings" icon={AlertTriangle} />
        <StatCard testId="admin-stat-reports" title="Reports" value={adminData.summary?.reports || 0} helper="Doctor reports generated" icon={Share2} />
        <StatCard testId="admin-stat-safety" title="Safety index" value={`${adminData.summary?.safety_index || 0}%`} helper="High-level trust indicator" icon={Activity} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <Card className="border-sky-100 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Recent users</CardTitle>
            <CardDescription>Quick access to new signups and account metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {adminData.users?.map((entry) => (
              <div key={entry.id} data-testid={`admin-user-row-${entry.id}`} className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{entry.name}</p>
                    <p className="text-sm text-slate-500">{entry.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{entry.role}</Badge>
                    <Badge variant="outline" className="border-sky-200 text-sky-700">{entry.blood_group}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-sky-100 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Add interaction rule</CardTitle>
            <CardDescription>Expand the local safety database with new medicine combinations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input data-testid="admin-rule-medicines-input" placeholder="Medicines, comma separated" value={ruleForm.medicines} onChange={(event) => setRuleForm((current) => ({ ...current, medicines: event.target.value }))} />
            <Input data-testid="admin-rule-severity-input" placeholder="Severity (mild, moderate, severe)" value={ruleForm.severity_level} onChange={(event) => setRuleForm((current) => ({ ...current, severity_level: event.target.value }))} />
            <Textarea data-testid="admin-rule-explanation-input" placeholder="Explanation" value={ruleForm.explanation} onChange={(event) => setRuleForm((current) => ({ ...current, explanation: event.target.value }))} />
            <Textarea data-testid="admin-rule-recommendation-input" placeholder="Safety recommendation" value={ruleForm.safety_recommendation} onChange={(event) => setRuleForm((current) => ({ ...current, safety_recommendation: event.target.value }))} />
            <Input data-testid="admin-rule-organ-effects-input" placeholder="Organ effects" value={ruleForm.organ_effects} onChange={(event) => setRuleForm((current) => ({ ...current, organ_effects: event.target.value }))} />
            <Button data-testid="admin-rule-submit-button" className="w-full bg-sky-600 hover:bg-sky-700" onClick={() => onAddRule({ ...ruleForm, medicines: ruleForm.medicines.split(",").map((item) => item.trim()).filter(Boolean) }, () => setRuleForm({ medicines: "", severity_level: "moderate", explanation: "", safety_recommendation: "", organ_effects: "" }))}>
              Save interaction rule
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-sky-100 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Interaction database</CardTitle>
          <CardDescription>Current static rules feeding the immediate safety engine.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {adminData.rules?.map((rule) => (
            <div key={rule.id} data-testid={`admin-rule-card-${rule.id}`} className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{rule.medicines.join(" + ")}</p>
                <Badge className={severityStyles[rule.severity_level] || severityStyles.mild}>{rule.severity_level}</Badge>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-500">{rule.explanation}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
