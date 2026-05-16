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

export const ProfilePage = ({ user, profileForm, setProfileForm, onSaveProfile, onDeleteAccount }) => (
  <div className="space-y-6">
    <section className="glass-panel p-6 lg:p-8">
      <Badge data-testid="profile-page-badge" className="bg-sky-100 text-sky-700 hover:bg-sky-100">Patient profile</Badge>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">Your identity, settings, and account control.</h1>
      <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">Update the details your doctor needs most often: name, age, blood group, photo, and secure account settings.</p>
    </section>

    <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
      <Card className="border-sky-100 bg-white/90 shadow-sm">
        <CardContent className="p-6 text-center">
          <img data-testid="profile-avatar-image" src={profileForm.profile_photo || user.profile_photo} alt={user.name} className="mx-auto h-28 w-28 rounded-full object-cover shadow-lg" />
          <h2 data-testid="profile-name-display" className="mt-4 text-2xl font-semibold text-slate-900">{user.name}</h2>
          <p data-testid="profile-email-display" className="mt-1 text-sm text-slate-500">{user.email}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge data-testid="profile-blood-group-display" className="bg-sky-100 text-sky-700 hover:bg-sky-100">{user.blood_group}</Badge>
            <Badge data-testid="profile-role-display" variant="outline" className="border-sky-200 text-sky-700">{user.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sky-100 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Account settings</CardTitle>
          <CardDescription>Edit your personal details and manage account access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input data-testid="profile-name-input" placeholder="Full name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
            <Input data-testid="profile-age-input" type="number" placeholder="Age" value={profileForm.age} onChange={(event) => setProfileForm((current) => ({ ...current, age: event.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input data-testid="profile-blood-group-input" placeholder="Blood group" value={profileForm.blood_group} onChange={(event) => setProfileForm((current) => ({ ...current, blood_group: event.target.value }))} />
            <Input data-testid="profile-phone-input" placeholder="Phone" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
          </div>
          <Input data-testid="profile-photo-input" placeholder="Profile photo URL" value={profileForm.profile_photo} onChange={(event) => setProfileForm((current) => ({ ...current, profile_photo: event.target.value }))} />
          <Button data-testid="profile-save-button" className="w-full bg-sky-600 hover:bg-sky-700" onClick={onSaveProfile}>
            Save profile
          </Button>
          <Button data-testid="profile-delete-button" variant="outline" className="w-full border-red-200 text-red-600" onClick={onDeleteAccount}>
            Delete account
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
);
