// 保存済み提案 draft を現在のワードローブで Proposal に復元 (削除済みはプレースホルダ)。
import type { ClothingItem } from "@/schema/clothing";
import type {
  Proposal,
  ProposalDraft,
  ProposalItem,
} from "@/schema/recommend";

// ProposalDraft[] (owned は id だけ) を Proposal[] (owned は ClothingItem 全体)
// に変換する。owned の id がワードローブに無ければ silent drop。
// 全部消えた場合は "(アイテムが削除されました)" の buy placeholder を入れて
// ProposalSchema の min(1) を満たす。
export function hydrateProposals(
  drafts: ProposalDraft[],
  items: ClothingItem[],
): Proposal[] {
  const itemMap = new Map(items.map((i) => [i.id, i]));
  return drafts.map((p) => {
    const hydrated: ProposalItem[] = p.items.flatMap<ProposalItem>((it) => {
      if (it.kind === "owned") {
        const item = itemMap.get(it.id);
        return item ? [{ kind: "owned", item }] : [];
      }
      return [{ kind: "buy", category: it.category, description: it.description }];
    });
    if (hydrated.length === 0) {
      hydrated.push({
        kind: "buy",
        category: "other",
        description: "(アイテムが削除されました)",
      });
    }
    return { reason: p.reason, items: hydrated };
  });
}
