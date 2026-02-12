import type { OpportunityDTO } from "@/domain/crm/dtos/opportunity";
import type { ScoringRuleInsert, ScoringRuleUpdate } from "@/domain/crm/dtos/scoringRule";
import { scoringRuleRepository } from "@/data/crm/scoringRuleRepository";
import { scoringRuleSchema } from "@/domain/crm/validation/scoringRuleSchema";
import { opportunityRepository } from "@/data/crm/opportunityRepository";

const compareNumeric = (value: number, operator: string, ruleValue: number) => {
  if (operator === "eq") return value === ruleValue;
  if (operator === "neq") return value !== ruleValue;
  if (operator === "gt") return value > ruleValue;
  if (operator === "gte") return value >= ruleValue;
  if (operator === "lt") return value < ruleValue;
  if (operator === "lte") return value <= ruleValue;
  return false;
};

const compareText = (value: string, operator: string, ruleValue: string) => {
  const v = value.toLowerCase();
  const r = ruleValue.toLowerCase();
  if (operator === "eq") return v === r;
  if (operator === "neq") return v !== r;
  if (operator === "contains") return v.includes(r);
  return false;
};

export const scoringRuleService = {
  async list(companyId: string) {
    return scoringRuleRepository.list(companyId);
  },

  async listActive(companyId: string) {
    return scoringRuleRepository.listActive(companyId);
  },

  async create(values: ScoringRuleInsert) {
    scoringRuleSchema.parse({
      name: values.name,
      field: values.field as any,
      operator: values.operator as any,
      value: values.value,
      points: values.points ?? 0,
      active: values.active ?? true,
    });
    return scoringRuleRepository.create(values);
  },

  async update(id: string, values: ScoringRuleUpdate) {
    return scoringRuleRepository.update(id, values);
  },

  async remove(id: string) {
    return scoringRuleRepository.remove(id);
  },

  async recalculateCompany(companyId: string) {
    const [rules, opportunities] = await Promise.all([
      scoringRuleRepository.listActive(companyId),
      opportunityRepository.listForScoring(companyId),
    ]);

    const mappedRules = rules.map((rule) => ({
      field: rule.field,
      operator: rule.operator,
      value: rule.value,
      points: rule.points,
    }));

    const now = new Date().toISOString();
    let updatedCount = 0;

    const updates = opportunities.flatMap((opportunity) => {
      const total = mappedRules.length
        ? scoringRuleService.computeScore(opportunity, mappedRules)
        : 0;

      if (opportunity.scoreTotal === total && opportunity.scoreUpdatedAt) {
        return [];
      }

      updatedCount += 1;
      return [
        opportunityRepository.update(opportunity.id, {
          score_total: total,
          score_updated_at: now,
        }),
      ];
    });

    await Promise.all(updates);

    return { total: opportunities.length, updated: updatedCount };
  },

  computeScore(opportunity: OpportunityDTO, rules: Array<{ field: string; operator: string; value: string; points: number }>) {
    let total = 0;
    for (const rule of rules) {
      if (rule.field === "value" && typeof opportunity.value === "number") {
        const target = Number(rule.value);
        if (!Number.isNaN(target) && compareNumeric(opportunity.value, rule.operator, target)) {
          total += rule.points;
        }
      }

      if (rule.field === "probability" && typeof opportunity.probability === "number") {
        const target = Number(rule.value);
        if (!Number.isNaN(target) && compareNumeric(opportunity.probability, rule.operator, target)) {
          total += rule.points;
        }
      }

      if (rule.field === "stage" && opportunity.stage) {
        if (compareText(opportunity.stage, rule.operator, rule.value)) {
          total += rule.points;
        }
      }

      if (rule.field === "status" && opportunity.status) {
        if (compareText(opportunity.status, rule.operator, rule.value)) {
          total += rule.points;
        }
      }

      if (rule.field === "source" && opportunity.source) {
        if (compareText(opportunity.source, rule.operator, rule.value)) {
          total += rule.points;
        }
      }

      if (rule.field === "tags" && opportunity.tags?.length) {
        if (opportunity.tags.some((tag) => compareText(tag, rule.operator, rule.value))) {
          total += rule.points;
        }
      }
    }

    return total;
  },
};
