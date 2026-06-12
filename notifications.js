window.notificacionesState = window.notificacionesState || {
  unsubscribe: null,
  idsVistos: new Set(),
  uid: null,
  items: []
};

function normalizarArrayUidsNotificaciones(uids) {
  const lista = Array.isArray(uids) ? uids : [uids];
  return lista.filter(function(uid) { return !!uid; }).filter(function(uid, index, arr) {
    return arr.indexOf(uid) === index;
  });
}

function crearDocIdNotificacion(dedupeKey) {
  return String(dedupeKey || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 150);
}

function fechaNotificacionToDate(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  return new Date(valor);
}

function textoFechaNotificacion(valor) {
  const fecha = fechaNotificacionToDate(valor);
  if (!fecha || isNaN(fecha.getTime())) return "";
  return fecha.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function crearNotificacionInterna(datos) {
  if (!datos || !datos.uid) return null;

  const ahora = firebase.firestore.FieldValue.serverTimestamp();
  const payload = {
    uid: datos.uid,
    tipo: datos.tipo || "aviso",
    titulo: datos.titulo || "Aviso",
    mensaje: datos.mensaje || "",
    partidaId: datos.partidaId || null,
    chatId: datos.chatId || null,
    leida: false,
    createdAt: ahora,
    caducaAt: datos.caducaAt || null,
    accion: datos.accion || null,
    prioridad: datos.prioridad || "normal",
    popupMostrado: false,
    resuelta: false,
    origen: datos.origen || "app",
    dedupeKey: datos.dedupeKey || null,
    data: datos.data || {},
    emailCritico: datos.emailCritico === true,
    emailEnviado: false
  };

  if (payload.dedupeKey) {
    const docId = crearDocIdNotificacion(payload.uid + "_" + payload.dedupeKey);
    await db.collection("notificaciones").doc(docId).set(payload, { merge: true });
    return docId;
  }

  const doc = await db.collection("notificaciones").add(payload);
  return doc.id;
}

function crearNotificacionesParaUids(uids, datos) {
  const lista = normalizarArrayUidsNotificaciones(uids);
  return Promise.all(lista.map(function(uid) {
    return crearNotificacionInterna(Object.assign({}, datos, { uid: uid }));
  }));
}

function esNotificacionPenalizacionPerfil(n) {
  return !!n && (
    n.tipo === "penalizacion_abandono_confirmada" ||
    n.tipo === "penalizacion_agravada_cancelacion"
  );
}

function resolverNotificacionPorDedupe(uid, dedupeKey) {
  if (!uid || !dedupeKey) return Promise.resolve(false);

  const docId = crearDocIdNotificacion(uid + "_" + dedupeKey);
  return db.collection("notificaciones").doc(docId).set({
    resuelta: true,
    resueltaAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function() {
    return true;
  });
}

async function limpiarNotificacionesAntiguas(uid) {
  if (!uid) return;

  const ahora = new Date();
  const limiteLeidas = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const snap = await db.collection("notificaciones").where("uid", "==", uid).get();
  const batch = db.batch();
  let contador = 0;

  snap.forEach(function(doc) {
    const n = doc.data() || {};
    const createdAt = fechaNotificacionToDate(n.createdAt);
    const caducaAt = fechaNotificacionToDate(n.caducaAt);
    const caducada = caducaAt && caducaAt <= ahora;
    const leidaAntigua = n.leida === true && createdAt && createdAt <= limiteLeidas;

    if ((caducada || leidaAntigua || n.resuelta === true) && contador < 400) {
      batch.delete(doc.ref);
      contador++;
    }
  });

  if (contador > 0) await batch.commit();
}

function renderizarCampanaNotificaciones(notificaciones) {
  const contador = document.getElementById("notificacionesContador");
  const lista = document.getElementById("notificacionesLista");
  if (!contador || !lista) return;

  const noLeidas = notificaciones.filter(function(n) { return n.data.leida !== true; });
  contador.textContent = String(noLeidas.length);
  contador.style.display = noLeidas.length > 0 ? "inline-flex" : "none";

  if (noLeidas.length === 0) {
    lista.replaceChildren(crearTextoNotificacion("No tienes avisos"));
    return;
  }

  const fragment = document.createDocumentFragment();
  noLeidas.forEach(function(item) {
    const n = item.data;
    const fila = document.createElement("div");
    fila.className = "notificacionItem" + (n.leida ? " leida" : "");

    const titulo = document.createElement("div");
    titulo.className = "notificacionTitulo";
    titulo.textContent = n.titulo || "Aviso";

    const mensaje = document.createElement("div");
    mensaje.className = "notificacionMensaje";
    mensaje.textContent = n.mensaje || "";

    const fecha = document.createElement("div");
    fecha.className = "notificacionFecha";
    fecha.textContent = textoFechaNotificacion(n.createdAt);

    const acciones = document.createElement("div");
    acciones.className = "notificacionAcciones";

    if (n.partidaId || esNotificacionPenalizacionPerfil(n)) {
      const abrir = document.createElement("button");
      abrir.type = "button";
      abrir.textContent = esNotificacionPenalizacionPerfil(n)
        ? "Ver perfil"
        : "Abrir partida";
      abrir.onclick = function() { abrirAccionNotificacion(item.id, n); };
      acciones.appendChild(abrir);
    }

    if (!n.leida) {
      const marcar = document.createElement("button");
      marcar.type = "button";
      marcar.textContent = "Marcar leído";
      marcar.onclick = function() { marcarNotificacionLeida(item.id); };
      acciones.appendChild(marcar);
    }

    fila.appendChild(titulo);
    fila.appendChild(mensaje);
    fila.appendChild(fecha);
    fila.appendChild(acciones);
    fragment.appendChild(fila);
  });

  lista.replaceChildren(fragment);
}

function crearTextoNotificacion(texto) {
  const el = document.createElement("div");
  el.className = "notificacionVacia";
  el.textContent = texto;
  return el;
}

function mostrarPopupNotificacion(id, n) {
  const contenedor = document.getElementById("notificacionesPopup");
  if (!contenedor || !n || n.leida === true || n.popupMostrado === true) return;

  const popup = document.createElement("div");
  popup.className = "notificacionPopup";

  const titulo = document.createElement("div");
  titulo.className = "notificacionPopupTitulo";
  titulo.textContent = n.titulo || "Aviso";

  const mensaje = document.createElement("div");
  mensaje.textContent = n.mensaje || "";

  popup.appendChild(titulo);
  popup.appendChild(mensaje);
  contenedor.appendChild(popup);

  db.collection("notificaciones").doc(id).set({ popupMostrado: true }, { merge: true }).catch(function() {});

  setTimeout(function() {
    popup.remove();
  }, 5200);
}

function escucharNotificaciones(uid) {
  detenerNotificacionesInternas();
  window.notificacionesState.uid = uid;
  window.notificacionesState.idsVistos = new Set();

  limpiarNotificacionesAntiguas(uid).catch(function(error) {
    console.warn("No se pudieron limpiar notificaciones:", error.message);
  });

  window.notificacionesState.unsubscribe = db.collection("notificaciones")
    .where("uid", "==", uid)
    .onSnapshot(function(snapshot) {
      const items = [];
      snapshot.forEach(function(doc) {
        items.push({ id: doc.id, data: doc.data() || {} });
      });

      items.sort(function(a, b) {
        const fechaA = fechaNotificacionToDate(a.data.createdAt);
        const fechaB = fechaNotificacionToDate(b.data.createdAt);
        return (fechaB ? fechaB.getTime() : 0) - (fechaA ? fechaA.getTime() : 0);
      });

      window.notificacionesState.items = items;
      renderizarCampanaNotificaciones(items);

      snapshot.docChanges().forEach(function(change) {
        if (change.type !== "added") return;
        const id = change.doc.id;
        if (window.notificacionesState.idsVistos.has(id)) return;
        window.notificacionesState.idsVistos.add(id);
        mostrarPopupNotificacion(id, change.doc.data() || {});
      });
    });
}

function detenerNotificacionesInternas() {
  if (window.notificacionesState.unsubscribe) {
    window.notificacionesState.unsubscribe();
    window.notificacionesState.unsubscribe = null;
  }
  window.notificacionesState.uid = null;
  window.notificacionesState.idsVistos = new Set();
  window.notificacionesState.items = [];
  renderizarCampanaNotificaciones([]);
}

function marcarNotificacionLeida(id) {
  if (!id) return Promise.resolve();
  window.notificacionesState.items = (window.notificacionesState.items || []).map(function(item) {
    if (item.id !== id) return item;
    return Object.assign({}, item, {
      data: Object.assign({}, item.data, { leida: true })
    });
  });
  renderizarCampanaNotificaciones(window.notificacionesState.items);

  return db.collection("notificaciones").doc(id).set({
    leida: true,
    leidaAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

function abrirAccionNotificacion(id, n) {
  marcarNotificacionLeida(id).catch(function() {});
  cerrarPanelNotificaciones();
  if (esNotificacionPenalizacionPerfil(n)) {
    const uidPerfil = n.uid || (auth.currentUser && auth.currentUser.uid);
    if (uidPerfil && typeof verPerfil === "function") verPerfil(uidPerfil);
    return;
  }

  if (n && n.partidaId && typeof mostrar === "function") {
    mostrar("partidas");
    if (
      n.accion === "introducir_resultado" ||
      n.accion === "valorar_jugadores" ||
      n.accion === "validar_resultado"
    ) {
      if (typeof cambiarModoPartidas === "function") {
        cambiarModoPartidas("pendientes");
      } else {
        window.modoPartidas = "pendientes";
        if (typeof cargarPartidas === "function") cargarPartidas();
      }
      return;
    }

    if (typeof cargarPartidas === "function") cargarPartidas();
  }
}

function togglePanelNotificaciones() {
  const panel = document.getElementById("notificacionesPanel");
  if (!panel) return;
  panel.classList.toggle("abierto");
}

function cerrarPanelNotificaciones() {
  const panel = document.getElementById("notificacionesPanel");
  if (panel) panel.classList.remove("abierto");
}

function initNotificacionesUI() {
  const btn = document.getElementById("notificacionesBtn");
  const cerrar = document.getElementById("notificacionesCerrar");
  if (btn) btn.onclick = togglePanelNotificaciones;
  if (cerrar) cerrar.onclick = cerrarPanelNotificaciones;
}

window.crearNotificacionInterna = crearNotificacionInterna;
window.crearNotificacionesParaUids = crearNotificacionesParaUids;
window.resolverNotificacionPorDedupe = resolverNotificacionPorDedupe;
window.limpiarNotificacionesAntiguas = limpiarNotificacionesAntiguas;
window.escucharNotificaciones = escucharNotificaciones;
window.detenerNotificacionesInternas = detenerNotificacionesInternas;
window.marcarNotificacionLeida = marcarNotificacionLeida;

document.addEventListener("DOMContentLoaded", initNotificacionesUI);
