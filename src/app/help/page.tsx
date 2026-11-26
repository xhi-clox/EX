'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Cpu,
  FileText,
  HelpCircle,
  ImageUp,
  Keyboard,
  LifeBuoy,
  Loader2,
  Mail,
  MessageSquare,
  MonitorCheck,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProjects } from '@/hooks/use-projects';
import { SHORTCUTS, SHORTCUT_GROUPS, comboKeys } from '@/app/editor/shortcuts';
import { cn } from '@/lib/utils';

const SUPPORT_EMAIL = 'support@exampro.app';

type FaqCategory =
  | 'Getting started'
  | 'Editor'
  | 'AI & import'
  | 'Export & print'
  | 'Account';

interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: React.ReactNode;
}

const FAQS: FaqItem[] = [
  {
    id: 'first-paper',
    category: 'Getting started',
    question: 'How do I create my first question paper?',
    answer: (
      <div className="space-y-2">
        <p>
          Open <Link href="/projects" className="font-bold text-[#0f766e]">Projects</Link> and
          choose <strong>New paper</strong>. Give it a name, subject and class. The editor opens
          with a blank paper that already uses your school name, time and marks defaults.
        </p>
        <p>
          From the dashboard you can also start with a quick action: blank paper, AI generation
          from a topic, or OCR import from a photo.
        </p>
      </div>
    ),
  },
  {
    id: 'defaults',
    category: 'Getting started',
    question: 'Where do the school name, time and marks come from?',
    answer: (
      <p>
        New papers use the values on{' '}
        <Link href="/settings" className="font-bold text-[#0f766e]">Settings → Paper defaults</Link>.
        Change them once and every new paper starts with those values. Existing papers keep
        their own details.
      </p>
    ),
  },
  {
    id: 'save',
    category: 'Editor',
    question: 'When is my paper saved?',
    answer: (
      <p>
        The editor saves shortly after you stop typing. The status beside the paper title shows
        “saved”, “saving” or “changes pending”. You can also press <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd>{' '}
        to save immediately. Autosave can be turned off in Settings.
      </p>
    ),
  },
  {
    id: 'undo',
    category: 'Editor',
    question: 'Can I undo a mistake?',
    answer: (
      <p>
        Yes. Use <Kbd>Ctrl</Kbd> + <Kbd>Z</Kbd> to undo and <Kbd>Ctrl</Kbd> +{' '}
        <Kbd>Shift</Kbd> + <Kbd>Z</Kbd> to redo. Deleting a question is also undoable. A burst
        of typing is grouped into one undo step so you can revert a sentence at a time.
      </p>
    ),
  },
  {
    id: 'question-types',
    category: 'Editor',
    question: 'Which question types are supported?',
    answer: (
      <p>
        MCQ, short answer, essay/creative, passage/comprehension, fill in the blanks, table,
        section headers, text boxes, images, and “or” separators. Questions can contain nested
        sub-questions, and numbering is automatic.
      </p>
    ),
  },
  {
    id: 'ai',
    category: 'AI & import',
    question: 'How does AI paper generation work?',
    answer: (
      <p>
        Choose <strong>Generate from topic</strong>, create a project, then describe the topic
        and class. AI returns a structured draft that you can open in the editor and edit like
        any other paper. Review the questions before exporting.
      </p>
    ),
  },
  {
    id: 'ocr',
    category: 'AI & import',
    question: 'Can I import a photo of an existing paper?',
    answer: (
      <p>
        Yes. Open a paper and choose the image/OCR import action, or use{' '}
        <strong>Import from image</strong> on the dashboard. A clear, well-lit photo works best.
        Imported questions are appended to the current paper so nothing is overwritten.
      </p>
    ),
  },
  {
    id: 'pdf',
    category: 'Export & print',
    question: 'How do I download a print-ready PDF?',
    answer: (
      <p>
        In the editor press <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>E</Kbd> or use the
        download button. The booklet preview shows the page order before the PDF is generated.
        Check the page margins in paper settings if content is close to the edge.
      </p>
    ),
  },
  {
    id: 'pagination',
    category: 'Export & print',
    question: 'Why did a question move to the next page?',
    answer: (
      <p>
        Pagination keeps a question and its sub-questions together so nothing splits across
        pages. If a large question does not fit, it moves to the next page. Reducing font size
        or line spacing in paper settings can help fit more content.
      </p>
    ),
  },
  {
    id: 'backup',
    category: 'Account',
    question: 'How do I back up or move my papers?',
    answer: (
      <p>
        Go to{' '}
        <Link href="/settings" className="font-bold text-[#0f766e]">Settings → Data & privacy</Link>{' '}
        and choose <strong>Download JSON</strong>. The export contains the full paper document for
        every project, including questions, tables and images.
      </p>
    ),
  },
  {
    id: 'delete',
    category: 'Account',
    question: 'Can I recover a deleted paper?',
    answer: (
      <p>
        Deleting a paper from the project menu is permanent. Use <strong>Duplicate</strong>{' '}
        before making large changes if you want to keep the original. Settings also has a
        “delete all papers” action, which asks for confirmation first.
      </p>
    ),
  },
  {
    id: 'profile',
    category: 'Account',
    question: 'How do I change my name, photo or password?',
    answer: (
      <p>
        Open{' '}
        <Link href="/profile" className="font-bold text-[#0f766e]">Profile</Link> to update your
        name and photo URL. Email accounts can change their password there; Google accounts use
        Google sign-in instead.
      </p>
    ),
  },
];

const CATEGORIES: Array<'All' | FaqCategory> = [
  'All',
  'Getting started',
  'Editor',
  'AI & import',
  'Export & print',
  'Account',
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[#d1e2de] bg-white px-1.5 font-sans text-[10px] font-bold text-[#4f6d6f] shadow-[0_1px_0_rgba(23,52,58,0.06)]">
      {children}
    </kbd>
  );
}

function ShortcutKeycaps({ id }: { id: string }) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);
  const shortcut = SHORTCUTS.find((item) => item.id === id);
  if (!shortcut) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {comboKeys(shortcut.combo, mac).map((key, index) => (
        <Kbd key={index}>{key}</Kbd>
      ))}
    </span>
  );
}

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

function HelpPage() {
  const { data: session } = useSession();
  const { projects } = useProjects();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | FaqCategory>('All');
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [checking, setChecking] = useState(false);

  const [topic, setTopic] = useState('Question');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return FAQS.filter((faq) => {
      if (category !== 'All' && faq.category !== category) return false;
      if (!needle) return true;
      return `${faq.question} ${faq.category}`.toLowerCase().includes(needle);
    });
  }, [query, category]);

  const runChecks = async () => {
    setChecking(true);
    const results: CheckResult[] = [];

    results.push({
      label: 'Browser connection',
      ok: navigator.onLine,
      detail: navigator.onLine ? 'Online' : 'Offline — changes cannot be saved',
    });

    try {
      const started = performance.now();
      const response = await fetch('/api/projects', { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - started);
      results.push({
        label: 'Papers API',
        ok: response.ok,
        detail: response.ok ? `Responded in ${elapsed} ms` : `HTTP ${response.status}`,
      });
    } catch {
      results.push({
        label: 'Papers API',
        ok: false,
        detail: 'Could not reach the server',
      });
    }

    let storageOk = true;
    try {
      window.localStorage.setItem('examProDiagnostic', '1');
      window.localStorage.removeItem('examProDiagnostic');
    } catch {
      storageOk = false;
    }
    results.push({
      label: 'Local preferences',
      ok: storageOk,
      detail: storageOk ? 'Browser storage available' : 'Storage is blocked',
    });

    results.push({
      label: 'Clipboard',
      ok: Boolean(navigator.clipboard),
      detail: navigator.clipboard ? 'Copy to clipboard available' : 'Copy is not available',
    });

    setChecks(results);
    setChecking(false);
  };

  useEffect(() => {
    void runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildReport = () => {
    const lines = [
      'ExamPro support report',
      `Generated: ${new Date().toISOString()}`,
      `Account: ${session?.user?.email ?? 'not signed in'}`,
      `Papers: ${projects.length}`,
      `Page: ${typeof window !== 'undefined' ? window.location.href : '—'}`,
      `Viewport: ${typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '—'}`,
      `User agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : '—'}`,
      '',
      'System checks:',
      ...checks.map((check) => `- ${check.label}: ${check.ok ? 'OK' : 'FAIL'} (${check.detail})`),
    ];
    return lines.join('\n');
  };

  const copyText = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title, description: 'Copied to your clipboard.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Could not copy',
        description: 'Select the text manually and copy it.',
      });
    }
  };

  const sendSupportRequest = () => {
    setContactError(null);
    if (!subject.trim() || !message.trim()) {
      setContactError('Add a subject and a message before sending.');
      return;
    }

    const body = [
      `Topic: ${topic}`,
      `From: ${session?.user?.email ?? 'not signed in'}`,
      '',
      message.trim(),
      '',
      '---',
      buildReport(),
    ].join('\n');

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[ExamPro] ${subject.trim()}`
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    toast({
      title: 'Email draft opened',
      description: 'Attach a screenshot if it helps explain the issue.',
    });
  };

  const quickLinks = [
    {
      title: 'Create a paper',
      description: 'Start with a blank paper',
      href: '/projects?intent=blank',
      icon: FileText,
      tone: 'bg-[#e3f2ee] text-[#0f766e]',
    },
    {
      title: 'Import a photo',
      description: 'Turn a paper photo into text',
      href: '/projects?intent=image',
      icon: ImageUp,
      tone: 'bg-[#fbe8e4] text-[#a65346]',
    },
    {
      title: 'AI generation',
      description: 'Draft questions from a topic',
      href: '/projects?intent=ai',
      icon: Sparkles,
      tone: 'bg-[#f0e9fb] text-[#6d4fa3]',
    },
    {
      title: 'Back up papers',
      description: 'Export everything as JSON',
      href: '/settings',
      icon: ShieldCheck,
      tone: 'bg-[#fff1dc] text-[#a66b1d]',
    },
  ];

  return (
    <DashboardShell
      title="Help & support"
      eyebrow="Guides, shortcuts and diagnostics"
      actions={
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-bold text-white transition-colors hover:bg-[#115e59]"
        >
          <Mail className="size-4" /> Email support
        </a>
      }
    >
      <div className="grid gap-5">
        <section className="overflow-hidden rounded-2xl border border-[#d7e5e1] bg-[#12363c] p-5 text-white shadow-[0_14px_34px_rgba(23,52,58,0.14)] sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#70c7b6]">
                Support centre
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                Find an answer or send us the details.
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#b5ccca]">
                Search the guides below, run a quick system check, or open a support email with
                your account and browser details already attached.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#83a6a5]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search help, e.g. “PDF”, “autosave”, “duplicate”"
                aria-label="Search help articles"
                className="w-full rounded-xl border border-white/15 bg-white/10 py-3 pl-10 pr-4 text-sm font-medium text-white outline-none transition-colors placeholder:text-[#9fbab8] focus:border-[#70c7b6] focus:bg-white/15"
              />
              <p className="mt-2 text-[11px] text-[#9fbab8]">
                {filteredFaqs.length} of {FAQS.length} guides match
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {quickLinks.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="group rounded-xl border border-white/10 bg-white/[0.06] p-3 transition-colors hover:border-[#70c7b6]/50 hover:bg-white/10"
              >
                <span className={cn('mb-2 flex size-8 items-center justify-center rounded-lg', link.tone)}>
                  <link.icon className="size-4" />
                </span>
                <span className="block text-xs font-bold text-white">{link.title}</span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-[#9fbab8]">
                  {link.description}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
            <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-[#e8efed] pb-4">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                    category === item
                      ? 'bg-[#173f45] text-white'
                      : 'text-[#6b8385] hover:bg-[#f0f8f6] hover:text-[#0f766e]'
                  )}
                >
                  {item}
                </button>
              ))}
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#cdddda] bg-[#f8fbfa] px-6 py-8 text-center">
                <HelpCircle className="mb-2 size-7 text-[#8aa0a0]" />
                <p className="text-sm font-bold text-[#294b50]">No guide matches that search</p>
                <p className="mt-1 text-xs text-[#829697]">
                  Try a shorter word, or send us the question below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCategory('All');
                  }}
                  className="mt-3 text-xs font-bold text-[#0f766e] hover:text-[#115e59]"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-1">
                {filteredFaqs.map((faq) => (
                  <AccordionItem
                    key={faq.id}
                    value={faq.id}
                    className="rounded-xl border border-transparent px-2 transition-colors data-[state=open]:border-[#e4ecea] data-[state=open]:bg-[#f9fcfb]"
                  >
                    <AccordionTrigger className="gap-3 py-3 text-left text-sm font-bold text-[#29484d] hover:no-underline">
                      <span className="flex items-start gap-3">
                        <span className="mt-0.5 rounded-md bg-[#e8f2ef] px-1.5 py-0.5 text-[10px] font-bold text-[#397d73]">
                          {faq.category}
                        </span>
                        {faq.question}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pl-[86px] pr-2 text-[13px] leading-relaxed text-[#4f6d6f]">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#17343a]">
                    <MonitorCheck className="size-4 text-[#0f766e]" /> System check
                  </h2>
                  <p className="mt-0.5 text-[11px] text-[#829697]">
                    A quick look at what the app needs.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runChecks()}
                  disabled={checking}
                  className="border-[#d1e2de] bg-white text-[#0f766e] hover:bg-[#f0f8f6]"
                >
                  {checking ? <Loader2 className="size-3.5 animate-spin" /> : 'Run'}
                </Button>
              </div>

              <div className="space-y-2">
                {checks.map((check) => (
                  <div
                    key={check.label}
                    className="flex items-start gap-2 rounded-lg border border-[#e8efed] bg-[#f9fcfb] px-3 py-2"
                  >
                    {check.ok ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#3f9d7d]" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-[#c65d4d]" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#29484d]">{check.label}</p>
                      <p className="text-[10px] leading-relaxed text-[#829697]">{check.detail}</p>
                    </div>
                  </div>
                ))}
                {checks.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[#cdddda] px-3 py-4 text-center text-xs text-[#829697]">
                    Run the check to see the current status.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => void copyText(buildReport(), 'Report copied')}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#d1e2de] bg-white px-3 py-2 text-xs font-bold text-[#587174] transition-colors hover:border-[#8bc8bd] hover:text-[#0f766e]"
              >
                <Copy className="size-3.5" /> Copy diagnostic report
              </button>
            </section>

            <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
              <div className="mb-4 flex items-start gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e8eefb] text-[#3d5f9a]">
                  <LifeBuoy className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#17343a]">Contact support</h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#829697]">
                    We reply to {SUPPORT_EMAIL}.
                  </p>
                </div>
              </div>

              {contactError && (
                <p
                  role="alert"
                  className="mb-3 rounded-lg border border-[#f2cdc7] bg-[#fdf1ef] px-3 py-2 text-xs font-medium text-[#b04a3b]"
                >
                  {contactError}
                </p>
              )}

              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-[12px] font-bold text-[#17343a]">Topic</Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#d7e5e1] bg-white text-[#17343a]">
                      <SelectItem value="Question">Question</SelectItem>
                      <SelectItem value="Bug report">Bug report</SelectItem>
                      <SelectItem value="Account issue">Account issue</SelectItem>
                      <SelectItem value="Feature request">Feature request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="support-subject" className="text-[12px] font-bold text-[#17343a]">
                    Subject
                  </Label>
                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    maxLength={120}
                    placeholder="Short summary"
                    className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a] placeholder:text-[#8aa0a0] focus-visible:ring-[#5aa99d]"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="support-message" className="text-[12px] font-bold text-[#17343a]">
                    Message
                  </Label>
                  <Textarea
                    id="support-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={4000}
                    rows={4}
                    placeholder="What happened, and what did you expect?"
                    className="border-[#d1e2de] bg-[#f4f9f7] text-[#17343a] placeholder:text-[#8aa0a0] focus-visible:ring-[#5aa99d]"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <Button
                  onClick={sendSupportRequest}
                  className="w-full bg-[#0f766e] text-white hover:bg-[#115e59]"
                >
                  <Mail className="size-4" /> Open email draft
                </Button>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      `Topic: ${topic}\nSubject: ${subject}\n\n${message}\n\n---\n${buildReport()}`,
                      'Request copied'
                    )
                  }
                  className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#6b8385] transition-colors hover:text-[#0f766e]"
                >
                  <ClipboardCheck className="size-3.5" /> Copy request instead
                </button>
              </div>
            </section>
          </aside>
        </div>

        <section className="rounded-2xl border border-[#d7e5e1] bg-white p-5 shadow-[0_10px_30px_rgba(23,52,58,0.05)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#e8efed] pb-4">
            <div className="flex items-start gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#f0e9fb] text-[#6d4fa3]">
                <Keyboard className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#17343a]">Editor keyboard shortcuts</h2>
                <p className="mt-0.5 text-[11px] text-[#829697]">
                  Shortcuts use the physical key, so they work with Bangla keyboards too.
                </p>
              </div>
            </div>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-xs font-bold text-[#0f766e] hover:text-[#115e59]"
            >
              Open the editor <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group}>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#829697]">
                  {group}
                </h3>
                <ul className="space-y-1.5">
                  {SHORTCUTS.filter((shortcut) => shortcut.group === group && !shortcut.hidden).map(
                    (shortcut) => (
                      <li
                        key={shortcut.id}
                        className="flex items-center justify-between gap-3 text-xs text-[#4f6d6f]"
                      >
                        <span>{shortcut.label}</span>
                        <ShortcutKeycaps id={shortcut.id} />
                      </li>
                    )
                  )}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-3 border-t border-[#e8efed] pt-4 sm:grid-cols-3">
            {[
              {
                icon: Cpu,
                title: 'Works offline?',
                text: 'Open pages keep working, but saving needs a connection. The system check above tells you if the API is reachable.',
              },
              {
                icon: BookOpenCheck,
                title: 'AI needs a key',
                text: 'AI generation and OCR require a configured Gemini key on the server. The rest of the editor works without it.',
              },
              {
                icon: MessageSquare,
                title: 'Include details',
                text: 'When reporting an issue, include the paper name and what you did just before it happened.',
              },
            ].map((tip) => (
              <div key={tip.title} className="rounded-xl bg-[#f9fcfb] p-3 ring-1 ring-[#e8efed]">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[#29484d]">
                  <tip.icon className="size-3.5 text-[#0f766e]" /> {tip.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#829697]">{tip.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

export default HelpPage;
