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
import { Link } from "react-router-dom";

import { logger } from "@/lib/logger";

export default function SignupWizard() {
  const {
    currentStep,
    formData,
    updateFormData,
    nextStep,
    prevStep,
    saveIntent,
  } = useSignupWizard();

  const stepLabels = [
    "Cuenta",
    "Plan",
    "Módulos",
    "Pago",
    "Confirmación",
  ];
  const currentStepLabel = stepLabels[currentStep] || "Paso";
  const totalSteps = stepLabels.length;

  const handleCreateIntent = async () => {
    logger.debug("[SignupWizard] Creating intent with:", formData);

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

      logger.debug("[SignupWizard] Intent created:", data);

      if (!data?.intent_id) {
        throw new Error("No intent_id returned");
      }

      saveIntent(data.intent_id);

      // For test tokens (starting with "test_"), skip checkout and go directly to success
      if (paymentMethodRef?.startsWith("test_")) {
        logger.debug("[SignupWizard] Test payment detected, skipping checkout");
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

      logger.debug("[SignupWizard] Checkout created:", checkoutData);

      // If payment was captured inline, navigate to success directly
      if (checkoutData?.is_paid_ready || (formData.payment_method_ref && formData.payment_provider)) {
        logger.debug("[SignupWizard] Payment method ready, navigating to success");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 relative overflow-hidden">
      {/* Advanced animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Main breathing orbs */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" style={{animation: 'breathing 8s infinite'}}></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" style={{animation: 'breathing 10s infinite 2s'}}></div>
        
        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/3 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl" style={{animation: 'float 12s infinite ease-in-out'}}></div>
        <div className="absolute bottom-1/4 right-1/3 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl" style={{animation: 'float 15s infinite ease-in-out 3s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" style={{animation: 'float 10s infinite ease-in-out 5s'}}></div>
        
        {/* Diagonal moving lights */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" style={{animation: 'slideDown 8s infinite linear'}}></div>
        <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" style={{animation: 'slideLeft 10s infinite linear 2s'}}></div>
        
        {/* Rotating gradient overlay */}
        <div className="absolute inset-0 opacity-20" style={{animation: 'rotateGradient 25s infinite linear'}}>
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-cyan-500/5"></div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8 p-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            {/* Logo with elegant animation */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center relative overflow-hidden group" style={{animation: 'softGlow 4s infinite ease-in-out'}}>
              {/* Animated background shine */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{animation: 'shine 3s infinite'}}></div>
              <img src="/landing/images/logo_transparente_hd.png" alt="Ventify Space" className="w-10 h-10 relative z-10 drop-shadow-lg" />
            </div>
            <h1 className="text-4xl font-bold text-white">Ventify</h1>
          </div>
          <h2 className="text-xl text-slate-100 font-medium">Crea tu cuenta empresarial</h2>
        </div>

        {/* Custom animations */}
        <style>{`
          @keyframes breathing {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }
          @keyframes softGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.2), 0 0 40px rgba(59, 130, 246, 0.1); }
            50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.15); }
          }
          @keyframes shine {
            0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
            100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
          }
          @keyframes float {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(20px, -30px) rotate(5deg); }
            50% { transform: translate(-15px, -50px) rotate(-5deg); }
            75% { transform: translate(-25px, -25px) rotate(3deg); }
          }
          @keyframes rotateGradient {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes slideDown {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100vh); }
          }
          @keyframes slideLeft {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100vw); }
          }
        `}</style>

        {/* Stepper */}
        <div className="mb-4 flex items-center justify-between text-slate-100">
          <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-white/15 shadow-inner text-sm text-white">
            Paso {currentStep + 1} de {totalSteps}
          </div>
          <span className="text-sm text-slate-100/90">{currentStepLabel}</span>
        </div>
        <SignupStepper currentStep={currentStep} />

        {/* Content */}
        <Card
          className="p-6 md:p-8 mt-8 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-2xl border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.55)] rounded-2xl text-white"
          style={{animation: 'fadeInUp 0.6s ease-out'}}
        >
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
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
        <p className="text-center text-sm text-slate-200 mt-6">
          ¿Ya tienes una cuenta?{" "}
          <Link to="/auth" className="text-cyan-200 hover:text-cyan-100 underline-offset-4 hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
