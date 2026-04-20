import { useEffect } from "react";
import { captureTrackingFromUrl } from "@/lib/utmTracking";
import CampaignWizard from "@/components/campaign-wizard/CampaignWizard";
import { useWizardStore, type WizardStep, STEP_ORDER } from "@/components/campaign-wizard/wizardStore";

export default function MontarCampanha() {
  useEffect(() => {
    document.title = "Montar campanha · mesa.ads";
    captureTrackingFromUrl("/montar-campanha");

    try {
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get("step");
      if (stepParam && STEP_ORDER.includes(stepParam as WizardStep)) {
        const productId = useWizardStore.getState().productId;
        if (productId) {
          useWizardStore.getState().goTo(stepParam as WizardStep);
        }
        params.delete("step");
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
        window.history.replaceState(null, "", newUrl);
      }
    } catch {}
  }, []);

  return <CampaignWizard />;
}
