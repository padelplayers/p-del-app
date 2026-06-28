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

function textoNotificacionSeguidoresAgrupada(tipo, cantidad) {
  const total = Number(cantidad || 0);

  if (tipo === "nuevos_seguidores") {
    return total === 1 ? "Tienes 1 nuevo seguidor" : "Tienes " + total + " nuevos seguidores";
  }

  if (tipo === "seguidores_perdidos_perfil_borrado") {
    return total === 1
      ? "1 jugador ha dejado de seguirte porque borró el perfil"
      : total + " jugadores han dejado de seguirte porque borraron el perfil";
  }

  return total === 1
    ? "1 jugador ha dejado de seguirte"
    : total + " jugadores han dejado de seguirte";
}

function crearOActualizarNotificacionSeguidoresAgrupada(datos) {
  if (!datos || !datos.paraUid || !datos.tipo) return Promise.resolve(null);

  const tipo = datos.tipo;
  const paraUid = datos.paraUid;
  const actorUid = datos.actorUid || null;
  const actorNombre = datos.actorNombre || null;
  const motivo = datos.motivo || null;
  const dedupeKey = tipo + "_" + paraUid;
  const docId = crearDocIdNotificacion(paraUid + "_" + dedupeKey);
  const ref = db.collection("notificaciones").doc(docId);

  return db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      const anterior = doc.exists ? (doc.data() || {}) : {};
      const pendiente = doc.exists && anterior.leida !== true && anterior.resuelta !== true;
      const uids = pendiente && Array.isArray(anterior.uids) ? anterior.uids.slice() : [];
      const nombres = pendiente && Array.isArray(anterior.nombres) ? anterior.nombres.slice() : [];

      if (actorUid && !uids.includes(actorUid)) uids.push(actorUid);
      if (actorNombre && !nombres.includes(actorNombre)) nombres.push(actorNombre);

      const cantidad = uids.length > 0
        ? uids.length
        : (pendiente ? Number(anterior.cantidad || 0) + 1 : 1);
      const mensaje = textoNotificacionSeguidoresAgrupada(tipo, cantidad);
      const ahora = firebase.firestore.FieldValue.serverTimestamp();
      const payload = {
        uid: paraUid,
        paraUid: paraUid,
        tipo: tipo,
        titulo: "Aviso",
        mensaje: mensaje,
        cantidad: cantidad,
        uids: uids,
        nombres: nombres,
        motivo: motivo,
        leida: false,
        resuelta: false,
        accion: tipo === "seguidores_perdidos_perfil_borrado" ? null : "ver_usuarios_sociales",
        prioridad: "normal",
        popupMostrado: false,
        origen: "perfil",
        dedupeKey: dedupeKey,
        updatedAt: ahora,
        data: {
          paraUid: paraUid,
          cantidad: cantidad,
          uids: uids,
          nombres: nombres,
          motivo: motivo
        }
      };

      if (!pendiente) payload.createdAt = ahora;

      transaction.set(ref, payload, { merge: true });
      return docId;
    });
  });
}

function esNotificacionPenalizacionPerfil(n) {
  return !!n && (
    n.tipo === "penalizacion_abandono_confirmada" ||
    n.tipo === "penalizacion_agravada_cancelacion" ||
    n.tipo === "penalizacion_no_presentado"
  );
}

function esNotificacionVerPerfil(n) {
  return !!n && (
    esNotificacionPenalizacionPerfil(n) ||
    n.accion === "ver_perfil" ||
    n.tipo === "restriccion_fiabilidad_inicio" ||
    n.tipo === "restriccion_fiabilidad_fin"
  );
}

function esNotificacionFinalCancelacionPartida(n) {
  return !!n && (
    n.tipo === "partida_cancelada" ||
    n.tipo === "partida_cancelada_automatica_5h" ||
    n.tipo === "partida_cancelada_automatica_5h_creador"
  );
}

function esNotificacionConAccionPartidaActiva(n) {
  if (!n || !n.partidaId) return false;
  if (esNotificacionPenalizacionPerfil(n)) return false;
  if (esNotificacionFinalCancelacionPartida(n)) return false;
  return !!n.accion || n.accion === undefined;
}

function notificacionPerteneceAUsuario(n, uid) {
  if (!n || !uid) return false;
  return n.uid === uid || n.paraUid === uid;
}

function quitarNotificacionLocal(id) {
  window.notificacionesState.items = (window.notificacionesState.items || []).filter(function(item) {
    return item.id !== id;
  });
  renderizarCampanaNotificaciones(window.notificacionesState.items);
}

async function borrarNotificacionPropiaPorRef(ref, uid) {
  if (!ref || !uid) return false;

  const doc = await ref.get();
  if (!doc.exists) return false;

  const data = doc.data() || {};
  if (!notificacionPerteneceAUsuario(data, uid)) return false;

  await ref.delete();
  return true;
}

function resolverNotificacionPorDedupe(uid, dedupeKey) {
  if (!uid || !dedupeKey) return Promise.resolve(false);

  const user = auth.currentUser;
  if (!user || user.uid !== uid) return Promise.resolve(false);

  const docId = crearDocIdNotificacion(uid + "_" + dedupeKey);
  return borrarNotificacionPropiaPorRef(db.collection("notificaciones").doc(docId), uid);
}

function resolverNotificacionesTemporalesPorPartidaId(partidaId, opciones) {
  if (!partidaId) return Promise.resolve(0);
  opciones = opciones || {};
  const user = auth.currentUser;
  if (!user) return Promise.resolve(0);

  return db.collection("notificaciones").where("partidaId", "==", partidaId).get()
    .then(function(snapshot) {
      const batch = db.batch();
      let contador = 0;

      snapshot.forEach(function(doc) {
        const notificacion = doc.data() || {};
        if (!esNotificacionConAccionPartidaActiva(notificacion)) return;
        if (!notificacionPerteneceAUsuario(notificacion, user.uid)) return;

        batch.delete(doc.ref);
        contador++;
      });

      if (contador === 0) return 0;
      return batch.commit().then(function() { return contador; });
    });
}

function resolverNotificacionesPorPartidaId(partidaId) {
  return resolverNotificacionesTemporalesPorPartidaId(partidaId, {
    marcarLeida: true
  });
}

async function limpiarNotificacionesAntiguas(uid) {
  if (!uid) return;

  const ahora = new Date();
  const snap = await db.collection("notificaciones").where("uid", "==", uid).get();
  const batch = db.batch();
  let contador = 0;

  snap.forEach(function(doc) {
    const n = doc.data() || {};
    const caducaAt = fechaNotificacionToDate(n.caducaAt);
    const caducada = caducaAt && caducaAt <= ahora;

    if ((caducada || n.leida === true || n.resuelta === true) && contador < 400) {
      batch.delete(doc.ref);
      contador++;
    }
  });

  if (contador > 0) await batch.commit();
}

function obtenerNotificacionesNoLeidas(notificaciones) {
  return (notificaciones || []).filter(function(item) {
    return item.data.leida !== true && item.data.resuelta !== true;
  });
}

function obtenerTextoVisibleNotificacion(n) {
  if (
    n &&
    (
      n.tipo === "nuevos_seguidores" ||
      n.tipo === "seguidores_perdidos" ||
      n.tipo === "seguidores_perdidos_perfil_borrado"
    )
  ) {
    return {
      titulo: "Aviso",
      mensaje: textoNotificacionSeguidoresAgrupada(n.tipo, n.cantidad || (Array.isArray(n.uids) ? n.uids.length : 1))
    };
  }

  if (
    n &&
    n.tipo === "nuevo_resultado_propuesto" &&
    n.data &&
    n.data.equiposCorregidos === true
  ) {
    return {
      titulo: "Nuevo resultado y equipos propuestos",
      mensaje: "Se ha propuesto un nuevo resultado y también se han modificado los equipos. Revisa marcador y parejas antes de validar o rechazar."
    };
  }

  return {
    titulo: (n && n.titulo) || "Aviso",
    mensaje: (n && n.mensaje) || ""
  };
}

function obtenerContactoReservaNotificacion(n) {
  if (
    !n ||
    n.tipo !== "partida_cancelada_automatica_5h_creador" ||
    !n.data ||
    !n.data.contactoReserva
  ) {
    return null;
  }

  const contacto = n.data.contactoReserva;
  const valor = String(contacto.valor || "").trim();
  if (contacto.tipo === "web" && /^https?:\/\//i.test(valor)) {
    return { tipo: "web", valor: valor };
  }
  if (contacto.tipo === "telefono" && valor.replace(/\D/g, "").length >= 6) {
    return { tipo: "telefono", valor: valor };
  }
  return null;
}

function obtenerAccionVisibleNotificacion(n) {
  if (n && n.tipo === "seguidores_perdidos_perfil_borrado") {
    return null;
  }

  if (n && (n.tipo === "nuevos_seguidores" || n.tipo === "seguidores_perdidos")) {
    const cantidad = Number(n.cantidad || (Array.isArray(n.uids) ? n.uids.length : 1));
    if (n.tipo === "nuevos_seguidores") {
      return { texto: cantidad === 1 ? "Ver seguidor" : "Ver seguidores" };
    }
    return { texto: cantidad === 1 ? "Ver jugador" : "Ver jugadores" };
  }

  if (esNotificacionVerPerfil(n)) {
    return { texto: "Ver perfil" };
  }

  const contactoReserva = obtenerContactoReservaNotificacion(n);
  if (contactoReserva) {
    return {
      texto: contactoReserva.tipo === "web" ? "Cancelar reserva" : "Contactar pista"
    };
  }

  if (
    n &&
    (
      n.tipo === "partida_cancelada" ||
      n.tipo === "partida_cancelada_automatica_5h_creador" ||
      n.tipo === "partida_cancelada_automatica_5h"
    )
  ) {
    return null;
  }
  if (n && n.partidaId && n.resuelta !== true && n.accion) return { texto: "Abrir partida" };
  return null;
}

function renderizarCampanaNotificaciones(notificaciones) {
  const contador = document.getElementById("notificacionesContador");
  const contadorBottom = document.getElementById("bottomNavNotificacionesContador");
  const btnBottom = document.getElementById("bottomNavNotificaciones");
  const lista = document.getElementById("notificacionesLista");
  if (!lista) return;

  const noLeidas = obtenerNotificacionesNoLeidas(notificaciones);

  if (contador) {
    contador.textContent = String(noLeidas.length);
    contador.style.display = noLeidas.length > 0 ? "inline-flex" : "none";
  }

  if (contadorBottom) {
    contadorBottom.textContent = String(noLeidas.length);
    contadorBottom.style.display = noLeidas.length > 0 ? "inline-flex" : "none";
  }

  if (btnBottom) {
    btnBottom.classList.toggle("hasUnread", noLeidas.length > 0);
  }

  if (noLeidas.length === 0) {
    lista.replaceChildren(crearTextoNotificacion("No tienes avisos"));
    return;
  }

  const fragment = document.createDocumentFragment();
  noLeidas.forEach(function(item) {
    const n = item.data;
    const textoVisible = obtenerTextoVisibleNotificacion(n);
    const fila = document.createElement("div");
    fila.className = "notificacionItem" + (n.leida ? " leida" : "");

    const titulo = document.createElement("div");
    titulo.className = "notificacionTitulo";
    titulo.textContent = textoVisible.titulo;

    const mensaje = document.createElement("div");
    mensaje.className = "notificacionMensaje";
    mensaje.textContent = textoVisible.mensaje;

    const fecha = document.createElement("div");
    fecha.className = "notificacionFecha";
    fecha.textContent = textoFechaNotificacion(n.createdAt);

    const acciones = document.createElement("div");
    acciones.className = "notificacionAcciones";

    const accionVisible = obtenerAccionVisibleNotificacion(n);
    if (accionVisible) {
      const abrir = document.createElement("button");
      abrir.type = "button";
      abrir.textContent = accionVisible.texto;
      abrir.onclick = function(event) {
        const estadoBoton = bloquearBotonAccion(event, "Enviando...");
        if (estadoBoton.bloqueado) return;
        Promise.resolve(abrirAccionNotificacion(item.id, n)).finally(function() {
          restaurarBotonAccion(estadoBoton);
        });
      };
      acciones.appendChild(abrir);
    }

    if (!n.leida) {
      const marcar = document.createElement("button");
      marcar.type = "button";
      marcar.textContent = "Marcar leído";
      marcar.onclick = function(event) {
        const estadoBoton = bloquearBotonAccion(event, "Guardando...");
        if (estadoBoton.bloqueado) return;
        marcarNotificacionLeida(item.id).catch(function(error) {
          console.error("No se pudo marcar la notificacion como leida:", error);
        }).finally(function() {
          restaurarBotonAccion(estadoBoton);
        });
      };
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
  if (!contenedor || !n || n.leida === true || n.resuelta === true || n.popupMostrado === true) return;
  const textoVisible = obtenerTextoVisibleNotificacion(n);

  const popup = document.createElement("div");
  popup.className = "notificacionPopup";

  const titulo = document.createElement("div");
  titulo.className = "notificacionPopupTitulo";
  titulo.textContent = textoVisible.titulo;

  const mensaje = document.createElement("div");
  mensaje.textContent = textoVisible.mensaje;

  popup.appendChild(titulo);
  popup.appendChild(mensaje);
  contenedor.appendChild(popup);

  db.collection("notificaciones").doc(id).set({ popupMostrado: true }, { merge: true }).catch(function() {});

  setTimeout(function() {
    popup.remove();
  }, 5200);
}

function mostrarResumenNotificacionesPendientes(cantidad) {
  const contenedor = document.getElementById("notificacionesPopup");
  if (!contenedor || cantidad < 1) return;

  const popup = document.createElement("div");
  popup.className = "notificacionPopup";

  const mensaje = document.createElement("div");
  mensaje.textContent = "Tienes " + cantidad + (cantidad === 1
    ? " aviso sin leer."
    : " avisos sin leer.");

  popup.appendChild(mensaje);
  contenedor.appendChild(popup);

  setTimeout(function() {
    popup.remove();
  }, 5200);
}

function escucharNotificaciones(uid) {
  detenerNotificacionesInternas();
  window.notificacionesState.uid = uid;
  window.notificacionesState.idsVistos = new Set();
  let cargaInicial = true;
  let resolverCargaInicial;
  const cargaInicialLista = new Promise(function(resolve) {
    resolverCargaInicial = resolve;
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

      if (cargaInicial) {
        snapshot.forEach(function(doc) {
          window.notificacionesState.idsVistos.add(doc.id);
        });
        cargaInicial = false;
        resolverCargaInicial();
        return;
      }

      snapshot.docChanges().forEach(function(change) {
        if (change.type !== "added") return;
        const id = change.doc.id;
        if (window.notificacionesState.idsVistos.has(id)) return;
        window.notificacionesState.idsVistos.add(id);
        mostrarPopupNotificacion(id, change.doc.data() || {});
      });
    }, function(error) {
      console.warn("No se pudieron escuchar las notificaciones:", error.message);
      if (cargaInicial) {
        cargaInicial = false;
        resolverCargaInicial();
      }
    });

  Promise.all([
    limpiarNotificacionesAntiguas(uid).catch(function(error) {
      console.warn("No se pudieron limpiar notificaciones:", error.message);
    }),
    cargaInicialLista
  ]).then(function() {
    if (window.notificacionesState.uid !== uid) return;
    mostrarResumenNotificacionesPendientes(
      obtenerNotificacionesNoLeidas(window.notificacionesState.items).length
    );
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
  const user = auth.currentUser;
  if (!user) return Promise.resolve();

  quitarNotificacionLocal(id);

  return borrarNotificacionPropiaPorRef(db.collection("notificaciones").doc(id), user.uid);
}

function marcarTodasNotificacionesLeidas() {
  const user = auth.currentUser;
  if (!user) return Promise.resolve(0);

  window.notificacionesState.items = [];
  renderizarCampanaNotificaciones([]);

  return db.collection("notificaciones").where("uid", "==", user.uid).get()
    .then(function(snapshot) {
      const batch = db.batch();
      let contador = 0;

      snapshot.forEach(function(doc) {
        const data = doc.data() || {};
        if (!notificacionPerteneceAUsuario(data, user.uid)) return;
        batch.delete(doc.ref);
        contador++;
      });

      if (contador === 0) return 0;
      return batch.commit().then(function() { return contador; });
    });
}

async function usuarioAdminNotificaciones() {
  const user = auth.currentUser;
  if (!user) return false;

  const doc = await db.collection("usuarios").doc(user.uid).get();
  if (!doc.exists) return false;

  const data = doc.data() || {};
  return data.admin === true || data.rol === "admin";
}

async function limpiarNotificacionesAntiguasAdmin() {
  const esAdmin = await usuarioAdminNotificaciones();
  if (!esAdmin) {
    alert("Herramienta disponible solo para admin.");
    return 0;
  }

  const snap = await db.collection("notificaciones").get();
  const refs = [];

  snap.forEach(function(doc) {
    const data = doc.data() || {};
    if (data.leida === true || data.resuelta === true) refs.push(doc.ref);
  });

  if (refs.length === 0) {
    alert("No hay notificaciones antiguas para eliminar.");
    return 0;
  }

  const confirmar = confirm("Se eliminarán " + refs.length + " notificaciones antiguas. ¿Continuar?");
  if (!confirmar) return 0;

  for (let i = 0; i < refs.length; i += 450) {
    const batch = db.batch();
    refs.slice(i, i + 450).forEach(function(ref) {
      batch.delete(ref);
    });
    await batch.commit();
  }

  alert("Eliminadas " + refs.length + " notificaciones antiguas");
  return refs.length;
}

function abrirAccionNotificacion(id, n) {
  marcarNotificacionLeida(id).catch(function() {});
  cerrarPanelNotificaciones();

  if (n && (n.tipo === "nuevos_seguidores" || n.tipo === "seguidores_perdidos")) {
    if (typeof window.abrirListaNotificacionSocialPerfil === "function") {
      window.abrirListaNotificacionSocialPerfil({
        tipo: n.tipo,
        uids: Array.isArray(n.uids) ? n.uids : [],
        titulo: n.tipo === "nuevos_seguidores" ? "Nuevos seguidores" : "Jugadores que dejaron de seguirte"
      });
    }
    return;
  }

  const contactoReserva = obtenerContactoReservaNotificacion(n);
  if (contactoReserva) {
    if (contactoReserva.tipo === "web") {
      window.open(contactoReserva.valor, "_blank", "noopener");
    } else {
      window.location.href = "tel:" + contactoReserva.valor.replace(/[^\d+]/g, "");
    }
    return;
  }

  if (esNotificacionVerPerfil(n)) {
    const data = n && n.data ? n.data : {};
    const uidPerfil = data.perfilUid || data.uid || n.uid || (auth.currentUser && auth.currentUser.uid);
    if (uidPerfil && typeof verPerfil === "function") verPerfil(uidPerfil);
    return;
  }

  if (n && n.partidaId && typeof mostrar === "function") {
    window.partidaChatFiltroId = n.partidaId;
    window.partidaPendienteDestacar = n.partidaId;
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
      if (n.accion === "introducir_resultado" && typeof window.abrirFormularioResultado === "function") {
        setTimeout(function() { window.abrirFormularioResultado(n.partidaId); }, 250);
      }
      if (n.accion === "valorar_jugadores" && typeof window.abrirValoracionesPostPartido === "function") {
        setTimeout(function() { window.abrirValoracionesPostPartido(n.partidaId); }, 250);
      }
      return;
    }

    if (typeof cargarPartidas === "function") cargarPartidas();
  }
}

function togglePanelNotificaciones() {
  const panel = document.getElementById("notificacionesPanel");
  if (!panel) return;
  const abierto = panel.classList.toggle("abierto");
  const btnBottom = document.getElementById("bottomNavNotificaciones");
  if (abierto) {
    document.querySelectorAll("#bottomNav .bottomNavBtn").forEach(function(btn) {
      btn.classList.remove("activo");
    });
  } else if (typeof window.actualizarBottomNavActivo === "function") {
    window.actualizarBottomNavActivo(window.seccionActualApp || "");
  }
  if (btnBottom) btnBottom.classList.toggle("activo", abierto);
}

function cerrarPanelNotificaciones() {
  const panel = document.getElementById("notificacionesPanel");
  if (panel) panel.classList.remove("abierto");
  const btnBottom = document.getElementById("bottomNavNotificaciones");
  if (btnBottom) btnBottom.classList.remove("activo");
  if (typeof window.actualizarBottomNavActivo === "function") {
    window.actualizarBottomNavActivo(window.seccionActualApp || "");
  }
}

function initNotificacionesUI() {
  const btn = document.getElementById("notificacionesBtn");
  const btnBottom = document.getElementById("bottomNavNotificaciones");
  const cerrar = document.getElementById("notificacionesCerrar");
  const btnLimpiarAdmin = document.getElementById("btnLimpiarNotificacionesAntiguas");
  if (btn) btn.onclick = togglePanelNotificaciones;
  if (btnBottom) btnBottom.onclick = togglePanelNotificaciones;
  if (cerrar) cerrar.onclick = cerrarPanelNotificaciones;
  if (btnLimpiarAdmin) {
    btnLimpiarAdmin.onclick = function(event) {
      const estadoBoton = bloquearBotonAccion(event, "Eliminando...");
      if (estadoBoton.bloqueado) return;
      limpiarNotificacionesAntiguasAdmin().catch(function(error) {
        alert("No se pudieron limpiar las notificaciones antiguas: " + error.message);
      }).finally(function() {
        restaurarBotonAccion(estadoBoton);
      });
    };
  }
}

window.crearNotificacionInterna = crearNotificacionInterna;
window.crearNotificacionesParaUids = crearNotificacionesParaUids;
window.crearOActualizarNotificacionSeguidoresAgrupada = crearOActualizarNotificacionSeguidoresAgrupada;
window.resolverNotificacionPorDedupe = resolverNotificacionPorDedupe;
window.resolverNotificacionesTemporalesPorPartidaId = resolverNotificacionesTemporalesPorPartidaId;
window.resolverNotificacionesPorPartidaId = resolverNotificacionesPorPartidaId;
window.limpiarNotificacionesAntiguas = limpiarNotificacionesAntiguas;
window.escucharNotificaciones = escucharNotificaciones;
window.detenerNotificacionesInternas = detenerNotificacionesInternas;
window.marcarNotificacionLeida = marcarNotificacionLeida;
window.marcarTodasNotificacionesLeidas = marcarTodasNotificacionesLeidas;
window.limpiarNotificacionesAntiguasAdmin = limpiarNotificacionesAntiguasAdmin;

document.addEventListener("DOMContentLoaded", initNotificacionesUI);
