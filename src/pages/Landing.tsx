import { useEffect } from "react";

const Landing = () => {
  useEffect(() => {
    // Cargar la landing estática como página principal
    window.location.replace("/landing/index.html");
  }, []);

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