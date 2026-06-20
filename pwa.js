window.pwaState = window.pwaState || {
  deferredPrompt: null
};

const PWA_APP_VERSION = "v91";
const PWA_INSTALADA_KEY = "pwaInstalada";
const PWA_SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

function pwaEstaInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function instalacionPwaDisponible() {
  return !pwaEstaInstalada() && !!window.pwaState.deferredPrompt;
}

function esDispositivoMovilPwa() {
  const ua = navigator.userAgent || navigator.vendor || "";
  const esAndroid = /Android/i.test(ua);
  const esIphone = /iPhone/i.test(ua);
  const esIpad = /iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return esAndroid || esIphone || esIpad;
}

function cerrarAvisoPwa() {
  const aviso = document.getElementById("pwaAviso");
  if (aviso) aviso.style.display = "none";
}

function activarNuevoServiceWorker(worker) {
  if (!worker) return;
  worker.postMessage({ type: "SKIP_WAITING" });
}

function registrarActualizacionesServiceWorker(registration) {
  if (!registration) return;

  if (registration.waiting && navigator.serviceWorker.controller) {
    activarNuevoServiceWorker(registration.waiting);
  }

  registration.addEventListener("updatefound", function() {
    const nuevoWorker = registration.installing;
    if (!nuevoWorker) return;

    nuevoWorker.addEventListener("statechange", function() {
      if (nuevoWorker.state === "installed" && navigator.serviceWorker.controller) {
        activarNuevoServiceWorker(nuevoWorker);
      }
    });
  });
}

function comprobarActualizacionServiceWorker(registration) {
  if (!registration || typeof registration.update !== "function") {
    return Promise.resolve(null);
  }

  return registration.update().catch(function(error) {
    console.warn("No se pudo comprobar actualizaci\u00f3n del service worker:", error.message);
    return null;
  });
}

function programarComprobacionesServiceWorker(registration) {
  if (!registration || window.pwaState.swUpdateProgramado) return;

  window.pwaState.swUpdateProgramado = true;
  const comprobar = function() {
    comprobarActualizacionServiceWorker(registration);
  };

  window.pwaState.swUpdateTimer = setInterval(comprobar, PWA_SW_UPDATE_INTERVAL_MS);
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") comprobar();
  });
  window.addEventListener("focus", comprobar);
  window.addEventListener("online", comprobar);
}

function actualizarBotonInstalarPwa() {
  const botonMenu = document.getElementById("btnInstalarPwaMenu");
  if (!botonMenu) return;
  botonMenu.style.display = instalacionPwaDisponible() ? "block" : "none";
}

function mostrarAvisoPwaSiProcede() {
  const aviso = document.getElementById("pwaAviso");
  if (!aviso || pwaEstaInstalada() || !esDispositivoMovilPwa()) return;

  const esIos = /iPhone|iPad/i.test(navigator.userAgent || "");
  if (!window.pwaState.deferredPrompt && !esIos) return;

  aviso.style.display = "flex";
  actualizarBotonInstalarPwa();
}

function actualizarTextoAvisoPwa() {
  const aviso = document.getElementById("pwaAviso");
  if (!aviso) return;

  const titulo = aviso.querySelector("h3");
  const texto = aviso.querySelector("p");

  if (titulo) titulo.textContent = "Instala P\u00e1del Players Morvedre";
  if (texto) {
    texto.textContent = "Instala la app para disfrutar de una experiencia m\u00e1s completa. Accede m\u00e1s r\u00e1pido a tus partidas, chats y clasificaciones, y recuerda entrar peri\u00f3dicamente para consultar el estado de tus partidas y avisos importantes.";
  }
}

function instalarPwa() {
  if (window.pwaState.deferredPrompt) {
    const promptInstalacion = window.pwaState.deferredPrompt;
    promptInstalacion.prompt();
    promptInstalacion.userChoice.then(function(choice) {
      if (choice && choice.outcome === "accepted") {
        localStorage.setItem(PWA_INSTALADA_KEY, "true");
      }
    }).finally(function() {
      window.pwaState.deferredPrompt = null;
      cerrarAvisoPwa();
      actualizarBotonInstalarPwa();
    });
    return;
  }

  alert("En tu navegador, usa el men\u00fa y elige A\u00f1adir a pantalla de inicio.");
}

function initPwaBasica() {
  actualizarTextoAvisoPwa();
  localStorage.removeItem(PWA_INSTALADA_KEY);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" })
      .then(function(registration) {
        registrarActualizacionesServiceWorker(registration);
        programarComprobacionesServiceWorker(registration);
        return comprobarActualizacionServiceWorker(registration);
      })
      .catch(function(error) {
        console.warn("No se pudo registrar service worker:", error.message);
      });

    let recargaPorServiceWorker = false;
    navigator.serviceWorker.addEventListener("controllerchange", function() {
      if (recargaPorServiceWorker) return;
      recargaPorServiceWorker = true;
      window.location.reload();
    });
  }

  window.addEventListener("beforeinstallprompt", function(event) {
    event.preventDefault();
    window.pwaState.deferredPrompt = event;
    actualizarBotonInstalarPwa();
  });

  window.addEventListener("appinstalled", function() {
    localStorage.setItem(PWA_INSTALADA_KEY, "true");
    window.pwaState.deferredPrompt = null;
    cerrarAvisoPwa();
    actualizarBotonInstalarPwa();
  });

  const instalar = document.getElementById("pwaInstalarBtn");
  const instalarMenu = document.getElementById("btnInstalarPwaMenu");
  const ahoraNo = document.getElementById("pwaAhoraNoBtn");

  if (instalar) instalar.onclick = instalarPwa;
  if (instalarMenu) instalarMenu.onclick = instalarPwa;
  if (ahoraNo) ahoraNo.onclick = cerrarAvisoPwa;

  actualizarBotonInstalarPwa();
}

window.initPwaBasica = initPwaBasica;
window.mostrarAvisoPwaSiProcede = mostrarAvisoPwaSiProcede;
window.instalarPwa = instalarPwa;
window.actualizarBotonInstalarPwa = actualizarBotonInstalarPwa;

document.addEventListener("DOMContentLoaded", initPwaBasica);
