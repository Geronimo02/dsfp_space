import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/app", { replace: true });
        return;
      }

      // No active session: load the Webflow export directly to keep all interactions intact.
      window.location.replace("/landing/index.html");
    };

    checkSession();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
        <span>Preparando tu experiencia...</span>
      </div>
    </div>
  );
};

export default Landing;
