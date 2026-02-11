import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { BusinessNiche, ONBOARDING_CHECKLISTS } from "@/lib/onboardingChecklists";

export function useOnboardingChecklist() {
  const { currentCompany } = useCompany();
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [niche, setNiche] = useState<BusinessNiche | null>(null);

  const companyId = currentCompany?.id;

  useEffect(() => {
    if (!companyId) return;

    const load = async () => {
      setLoading(true);
      try {
        // Get company niche
        const { data: company } = await supabase
          .from("companies")
          .select("business_niche")
          .eq("id", companyId)
          .single();

        if (company?.business_niche && company.business_niche in ONBOARDING_CHECKLISTS) {
          setNiche(company.business_niche as BusinessNiche);
        } else {
          setNiche(null);
        }

        // Get onboarding dismissed status
        const { data: onboarding } = await supabase
          .from("company_onboarding")
          .select("onboarding_dismissed")
          .eq("company_id", companyId)
          .single();

        setDismissed(onboarding?.onboarding_dismissed === true);

        // Get completed items
        const { data: items } = await supabase
          .from("onboarding_checklist_items")
          .select("item_key")
          .eq("company_id", companyId)
          .eq("completed", true);

        setCompletedItems(new Set((items || []).map((i: any) => i.item_key)));
      } catch (e) {
        console.error("[Onboarding] Error loading:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [companyId]);

  const completeItem = useCallback(async (itemKey: string) => {
    if (!companyId) return;
    setCompletedItems((prev) => new Set([...prev, itemKey]));

    await supabase.from("onboarding_checklist_items").upsert(
      { company_id: companyId, item_key: itemKey, completed: true, completed_at: new Date().toISOString() },
      { onConflict: "company_id,item_key" }
    );
  }, [companyId]);

  const dismissOnboarding = useCallback(async () => {
    if (!companyId) return;
    setDismissed(true);
    await supabase
      .from("company_onboarding")
      .update({ onboarding_dismissed: true })
      .eq("company_id", companyId);
  }, [companyId]);

  const checklist = niche ? ONBOARDING_CHECKLISTS[niche] : null;
  const totalItems = checklist?.items.length || 0;
  const completedCount = checklist?.items.filter((i) => completedItems.has(i.key)).length || 0;
  const allDone = totalItems > 0 && completedCount === totalItems;
  const shouldShow = !!niche && !dismissed && !allDone && !loading;

  return {
    niche,
    checklist,
    completedItems,
    completedCount,
    totalItems,
    allDone,
    shouldShow,
    loading,
    completeItem,
    dismissOnboarding,
  };
}
