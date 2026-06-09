window.pwaState = window.pwaState || {
  deferredPrompt: null
};

function pwaEstaInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function cerrarAvisoPwa() {
  const aviso = document.getElementById("pwaAviso");
  if (aviso) aviso.style.display = "none";
}

function mostrarAvisoPwaSiProcede() {
  const aviso = document.getElementById("pwaAviso");
  if (!aviso || pwaEstaInstalada()) return;
  aviso.style.display = "flex";
}

function initPwaBasica() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(function(error) {
      console.warn("No se pudo registrar service worker:", error.message);
    });
  }

  window.addEventListener("beforeinstallprompt", function(event) {
    event.preventDefault();
    window.pwaState.deferredPrompt = event;
  });

  window.addEventListener("appinstalled", function() {
    window.pwaState.deferredPrompt = null;
    cerrarAvisoPwa();
  });

  const instalar = document.getElementById("pwaInstalarBtn");
  const ahoraNo = document.getElementById("pwaAhoraNoBtn");

  if (instalar) {
    instalar.onclick = function() {
      if (window.pwaState.deferredPrompt) {
        window.pwaState.deferredPrompt.prompt();
        window.pwaState.deferredPrompt.userChoice.finally(function() {
          window.pwaState.deferredPrompt = null;
          cerrarAvisoPwa();
        });
      } else {
        alert("En tu navegador, usa el menú y elige Añadir a pantalla de inicio.");
      }
    };
  }

  if (ahoraNo) ahoraNo.onclick = cerrarAvisoPwa;
}

window.initPwaBasica = initPwaBasica;
window.mostrarAvisoPwaSiProcede = mostrarAvisoPwaSiProcede;

document.addEventListener("DOMContentLoaded", initPwaBasica);
