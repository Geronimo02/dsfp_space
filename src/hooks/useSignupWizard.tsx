import { useState, useEffect } from "react";

export interface SignupFormData {
  email: string;
  full_name: string;
  company_name: string;
  password: string;
  plan_id: string;
  modules: string[];
  provider: "stripe" | "mercadopago";
}

export interface SignupIntent {
  intent_id: string;
  checkout_url?: string;
}

const STORAGE_KEY = "signup_wizard_data";
const INTENT_KEY = "signup_intent_id";

export function useSignupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<SignupFormData>({
    email: "",
    full_name: "",
    company_name: "",
    password: "",
    plan_id: "",
    modules: [],
    provider: "mercadopago",
  });
  const [intentId, setIntentId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    const savedIntent = localStorage.getItem(INTENT_KEY);
    
    if (savedData) {
      try {
        setFormData(JSON.parse(savedData));
      } catch (e) {
        console.error("Error loading saved signup data:", e);
      }
    }
    
    if (savedIntent) {
      setIntentId(savedIntent);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    if (intentId) {
      localStorage.setItem(INTENT_KEY, intentId);
    }
  }, [intentId]);

  const updateFormData = (data: Partial<SignupFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));
  const goToStep = (step: number) => setCurrentStep(step);

  const saveIntent = (id: string) => {
    setIntentId(id);
  };

  const clearData = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(INTENT_KEY);
    setFormData({
      email: "",
      full_name: "",
      company_name: "",
      password: "",
      plan_id: "",
      modules: [],
      provider: "mercadopago",
    });
    setIntentId(null);
    setCurrentStep(0);
  };

  return {
    currentStep,
    formData,
    intentId,
    updateFormData,
    nextStep,
    prevStep,
    goToStep,
    saveIntent,
    clearData,
  };
}
