import { UserAvatar } from "@/components/shared/UserAvatar";
import type { teamRanking } from "@/lib/stats";

export function TeamRanking({ ranking }: { ranking: ReturnType<typeof teamRanking> }) {
  if (!ranking.length) {
    return <p className="py-8 text-center text-sm text-gray-400">Sem dados de produtividade ainda</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase text-gray-500">
            <th className="pb-2 pr-2">#</th>
            <th className="pb-2 pr-2">Usuário</th>
            <th className="pb-2 pr-2 text-right">Concluídas</th>
            <th className="pb-2 pr-2 text-right">Atrasadas</th>
            <th className="pb-2 pr-2 text-right">Taxa</th>
            <th className="pb-2 text-right">Tempo médio</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.profile.id} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 pr-2 font-display font-bold text-blue-900">{i + 1}</td>
              <td className="py-2.5 pr-2">
                <div className="flex items-center gap-2">
                  <UserAvatar name={r.profile.full_name} avatarUrl={r.profile.avatar_url} size="xs" />
                  <span className="font-semibold text-blue-900">{r.profile.full_name}</span>
                </div>
              </td>
              <td className="py-2.5 pr-2 text-right text-blue-900">{r.completed}</td>
              <td className="py-2.5 pr-2 text-right text-[color:var(--color-danger)]">{r.overdue}</td>
              <td className="py-2.5 pr-2 text-right font-semibold text-blue-900">{r.completionRate}%</td>
              <td className="py-2.5 text-right text-gray-500">{r.avgDays}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
