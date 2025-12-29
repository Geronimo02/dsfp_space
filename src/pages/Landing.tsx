import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("r");

    // Si viene con ?r=auth, navega dentro de la SPA al login
    if (redirect === "auth") {
      navigate("/auth", { replace: true });
      return;
    }

    // Caso por defecto: mostrar la landing estática
    window.location.replace("/landing/index.html");
  }, [navigate]);

  // Loader mientras redirige
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
        <span>Cargando...</span>
      </div>
    </div>
  );
};

export default Landing;