(function() {
  "use strict";

  const ONESIGNAL_APP_ID = "31db48d9-ff66-45fb-82ba-f942e97df865";
  const SAFARI_WEB_ID = "web.onesignal.auto.110555e6-7aae-4d44-9896-bfe7a2b1c987";
  const ONESIGNAL_SW_PATH = "p-del-app/push/onesignal/OneSignalSDKWorker.js";
  const ONESIGNAL_SW_SCOPE = "/p-del-app/push/onesignal/";

  let oneSignal = null;
  let initPromise = null;
  let ultimoUid = null;
  let ultimoErrorOneSignal = null;
  function ocultarInvitacionPush() {
    const capa = document.getElementById("pushInvitacionInicial");
    if (capa) capa.remove();
  }

  function debeMostrarInvitacionPush(user) {
    if (!user || !oneSignal || !entornoCompatible()) return false;
    if (esIos() && !estaInstalada()) return false;
    if (Notification.permission === "denied") return false;
    const permiso = oneSignal.Notifications && oneSignal.Notifications.permission === true;
    const suscrito = !!(oneSignal.User && oneSignal.User.PushSubscription && oneSignal.User.PushSubscription.optedIn);
    if (permiso && suscrito) return false;
    return true;
  }

  function mostrarInvitacionPush(user) {
    if (!debeMostrarInvitacionPush(user) || document.getElementById("pushInvitacionInicial")) return;

    const capa = document.createElement("div");
    capa.id = "pushInvitacionInicial";
    capa.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;";
    capa.innerHTML = '<div role="dialog" aria-modal="true" aria-labelledby="pushInvitacionTitulo" style="width:min(430px,100%);background:#fff;border-radius:18px;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,.3);font-family:inherit;">' +
      '<h2 id="pushInvitacionTitulo" style="margin:0 0 12px;color:#1565C0;font-size:22px;">Activa los avisos de Pádel Players</h2>' +
      '<p style="margin:0 0 20px;line-height:1.45;color:#222;">Recibe avisos importantes sobre tus partidas, cambios de jugadores, reservas y mensajes privados.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button id="pushInvitacionActivar" type="button" style="width:100%;border:0;border-radius:12px;padding:13px 16px;background:#1565C0;color:#fff;font-weight:700;font-size:16px;">Activar avisos</button>' +
      '</div></div>';
    document.body.appendChild(capa);

    document.getElementById("pushInvitacionActivar").addEventListener("click", function() {
      registrarPush(true).then(function(ok) {
        if (ok) ocultarInvitacionPush();
      }).catch(function(error) {
        console.warn("No se pudieron activar las notificaciones push:", error && error.message ? error.message : error);
        alert("No se pudieron activar las notificaciones en este dispositivo.");
      });
    });
  }

  function esIos() {
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function estaInstalada() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function entornoCompatible() {
    return window.isSecureContext === true && "serviceWorker" in navigator && "Notification" in window;
  }

  function actualizarBotonPush() {
    const btn = document.getElementById("pushActivarBtn");
    if (!btn) return;

    const user = firebase.auth().currentUser;
    if (!user || !entornoCompatible() || !oneSignal) {
      btn.style.display = "none";
      return;
    }

    const permiso = oneSignal.Notifications && oneSignal.Notifications.permission === true;
    const suscrito = !!(oneSignal.User && oneSignal.User.PushSubscription && oneSignal.User.PushSubscription.optedIn);

    if (permiso && suscrito) {
      btn.style.display = "none";
      return;
    }

    btn.style.display = "inline-block";
    btn.textContent = "Activar avisos";
  }

  async function identificarUsuario(user) {
    if (!oneSignal) return;

    if (!user) {
      if (ultimoUid && typeof oneSignal.logout === "function") {
        await oneSignal.logout();
      }
      ultimoUid = null;
      actualizarBotonPush();
      return;
    }

    if (ultimoUid !== user.uid && typeof oneSignal.login === "function") {
      await oneSignal.login(user.uid);
      ultimoUid = user.uid;
    }
    actualizarBotonPush();
  }

  async function registrarPush(interactivo) {
    const user = firebase.auth().currentUser;
    if (!user || !entornoCompatible()) return false;

    if (!oneSignal) {
      await iniciarOneSignal();
    }
    if (!oneSignal) {
      actualizarBotonPush();
      return false;
    }

    if (esIos() && !estaInstalada()) {
      if (interactivo) {
        alert("En iPhone/iPad, instala primero Pádel Players en la pantalla de inicio y ábrela desde su icono. Después podrás activar las notificaciones.");
      }
      return false;
    }

    await identificarUsuario(user);

    if (!oneSignal.Notifications.permission && interactivo) {
      await oneSignal.Notifications.requestPermission();
    }

    if (!oneSignal.Notifications.permission) {
      if (interactivo && Notification.permission === "denied") {
        alert("Las notificaciones están bloqueadas en este dispositivo. Debes permitirlas desde los ajustes del navegador o de la app.");
      }
      actualizarBotonPush();
      return false;
    }

    if (oneSignal.User && oneSignal.User.PushSubscription && !oneSignal.User.PushSubscription.optedIn) {
      await oneSignal.User.PushSubscription.optIn();
    }

    actualizarBotonPush();
    return !!(oneSignal.User && oneSignal.User.PushSubscription && oneSignal.User.PushSubscription.optedIn);
  }

  function iniciarOneSignal() {
    if (initPromise) return initPromise;

    initPromise = new Promise(function(resolve) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            safari_web_id: SAFARI_WEB_ID,
            serviceWorkerPath: ONESIGNAL_SW_PATH,
            serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE },
            notifyButton: { enable: false },
            welcomeNotification: { disable: true },
            persistNotification: false
          });

          oneSignal = OneSignal;
          ultimoErrorOneSignal = null;

          if (OneSignal.Notifications && typeof OneSignal.Notifications.addEventListener === "function") {
            OneSignal.Notifications.addEventListener("permissionChange", actualizarBotonPush);
          }
          if (OneSignal.User && OneSignal.User.PushSubscription && typeof OneSignal.User.PushSubscription.addEventListener === "function") {
            OneSignal.User.PushSubscription.addEventListener("change", actualizarBotonPush);
          }

          await identificarUsuario(firebase.auth().currentUser);
          setTimeout(function() { mostrarInvitacionPush(firebase.auth().currentUser); }, 900);
          resolve(OneSignal);
        } catch (error) {
          ultimoErrorOneSignal = error && error.message ? error.message : String(error);
          console.warn("No se pudo iniciar OneSignal:", ultimoErrorOneSignal);
          resolve(null);
        }
      });
    });

    return initPromise;
  }

  function initPush() {
    const btn = document.getElementById("pushActivarBtn");
    if (btn) {
      btn.addEventListener("click", function() {
        registrarPush(true).catch(function(error) {
          console.warn("No se pudieron activar las notificaciones push:", error && error.message ? error.message : error);
          alert("No se pudieron activar las notificaciones en este dispositivo.");
        });
      });
    }

    firebase.auth().onAuthStateChanged(function(user) {
      iniciarOneSignal().then(function() {
        return identificarUsuario(user).then(function() {
          if (!user) ocultarInvitacionPush();
          else setTimeout(function() { mostrarInvitacionPush(user); }, 900);
        });
      }).catch(function(error) {
        console.warn("No se pudo sincronizar OneSignal con la sesión:", error && error.message ? error.message : error);
      });
    });

    iniciarOneSignal();
  }

  const PUSH_BACKEND_URL = "https://padel-morvedre-push.padelplayersmorvedre.workers.dev";

  async function solicitarPushBackend(payload) {
    const user = firebase.auth().currentUser;
    if (!user || !payload) return false;
    try {
      const token = await user.getIdToken();
      const response = await fetch(PUSH_BACKEND_URL, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        console.warn("[PUSH] Backend rechazó la solicitud:", response.status);
        return false;
      }
      return true;
    } catch (error) {
      console.warn("[PUSH] No se pudo solicitar el aviso:", error && error.message ? error.message : error);
      return false;
    }
  }

  window.solicitarPushBackend = solicitarPushBackend;
  window.registrarPush = registrarPush;
  window.repararPushIos = async function() {
    const ok = await registrarPush(true);
    const diagnostico = await window.obtenerDiagnosticoPush();
    return { ok: ok, diagnostico: diagnostico };
  };

  window.obtenerDiagnosticoPush = async function() {
    const datos = {};
    const user = firebase.auth().currentUser;
    datos["push.js cargado"] = "SI";
    datos["OneSignal initPromise"] = initPromise ? "CREADA" : "NO";
    datos["OneSignal objeto"] = oneSignal ? "SI" : "NO";
    datos["Error OneSignal init"] = ultimoErrorOneSignal || "NO";
    datos["Firebase usuario"] = user ? user.uid : "NO";
    datos["UID identificado"] = ultimoUid || "NO";
    datos["Entorno compatible"] = entornoCompatible() ? "SI" : "NO";
    datos["iOS detectado"] = esIos() ? "SI" : "NO";
    datos["PWA instalada"] = estaInstalada() ? "SI" : "NO";
    datos["Permiso navegador"] = ("Notification" in window) ? Notification.permission : "NO DISPONIBLE";

    try {
      datos["OneSignal permiso"] = oneSignal && oneSignal.Notifications
        ? String(oneSignal.Notifications.permission) : "NO DISPONIBLE";
    } catch (e) { datos["OneSignal permiso"] = "ERROR: " + (e.message || String(e)); }

    try {
      const sub = oneSignal && oneSignal.User && oneSignal.User.PushSubscription
        ? oneSignal.User.PushSubscription : null;
      datos["OneSignal optedIn"] = sub ? String(sub.optedIn) : "NO DISPONIBLE";
      datos["Subscription ID"] = sub && sub.id ? String(sub.id) : "NO";
      datos["Push token"] = sub && sub.token ? "SI" : "NO";
    } catch (e) { datos["Suscripcion"] = "ERROR: " + (e.message || String(e)); }

    try { datos["Debe mostrar invitacion"] = debeMostrarInvitacionPush(user) ? "SI" : "NO"; }
    catch (e) { datos["Debe mostrar invitacion"] = "ERROR: " + (e.message || String(e)); }
    return datos;
  };

  document.addEventListener("DOMContentLoaded", initPush);
})();
