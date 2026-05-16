import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  ScanLine,
  FileBadge,
  Sparkles,
  EyeOff,
  Eye,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api";
import { blankSignup } from "@/constants";

export const AuthPage = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).get("tab") || "login");
  const [showPassword, setShowPassword] = useState(false);
  const [signupForm, setSignupForm] = useState(blankSignup);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [resetForm, setResetForm] = useState({ phone: "", code: "", new_password: "" });
  const [resetCode, setResetCode] = useState("");
  const [loading, setLoading] = useState(false);

  const runAuth = async (type) => {
    setLoading(true);
    try {
      const endpoint = type === "signup" ? "/auth/signup" : "/auth/login";
      const data = type === "signup" ? { ...signupForm, age: Number(signupForm.age) } : loginForm;
      const response = await apiRequest({ method: "post", url: endpoint, data });
      onAuthSuccess(response.token, response.user);
      toast.success(type === "signup" ? "Account created" : "Welcome back");
      navigate("/app/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Unable to continue");
    } finally {
      setLoading(false);
    }
  };

  const requestReset = async () => {
    try {
      const response = await apiRequest({ method: "post", url: "/auth/request-reset", data: { phone: resetForm.phone } });
      setResetCode(response.demo_code);
      toast.success("Verification code generated for phone recovery");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Reset request failed");
    }
  };

  const confirmReset = async () => {
    try {
      await apiRequest({ method: "post", url: "/auth/confirm-reset", data: resetForm });
      toast.success("Password updated. Please login.");
      setTab("login");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Password reset failed");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(186,230,253,0.75),_transparent_30%),linear-gradient(180deg,_#f6fdff_0%,_#eff8ff_42%,_#ffffff_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[90vh] max-w-6xl gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div className="glass-panel space-y-6 p-6 lg:p-8">
          <Badge data-testid="auth-page-badge" className="bg-sky-100 text-sky-700 hover:bg-sky-100">
            Secure access for patients and admin
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Your medicines deserve organized care.</h1>
          <p className="max-w-xl text-base leading-8 text-slate-600 md:text-lg">
            Sign in to manage prescriptions, reminders, AI medicine guidance, and doctor sharing from one hospital-inspired workspace.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [Bell, "Reminders", "Track every dose"],
              [ScanLine, "Scanning", "Barcode, OCR, voice"],
              [FileBadge, "Reports", "Shareable doctor summaries"],
            ].map(([Icon, title, text]) => (
              <div key={title} className="rounded-3xl bg-white/90 p-4 shadow-sm">
                <Icon className="h-5 w-5 text-sky-600" />
                <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-sky-100 bg-sky-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Demo admin access</p>
            <p data-testid="demo-admin-credentials" className="mt-2 text-sm leading-7 text-slate-600">
              Email: admin@meditrack.app <br /> Password: Admin123!
            </p>
          </div>
        </div>

        <Card className="border-sky-100 bg-white/95 shadow-[0_30px_80px_rgba(14,116,244,0.12)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-900">Access Medi Track</CardTitle>
            <CardDescription>Use secure email login now, plus password recovery with phone verification code.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="space-y-5">
              <TabsList className="grid w-full grid-cols-3 rounded-full bg-sky-50 p-1">
                <TabsTrigger data-testid="auth-tab-login" value="login" className="rounded-full">Login</TabsTrigger>
                <TabsTrigger data-testid="auth-tab-signup" value="signup" className="rounded-full">Signup</TabsTrigger>
                <TabsTrigger data-testid="auth-tab-reset" value="reset" className="rounded-full">Reset</TabsTrigger>
              </TabsList>

              <Button
                data-testid="google-login-button"
                variant="outline"
                className="w-full border-sky-200 bg-white"
                onClick={() => toast.info("Google sign-in can be connected when Firebase project keys are added.")}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>

              <TabsContent value="login" className="space-y-4">
                <Input data-testid="login-email-input" placeholder="Email" value={loginForm.email} onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))} />
                <div className="relative">
                  <Input data-testid="login-password-input" type={showPassword ? "text" : "password"} placeholder="Password" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} />
                  <button type="button" data-testid="login-password-toggle" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowPassword((current) => !current)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button data-testid="login-submit-button" className="w-full bg-sky-600 hover:bg-sky-700" onClick={() => runAuth("login")} disabled={loading}>
                  {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Login
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <Input data-testid="signup-name-input" placeholder="Full name" value={signupForm.name} onChange={(event) => setSignupForm((current) => ({ ...current, name: event.target.value }))} />
                <div className="grid grid-cols-2 gap-4">
                  <Input data-testid="signup-age-input" type="number" placeholder="Age" value={signupForm.age} onChange={(event) => setSignupForm((current) => ({ ...current, age: event.target.value }))} />
                  <Input data-testid="signup-blood-group-input" placeholder="Blood group" value={signupForm.blood_group} onChange={(event) => setSignupForm((current) => ({ ...current, blood_group: event.target.value }))} />
                </div>
                <Input data-testid="signup-email-input" placeholder="Email" value={signupForm.email} onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))} />
                <Input data-testid="signup-phone-input" placeholder="Phone number" value={signupForm.phone} onChange={(event) => setSignupForm((current) => ({ ...current, phone: event.target.value }))} />
                <div className="relative">
                  <Input data-testid="signup-password-input" type={showPassword ? "text" : "password"} placeholder="Password" value={signupForm.password} onChange={(event) => setSignupForm((current) => ({ ...current, password: event.target.value }))} />
                  <button type="button" data-testid="signup-password-toggle" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowPassword((current) => !current)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input data-testid="signup-photo-input" placeholder="Profile photo URL (optional)" value={signupForm.profile_photo} onChange={(event) => setSignupForm((current) => ({ ...current, profile_photo: event.target.value }))} />
                <Button data-testid="signup-submit-button" className="w-full bg-sky-600 hover:bg-sky-700" onClick={() => runAuth("signup")} disabled={loading}>
                  {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create account
                </Button>
              </TabsContent>

              <TabsContent value="reset" className="space-y-4">
                <Input data-testid="reset-phone-input" placeholder="Phone number used on account" value={resetForm.phone} onChange={(event) => setResetForm((current) => ({ ...current, phone: event.target.value }))} />
                <Button data-testid="reset-request-button" variant="outline" className="w-full border-sky-200" onClick={requestReset}>
                  Request verification code
                </Button>
                {resetCode ? (
                  <p data-testid="reset-demo-code" className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                    Verification code: {resetCode}
                  </p>
                ) : null}
                <Input data-testid="reset-code-input" placeholder="Verification code" value={resetForm.code} onChange={(event) => setResetForm((current) => ({ ...current, code: event.target.value }))} />
                <Input data-testid="reset-new-password-input" type="password" placeholder="New password" value={resetForm.new_password} onChange={(event) => setResetForm((current) => ({ ...current, new_password: event.target.value }))} />
                <Button data-testid="reset-confirm-button" className="w-full bg-sky-600 hover:bg-sky-700" onClick={confirmReset}>
                  Update password
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
