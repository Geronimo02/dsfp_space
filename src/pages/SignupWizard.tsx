import { useSignupWizard } from "@/hooks/useSignupWizard";
import { SignupStepper } from "@/components/signup/SignupStepper";
import { Step1Account } from "@/components/signup/Step1Account";
import { Step2Plan } from "@/components/signup/Step2Plan";
import { Step4Modules } from "@/components/signup/Step4Modules";
import { Step4Payment } from "@/components/signup/Step4Payment";
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
      const providerSelected = formData.payment_provider || "auto";
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

      // For test tokens (starting with "test_"), skip checkout and go directly to success
      if (paymentMethodRef?.startsWith("test_")) {
        console.log("[SignupWizard] Test payment detected, skipping checkout");
        toast.success("¡Cuenta creada exitosamente!");
        setTimeout(() => {
          window.location.href = `/signup/success?intent_id=${data.intent_id}`;
        }, 500);
        return;
      }

      // Call start-checkout for real payments
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
      toast.error("Error al procesar la solicitud. Por favor intenta de nuevo.");
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 relative overflow-hidden group p-6 rounded-2xl" style={{animation: 'gradientShift 8s infinite ease-in-out'}}>
          {/* Background with gradient animation */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 -z-10"></div>
          
          {/* Blur effects with breathing animation */}
          <div className="absolute inset-0 opacity-50 pointer-events-none">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/15 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-primary/10 rounded-full blur-3xl" style={{animation: 'breathing 6s infinite'}}></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-center gap-3 mb-4">
              {/* Logo container with soft glow */}
              <div className="p-2 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-primary/40 shadow-xl shadow-primary/20 backdrop-blur-sm" style={{animation: 'softGlow 4s infinite ease-in-out'}}>
                <img src="/landing/images/logo_transparente_hd.png" alt="Ventify Space" className="w-8 h-8 drop-shadow-lg" />
              </div>
              <h1 className="text-3xl font-bold text-white">Ventify</h1>
            </div>
            <h2 className="text-xl text-primary/80 font-medium">Crea tu cuenta empresarial</h2>
          </div>

          {/* Custom animations */}
          <style>{`
            @keyframes breathing {
              0%, 100% { opacity: 0.4; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.05); }
            }
            @keyframes softGlow {
              0%, 100% { box-shadow: 0 0 20px rgba(var(--primary-rgb, 59, 130, 246), 0.15); }
              50% { box-shadow: 0 0 32px rgba(var(--primary-rgb, 59, 130, 246), 0.25); }
            }
            @keyframes gradientShift {
              0%, 100% { background: linear-gradient(135deg, rgb(15, 23, 42), rgb(30, 41, 59), rgb(15, 23, 42)); }
              50% { background: linear-gradient(135deg, rgb(20, 28, 47), rgb(35, 46, 64), rgb(20, 28, 47)); }
            }
          `}</style>
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
            <Step4Modules
              formData={formData}
              updateFormData={updateFormData}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          )}
          {currentStep === 3 && (
            <Step4Payment
              formData={formData}
              updateFormData={updateFormData}
              nextStep={nextStep}
              prevStep={prevStep}
            />
          )}
          {currentStep === 4 && (
            <Step5Confirmation
              formData={formData}
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
