import { Construction } from 'lucide-react';

type Props = {
  title: string;
  stage: number; // 1..7 из ТЗ §17
  description: string;
  todo: string[];
};

export function StageStub({ title, stage, description, todo }: Props) {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground mb-6">{description}</p>

      <div className="border border-warning/30 bg-warning/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Construction className="size-5 text-warning" />
          <div className="font-semibold">
            Реализация — Этап {stage} из ТЗ §17
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          {todo.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
