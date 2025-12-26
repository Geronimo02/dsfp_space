import { useSignupWizard } from "@/hooks/useSignupWizard";
import { SignupStepper } from "@/components/signup/SignupStepper";
import { Step1Account } from "@/components/signup/Step1Account";
import { Step2Plan } from "@/components/signup/Step2Plan";
import { Step3Payment } from "@/components/signup/Step3Payment";
import { Step4Modules } from "@/components/signup/Step4Modules";
import { Step5Confirmation } from "@/components/signup/Step5Confirmation";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export default function SignupWizard() {
  const {
    currentStep,
    formData,
    updateFormData,
    nextStep,
    prevStep,
    saveIntent,
  } = useSignupWizard();

  const handleCreateIntent = async () => {
    console.log("[SignupWizard] Creating intent with:", formData);

    try {
      // Use the provider and payment method from formData
      const providerSelected = formData.payment_provider || "stripe";
      const paymentMethodRef = formData.payment_method_ref;

      const { data, error } = await supabase.functions.invoke("create-intent", {
        body: {
          email: formData.email,
          full_name: formData.full_name,
          company_name: formData.company_name,
          plan_id: formData.plan_id,
          modules: formData.modules,
          provider: providerSelected,
          payment_provider: providerSelected,
          payment_method_ref: paymentMethodRef,
          billing_country: formData.billing_country,
        },
      });

      if (error) {
        console.error("[SignupWizard] Intent error:", error);
        throw error;
      }

      console.log("[SignupWizard] Intent created:", data);

      if (!data?.intent_id) {
        throw new Error("No intent_id returned");
      }

      saveIntent(data.intent_id);

      // Call start-checkout (it will handle inline payment method or create redirect)
      const successUrl = `${window.location.origin}/signup/success?intent_id=${data.intent_id}`;
      const cancelUrl = `${window.location.origin}/signup/cancel?intent_id=${data.intent_id}`;

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        "start-checkout",
        {
          body: {
            intent_id: data.intent_id,
            success_url: successUrl,
            cancel_url: cancelUrl,
          },
        }
      );

      if (checkoutError) {
        console.error("[SignupWizard] Checkout error:", checkoutError);
        throw checkoutError;
      }

      console.log("[SignupWizard] Checkout created:", checkoutData);

      // If payment was captured inline, navigate to success directly
      if (checkoutData?.is_paid_ready || (formData.payment_method_ref && formData.payment_provider)) {
        console.log("[SignupWizard] Payment method ready, navigating to success");
        window.location.href = `/signup/success?intent_id=${data.intent_id}`;
        return;
      }

      console.log("[SignupWizard] is_free_trial:", checkoutData?.is_free_trial);
      console.log("[SignupWizard] checkout_url:", checkoutData?.checkout_url);
      console.log("[SignupWizard] intent_id:", checkoutData?.intent_id);

      // Handle free trial (no external checkout needed)
      if (checkoutData?.is_free_trial || !checkoutData?.checkout_url) {
        // Save intent_id to localStorage if provided
        if (checkoutData?.intent_id) {
          localStorage.setItem("signup_intent_id", checkoutData.intent_id);
          console.log("[SignupWizard] Saved intent_id to localStorage:", checkoutData.intent_id);
        }
        toast.success("¡Prueba gratuita activada!");
        setTimeout(() => {
          window.location.href = "/signup/success";
        }, 500);
      } else if (checkoutData?.checkout_url) {
        toast.success("Redirigiendo al procesador de pagos...");
        // Redirect to external checkout
        window.location.href = checkoutData.checkout_url;
      } else {
        throw new Error("No checkout_url o is_free_trial en response");
      }
    } catch (error) {
      console.error("[SignupWizard] Error:", error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Building2 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">DSFP</h1>
          </div>
          <h2 className="text-xl text-muted-foreground">Crea tu cuenta empresarial</h2>
        </div>

        {/* Stepper */}
        <SignupStepper currentStep={currentStep} />

        {/* Content */}
        <Card className="p-6 md:p-8 mt-8">
          {currentStep === 0 && (
            <Step1Account formData={formData} updateFormData={updateFormData} nextStep={nextStep} />
          )}
          {currentStep === 1 && (
            <Step2Plan
              formData={formData}
              updateFormData={updateFormData}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          )}
          {currentStep === 2 && (
            <Step3Payment
              formData={formData}
              updateFormData={updateFormData}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          )}
          {currentStep === 3 && (
            <Step4Modules
              formData={formData}
              updateFormData={updateFormData}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          )}
          {currentStep === 4 && (
            <Step5Confirmation
              formData={formData}
              updateFormData={updateFormData}
              nextStep={nextStep}
              prevStep={prevStep}
              onCreateIntent={handleCreateIntent}
            />
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Ya tienes una cuenta?{" "}
          <a href="/auth" className="text-primary hover:underline font-medium">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
