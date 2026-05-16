import { Link } from "react-router-dom";
import { Pill, Camera, Activity, Share2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { heroImage } from "@/constants";

export const LandingPage = () => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.7),_transparent_32%),linear-gradient(180deg,_#f7fdff_0%,_#eef7ff_42%,_#ffffff_100%)] text-slate-900">
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="glass-panel mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg">
            <Pill className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">Medi Track</p>
            <p className="text-sm text-slate-500">Smart medical records and medicine tracking</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/auth">
            <Button data-testid="landing-login-button" variant="outline" className="border-sky-200 bg-white/90 px-6">
              Login
            </Button>
          </Link>
          <Link to="/auth?tab=signup">
            <Button data-testid="landing-signup-button" className="bg-sky-600 px-6 hover:bg-sky-700">
              Create account
            </Button>
          </Link>
        </div>
      </header>

      <section className="grid gap-8 pb-8 pt-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <Badge data-testid="hero-badge" className="bg-sky-100 text-sky-700 hover:bg-sky-100">
            AI-powered medicine safety and medical memory
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Keep medicines, prescriptions, and doctor-ready reports in one calm place.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            Track active medicines, detect harmful interactions, scan prescriptions, set reminders, and share clean health summaries with doctors — all inside a mobile-friendly hospital-style dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/auth?tab=signup">
              <Button data-testid="hero-start-button" className="h-12 rounded-full bg-sky-600 px-6 hover:bg-sky-700">
                Start tracking
              </Button>
            </Link>
            <Link to="/auth">
              <Button data-testid="hero-demo-login-button" variant="outline" className="h-12 rounded-full border-sky-200 bg-white px-6">
                View dashboard flow
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Drug interaction safety", "Hybrid database + AI checks"],
              ["Prescription capture", "Camera, file upload, OCR, voice"],
              ["Doctor sharing", "Exportable report summaries"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden p-4">
          <div className="absolute inset-x-8 top-8 h-24 rounded-full bg-sky-200/55 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white/70 bg-white p-4 shadow-xl">
            <div className="aspect-[4/4.4] overflow-hidden rounded-[1.6rem] bg-slate-100">
              <img
                data-testid="hero-image"
                src={heroImage}
                alt="Medication reminder app"
                className="h-full w-full object-cover object-center"
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-sky-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-sky-700">Active today</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">4 reminders</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Safety engine</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">2 alerts checked</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 py-8 md:grid-cols-3">
        {[
          [Camera, "Capture prescriptions", "Use mobile camera preview, retake if needed, and OCR medicines into your records."],
          [Activity, "Understand interactions", "Static interaction rules plus AI analysis highlight severe, moderate, and mild risks."],
          [Share2, "Send doctor-ready reports", "Generate PDF summaries that include medicine lists, records, and safety alerts."],
        ].map(([Icon, title, text]) => (
          <Card key={title} className="border-sky-100 bg-white/90 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">{text}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  </div>
);
