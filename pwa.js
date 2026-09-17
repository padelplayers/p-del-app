window.pwaState = window.pwaState || {
  deferredPrompt: null
};

const PWA_APP_VERSION = "v129";
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


function esIosPwa() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function usuarioEstaEditandoPwa() {
  const activo = document.activeElement;
  if (!activo) return false;
  const tag = String(activo.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || activo.isContentEditable === true;
}

function ofrecerActualizacionPwa(registration) {
  if (!registration || !registration.waiting || window.pwaState.actualizacionOfrecida) return;

  if (usuarioEstaEditandoPwa()) {
    window.pwaState.actualizacionPendiente = registration;
    return;
  }

  window.pwaState.actualizacionOfrecida = true;
  const aceptar = window.confirm("Hay una nueva versi\u00f3n de P\u00e1del Players Morvedre disponible. ¿Actualizar ahora?");
  if (aceptar && registration.waiting) {
    window.pwaState.recargarAlCambiarControlador = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  } else {
    window.pwaState.actualizacionOfrecida = false;
  }
}

function vigilarActualizacionesPwa(registration) {
  if (!registration) return;

  if (registration.waiting && navigator.serviceWorker.controller) {
    ofrecerActualizacionPwa(registration);
  }

  registration.addEventListener("updatefound", function() {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", function() {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        ofrecerActualizacionPwa(registration);
      }
    });
  });
}

function cerrarAvisoPwa() {
  const aviso = document.getElementById("pwaAviso");
  if (aviso) aviso.style.display = "none";
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

  const esIos = esIosPwa();
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

  if (esIosPwa()) {
    alert("En iPhone/iPad: abre esta web en Safari, pulsa Compartir (cuadrado con flecha hacia arriba) y elige Añadir a pantalla de inicio. Después pulsa Añadir.");
    return;
  }

  alert("En tu navegador, usa el menú y elige Añadir a pantalla de inicio.");
}

function initPwaBasica() {
  actualizarTextoAvisoPwa();
  localStorage.removeItem(PWA_INSTALADA_KEY);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js?v=129", { updateViaCache: "none" })
      .then(function(registration) {
        vigilarActualizacionesPwa(registration);
        programarComprobacionesServiceWorker(registration);
        return comprobarActualizacionServiceWorker(registration);
      })
      .catch(function(error) {
        console.warn("No se pudo registrar service worker:", error.message);
      });
  }

  window.addEventListener("beforeinstallprompt", function(event) {
    event.preventDefault();
    window.pwaState.deferredPrompt = event;
    actualizarBotonInstalarPwa();
    mostrarAvisoPwaSiProcede();
  });

  navigator.serviceWorker.addEventListener("controllerchange", function() {
    if (!window.pwaState.recargarAlCambiarControlador || window.pwaState.recargaPorActualizacion) return;
    window.pwaState.recargaPorActualizacion = true;
    window.location.reload();
  });

  document.addEventListener("focusout", function() {
    if (!window.pwaState.actualizacionPendiente) return;
    setTimeout(function() {
      if (usuarioEstaEditandoPwa()) return;
      const registration = window.pwaState.actualizacionPendiente;
      window.pwaState.actualizacionPendiente = null;
      ofrecerActualizacionPwa(registration);
    }, 150);
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
  mostrarAvisoPwaSiProcede();
}

window.initPwaBasica = initPwaBasica;
window.mostrarAvisoPwaSiProcede = mostrarAvisoPwaSiProcede;
window.instalarPwa = instalarPwa;
window.actualizarBotonInstalarPwa = actualizarBotonInstalarPwa;

document.addEventListener("DOMContentLoaded", initPwaBasica);
