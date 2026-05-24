'use client';

import { useEffect, useState, FormEvent } from 'react';
import { X, Eye, Heart, MessageCircle, Calendar, ExternalLink, Trash2, Send, NotebookPen } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatNumber } from '@/lib/utils';

type Video = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
};

type Note = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string; role: string } | null;
};

type Props = {
  video: Video | null;
  projectPlatformId: string;
  onClose: () => void;
};

export function VideoDetailSheet({ video, projectPlatformId, onClose }: Props) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setCurrentUserId(u.id);
        setCurrentUserRole(u.role);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!video) return;
    refresh();
    // ESC закрытие
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  function refresh() {
    if (!video) return;
    const token = readCookie('access_token');
    if (!token) return;
    apiFetch<Note[]>(`/notes?videoId=${video.id}`, { token })
      .then(setNotes)
      .catch((e) => setError((e as Error).message));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!video || !body.trim()) return;
    const token = readCookie('access_token');
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/notes', {
        method: 'POST',
        token,
        body: JSON.stringify({
          videoId: video.id,
          projectPlatformId,
          body: body.trim(),
        }),
      });
      setBody('');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(id: string) {
    if (!confirm('Удалить заметку?')) return;
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch(`/notes/${id}`, { method: 'DELETE', token });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!video) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
      />
      {/* Sheet справа */}
      <aside
        className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-background border-l border-border z-50 overflow-y-auto shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <header className="sticky top-0 z-10 bg-background border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="font-semibold">Карточка публикации</div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {/* Превью */}
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnail} alt="" className="w-full aspect-video object-cover rounded-lg" />
            <div>
              <h3 className="font-semibold leading-snug">{video.title}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(video.publishedAt).toLocaleDateString('ru-RU')}
                </span>
                <a
                  href={`https://youtu.be/${video.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-primary"
                >
                  Открыть на YouTube <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Метрики */}
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={<Eye className="size-4" />} label="Просмотры" value={video.views} />
            <Metric icon={<Heart className="size-4" />} label="Лайки" value={video.likes} />
            <Metric icon={<MessageCircle className="size-4" />} label="Комментарии" value={video.comments} />
          </div>

          {/* Заметки */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <NotebookPen className="size-4 text-primary" />
              <div className="font-semibold">Заметки команды</div>
              <div className="ml-auto text-xs text-muted-foreground">
                {notes?.length ?? 0}
              </div>
            </div>

            {/* Форма */}
            <form onSubmit={submit} className="space-y-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Что показалось интересным в этом видео?"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy || !body.trim()}
                  className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
                >
                  <Send className="size-3.5" /> {busy ? 'Отправка…' : 'Добавить'}
                </button>
              </div>
            </form>

            {error && (
              <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md mt-2">{error}</div>
            )}

            {/* Список заметок */}
            <div className="mt-4 space-y-3">
              {notes === null ? (
                <div className="text-center text-sm text-muted-foreground py-4">Загрузка…</div>
              ) : notes.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-lg">
                  Заметок пока нет — будьте первыми
                </div>
              ) : (
                notes.map((n) => {
                  const canDelete = n.author?.id === currentUserId || currentUserRole === 'ADMIN';
                  return (
                    <div key={n.id} className="border border-border rounded-md p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center">
                          {n.author?.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="text-xs font-medium">
                          {n.author?.name ?? 'удалённый'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString('ru-RU')}
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => deleteNote(n.id)}
                            className="ml-auto p-1 hover:bg-danger/10 hover:text-danger rounded text-muted-foreground"
                            title="Удалить"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon} {label}
      </div>
      <div className="font-semibold tabular-nums mt-1">{formatNumber(value)}</div>
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
