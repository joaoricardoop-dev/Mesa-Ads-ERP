import { useEffect } from "react";
import { captureTrackingFromUrl } from "@/lib/utmTracking";
import CampaignWizard from "@/components/campaign-wizard/CampaignWizard";

export default function MontarCampanha() {
  useEffect(() => {
    document.title = "Montar campanha · mesa.ads";
    captureTrackingFromUrl("/montar-campanha");
  }, []);

  return <CampaignWizard />;
}
