import { Link, useLocation } from "react-router-dom";
import {
  Home,
  FileText,
  Share2,
  UserCircle,
  ShieldPlus,
  Pill,
  LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navIconMap = {
  Home,
  FileText,
  Share2,
  UserCircle,
  ShieldPlus,
};

const navItems = [
  { label: "Dashboard", href: "/app/dashboard", icon: "Home" },
  { label: "Records", href: "/app/records", icon: "FileText" },
  { label: "Doctor Sharing", href: "/app/sharing", icon: "Share2" },
  { label: "Profile", href: "/app/profile", icon: "UserCircle" },
  { label: "Admin", href: "/app/admin", icon: "ShieldPlus" },
];

export const Shell = ({ user, onLogout, children }) => {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.55),_transparent_34%),linear-gradient(180deg,_#f8fdff_0%,_#eef7ff_48%,_#f8fbff_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:px-8 lg:py-6">
        <aside className="glass-panel lg:sticky lg:top-6 lg:flex lg:w-72 lg:flex-col">
          <div className="flex items-center gap-3 border-b border-sky-100 px-5 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold">Medi Track</p>
              <p className="text-sm text-slate-500">Hospital-style medicine control</p>
            </div>
          </div>

          <div className="px-5 py-5">
            <div data-testid="sidebar-user-card" className="rounded-3xl bg-sky-50 p-4">
              <p className="text-sm text-slate-500">Signed in as</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{user.name}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge data-testid="sidebar-user-role-badge" className="bg-sky-600 text-white hover:bg-sky-600">
                  {user.role}
                </Badge>
                <Badge data-testid="sidebar-user-blood-group-badge" variant="outline" className="border-sky-200 text-sky-700">
                  {user.blood_group}
                </Badge>
              </div>
            </div>
          </div>

          <nav className="flex flex-1 flex-row gap-2 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
            {navItems.map((item) => {
              const Icon = navIconMap[item.icon];
              const active = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  data-testid={`sidebar-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`flex min-w-max items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 ${active
                      ? "bg-sky-600 text-white shadow-[0_18px_35px_rgba(2,132,199,0.25)]"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-sky-100 px-5 py-5">
            <Button data-testid="logout-button" variant="outline" className="w-full border-sky-200" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <main className="flex-1 space-y-6 py-3">{children}</main>
      </div>
    </div>
  );
};
