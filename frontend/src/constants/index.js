export const heroImage =
  "https://images.pexels.com/photos/5712677/pexels-photo-5712677.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export const navItems = [
  { label: "Dashboard", href: "/app/dashboard", icon: "Home" },
  { label: "Records", href: "/app/records", icon: "FileText" },
  { label: "Doctor Sharing", href: "/app/sharing", icon: "Share2" },
  { label: "Profile", href: "/app/profile", icon: "UserCircle" },
  { label: "Admin", href: "/app/admin", icon: "ShieldPlus" },
];

export const severityStyles = {
  severe: "bg-red-50 text-red-700 border-red-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  mild: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export const blankSignup = {
  name: "",
  age: "",
  blood_group: "",
  email: "",
  phone: "",
  password: "",
  profile_photo: "",
};

export const blankMedicine = {
  medicine_name: "",
  dosage: "",
  start_date: new Date().toISOString().slice(0, 10),
  frequency: "Once daily",
  reminder_times: ["08:00"],
  notes: "",
  source: "manual",
  barcode: "",
};

export const blankRecord = {
  title: "",
  past_treatments: "",
  notes: "",
  prescription_image: "",
  prescription_text: "",
  report_type: "prescription",
};

export const blankProfile = {
  name: "",
  age: "",
  blood_group: "",
  phone: "",
  profile_photo: "",
};
