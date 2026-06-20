const adminChatSistemaState = {
  auditado: false,
  eliminables: [],
  resumen: null
};

const ADMIN_CHAT_EVENTOS_CONDICIONALES = [
  "partida_creada",
  "partida_completa",
  "falta_1",
  "falta_1_hombre",
  "falta_1_mujer",
  "sustitucion_urgente",
  "plaza_libre_confirmada"
];

const ADMIN_CHAT_EVENTOS_NO_PERMITIDOS = [
  "partida_confirmada",
  "partida_cancelada",
  "cambio_creador_pendiente",
  "nuevo_creador",
  "reserva_pendiente",
  "reserva_aceptada",
  "reserva_rechazada",
  "resultado_pendiente",
  "resultado_validado",
  "valoraciones_pendientes",
  "penalizaciones"
];

function crearTextoAdminChatSistema(texto, clase) {
  const el = document.createElement("div");
  if (clase) el.className = clase;
  el.textContent = texto;
  return el;
}

function esMensajeSistemaAdminChat(data) {
  return !!data && (data.system === true || data.type === "system");
}

function arrayUnicoAdminChat(valor) {
  return Array.isArray(valor) ? Array.from(new Set(valor.filter(Boolean))) : [];
}

function obtenerFechaHoraAdminChatPartida(partida) {
  if (!partida || !partida.fecha || !partida.hora) return null;

  const partesFecha = String(partida.fecha).split("-");
  const partesHora = String(partida.hora).split(":");
  if (partesFecha.length !== 3 || partesHora.length < 2) return null;

  const fecha = new Date(
    Number(partesFecha[0]),
    Number(partesFecha[1]) - 1,
    Number(partesFecha[2]),
    Number(partesHora[0]),
    Number(partesHora[1])
  );

  return isNaN(fecha.getTime()) ? null : fecha;
}

function partidaPasadaAdminChat(partida) {
  const fecha = obtenerFechaHoraAdminChatPartida(partida);
  return !!(fecha && fecha < new Date());
}

function tieneSustitucionPendienteAdminChat(partida) {
  return !!(
    partida &&
    (
      partida.sustitucionPendiente === true ||
      partida.sustitucionTipo === "reserva_subida_pendiente_aceptar"
    )
  );
}

function tieneSolicitudSustitucionAdminChat(partida) {
  return !!(partida && partida.solicitudSustitucionEstado === "solicitud_sustitucion_pendiente");
}

function solicitudSustitucionPublicaAdminChat(partida) {
  return !!(
    partida &&
    String(partida.estado || "").toLowerCase().trim() === "confirmada" &&
    !tieneSustitucionPendienteAdminChat(partida) &&
    tieneSolicitudSustitucionAdminChat(partida) &&
    arrayUnicoAdminChat(partida && partida.solicitudSustitucionReservasCompatibles).length === 0
  );
}

function esEstadoFinalAdminChat(estado) {
  const valor = String(estado || "").toLowerCase().trim();
  return valor === "finalizada" ||
    valor === "cancelada" ||
    valor === "cancelada_por_no_presentado";
}

function eventoProcedeAdminChat(eventType, partida) {
  const estado = String((partida && partida.estado) || "").toLowerCase().trim();
  const jugadores = arrayUnicoAdminChat(partida && partida.jugadores);

  if (eventType === "partida_creada") {
    return estado === "abierta" && !partidaPasadaAdminChat(partida);
  }

  if (eventType === "partida_completa") {
    return estado === "abierta" && jugadores.length === 4 && !partidaPasadaAdminChat(partida);
  }

  if (eventType === "falta_1" || eventType === "falta_1_hombre" || eventType === "falta_1_mujer") {
    return estado === "abierta" && jugadores.length === 3 && !partidaPasadaAdminChat(partida);
  }

  if (eventType === "reserva_pendiente") {
    return (estado === "confirmada" || estado === "abierta") &&
      tieneSustitucionPendienteAdminChat(partida) &&
      !partidaPasadaAdminChat(partida);
  }

  if (eventType === "plaza_libre_confirmada") {
    return estado === "confirmada" &&
      jugadores.length < 4 &&
      !tieneSustitucionPendienteAdminChat(partida) &&
      !tieneSolicitudSustitucionAdminChat(partida) &&
      !partidaPasadaAdminChat(partida);
  }

  if (eventType === "sustitucion_urgente") {
    return estado === "confirmada" &&
      solicitudSustitucionPublicaAdminChat(partida) &&
      !partidaPasadaAdminChat(partida);
  }

  if (eventType === "cambio_creador_pendiente") {
    return estado === "abierta" &&
      partida &&
      partida.cambioCreadorPendiente === true &&
      !partidaPasadaAdminChat(partida);
  }

  if (eventType === "nuevo_creador") return false;

  return true;
}

function textoMensajeAdminChat(data) {
  return String((data && (data.t || data.texto || data.mensaje)) || "").trim();
}

function clasificarMensajeAdminChat(item, partida) {
  const data = item.data;
  const eventType = data.eventType || "";
  const dedupeKey = String(data.dedupeKey || "");
  const partidaId = data.partidaId || "";

  if (eventType === "partida_cancelada" || dedupeKey.indexOf("partida_cancelada") !== -1) {
    return { eliminable: true, motivo: "Mensaje Sistema de partida cancelada" };
  }

  if (eventType === "partida_confirmada" || dedupeKey.indexOf("partida_confirmada") !== -1) {
    return { eliminable: true, motivo: "Mensaje Sistema de partida confirmada no permitido en Chat General" };
  }

  if (ADMIN_CHAT_EVENTOS_NO_PERMITIDOS.includes(eventType)) {
    return { eliminable: true, motivo: "Mensaje Sistema no permitido en Chat General" };
  }

  if (!partidaId) {
    return { eliminable: false, motivo: "Sistema sin partidaId verificable" };
  }

  if (partida === undefined) {
    return { eliminable: false, motivo: "No se pudo verificar la partida asociada" };
  }

  if (!partida) {
    return { eliminable: true, motivo: "La partida asociada ya no existe" };
  }

  if (esEstadoFinalAdminChat(partida.estado)) {
    return { eliminable: true, motivo: "La partida esta " + partida.estado };
  }

  if (ADMIN_CHAT_EVENTOS_CONDICIONALES.includes(eventType) && !eventoProcedeAdminChat(eventType, partida)) {
    return { eliminable: true, motivo: "El aviso ya no procede para el estado actual de la partida" };
  }

  return { eliminable: false, motivo: "Aviso todavia verificable o no seguro para eliminar" };
}

async function usuarioAdminChatSistema() {
  const user = auth.currentUser;
  if (!user) return false;

  const doc = await db.collection("usuarios").doc(user.uid).get();
  if (!doc.exists) return false;

  const data = doc.data() || {};
  return data.admin === true || data.rol === "admin";
}

async function leerPartidasAdminChat(partidaIds) {
  const mapa = {};
  const ids = Array.from(new Set(partidaIds.filter(Boolean)));

  for (let i = 0; i < ids.length; i += 20) {
    const bloque = ids.slice(i, i + 20);
    await Promise.all(bloque.map(function(id) {
      return db.collection("partidas").doc(id).get()
        .then(function(doc) {
          mapa[id] = doc.exists ? (doc.data() || {}) : null;
        })
        .catch(function(error) {
          console.warn("No se pudo leer partida para auditoria de chat:", error.message);
          mapa[id] = undefined;
        });
    }));
  }

  return mapa;
}

function pintarResumenAdminChatSistema(resumen) {
  const contenedor = document.getElementById("adminChatSistemaResumen");
  if (!contenedor) return;

  const items = [
    ["Total Sistema", resumen.totalSistema],
    ["Con partidaId", resumen.conPartidaId],
    ["Sin partidaId", resumen.sinPartidaId],
    ["Eliminables seguros", resumen.eliminables],
    ["No eliminables", resumen.noEliminables]
  ];

  const grid = document.createElement("div");
  grid.className = "adminChatSistemaResumenGrid";

  items.forEach(function(item) {
    const card = document.createElement("div");
    card.className = "adminChatSistemaDato";
    card.appendChild(crearTextoAdminChatSistema(item[0], "adminChatSistemaDatoLabel"));
    card.appendChild(crearTextoAdminChatSistema(String(item[1]), "adminChatSistemaDatoValor"));
    grid.appendChild(card);
  });

  contenedor.replaceChildren(grid);
}

function pintarListaAdminChatSistema(eliminables, noEliminables) {
  const contenedor = document.getElementById("adminChatSistemaLista");
  if (!contenedor) return;

  const bloque = document.createElement("div");
  bloque.className = "adminChatSistemaResultados";
  const titulo = document.createElement("h4");
  titulo.textContent = "Eliminables seguros";
  bloque.appendChild(titulo);

  if (eliminables.length === 0) {
    bloque.appendChild(crearTextoAdminChatSistema("No hay mensajes obsoletos seguros detectados.", "adminChatSistemaVacio"));
  } else {
    eliminables.slice(0, 80).forEach(function(item) {
      const data = item.data;
      const fila = document.createElement("div");
      fila.className = "adminChatSistemaFila";
      fila.appendChild(crearTextoAdminChatSistema(textoMensajeAdminChat(data).slice(0, 160) || "(sin texto)", "adminChatSistemaTexto"));
      fila.appendChild(crearTextoAdminChatSistema("eventType: " + (data.eventType || "-")));
      fila.appendChild(crearTextoAdminChatSistema("dedupeKey: " + (data.dedupeKey || "-")));
      fila.appendChild(crearTextoAdminChatSistema("partidaId: " + (data.partidaId || "-")));
      fila.appendChild(crearTextoAdminChatSistema("motivo: " + item.motivo, "adminChatSistemaMotivo"));
      bloque.appendChild(fila);
    });
  }

  bloque.appendChild(crearTextoAdminChatSistema("No eliminables por seguridad: " + noEliminables.length, "adminChatSistemaDetalle"));
  contenedor.replaceChildren(bloque);
}

window.auditarChatSistemaAdmin = async function() {
  const estado = document.getElementById("adminChatSistemaEstado");
  const btnEliminar = document.getElementById("btnEliminarChatSistemaObsoletos");
  adminChatSistemaState.auditado = false;
  adminChatSistemaState.eliminables = [];
  adminChatSistemaState.resumen = null;
  if (btnEliminar) btnEliminar.style.display = "none";
  if (estado) estado.textContent = "Auditando mensajes Sistema...";

  try {
    if (!(await usuarioAdminChatSistema())) {
      if (estado) estado.textContent = "Herramienta disponible solo para admin.";
      return;
    }

    const snapshot = await db.collection("chats").doc("general").collection("mensajes").get();
    const sistema = [];
    snapshot.forEach(function(doc) {
      const data = doc.data() || {};
      if (!esMensajeSistemaAdminChat(data)) return;
      sistema.push({ id: doc.id, ref: doc.ref, data: data });
    });

    const partidas = await leerPartidasAdminChat(sistema.map(function(item) {
      return item.data.partidaId || "";
    }));
    const eliminables = [];
    const noEliminables = [];

    sistema.forEach(function(item) {
      const partidaId = item.data.partidaId || "";
      const partida = partidaId ? partidas[partidaId] : null;
      const clasificacion = clasificarMensajeAdminChat(item, partida);
      item.motivo = clasificacion.motivo;
      if (clasificacion.eliminable) eliminables.push(item);
      else noEliminables.push(item);
    });

    const resumen = {
      totalSistema: sistema.length,
      conPartidaId: sistema.filter(function(item) { return !!item.data.partidaId; }).length,
      sinPartidaId: sistema.filter(function(item) { return !item.data.partidaId; }).length,
      eliminables: eliminables.length,
      noEliminables: noEliminables.length
    };

    adminChatSistemaState.auditado = true;
    adminChatSistemaState.eliminables = eliminables;
    adminChatSistemaState.resumen = resumen;
    pintarResumenAdminChatSistema(resumen);
    pintarListaAdminChatSistema(eliminables, noEliminables);

    if (estado) estado.textContent = "Auditoria completada. No se ha borrado nada.";
    if (btnEliminar && eliminables.length > 0) btnEliminar.style.display = "inline-block";
  } catch (error) {
    console.error("Error auditando Chat Sistema:", error);
    if (estado) estado.textContent = "No se pudo completar la auditoria.";
  }
};

window.eliminarChatSistemaObsoletosAdmin = async function() {
  const estado = document.getElementById("adminChatSistemaEstado");
  const eliminables = adminChatSistemaState.eliminables || [];
  if (!adminChatSistemaState.auditado || eliminables.length === 0) return;

  if (!(await usuarioAdminChatSistema())) {
    if (estado) estado.textContent = "Herramienta disponible solo para admin.";
    return;
  }

  const ok = confirm("Eliminar " + eliminables.length + " mensajes Sistema obsoletos");
  if (!ok) return;

  let eliminados = 0;
  let fallidos = 0;

  for (let i = 0; i < eliminables.length; i += 450) {
    const bloque = eliminables.slice(i, i + 450);
    const batch = db.batch();
    bloque.forEach(function(item) {
      batch.delete(item.ref);
    });

    try {
      await batch.commit();
      eliminados += bloque.length;
    } catch (error) {
      console.warn("No se pudo borrar un lote de mensajes Sistema:", error.message);
      fallidos += bloque.length;
    }
  }

  adminChatSistemaState.auditado = false;
  adminChatSistemaState.eliminables = [];
  const btnEliminar = document.getElementById("btnEliminarChatSistemaObsoletos");
  if (btnEliminar) btnEliminar.style.display = "none";
  if (estado) estado.textContent = "Limpieza finalizada. Eliminados: " + eliminados + ". Fallidos: " + fallidos + ". Omitidos: 0.";
};

document.addEventListener("DOMContentLoaded", function() {
  const btnAuditar = document.getElementById("btnAuditarChatSistema");
  const btnEliminar = document.getElementById("btnEliminarChatSistemaObsoletos");

  if (btnAuditar) {
    btnAuditar.addEventListener("click", function() {
      window.auditarChatSistemaAdmin();
    });
  }

  if (btnEliminar) {
    btnEliminar.addEventListener("click", function() {
      window.eliminarChatSistemaObsoletosAdmin();
    });
  }
});
