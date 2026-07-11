import { Injectable, Logger } from '@nestjs/common';

const KABINETY_API = 'https://kabinety.aubakirova.school/api/board';
const CACHE_TTL_MS = 10 * 60 * 1000; // данные меняются редко

type BoardStudent = { id: string; name: string; isNew?: boolean; room?: string | null };
type BoardRoom = { num: string; klass?: string | null };

export type KabinetySummary = {
  total: number;
  newStudents: number;
  existing: number;
  unassigned: number;
  byGrade: Array<{ grade: string; count: number }>;
  fetchedAt: string;
};

@Injectable()
export class KabinetyService {
  private readonly logger = new Logger(KabinetyService.name);
  private cache: { at: number; data: KabinetySummary } | null = null;

  // Кол-во детей в школе (2026/2027) из системы распределения по кабинетам
  async getSummary(): Promise<KabinetySummary> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.data;

    const res = await fetch(KABINETY_API, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`kabinety API: ${res.status}`);
    const board = (await res.json()) as { students?: BoardStudent[]; rooms?: BoardRoom[] };

    const students = board.students ?? [];
    const roomToKlass = new Map((board.rooms ?? []).map((r) => [r.num, r.klass ?? '']));

    const byGradeMap = new Map<string, number>();
    let newStudents = 0;
    let unassigned = 0;
    for (const s of students) {
      if (s.isNew) newStudents++;
      const klass = s.room ? roomToKlass.get(s.room) ?? '' : '';
      if (!s.room) unassigned++;
      const grade = /^(\d+)/.exec(klass ?? '')?.[1] ?? '—';
      byGradeMap.set(grade, (byGradeMap.get(grade) ?? 0) + 1);
    }

    const byGrade = [...byGradeMap.entries()]
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => (a.grade === '—' ? 1 : b.grade === '—' ? -1 : Number(a.grade) - Number(b.grade)));

    const data: KabinetySummary = {
      total: students.length,
      newStudents,
      existing: students.length - newStudents,
      unassigned,
      byGrade,
      fetchedAt: new Date().toISOString(),
    };
    this.cache = { at: Date.now(), data };
    return data;
  }
}
