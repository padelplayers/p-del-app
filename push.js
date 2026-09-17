(function() {
  "use strict";

  const ONESIGNAL_APP_ID = "31db48d9-ff66-45fb-82ba-f942e97df865";
  const SAFARI_WEB_ID = "web.onesignal.auto.110555e6-7aae-4d44-9896-bfe7a2b1c987";
  const ONESIGNAL_SW_PATH = "p-del-app/push/onesignal/OneSignalSDKWorker.js";
  const ONESIGNAL_SW_SCOPE = "/p-del-app/push/onesignal/";

  let oneSignal = null;
  let initPromise = null;
  let ultimoUid = null;

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
    if (!user || !oneSignal || !entornoCompatible()) return false;

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
            persistNotification: false
          });

          oneSignal = OneSignal;

          if (OneSignal.Notifications && typeof OneSignal.Notifications.addEventListener === "function") {
            OneSignal.Notifications.addEventListener("permissionChange", actualizarBotonPush);
          }
          if (OneSignal.User && OneSignal.User.PushSubscription && typeof OneSignal.User.PushSubscription.addEventListener === "function") {
            OneSignal.User.PushSubscription.addEventListener("change", actualizarBotonPush);
          }

          await identificarUsuario(firebase.auth().currentUser);
          resolve(OneSignal);
        } catch (error) {
          console.warn("No se pudo iniciar OneSignal:", error && error.message ? error.message : error);
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
        return identificarUsuario(user);
      }).catch(function(error) {
        console.warn("No se pudo sincronizar OneSignal con la sesión:", error && error.message ? error.message : error);
      });
    });

    iniciarOneSignal();
  }

  window.registrarPush = registrarPush;
  document.addEventListener("DOMContentLoaded", initPush);
})();
