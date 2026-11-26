'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  AtSign,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  FileQuestion,
  FileText,
  Folder,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  Settings,
  ShieldCheck,
  Target,
  User,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatMarks } from '@/lib/project-utils';
import { cn } from '@/lib/utils';

interface AccountProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  hasPassword: boolean;
  stats: {
    projects: number;
    papers: number;
    questions: number;
    marks: number;
    subjects: number;
    classes: number;
  };
}

const inputClass =
  'border-[#d1e2de] bg-[#f4f9f7] text-[#17343a] placeholder:text-[#8aa0a0] focus-visible:ring-[#5aa99d]';

function ProfilePage() {
  const { update } = useSession();
  const { toast } = useToast();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Could not load account (${response.status})`);
      }
      const data = (await response.json()) as AccountProfile;
      setProfile(data);
      setName(data.name ?? '');
      setImage(data.image ?? '');
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Could not load your account.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    if (!profile || savingProfile) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setProfileError('Name must be at least 2 characters.');
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, image: image.trim() || null }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Could not save profile (${response.status})`);
      }

      setProfile((current) =>
        current
          ? { ...current, name: payload.name, image: payload.image }
          : current
      );
      setName(payload.name ?? trimmed);
      setImage(payload.image ?? '');
      await update({ name: payload.name, image: payload.image });
      toast({
        title: 'Profile updated',
        description: 'Your account details have been saved.',
      });
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : 'Could not save your profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (savingPassword) return;
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Could not change password (${response.status})`);
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: 'Password changed',
        description: 'Use your new password the next time you sign in.',
      });
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : 'Could not change your password.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const displayName = profile?.name || profile?.email?.split('@')[0] || 'Teacher';
  const initial = displayName.charAt(0).toUpperCase();
  const memberSince = profile ? format(new Date(profile.createdAt), 'd MMMM yyyy') : '—';

  const stats = profile
    ? [
        { label: 'Papers', value: profile.stats.projects, icon: Folder, tone: 'bg-[#e3f2ee] text-[#0f766e]' },
        { label: 'Saved papers', value: profile.stats.papers, icon: FileText, tone: 'bg-[#e8eefb] text-[#3d5f9a]' },
        { label: 'Questions', value: profile.stats.questions, icon: FileQuestion, tone: 'bg-[#f0e9fb] text-[#6d4fa3]' },
        { label: 'Marks', value: formatMarks(profile.stats.marks), icon: Target, tone: 'bg-[#fff1dc] text-[#a66b1d]' },
        { label: 'Subjects', value: profile.stats.subjects, icon: BookOpen, tone: 'bg-[#e3f2ee] text-[#0f766e]' },
        { label: 'Classes', value: profile.stats.classes, icon: Users, tone: 'bg-[#fbe8e4] text-[#a65346]' },
      ]
    : [];

  return (
    <DashboardShell
      title="Profile"
      eyebrow="Your account and teaching workspace"
      actions={
        <Link
          href="/settings"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d1e2de] bg-white px-4 text-sm font-bold text-[#587174] transition-colors hover:border-[#8bc8bd] hover:bg-[#f0f8f6] hover:text-[#0f766e]"
        >
          <Settings className="size-4" /> Settings
        </Link>
      }
    >
      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="h-[360px] animate-pulse rounded-2xl border border-[#d7e5e1] bg-white" />
          <div className="h-[360px] animate-pulse rounded-2xl border border-[#d7e5e1] bg-white" />
        </div>
      ) : loadError || !profile ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#cdddda] bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold text-[#294b50]">Could not load your account</p>
          <p className="mt-1 max-w-sm text-xs text-[#829697]">{loadError}</p>
          <Button
            onClick={() => void loadProfile()}
            className="mt-4 bg-[#0f766e] text-white hover:bg-[#115e59]"
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-[#d7e5e1] bg-white shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
              <div className="h-24 bg-[#12363c]" />
              <div className="px-5 pb-5">
                <div className="-mt-10 mb-3 flex items-end justify-between">
                  <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#173f45] text-2xl font-bold text-white shadow-md">
                    {profile.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.image}
                        alt={displayName}
                        className="size-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      initial
                    )}
                  </div>
                  <span
                    className={cn(
                      'mb-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold',
                      profile.hasPassword
                        ? 'bg-[#eaf7f2] text-[#327d68]'
                        : 'bg-[#e8eefb] text-[#3d5f9a]'
                    )}
                  >
                    <BadgeCheck className="size-3" />
                    {profile.hasPassword ? 'Email account' : 'Google account'}
                  </span>
                </div>

                <h2 className="truncate text-lg font-bold text-[#102f35]">{displayName}</h2>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#6b8385]">
                  <Mail className="size-3.5" /> {profile.email}
                </p>

                <div className="mt-4 space-y-2 border-t border-[#e8efed] pt-4 text-xs">
                  <p className="flex items-center justify-between text-[#6b8385]">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" /> Member since
                    </span>
                    <span className="font-bold text-[#294b50]">{memberSince}</span>
                  </p>
                  <p className="flex items-center justify-between text-[#6b8385]">
                    <span className="flex items-center gap-1.5">
                      <AtSign className="size-3.5" /> Account ID
                    </span>
                    <span className="max-w-[140px] truncate font-mono text-[10px] font-bold text-[#294b50]">
                      {profile.id}
                    </span>
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#d7e5e1] bg-[#f9fcfb] p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#17343a]">
                <ShieldCheck className="size-4 text-[#0f766e]" /> Your workspace
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#6b8385]">
                Papers are private to this account. Use Settings to export a backup or change
                paper defaults.
              </p>
              <Link
                href="/projects"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0f766e] hover:text-[#115e59]"
              >
                Open all papers →
              </Link>
            </section>
          </div>

          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[#d7e5e1] bg-white p-4 shadow-[0_8px_22px_rgba(23,52,58,0.04)]"
                >
                  <span className={cn('mb-3 flex size-9 items-center justify-center rounded-xl', stat.tone)}>
                    <stat.icon className="size-4" />
                  </span>
                  <p className="text-xl font-bold tracking-[-0.03em] text-[#102f35]">
                    {stat.value}
                  </p>
                  <p className="text-[11px] font-bold text-[#6b8385]">{stat.label}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
              <div className="mb-4 flex items-start gap-3 border-b border-[#e8efed] pb-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#e3f2ee] text-[#0f766e]">
                  <User className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#102f35]">Personal details</h2>
                  <p className="mt-0.5 text-xs text-[#6b8385]">
                    Your name appears in the dashboard greeting and account menu.
                  </p>
                </div>
              </div>

              {profileError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl border border-[#f2cdc7] bg-[#fdf1ef] px-4 py-3 text-sm font-medium text-[#b04a3b]"
                >
                  {profileError}
                </p>
              )}

              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="profile-name" className="text-[13px] font-bold text-[#17343a]">
                    Full name
                  </Label>
                  <Input
                    id="profile-name"
                    value={name}
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                    placeholder="Your name"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="profile-email" className="text-[13px] font-bold text-[#17343a]">
                    Email
                  </Label>
                  <Input
                    id="profile-email"
                    value={profile.email ?? ''}
                    readOnly
                    disabled
                    className="border-[#e4ecea] bg-[#f7faf9] text-[#6b8385]"
                  />
                  <p className="text-[11px] text-[#829697]">
                    Email changes are not supported yet. Contact support if you need to move
                    your account.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="profile-image" className="text-[13px] font-bold text-[#17343a]">
                    Photo URL
                  </Label>
                  <Input
                    id="profile-image"
                    value={image}
                    onChange={(event) => setImage(event.target.value)}
                    className={inputClass}
                    placeholder="https://example.com/photo.jpg"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImage('')}
                      className="text-[11px] font-bold text-[#6b8385] hover:text-[#b04a3b]"
                    >
                      Remove photo
                    </button>
                    <span className="text-[11px] text-[#829697]">
                      Leave blank to use your initial.
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end border-t border-[#e8efed] pt-4">
                <Button
                  onClick={() => void handleSaveProfile()}
                  disabled={savingProfile}
                  className="bg-[#0f766e] text-white hover:bg-[#115e59]"
                >
                  {savingProfile ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save profile
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
              <div className="mb-4 flex items-start gap-3 border-b border-[#e8efed] pb-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#fff1dc] text-[#a66b1d]">
                  <KeyRound className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#102f35]">Password</h2>
                  <p className="mt-0.5 text-xs text-[#6b8385]">
                    {profile.hasPassword
                      ? 'Use at least 8 characters. You will keep your current session.'
                      : 'This account signs in with Google, so there is no password to change.'}
                  </p>
                </div>
              </div>

              {profile.hasPassword ? (
                <>
                  {passwordError && (
                    <p
                      role="alert"
                      className="mb-4 rounded-xl border border-[#f2cdc7] bg-[#fdf1ef] px-4 py-3 text-sm font-medium text-[#b04a3b]"
                    >
                      {passwordError}
                    </p>
                  )}
                  <div className="grid gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="current-password" className="text-[13px] font-bold text-[#17343a]">
                        Current password
                      </Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        className={inputClass}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="new-password" className="text-[13px] font-bold text-[#17343a]">
                          New password
                        </Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          className={inputClass}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="confirm-password" className="text-[13px] font-bold text-[#17343a]">
                          Confirm new password
                        </Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          className={inputClass}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end border-t border-[#e8efed] pt-4">
                    <Button
                      onClick={() => void handleChangePassword()}
                      disabled={
                        savingPassword || !currentPassword || !newPassword || !confirmPassword
                      }
                      className="bg-[#173f45] text-white hover:bg-[#12363c]"
                    >
                      {savingPassword ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Lock className="size-4" />
                      )}
                      Update password
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-[#dbe6f5] bg-[#f3f7fd] px-4 py-3">
                  <Check className="size-4 text-[#3d5f9a]" />
                  <p className="text-xs text-[#3d5f9a]">
                    Google handles your sign-in securely. You can still add a profile photo URL
                    above.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default ProfilePage;
