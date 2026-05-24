'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { Link2, Copy, Check, Trash2, Wand2, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

type UtmLink = {
  id: string;
  label: string;
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content: string | null;
  term: string | null;
  generatedUrl: string;
  createdAt: string;
  project: { slug: string; name: string } | null;
};

type Rules = { sources: string[]; mediums: string[]; tokenPattern: string; tokenHint: string };
type Project = { id: string; slug: string; name: string };

export default function UtmPage() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<UtmLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // form state
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://a-school.kz/');
  const [source, setSource] = useState('instagram');
  const [medium, setMedium] = useState('social');
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [term, setTerm] = useState('');
  const [projectId, setProjectId] = useState('');

  function refresh() {
    const token = readCookie('access_token');
    if (!token) return;
    apiFetch<UtmLink[]>('/utm?limit=50', { token }).then(setHistory).catch(console.error);
  }

  useEffect(() => {
    const token = readCookie('access_token');
    if (!token) return;
    Promise.all([
      apiFetch<Rules>('/utm/rules', { token }),
      apiFetch<Project[]>('/projects', { token }),
    ]).then(([r, p]) => {
      setRules(r);
      setProjects(p);
    });
    refresh();
  }, []);

  // Live preview
  const previewUrl = (() => {
    if (!baseUrl || !campaign) return null;
    try {
      const u = new URL(baseUrl);
      u.searchParams.set('utm_source', source);
      u.searchParams.set('utm_medium', medium);
      u.searchParams.set('utm_campaign', campaign.toLowerCase());
      if (content) u.searchParams.set('utm_content', content.toLowerCase());
      if (term) u.searchParams.set('utm_term', term.toLowerCase());
      return u.toString();
    } catch {
      return null;
    }
  })();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const token = readCookie('access_token');
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/utm', {
        method: 'POST',
        token,
        body: JSON.stringify({
          label,
          baseUrl,
          source,
          medium,
          campaign,
          content: content || undefined,
          term: term || undefined,
          projectId: projectId || undefined,
        }),
      });
      // reset
      setLabel(''); setCampaign(''); setContent(''); setTerm('');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(id: string) {
    if (!confirm('Удалить эту метку?')) return;
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch(`/utm/${id}`, { method: 'DELETE', token });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function copyUrl(id: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    });
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">UTM-конструктор</h1>
        <p className="text-sm text-muted-foreground">
          Генератор UTM-меток с принудительными правилами именования (§14.5 ТЗ).
          Чтобы вся команда делала единообразные метки и аналитика по проектам не ломалась.
        </p>
      </header>

      {/* Конструктор */}
      <form onSubmit={submit} className="border border-border rounded-xl bg-background p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Название метки" hint="для истории, например «Reels про набор»">
            <input
              required minLength={3}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input"
              placeholder="Reels: видео про набор"
            />
          </Field>
          <Field label="Целевая ссылка (baseUrl)">
            <input
              required type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="input"
              placeholder="https://a-school.kz/courses"
            />
          </Field>
          <Field label="utm_source" hint="откуда трафик">
            <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
              {rules?.sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="utm_medium" hint="тип канала">
            <select value={medium} onChange={(e) => setMedium(e.target.value)} className="input">
              {rules?.mediums.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="utm_campaign" hint={rules?.tokenHint}>
            <input
              required
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="input"
              placeholder="autumn_2026"
              pattern="[a-zA-Z0-9_-]+"
            />
          </Field>
          <Field label="Проект (опционально)">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="input"
            >
              <option value="">— не привязан —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="utm_content (опционально)" hint="конкретное объявление/публикация">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input"
              placeholder="reel_aigerim_3"
              pattern="[a-zA-Z0-9_-]*"
            />
          </Field>
          <Field label="utm_term (опционально)" hint="ключевое слово / таргет">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="input"
              placeholder="parents_kz"
              pattern="[a-zA-Z0-9_-]*"
            />
          </Field>
        </div>

        {/* Превью URL */}
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Wand2 className="size-3" /> Превью
          </div>
          {previewUrl ? (
            <code className="text-xs break-all block font-mono text-foreground">{previewUrl}</code>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              Заполните baseUrl и campaign — появится URL
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
          >
            <Link2 className="size-4" /> {busy ? 'Сохранение…' : 'Сохранить и скопировать'}
          </button>
        </div>
      </form>

      {/* История */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">История меток</h2>
          <div className="text-xs text-muted-foreground">{history.length} последних</div>
        </div>
        <div className="border border-border rounded-xl bg-background overflow-hidden">
          {history.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Меток пока нет. Создайте первую сверху.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Метка</th>
                  <th className="text-left px-3 py-2">Source / Medium</th>
                  <th className="text-left px-3 py-2">Campaign</th>
                  <th className="text-left px-3 py-2">Проект</th>
                  <th className="text-right px-4 py-2">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="font-medium">{u.label}</div>
                      <code className="text-[10px] text-muted-foreground break-all line-clamp-1">
                        {u.generatedUrl}
                      </code>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs">
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded mr-1">
                          {u.source}
                        </span>
                        <span className="px-1.5 py-0.5 bg-muted rounded">{u.medium}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">{u.campaign}</td>
                    <td className="px-3 py-2 text-xs">
                      {u.project ? (
                        <Link href={`/projects/${u.project.slug}`} className="hover:text-primary">
                          {u.project.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => copyUrl(u.id, u.generatedUrl)}
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                          title="Копировать URL"
                        >
                          {copiedId === u.id ? (
                            <Check className="size-4 text-success" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteOne(u.id)}
                          className="p-1.5 hover:bg-danger/10 hover:text-danger rounded text-muted-foreground"
                          title="Удалить"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </label>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
