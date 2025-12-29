import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/app", { replace: true });
      } else {
        setLoading(false);
      }

        return;
      }

      // No active session: load the Webflow export directly to keep all interactions intact.
      window.location.replace("/landing/index.html");

    };

    checkSession();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
          <span>Cargando...</span>
        <span>Preparando tu experiencia...</span>
        </div>
      </div>
    );
  }

  // Render the static landing page in an iframe
  return (
    <iframe
      src="/landing/index.html"
      className="w-full h-screen border-0"
      title="Landing Page"
    />
  );
};

export default Landing;
