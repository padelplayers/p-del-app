window.modoPartidas = window.modoPartidas || "proximas";

const DESCUENTO_FIABILIDAD_PENALIZACION = {
  abandono_confirmada: 10,
  cancelacion_por_falta_sustituto: 10
};
const DURACION_PENALIZACION_MS = 180 * 24 * 60 * 60 * 1000;

function fechaPenalizacionToMillis(valor) {
  if (!valor) return null;
  if (typeof valor.toMillis === "function") return valor.toMillis();
  if (typeof valor.toDate === "function") return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();

  const fecha = new Date(valor);
  const millis = fecha.getTime();
  return isNaN(millis) ? null : millis;
}

function obtenerCaducidadPenalizacionMillis(penalizacion) {
  if (!penalizacion) return null;

  const caducaAtMillis = fechaPenalizacionToMillis(penalizacion.caducaAt);
  if (caducaAtMillis) return caducaAtMillis;

  const createdAtMillis = fechaPenalizacionToMillis(penalizacion.createdAt);
  if (!createdAtMillis) return null;

  return createdAtMillis + DURACION_PENALIZACION_MS;
}

function obtenerPenalizacionesActivasVigentes(penalizaciones, ahora) {
  const lista = Array.isArray(penalizaciones) ? penalizaciones : [];
  const ahoraMillis = fechaPenalizacionToMillis(ahora || new Date());

  return lista.filter(function(penalizacion) {
    if (!penalizacion || penalizacion.activa === false) return false;

    const caducidadMillis = obtenerCaducidadPenalizacionMillis(penalizacion);
    return !!caducidadMillis && caducidadMillis > ahoraMillis;
  });
}

function obtenerDescuentoFiabilidadPenalizacion(penalizacion) {
  if (!penalizacion) return 0;
  const tipo = String(penalizacion.tipo || "").trim();
  return DESCUENTO_FIABILIDAD_PENALIZACION[tipo] || 0;
}

function calcularFiabilidadDesdePenalizaciones(penalizaciones, ahora) {
  const activas = obtenerPenalizacionesActivasVigentes(penalizaciones, ahora);
  const descuento = activas.reduce(function(total, penalizacion) {
    return total + obtenerDescuentoFiabilidadPenalizacion(penalizacion);
  }, 0);

  return Math.max(0, Math.min(100, 100 - descuento));
}

function resumenPenalizacionesFiabilidad(penalizaciones, ahora) {
  const activas = obtenerPenalizacionesActivasVigentes(penalizaciones, ahora);
  return {
    penalizacionesActivas: activas.length,
    fiabilidad: calcularFiabilidadDesdePenalizaciones(penalizaciones, ahora),
    penalizacionesActivasLista: activas
  };
}

function datosClasificacionPenalizaciones(dataUsuario, penalizacionesExtra) {
  const existentes = Array.isArray(dataUsuario && dataUsuario.penalizaciones)
    ? dataUsuario.penalizaciones
    : [];
  const nuevas = Array.isArray(penalizacionesExtra)
    ? penalizacionesExtra.filter(function(penalizacion) { return !!penalizacion; })
    : [];
  const resumen = resumenPenalizacionesFiabilidad(existentes.concat(nuevas));

  return {
    resumen: resumen,
    update: {
      "clasificacion.penalizacionesActivas": resumen.penalizacionesActivas,
      "clasificacion.fiabilidad": resumen.fiabilidad
    }
  };
}

function textoNodo(texto, tag) {
  const el = document.createElement(tag || "div");
  el.textContent = texto;
  return el;
}

function obtenerFechaHoraPartida(p) {
  if (!p || !p.fecha || !p.hora) return null;

  const f = p.fecha.split("-");
  const h = p.hora.split(":");
  if (f.length !== 3 || h.length < 2) return null;

  return new Date(
    parseInt(f[0]),
    parseInt(f[1]) - 1,
    parseInt(f[2]),
    parseInt(h[0]),
    parseInt(h[1])
  );
}

function tieneSustitucionPendientePartida(p) {
  return !!p && (
    p.sustitucionPendiente === true ||
    p.sustitucionTipo === "reserva_subida_pendiente_aceptar"
  );
}

function tieneSolicitudSustitucionPartida(p) {
  return !!p && p.solicitudSustitucionEstado === "solicitud_sustitucion_pendiente";
}

function partidaConfirmadaConPlazaLibre(p) {
  return !!p &&
    (p.estado === "confirmada" || p.estado === "pendiente_cancelacion_club") &&
    arrayUnicoPartida(p.jugadores).length < 4;
}

function partidaNecesitaCancelacionClub(p) {
  return !!p &&
    (p.estado === "confirmada" || p.estado === "pendiente_cancelacion_club") &&
    (
      arrayUnicoPartida(p.jugadores).length < 4 ||
      p.sustitucionTipo === "reserva_subida_pendiente_aceptar"
    );
}

function partidaConfirmadaAlcanzoVentana5h(p, ahora) {
  const fechaPartida = obtenerFechaHoraPartida(p);
  return !!(
    p &&
    (p.estado === "confirmada" || p.estado === "pendiente_cancelacion_club") &&
    fechaPartida &&
    (ahora || new Date()) >= new Date(fechaPartida.getTime() - 5 * 60 * 60 * 1000)
  );
}

function partidaAlcanzoLimiteCancelacionClub(p, ahora) {
  return partidaNecesitaCancelacionClub(p) &&
    partidaConfirmadaAlcanzoVentana5h(p, ahora);
}

function crearErrorLimiteCancelacionClubPartida() {
  const error = new Error("La partida ha alcanzado el límite de 5 horas y debe cancelarse automáticamente.");
  error.codigo = "PARTIDA_LIMITE_CANCELACION_5H";
  return error;
}

function esErrorLimiteCancelacionClubPartida(error) {
  return !!error && error.codigo === "PARTIDA_LIMITE_CANCELACION_5H";
}

function forzarCancelacionClubTrasAccionBloqueada(partidaId) {
  return procesarLimiteCancelacionClubPartida(partidaId).catch(function(error) {
    console.warn("No se pudo completar la cancelación automática tras bloquear la acción:", error.message);
    return false;
  }).then(function(resultado) {
    if (typeof cargarPartidas === "function") cargarPartidas();
    return resultado;
  });
}

function puedeConfirmarPartida(p, uid, ahora) {
  const fechaPartida = obtenerFechaHoraPartida(p);

  return (
    uid &&
    p &&
    p.creadaPor === uid &&
    p.cambioCreadorPendiente !== true &&
    !tieneSustitucionPendientePartida(p) &&
    p.estado === "abierta" &&
    (p.jugadores || []).length === 4 &&
    fechaPartida &&
    fechaPartida >= (ahora || new Date())
  );
}

function obtenerCaducidadCambioCreadorPartida(p) {
  const fechaPartida = obtenerFechaHoraPartida(p);
  if (!fechaPartida) return null;
  return new Date(fechaPartida.getTime() - 8 * 60 * 60 * 1000);
}

function caducidadNotificacionPartida(dias) {
  return new Date(Date.now() + (dias || 30) * 24 * 60 * 60 * 1000);
}

function notificarPartida(uids, datos) {
  if (typeof window.crearNotificacionesParaUids !== "function") return Promise.resolve();

  const lista = arrayUnicoPartida(Array.isArray(uids) ? uids : [uids]);
  if (lista.length === 0) return Promise.resolve();

  return window.crearNotificacionesParaUids(lista, Object.assign({
    origen: "partidas",
    prioridad: "normal",
    caducaAt: caducidadNotificacionPartida(30),
    emailCritico: false
  }, datos)).catch(function(error) {
    console.warn("No se pudo crear notificacion:", error.message);
  });
}

function textoFechaAvisoPartida(p) {
  if (!p) return "";
  return ((p.fecha || "") + " " + (p.hora || "")).trim();
}

function normalizarContactoReservaPartida(valor) {
  const contacto = String(valor || "").trim();
  if (!contacto) return null;

  if (/^https?:\/\//i.test(contacto)) {
    return { tipo: "web", valor: contacto };
  }

  if (contacto.replace(/\D/g, "").length >= 6) {
    return { tipo: "telefono", valor: contacto };
  }

  return null;
}

function obtenerContactoReservaPartida(pistaId) {
  if (!pistaId) return Promise.resolve(null);

  return db.collection("pistas").doc(pistaId).get().then(function(docPista) {
    if (!docPista.exists) return null;
    return normalizarContactoReservaPartida((docPista.data() || {}).reserva);
  }).catch(function(error) {
    console.warn("No se pudo obtener el contacto de reserva de la pista:", error.message);
    return null;
  });
}

function actualizarBotonesPartidas() {
  const btnProx = document.getElementById("btnProximas");
  const btnPend = document.getElementById("btnPendientes");

  if (!btnProx || !btnPend) return;

  if (window.modoPartidas === "proximas") {
    btnProx.style.background = "#1565C0";
    btnProx.style.color = "#fff";
    btnPend.style.background = "#eee";
    btnPend.style.color = "#000";
  } else {
    btnPend.style.background = "#1565C0";
    btnPend.style.color = "#fff";
    btnProx.style.background = "#eee";
    btnProx.style.color = "#000";
  }
}

function cambiarModoPartidas(modo) {
  window.modoPartidas = modo;
  actualizarBotonesPartidas();
  cargarPartidas();
}

function normalizarSexoPartida(valor) {
  const sexo = String(valor || "").toLowerCase().trim();
  if (sexo === "masculino" || sexo === "hombre") return "masculino";
  if (sexo === "femenino" || sexo === "mujer") return "femenino";
  return sexo;
}

function arrayUnicoPartida(valores) {
  const lista = Array.isArray(valores) ? valores.filter(function(uid) { return !!uid; }) : [];
  return lista.filter(function(uid, index) {
    return lista.indexOf(uid) === index;
  });
}

function datosSustitucionResueltaPartida() {
  return {
    sustitucionPendiente: false,
    sustitucionPendienteDesde: firebase.firestore.FieldValue.delete(),
    sustitucionPendienteUid: firebase.firestore.FieldValue.delete(),
    sustitucionTipo: firebase.firestore.FieldValue.delete(),
    sustitucionSaleUid: firebase.firestore.FieldValue.delete(),
    sustitucionEntraUid: firebase.firestore.FieldValue.delete(),
    sustitucionPendienteAt: firebase.firestore.FieldValue.delete()
  };
}

function datosSolicitudSustitucionResueltaPartida() {
  return {
    solicitudSustitucionEstado: firebase.firestore.FieldValue.delete(),
    solicitudSustitucionUid: firebase.firestore.FieldValue.delete(),
    solicitudSustitucionAt: firebase.firestore.FieldValue.delete(),
    solicitudSustitucionReservasCompatibles: firebase.firestore.FieldValue.delete()
  };
}

function datosPartidaCompletaPartida() {
  return {
    partidaIncompleta: false,
    faltaJugadores: 0,
    incompletaDesde: firebase.firestore.FieldValue.delete(),
    abandonoResponsableIncompletaUid: firebase.firestore.FieldValue.delete(),
    estadoAntesCancelacionClub: firebase.firestore.FieldValue.delete(),
    cancelacionClubPendienteDesde: firebase.firestore.FieldValue.delete(),
    cancelacionClubUltimoRecordatorioAt: firebase.firestore.FieldValue.delete()
  };
}

function datosPartidaIncompletaPartida(uidResponsable) {
  return {
    partidaIncompleta: true,
    faltaJugadores: 1,
    incompletaDesde: firebase.firestore.FieldValue.serverTimestamp(),
    abandonoResponsableIncompletaUid: uidResponsable || firebase.firestore.FieldValue.delete()
  };
}

function crearPenalizacionPartida(partidaId, uid, tipo, motivo) {
  const creadaAt = firebase.firestore.Timestamp.now();
  return {
    id: tipo + "_" + partidaId + "_" + uid,
    tipo: tipo,
    motivo: motivo,
    puntos: 0,
    impactoFiabilidad: -obtenerDescuentoFiabilidadPenalizacion({ tipo: tipo }),
    createdAt: creadaAt,
    caducaAt: firebase.firestore.Timestamp.fromMillis(
      creadaAt.toMillis() + DURACION_PENALIZACION_MS
    ),
    activa: true,
    partidaId: partidaId
  };
}

function cerrarDialogoSalidaPartida(dialogo, accion) {
  if (!dialogo) return;
  const resolver = dialogo._resolverSalidaPartida;
  dialogo.remove();
  if (typeof resolver === "function") resolver(accion);
}

function mostrarDialogoSalidaConfirmadaPartida() {
  return new Promise(function(resolve) {
    const anterior = document.getElementById("dialogoSalidaConfirmadaPartida");
    if (anterior) cerrarDialogoSalidaPartida(anterior, "cancelar");

    const overlay = document.createElement("div");
    overlay.id = "dialogoSalidaConfirmadaPartida";
    overlay.className = "partidaDialogoOverlay";
    overlay._resolverSalidaPartida = resolve;

    const dialogo = document.createElement("div");
    dialogo.className = "partidaDialogo";
    dialogo.setAttribute("role", "dialog");
    dialogo.setAttribute("aria-modal", "true");
    dialogo.setAttribute("aria-labelledby", "dialogoSalidaConfirmadaTitulo");

    const titulo = textoNodo("Esta partida ya está confirmada.", "h3");
    titulo.id = "dialogoSalidaConfirmadaTitulo";

    const parrafos = [
      "Solicitar sustituto: sigues dentro de la partida y no recibes una penalización inmediata. Se avisará a las reservas compatibles. Si una reserva acepta, ocupará tu plaza y saldrás sin penalización. Si nadie acepta, sigues siendo jugador titular y debes asistir a la partida.",
      "Salir con penalización: abandonas la partida inmediatamente y se aplica una penalización por abandono. Si la partida queda incompleta y se cancela automáticamente por falta de jugador, se podrá aplicar una penalización adicional."
    ];
    const contenido = document.createElement("div");
    contenido.className = "partidaDialogoTexto";
    parrafos.forEach(function(texto) {
      contenido.appendChild(textoNodo(texto, "p"));
    });

    const acciones = document.createElement("div");
    acciones.className = "partidaDialogoAcciones";

    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.textContent = "Cancelar";
    cancelar.onclick = function() { cerrarDialogoSalidaPartida(overlay, "cancelar"); };

    const solicitar = document.createElement("button");
    solicitar.type = "button";
    solicitar.className = "partidaDialogoSolicitar";
    solicitar.textContent = "Solicitar sustituto";
    solicitar.onclick = function() { cerrarDialogoSalidaPartida(overlay, "solicitar"); };

    const abandonar = document.createElement("button");
    abandonar.type = "button";
    abandonar.className = "partidaDialogoPenalizacion";
    abandonar.textContent = "Salir con penalización";
    abandonar.onclick = function() { cerrarDialogoSalidaPartida(overlay, "penalizacion"); };

    acciones.appendChild(cancelar);
    acciones.appendChild(solicitar);
    acciones.appendChild(abandonar);
    dialogo.appendChild(titulo);
    dialogo.appendChild(contenido);
    dialogo.appendChild(acciones);
    overlay.appendChild(dialogo);
    overlay.onclick = function(event) {
      if (event.target === overlay) cerrarDialogoSalidaPartida(overlay, "cancelar");
    };
    document.body.appendChild(overlay);
    cancelar.focus();
  });
}

function datosSustitucionReservaPendientePartida(uidSale, uidEntra) {
  return {
    sustitucionPendiente: true,
    sustitucionPendienteDesde: firebase.firestore.FieldValue.delete(),
    sustitucionPendienteUid: firebase.firestore.FieldValue.delete(),
    sustitucionTipo: "reserva_subida_pendiente_aceptar",
    sustitucionSaleUid: uidSale,
    sustitucionEntraUid: uidEntra,
    sustitucionPendienteAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function pintarJugador(uid, slotId) {
  const el = document.getElementById(slotId);
  if (!el) return;

  if (!uid) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:4px; color:#999; cursor:pointer;";
    wrapper.onclick = function() { unirseAPartida(slotId); };

    const fotoWrap = document.createElement("div");
    fotoWrap.style.cssText = "position:relative; width:40px; height:40px;";

    const img = document.createElement("img");
    img.src = "imagen/hombre.jpeg";
    img.style.cssText = "width:40px; height:40px; border-radius:50%; object-fit:cover; opacity:0.3;";

    const plus = document.createElement("div");
    plus.style.cssText = "position:absolute; bottom:-2px; right:-2px; width:18px; height:18px; border-radius:50%; background:#1565C0; color:#fff; font-size:12px; display:flex; align-items:center; justify-content:center;";
    plus.textContent = "+";

    const label = document.createElement("span");
    label.style.fontSize = "12px";
    label.textContent = "Libre";

    fotoWrap.appendChild(img);
    fotoWrap.appendChild(plus);
    wrapper.appendChild(fotoWrap);
    wrapper.appendChild(label);
    el.replaceChildren(wrapper);
    return;
  }

  db.collection("usuarios").doc(uid).get().then(doc => {
    if (!doc.exists) return;

    const raw = doc.data() || {};
    const u = {
      nombre: raw.nombre,
      nivel: raw.nivel,
      imagen: raw.fotoPerfil,
      genero: raw.sexo
    };

    let imgSrc = "imagen/hombre.jpeg";
    if (u.imagen && u.imagen !== "") imgSrc = u.imagen;
    else if (u.genero === "mujer") imgSrc = "imagen/mujer.jpeg";

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:4px;";

    const fotoWrap = document.createElement("div");
    fotoWrap.style.cssText = "position:relative; width:40px; height:40px;";

    const img = document.createElement("img");
    img.src = imgSrc;
    img.style.cssText = "width:40px; height:40px; border-radius:50%; object-fit:cover;";

    const info = document.createElement("div");
    info.style.cssText = "font-size:12px; text-align:center; line-height:1.1; max-width:60px;";

    const nombre = document.createElement("div");
    nombre.style.cssText = "overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
    nombre.textContent = u.nombre || "Jugador";

    const nivel = document.createElement("div");
    nivel.style.color = "#666";
    nivel.textContent = "Nivel " + (u.nivel || "-");

    fotoWrap.appendChild(img);
    info.appendChild(nombre);
    info.appendChild(nivel);
    wrapper.appendChild(fotoWrap);
    wrapper.appendChild(info);
    el.replaceChildren(wrapper);
  });
}

function crearPartida() {
  const div = document.getElementById("pistaSeleccionada");
  const pistaId = div && div.dataset ? div.dataset.id : null;
  const fecha = document.getElementById("fechaPartida")?.value;
  const hora = document.getElementById("horaPartida")?.value;

  if (!fecha || !hora) {
    alert("Completa todos los campos");
    return;
  }

  const ahora = new Date();
  const partesFecha = fecha.split("-");
  const partesHora = hora.split(":");
  const fechaPartida = new Date(
    parseInt(partesFecha[0]),
    parseInt(partesFecha[1]) - 1,
    parseInt(partesFecha[2]),
    parseInt(partesHora[0]),
    parseInt(partesHora[1])
  );

  const esHoy =
    parseInt(partesFecha[0]) === ahora.getFullYear() &&
    parseInt(partesFecha[1]) === (ahora.getMonth() + 1) &&
    parseInt(partesFecha[2]) === ahora.getDate();

  if (esHoy && fechaPartida < ahora) {
    alert("No puedes seleccionar una hora anterior a la actual");
    return;
  }

  const tipo = document.getElementById("tipoPartida")?.value;
  const genero = document.getElementById("generoPartida")?.value;
  const nivelTipo = document.getElementById("nivelTipo").value;
  const nivelDesde = document.getElementById("nivelDesde").value;
  const nivelHasta = document.getElementById("nivelHasta").value;

  if (!pistaId) {
    alert("Selecciona una pista");
    return;
  }

  if (!fecha || !hora || !tipo || !genero) {
    alert("Completa todos los campos");
    return;
  }

  if (nivelTipo === "rango") {
    if (!nivelDesde || !nivelHasta) {
      alert("Selecciona rango de nivel");
      return;
    }

    if (parseFloat(nivelDesde) > parseFloat(nivelHasta)) {
      alert("Nivel incorrecto");
      return;
    }
  }

  const user = firebase.auth().currentUser;

  db.collection("usuarios").doc(user.uid).get().then(function(docUser) {
    if (!docUser.exists) return;

    const datosUsuario = docUser.data() || {};
    const sexoUsuario = normalizarSexoPartida(datosUsuario.sexo);
    const nivelUsuario = parseFloat(datosUsuario.nivel);

    if (
      (genero === "masculino" && sexoUsuario !== "masculino") ||
      (genero === "femenino" && sexoUsuario !== "femenino")
    ) {
      alert("No puedes crear una partida de otro género");
      return;
    }

    if (nivelTipo === "rango") {
      const desdeNum = parseFloat(nivelDesde);
      const hastaNum = parseFloat(nivelHasta);

      if (isNaN(nivelUsuario) || nivelUsuario < desdeNum || nivelUsuario > hastaNum) {
        alert("No puedes crear una partida fuera de tu nivel");
        return;
      }
    }

    db.collection("partidas").add({
      pistaId: pistaId,
      fecha: fecha,
      hora: hora,
      tipo: tipo,
      genero: genero,
      creador: user.uid,
      creadorNombre: user.displayName || "Jugador",
      nivel: nivelTipo === "cualquiera" ? "cualquiera" : {
        desde: nivelDesde,
        hasta: nivelHasta
      },
      jugadores: [user.uid],
      reservas: [],
      estado: "abierta",
      creadaPor: user.uid,
      creadaAt: new Date()
    })
    .then(() => {
      return db.collection("usuarios").doc(user.uid).set({
        clasificacion: {
          partidasCreadas: firebase.firestore.FieldValue.increment(1)
        }
      }, { merge: true });
    })
    .then(() => {
      document.getElementById("pistaSeleccionada").innerText = "Ninguna pista";
      document.getElementById("pistaSeleccionada").dataset.id = "";
      mostrar("partidas");
      cargarPartidas();
    });
  });
}

window.recalcularPartidasCreadasUsuarioActual = async function() {
  const user = firebase.auth().currentUser;
  if (!user) return 0;

  const consultas = await Promise.all([
    db.collection("partidas").where("creadaPor", "==", user.uid).get(),
    db.collection("partidas").where("creador", "==", user.uid).get(),
    db.collection("historial_partidas").where("creadaPor", "==", user.uid).get(),
    db.collection("historial_partidas").where("creador", "==", user.uid).get()
  ]);

  const partidasCreadas = {};
  consultas.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      partidasCreadas[doc.id] = true;
    });
  });

  const total = Object.keys(partidasCreadas).length;
  await db.collection("usuarios").doc(user.uid).set({
    clasificacion: {
      partidasCreadas: total
    }
  }, { merge: true });

  return total;
};

window.seleccionarPistaPartida = function(id, nombre) {
  const div = document.getElementById("pistaSeleccionada");
  if (div) {
    div.innerText = nombre;
    div.dataset.id = id;
  }

  window.modoSeleccionPista = false;
  mostrar("crearPartida");
};

function initCrearPartida() {
  const input = document.getElementById("fechaPartida");
  if (!input) return;

  const hoy = new Date().toISOString().split("T")[0];
  input.value = "";
  input.onchange = function() {
    if (this.value < hoy) {
      alert("No puedes seleccionar una fecha anterior a hoy");
      this.value = "";
    }
  };
}

async function eliminarPartidaConChat(partidaId) {
  if (typeof window.eliminarChatTotal === "function") {
    const ok = await window.eliminarChatTotal(partidaId);
    if (ok === false) return false;
  } else {
    console.warn("[PARTIDAS] No se elimina la partida porque no esta disponible la limpieza del chat.");
    return false;
  }

  await db.collection("partidas").doc(partidaId).delete();
  return true;
}

function confirmarPartida(partidaId) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Debes iniciar sesion");
    return;
  }

  const ref = db.collection("partidas").doc(partidaId);

  db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) throw new Error("La partida ya no existe");

      const p = doc.data() || {};

      if (p.cambioCreadorPendiente === true) {
        throw new Error("La partida necesita un nuevo creador antes de poder confirmarse.");
      }

      if (tieneSustitucionPendientePartida(p)) {
        throw new Error("No puedes confirmar la partida hasta que la reserva acepte su plaza.");
      }

      if (p.creadaPor !== user.uid) {
        throw new Error("Solo el creador puede confirmar la partida");
      }

      if (p.estado !== "abierta") {
        throw new Error("Esta partida no se puede confirmar");
      }

      if ((p.jugadores || []).length !== 4) {
        throw new Error("La partida necesita 4 jugadores titulares");
      }

      const fechaPartida = obtenerFechaHoraPartida(p);
      if (!fechaPartida || fechaPartida < new Date()) {
        throw new Error("No se puede confirmar una partida cuya fecha u hora ya paso");
      }

      transaction.update(ref, {
        estado: "confirmada",
        confirmadaAt: firebase.firestore.FieldValue.serverTimestamp(),
        confirmadaPor: user.uid
      });

      return p;
    });
  }).then(function(p) {
    const destinatarios = arrayUnicoPartida((p.jugadores || []).concat(p.reservas || [])).filter(function(uid) {
      return uid !== user.uid;
    });

    return notificarPartida(destinatarios, {
      tipo: "partida_confirmada",
      titulo: "Partida confirmada",
      mensaje: "La partida del " + textoFechaAvisoPartida(p) + " ha sido confirmada.",
      partidaId: partidaId,
      accion: "abrir_partida",
      dedupeKey: "partida_confirmada_" + partidaId,
      data: { estado: "confirmada" }
    });
  }).then(function() {
    cargarPartidas();
  }).catch(function(error) {
    alert(error && error.message ? error.message : "No se pudo confirmar la partida");
    cargarPartidas();
  });
}

async function cancelarPartidaPorFaltaDisponibilidad(partidaId) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Debes iniciar sesion");
    return;
  }

  const ok = confirm("Vas a cancelar esta partida para todos los jugadores porque no puede realizarse. ¿Continuar?");
  if (!ok) return;

  try {
    const ref = db.collection("partidas").doc(partidaId);
    const doc = await ref.get();

    if (!doc.exists) {
      alert("La partida ya no existe");
      return;
    }

    const p = doc.data() || {};
    if (!puedeConfirmarPartida(p, user.uid)) {
      alert("Esta partida ya no se puede cancelar desde aqui.");
      cargarPartidas();
      return;
    }

    const destinatarios = arrayUnicoPartida((p.jugadores || []).concat(p.reservas || [])).filter(function(uid) {
      return uid !== user.uid;
    });

    if (destinatarios.length > 0) {
      if (typeof window.crearNotificacionesParaUids !== "function") {
        alert("No se pudo crear el aviso de cancelacion. Intentalo de nuevo.");
        return;
      }

      await window.crearNotificacionesParaUids(destinatarios, {
        origen: "partidas",
        tipo: "partida_cancelada",
        titulo: "Partida cancelada",
        mensaje: "El creador ha cancelado la partida porque no podía realizarse o no había disponibilidad en el club.",
        dedupeKey: "partida_cancelada_" + partidaId,
        prioridad: "alta",
        caducaAt: caducidadNotificacionPartida(30),
        data: { partidaId: partidaId, motivo: "sin_disponibilidad_club" }
      });
    }

    const borrada = await eliminarPartidaConChat(partidaId);
    if (!borrada) {
      alert("No se pudo cancelar la partida. Intentalo de nuevo.");
      return;
    }

    cargarPartidas();
  } catch (error) {
    console.error("[cancelarPartidaPorFaltaDisponibilidad]", error);
    alert(error && error.message ? error.message : "No se pudo cancelar la partida");
  }
}

function crearBloquePartida(id, p, nivelTexto, mostrarSalir, fondo) {
  const bloque = document.createElement("div");
  bloque.className = "partidaCard";
  bloque.style.background = fondo;

  const reservasCompletas = (p.reservas || []).length >= 2;
  let textoEstadoPartida = "";
  let claseEstadoPartida = "";

  if (p.estado === "abierta") {
    textoEstadoPartida = "ABIERTA";
    claseEstadoPartida = "partidaCabeceraAbierta";
  } else if (p.estado === "confirmada") {
    textoEstadoPartida = reservasCompletas ? "CERRADA" : "CONFIRMADA";
    claseEstadoPartida = reservasCompletas ? "partidaCabeceraCerrada" : "partidaCabeceraConfirmada";
  } else if (p.estado === "pendiente_cancelacion_club") {
    textoEstadoPartida = "PENDIENTE DE CANCELACIÓN";
    claseEstadoPartida = "partidaCabeceraPendienteCancelacion";
  } else if (p.estado === "cerrada") {
    textoEstadoPartida = "CERRADA";
    claseEstadoPartida = "partidaCabeceraCerrada";
  }

  const cabecera = document.createElement("div");
  cabecera.className = "partidaCabecera";
  if (claseEstadoPartida) cabecera.classList.add(claseEstadoPartida);

  const filaTop = document.createElement("div");
  filaTop.className = "partidaFilaTop";

  const fecha = textoNodo((p.fecha || "") + " - " + (p.hora || ""));
  fecha.className = "partidaFecha";

  const chatBtn = document.createElement("button");
  chatBtn.type = "button";
  chatBtn.className = "partidaChatBtn";
  chatBtn.dataset.partidaId = id;
  if (typeof window.chatPartidaTieneNoLeidos === "function") {
    chatBtn.classList.toggle("hasUnread", window.chatPartidaTieneNoLeidos(id));
  }
  chatBtn.textContent = "Chat partida";
  chatBtn.onclick = function() {
    const pistaChat = document.getElementById("pista_" + id);
    abrirChatPartida(id, p.fecha || "", pistaChat ? pistaChat.textContent : "");
  };

  filaTop.appendChild(fecha);
  filaTop.appendChild(chatBtn);

  const pistaFila = document.createElement("button");
  pistaFila.type = "button";
  pistaFila.className = "partidaPistaBtn";
  pistaFila.onclick = function() { verPista(p.pistaId); };

  const pistaTexto = document.createElement("span");
  pistaTexto.id = "pista_" + id;
  pistaTexto.className = "partidaPistaTexto";
  pistaTexto.textContent = "Cargando pista...";
  pistaFila.appendChild(pistaTexto);

  const metaFila = document.createElement("div");
  metaFila.className = "partidaMeta";
  metaFila.appendChild(textoNodo((p.tipo || "ranking") + " - " + nivelTexto + " - " + (p.genero || "")));

  const datosPistaPartida = textoNodo("");
  datosPistaPartida.id = "datosPistaPartida_" + id;
  metaFila.appendChild(datosPistaPartida);

  const creador = textoNodo("Creador: -");
  creador.id = "creador_" + id;
  metaFila.appendChild(creador);

  cabecera.appendChild(filaTop);
  if (textoEstadoPartida) {
    const estadoBadge = textoNodo(textoEstadoPartida, "span");
    estadoBadge.className = "partidaEstadoBadge";
    cabecera.appendChild(estadoBadge);
  }
  if (tieneSustitucionPendientePartida(p)) {
    const sustitucionBadge = textoNodo("Sustitución pendiente", "span");
    sustitucionBadge.textContent = p.sustitucionTipo === "reserva_subida_pendiente_aceptar"
      ? "Sustitución pendiente de aceptar"
      : "Sustitución pendiente";
    sustitucionBadge.className = "partidaEstadoBadge";
    sustitucionBadge.style.cssText = "background:#FFC107; color:#000; border-color:#FFC107; font-weight:bold;";
    cabecera.appendChild(sustitucionBadge);
  }
  if (tieneSolicitudSustitucionPartida(p)) {
    const solicitudBadge = textoNodo("Pendiente de sustituto", "span");
    solicitudBadge.className = "partidaEstadoBadge partidaEstadoSustitucionSolicitada";
    cabecera.appendChild(solicitudBadge);

    const solicitudDetalle = textoNodo(
      "El jugador que solicita sustituto sigue ocupando su plaza y debe asistir mientras nadie la acepte."
    );
    solicitudDetalle.className = "partidaAvisoSustitucion";
    cabecera.appendChild(solicitudDetalle);
  }
  if (partidaConfirmadaConPlazaLibre(p)) {
    const incompleta = textoNodo("Falta 1 jugador para completar la partida.");
    incompleta.className = "partidaAvisoIncompleta";
    cabecera.appendChild(incompleta);
  }
  if (p.cambioCreadorPendiente === true) {
    const cambioCreadorBadge = textoNodo("Cambio de creador pendiente", "span");
    cambioCreadorBadge.className = "partidaEstadoBadge";
    cambioCreadorBadge.style.cssText = "background:#FFC107; color:#000; border-color:#FFC107; font-weight:bold;";
    cabecera.appendChild(cambioCreadorBadge);
  }
  cabecera.appendChild(pistaFila);
  cabecera.appendChild(metaFila);

  const user = firebase.auth().currentUser;
  const uidActual = user ? user.uid : null;
  const cambioCreadorPendiente = p.cambioCreadorPendiente === true;
  const candidatosCambioCreador = arrayUnicoPartida(p.cambioCreadorCandidatos);
  const puedeAceptarCambioCreador = cambioCreadorPendiente && uidActual && candidatosCambioCreador.includes(uidActual);
  const esCreador = uidActual && p.creadaPor === uidActual && !cambioCreadorPendiente;
  const confirmarActivo = puedeConfirmarPartida(p, uidActual);
  const puedeResponderSustitucion =
    p.sustitucionTipo === "reserva_subida_pendiente_aceptar" &&
    uidActual &&
    p.sustitucionEntraUid === uidActual;
  const puedeAceptarSolicitudSustitucion =
    tieneSolicitudSustitucionPartida(p) &&
    uidActual &&
    arrayUnicoPartida(p.solicitudSustitucionReservasCompatibles).includes(uidActual) &&
    arrayUnicoPartida(p.reservas).includes(uidActual);

  if (esCreador && tieneSustitucionPendientePartida(p)) {
    const avisoSustitucionCreador = document.createElement("div");
    avisoSustitucionCreador.className = "partidaAcciones";
    avisoSustitucionCreador.style.cssText = "padding:8px; border-radius:6px; background:#FFF3CD; color:#664D03; font-weight:bold; text-align:left;";
    avisoSustitucionCreador.textContent = p.sustitucionTipo === "reserva_subida_pendiente_aceptar"
      ? "Hay una reserva pendiente de aceptar su plaza. No puedes confirmar la partida hasta que responda."
      : "Hay una sustituciÃ³n pendiente. No puedes confirmar la partida hasta que se resuelva.";
    cabecera.appendChild(avisoSustitucionCreador);
  }

  if (cambioCreadorPendiente) {
    const cambioCreadorBox = document.createElement("div");
    cambioCreadorBox.className = "partidaAcciones";
    cambioCreadorBox.style.flexDirection = "column";
    cambioCreadorBox.style.alignItems = "stretch";

    const avisoCambio = textoNodo("La partida necesita un nuevo creador.");
    avisoCambio.style.fontWeight = "bold";
    cambioCreadorBox.appendChild(avisoCambio);

    const detalleCambio = textoNodo("El primero que acepte será responsable de comprobar disponibilidad y realizar la reserva cuando la partida se complete.");
    detalleCambio.style.fontSize = "13px";
    detalleCambio.style.color = "#555";
    cambioCreadorBox.appendChild(detalleCambio);

    if (puedeAceptarCambioCreador) {
      const aceptarCambio = document.createElement("button");
      aceptarCambio.type = "button";
      aceptarCambio.textContent = "Aceptar ser creador";
      aceptarCambio.style.cssText = "background:#1565C0; color:#fff;";
      aceptarCambio.onclick = function() { aceptarCambioCreadorPartida(id); };
      cambioCreadorBox.appendChild(aceptarCambio);
    }

    cabecera.appendChild(cambioCreadorBox);
  }

  if (mostrarSalir || esCreador) {
    const salirWrap = document.createElement("div");
    salirWrap.className = "partidaAcciones";

    if (esCreador && p.estado === "abierta" && !cambioCreadorPendiente) {
      const confirmar = document.createElement("button");
      confirmar.type = "button";
      confirmar.textContent = confirmarActivo
        ? "Confirmar partida"
        : (tieneSustitucionPendientePartida(p) ? "Pendiente de aceptación" : "Faltan jugadores");
      confirmar.disabled = !confirmarActivo;
      confirmar.style.cssText = confirmarActivo
        ? "background:#FFC107; color:#0D47A1;"
        : "background:#ddd; color:#777; cursor:not-allowed;";
      confirmar.onclick = function() { confirmarPartida(id); };
      salirWrap.appendChild(confirmar);

      if (confirmarActivo) {
        const cancelarPartida = document.createElement("button");
        cancelarPartida.type = "button";
        cancelarPartida.textContent = "Cancelar partida";
        cancelarPartida.style.cssText = "background:#C62828; color:#fff;";
        cancelarPartida.onclick = function() { cancelarPartidaPorFaltaDisponibilidad(id); };
        salirWrap.appendChild(cancelarPartida);
      }
    }

    if (mostrarSalir) {
      const salir = document.createElement("button");
      salir.className = "partidaSalirBtn";
      salir.textContent = "Salir";
      salir.onclick = function() { salirDePartida(id); };

      salirWrap.appendChild(salir);
    }
    cabecera.appendChild(salirWrap);
  }

  if (puedeResponderSustitucion) {
    const sustitucionAcciones = document.createElement("div");
    sustitucionAcciones.className = "partidaAcciones";

    const aceptar = document.createElement("button");
    aceptar.type = "button";
    aceptar.textContent = "Aceptar sustitución";
    aceptar.style.cssText = "background:#1565C0; color:#fff;";
    aceptar.onclick = function() { aceptarSustitucionPartida(id); };

    const rechazar = document.createElement("button");
    rechazar.type = "button";
    rechazar.textContent = "Rechazar sustitución";
    rechazar.style.cssText = "background:#FFC107; color:#000;";
    rechazar.onclick = function() { rechazarSustitucionPartida(id); };

    sustitucionAcciones.appendChild(aceptar);
    sustitucionAcciones.appendChild(rechazar);
    cabecera.appendChild(sustitucionAcciones);
  }

  if (puedeAceptarSolicitudSustitucion) {
    const aceptarSolicitudWrap = document.createElement("div");
    aceptarSolicitudWrap.className = "partidaAcciones";

    const aceptarSolicitud = document.createElement("button");
    aceptarSolicitud.type = "button";
    aceptarSolicitud.textContent = "Aceptar ocupar la plaza";
    aceptarSolicitud.style.cssText = "background:#1565C0; color:#fff;";
    aceptarSolicitud.onclick = function() { aceptarSustitucionPartida(id); };

    aceptarSolicitudWrap.appendChild(aceptarSolicitud);
    cabecera.appendChild(aceptarSolicitudWrap);
  }

  if (typeof window.crearAccionesPostPartido === "function") {
    const accionesPostPartido = window.crearAccionesPostPartido(id, p, uidActual);
    if (accionesPostPartido) cabecera.appendChild(accionesPostPartido);
  }

  bloque.appendChild(cabecera);

  const jugadoresWrap = document.createElement("div");
  jugadoresWrap.className = "partidaJugadores";
  const jugadoresTitulo = textoNodo("Jugadores:");
  jugadoresTitulo.className = "partidaSeccionTitulo";
  const jugadoresGrid = document.createElement("div");
  jugadoresGrid.className = "partidaJugadoresGrid";

  for (let i = 1; i <= 4; i++) {
    const slot = document.createElement("div");
    slot.className = "jugadorSlot";
    slot.id = "j" + i + "_" + id;
    jugadoresGrid.appendChild(slot);
  }

  jugadoresWrap.appendChild(jugadoresTitulo);
  jugadoresWrap.appendChild(jugadoresGrid);

  const reservasWrap = document.createElement("div");
  reservasWrap.className = "partidaReservas";
  const reservasTitulo = textoNodo("Reservas");
  reservasTitulo.className = "partidaSeccionTitulo";
  const reservasGrid = document.createElement("div");
  reservasGrid.className = "partidaReservasGrid";

  for (let i = 1; i <= 2; i++) {
    const slot = document.createElement("div");
    slot.className = "jugadorSlot";
    slot.id = "r" + i + "_" + id;
    reservasGrid.appendChild(slot);
  }

  reservasWrap.appendChild(reservasTitulo);
  reservasWrap.appendChild(reservasGrid);
  bloque.appendChild(jugadoresWrap);
  bloque.appendChild(reservasWrap);
  return bloque;
}

function cargarDatosPartidaRenderizada(item) {
  const id = item.id;
  const p = item.p;

  if (p.pistaId) {
    db.collection("pistas").doc(p.pistaId).get().then(function(docPista) {
      if (docPista.exists) {
        const pista = docPista.data();
        const texto = (pista.nombre || "") + " - " + (pista.localidad || "");
        const el = document.getElementById("pista_" + id);
        if (el) el.innerText = texto;

        const datosEl = document.getElementById("datosPistaPartida_" + id);
        if (datosEl) {
          const tieneIndoor = Number(pista.indoor) > 0;
          const tieneOutdoor = Number(pista.outdoor) > 0;
          let tipoPista = "";

          if (tieneIndoor && tieneOutdoor) {
            tipoPista = "Indoor/Outdoor";
          } else if (tieneIndoor) {
            tipoPista = "Indoor";
          } else if (tieneOutdoor) {
            tipoPista = "Outdoor";
          }

          const partesFecha = (p.fecha || "").split("-");
          const fechaPartida = partesFecha.length === 3
            ? new Date(Number(partesFecha[0]), Number(partesFecha[1]) - 1, Number(partesFecha[2]))
            : null;
          const diaSemana = fechaPartida ? fechaPartida.getDay() : null;
          const horaPartida = parseInt((p.hora || "").split(":")[0], 10);
          let precio = "";

          if (diaSemana === 0 || diaSemana === 6) {
            precio = pista.precioFestivo;
          } else if (!isNaN(horaPartida) && horaPartida < 14) {
            precio = pista.precioManana;
          } else if (!isNaN(horaPartida)) {
            precio = pista.precioTarde;
          }

          let precioTexto = "";
          if (precio !== undefined && precio !== null && String(precio).trim() !== "" && /\d/.test(String(precio))) {
            precioTexto = String(precio).trim();
            if (precioTexto.includes("€/pers.")) {
              precioTexto = precioTexto;
            } else if (precioTexto.includes("€")) {
              precioTexto = precioTexto.replace(/\s*€\s*$/, "€/pers.");
            } else {
              precioTexto = precioTexto + "€/pers.";
            }
          }

          if (tipoPista && precioTexto) {
            datosEl.innerText = tipoPista + " · " + precioTexto;
          } else {
            datosEl.innerText = tipoPista || precioTexto;
          }
        }
      }
    });
  }

  for (var i = 0; i < 4; i++) {
    pintarJugador(p.jugadores[i] || null, "j" + (i + 1) + "_" + id);
  }

  for (var r = 0; r < 2; r++) {
    pintarJugador(p.reservas[r] || null, "r" + (r + 1) + "_" + id);
  }

  if (p.creadaPor) {
    db.collection("usuarios").doc(p.creadaPor).get().then(function(docUser) {
      if (docUser.exists) {
        const u = docUser.data();
        const el = document.getElementById("creador_" + id);
        if (el) el.innerText = "Creador: " + (u.nombre || "Jugador");
      }
    });
  }
}

function partidaTieneValoracionesCompletas(p) {
  const jugadores = participantesValoracionesPartida(p);
  if (jugadores.length < 2) return false;

  const jugadoresUnicos = new Set(jugadores);
  if (jugadoresUnicos.size !== jugadores.length) return false;

  const valoraciones = p.valoraciones;
  if (!valoraciones || typeof valoraciones !== "object") return false;

  return jugadores.every(function(uidValorador) {
    const valoracionValorador = valoraciones[uidValorador];
    if (!valoracionValorador || typeof valoracionValorador !== "object") return false;
    if (Object.prototype.hasOwnProperty.call(valoracionValorador, uidValorador)) return false;

    return jugadores.every(function(uidValorado) {
      if (uidValorado === uidValorador) return true;

      const valoracion = valoracionValorador[uidValorado];
      return !!valoracion && typeof valoracion === "object";
    });
  });
}

function partidaTieneResultadoValidado(p) {
  return !!(p && p.resultado && p.resultado.estado === "validado");
}

function esTipoRanking(tipo) {
  const valor = String(tipo || "ranking").toLowerCase().trim();
  return valor === "ranking" || valor === "competitiva" || valor === "competitivo";
}

function participantesValoracionesPartida(p) {
  if (!p) return [];

  if (esTipoRanking(p.tipo) && p.resultado && p.resultado.estado === "validado") {
    const equipo1 = Array.isArray(p.resultado.equipo1) ? p.resultado.equipo1 : [];
    const equipo2 = Array.isArray(p.resultado.equipo2) ? p.resultado.equipo2 : [];
    const participantesRanking = equipo1.concat(equipo2);
    if (participantesRanking.length === 4 && new Set(participantesRanking).size === 4) {
      return participantesRanking;
    }
  }

  if (String(p.tipo || "").toLowerCase().trim() === "amistosa") {
    const participantes = Array.isArray(p.participantesPostPartido) ? p.participantesPostPartido : [];
    if (participantes.length >= 4 && new Set(participantes).size === participantes.length) {
      return participantes;
    }
  }

  return Array.isArray(p.jugadores) ? p.jugadores : [];
}

function partidaConfirmadaIncompleta(p) {
  if (!p || p.estado !== "confirmada") return false;

  const tipo = String(p.tipo || "ranking").toLowerCase().trim();
  const valoracionesCompletas = partidaTieneValoracionesCompletas(p);

  if (tipo === "amistosa") return !valoracionesCompletas;

  return !(partidaTieneResultadoValidado(p) && valoracionesCompletas);
}

function procesarLimiteCancelacionClubPartida(partidaId) {
  const ref = db.collection("partidas").doc(partidaId);

  return db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) return false;

      const p = doc.data() || {};
      const uidReservaSinConfirmar = p.sustitucionTipo === "reserva_subida_pendiente_aceptar"
        ? p.sustitucionEntraUid
        : null;
      const jugadores = arrayUnicoPartida(p.jugadores).filter(function(uidJugador) {
        return uidJugador !== uidReservaSinConfirmar;
      });
      const reservas = arrayUnicoPartida(p.reservas);
      if (uidReservaSinConfirmar && !reservas.includes(uidReservaSinConfirmar)) {
        reservas.unshift(uidReservaSinConfirmar);
      }
      if (!partidaAlcanzoLimiteCancelacionClub(p)) {
        return false;
      }

      const abandonos = Array.isArray(p.abandonosConPenalizacion)
        ? p.abandonosConPenalizacion
        : [];
      const uidResponsable =
        p.abandonoResponsableIncompletaUid ||
        p.sustitucionSaleUid ||
        (abandonos.length > 0 && abandonos[abandonos.length - 1]
          ? abandonos[abandonos.length - 1].uid
          : null);
      const responsableTieneAbandono = abandonos.some(function(abandono) {
        return abandono && abandono.uid === uidResponsable;
      });
      const agravadasAplicadas = arrayUnicoPartida(p.penalizacionAgravadaAplicadaUids);
      const aplicaAgravada =
        uidResponsable &&
        responsableTieneAbandono &&
        !agravadasAplicadas.includes(uidResponsable);
      const penalizacionAgravada = aplicaAgravada
        ? crearPenalizacionPartida(
            partidaId,
            uidResponsable,
            "cancelacion_por_falta_sustituto",
            "La partida tuvo que cancelarse por falta de sustituto al llegar al límite de 5 horas"
          )
        : null;

      function finalizarCancelacionPendiente() {
        transaction.delete(ref);
        return {
          partida: p,
          creadaPor: p.creadaPor || p.creador || null,
          participantes: arrayUnicoPartida(
            jugadores
              .concat(reservas)
              .concat(p.creadaPor || p.creador || [])
              .concat(abandonos.map(function(abandono) {
                return abandono && abandono.uid;
              }))
          ),
          uidResponsable: penalizacionAgravada ? uidResponsable : null,
          penalizacionAgravada: penalizacionAgravada
        };
      }

      if (!penalizacionAgravada) {
        return finalizarCancelacionPendiente();
      }

      const usuarioResponsableRef = db.collection("usuarios").doc(uidResponsable);
      return transaction.get(usuarioResponsableRef).then(function(docUsuario) {
        const datosUsuario = docUsuario.exists ? (docUsuario.data() || {}) : {};
        const datosClasificacion = datosClasificacionPenalizaciones(datosUsuario, [penalizacionAgravada]);

        transaction.update(usuarioResponsableRef, Object.assign({}, datosClasificacion.update, {
          penalizaciones: firebase.firestore.FieldValue.arrayUnion(penalizacionAgravada)
        }));

        return finalizarCancelacionPendiente();
      });
    });
  }).then(function(actualizada) {
    if (!actualizada) return false;

    const pistaId = actualizada.partida && actualizada.partida.pistaId;
    return obtenerContactoReservaPartida(pistaId).then(function(contactoReserva) {
      actualizada.contactoReserva = contactoReserva;
      return actualizada;
    });
  }).then(function(actualizada) {
    if (!actualizada) return false;
    if (typeof window.resolverNotificacionesPorPartidaId !== "function") return actualizada;

    return window.resolverNotificacionesPorPartidaId(partidaId).catch(function(error) {
      console.warn("No se pudieron resolver los avisos anteriores de la partida cancelada:", error.message);
      return 0;
    }).then(function() {
      return actualizada;
    });
  }).then(function(actualizada) {
    if (!actualizada) return false;

    const avisos = [];
    if (actualizada.creadaPor) {
      avisos.push(notificarPartida(actualizada.creadaPor, {
        tipo: "partida_cancelada_automatica_5h_creador",
        titulo: "Partida cancelada automáticamente",
        mensaje: "La partida seguía incompleta al llegar al límite de 5 horas y ha sido eliminada de la app.\n\nDebes cancelar la reserva real con el club lo antes posible. Como la cancelación se ha producido a 5 horas del inicio, dispones aproximadamente de 1 hora para realizar la gestión antes de entrar en las últimas 4 horas previas a la partida, donde algunos clubes pueden aplicar condiciones especiales, restricciones o costes de cancelación.\n\nSi la pista fue reservada por teléfono o web, contacta con la instalación cuanto antes para evitar posibles pagos u obligaciones asociadas a la reserva.",
        partidaId: partidaId,
        dedupeKey: "partida_cancelada_automatica_5h_creador_" + partidaId,
        prioridad: "alta",
        emailCritico: true,
        accion: actualizada.contactoReserva ? "contactar_pista" : null,
        data: {
          motivo: "incompleta_sin_sustituto",
          contactoReserva: actualizada.contactoReserva
        }
      }));
    }
    const participantes = actualizada.participantes.filter(function(uid) {
      return uid !== actualizada.creadaPor;
    });
    if (participantes.length > 0) {
      avisos.push(notificarPartida(participantes, {
        tipo: "partida_cancelada_automatica_5h",
        titulo: "Partida cancelada",
        mensaje: "La partida seguía incompleta al llegar al límite de 5 horas y se ha cancelado automáticamente.",
        partidaId: partidaId,
        dedupeKey: "partida_cancelada_automatica_5h_" + partidaId,
        prioridad: "alta",
        emailCritico: true,
        data: { motivo: "incompleta_sin_sustituto" }
      }));
    }
    if (actualizada.penalizacionAgravada) {
      avisos.push(notificarPartida(actualizada.uidResponsable, {
        tipo: "penalizacion_agravada_cancelacion",
        titulo: "Penalización adicional",
        mensaje: "La partida tuvo que cancelarse por falta de sustituto. Se ha registrado una penalización adicional.",
        partidaId: partidaId,
        dedupeKey: "penalizacion_agravada_cancelacion_" + partidaId + "_" + actualizada.uidResponsable,
        prioridad: "alta",
        emailCritico: true,
        data: {
          penalizacionId: actualizada.penalizacionAgravada.id,
          motivo: actualizada.penalizacionAgravada.motivo
        }
      }));
    }

    return Promise.all(avisos.map(function(aviso) {
      return aviso.catch(function(error) {
        console.warn("No se pudo enviar un aviso de cancelación automática:", error.message);
      });
    })).then(function() {
      if (typeof window.eliminarChatTotal !== "function") return true;
      return window.eliminarChatTotal(partidaId).then(function(chatEliminado) {
        if (chatEliminado === false) {
          console.warn("[PARTIDAS] La partida se eliminó, pero no se pudo limpiar su chat.");
        }
        return true;
      }).catch(function(error) {
        console.warn("[PARTIDAS] La partida se eliminó, pero falló la limpieza de su chat:", error.message);
        return true;
      });
    });
  });
}

function revisarLimitesCancelacionClubPartidas() {
  if (!firebase.auth().currentUser) return Promise.resolve();

  return db.collection("partidas").get().then(function(snapshot) {
    const tareas = [];
    snapshot.forEach(function(doc) {
      const p = doc.data() || {};
      if (partidaAlcanzoLimiteCancelacionClub(p)) {
        tareas.push(procesarLimiteCancelacionClubPartida(doc.id));
      }
    });
    return Promise.all(tareas);
  }).catch(function(error) {
    console.warn("No se pudieron revisar las cancelaciones pendientes:", error.message);
  });
}

window.revisarLimitesCancelacionClubPartidas = revisarLimitesCancelacionClubPartidas;

function revisarCancelacionesAntesDePostPartido() {
  return revisarLimitesCancelacionClubPartidas().then(function() {
    if (typeof window.revisarAvisosPostPartido !== "function") return null;
    return window.revisarAvisosPostPartido();
  });
}

function asegurarRevisionCancelacionClubPartidas() {
  if (window.revisionCancelacionClubPartidasInterval) return;
  window.revisionCancelacionClubPartidasInterval = setInterval(function() {
    revisarCancelacionesAntesDePostPartido();
  }, 60 * 1000);
}

function cargarPartidas() {
  if (!window.modoPartidas) window.modoPartidas = "proximas";

  asegurarRevisionCancelacionClubPartidas();
  actualizarBotonesPartidas();
  cargarFiltroPistas();

  const contenedor = document.getElementById("listaPartidas");
  if (!contenedor) return;

  contenedor.replaceChildren(textoNodo("Cargando..."));

  revisarCancelacionesAntesDePostPartido()
  .then(function() {
    return db.collection("partidas").get();
  })
  .then(function(snapshot) {
    if (snapshot.empty) {
      contenedor.replaceChildren(textoNodo("No hay partidas"));
      return;
    }

    const proximas = [];
    const pendientes = [];
    const ahoraGlobal = new Date();
    const filtros = window.filtrosPartidas || {};
    const tipoNivel = filtros.tipoNivel || "";
    const nivelDesde = filtros.nivelDesde || "";
    const nivelHasta = filtros.nivelHasta || "";
    const filtroFecha = filtros.fecha || "";
    const filtroTipo = (filtros.tipo || "").toLowerCase().trim();
    const filtroGenero = filtros.genero || "";
    const filtroPista = filtros.pista || "";

    snapshot.forEach(function(doc) {
      const p = doc.data() || {};

      if (filtroTipo && ((p.tipo || "ranking").toLowerCase().trim() !== filtroTipo)) return;
      if (filtroFecha && ((p.fecha || "") !== filtroFecha)) return;
      if (filtroGenero && ((p.genero || "").toLowerCase().trim() !== filtroGenero)) return;
      if (filtroPista && ((p.pistaId || p.pista || "") !== filtroPista)) return;

      let pasaNivel = true;
      let nivelPartidaDesde = "";
      let nivelPartidaHasta = "";

      if (p.nivel && typeof p.nivel === "object") {
        nivelPartidaDesde = p.nivel.desde || "";
        nivelPartidaHasta = p.nivel.hasta || "";
      }

      if (tipoNivel === "cualquiera") {
        pasaNivel = !p.nivel || p.nivel === "cualquiera";
      }

      if (tipoNivel === "rango") {
        const filtroDesdeNum = parseFloat(nivelDesde);
        const filtroHastaNum = parseFloat(nivelHasta);
        const partidaDesdeNum = parseFloat(nivelPartidaDesde);
        const partidaHastaNum = parseFloat(nivelPartidaHasta);

        pasaNivel = !isNaN(partidaDesdeNum) && !isNaN(partidaHastaNum);
        if (pasaNivel && !isNaN(filtroDesdeNum)) pasaNivel = filtroDesdeNum >= partidaDesdeNum;
        if (pasaNivel && !isNaN(filtroHastaNum)) pasaNivel = filtroHastaNum <= partidaHastaNum;
      }

      if (tipoNivel && !pasaNivel) return;

      let fechaPartida = null;

      if (p.fecha && p.hora) {
        const f = p.fecha.split("-");
        const h = p.hora.split(":");
        fechaPartida = new Date(
          parseInt(f[0]),
          parseInt(f[1]) - 1,
          parseInt(f[2]),
          parseInt(h[0]),
          parseInt(h[1])
        );
        console.log("[cargarPartidas] datos", {
          id: doc.id,
          fecha: p.fecha,
          hora: p.hora,
          fechaPartida,
          ahoraGlobal
        });
      }

      const ahora = new Date();

      if (p.estado === "cancelada") {
        eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
        return;
      }

      if (p.cambioCreadorPendiente === true) {
        let caducaCambioCreador = p.cambioCreadorCaducaAt || null;
        if (caducaCambioCreador && typeof caducaCambioCreador.toDate === "function") {
          caducaCambioCreador = caducaCambioCreador.toDate();
        } else if (caducaCambioCreador) {
          caducaCambioCreador = new Date(caducaCambioCreador);
        }

        if (caducaCambioCreador && caducaCambioCreador <= ahora) {
          eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
          return;
        }
      }

      if (p.estado === "abierta" && fechaPartida && fechaPartida < ahora) {
        eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
        return;
      }

      if (p.estado === "confirmada" && fechaPartida) {
        if (partidaAlcanzoLimiteCancelacionClub(p, ahora)) {
          procesarLimiteCancelacionClubPartida(doc.id).then(function(actualizada) {
            if (actualizada) cargarPartidas();
          });
          return;
        }

        const limiteConfirmada = new Date(fechaPartida);
        limiteConfirmada.setDate(limiteConfirmada.getDate() + 3);

        if (ahora > limiteConfirmada && partidaConfirmadaIncompleta(p)) {
          eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
          return;
        }
      }

      const esRankingLimpieza = esTipoRanking(p.tipo);
      const puedeLimpiarFinalizada =
        p.estado === "finalizada" &&
        p.guardadaEnHistorial === true &&
        (
          (
            esRankingLimpieza &&
            p.rankingCompetitivoAplicado === true &&
            p.clasificacionComunitariaAplicada === true
          ) ||
          (
            !esRankingLimpieza &&
            p.clasificacionComunitariaAplicada === true
          )
        );

      if (puedeLimpiarFinalizada) {
        eliminarPartidaConChat(doc.id).then(function(ok) {
          if (ok) cargarPartidas();
        });
        return;
      }

      if (!fechaPartida) return;

      p.jugadores = p.jugadores || [];
      p.reservas = p.reservas || [];

      let fondo = "#ffffff";
      if (
        p.estado === "confirmada" ||
        p.estado === "cerrada" ||
        p.estado === "pendiente_cancelacion_club"
      ) fondo = "#e3f2fd";

      const nivelTexto =
        (p.nivel && p.nivel.desde && p.nivel.hasta)
          ? p.nivel.desde + " - " + p.nivel.hasta
          : "Cualquiera";

      const uid = firebase.auth().currentUser.uid;
      const puedeSalirPartida =
        p.estado === "abierta" ||
        (
          p.estado === "confirmada" &&
          !p.resultado &&
          (!p.valoraciones || Object.keys(p.valoraciones).length === 0)
        );
      const mostrarSalir =
        puedeSalirPartida &&
        p.cambioCreadorPendiente !== true &&
        (p.jugadores.includes(uid) || p.reservas.includes(uid));
      const item = {
        id: doc.id,
        p: p,
        _fechaOrden: fechaPartida.getTime(),
        nodo: crearBloquePartida(doc.id, p, nivelTexto, mostrarSalir, fondo)
      };

      const limiteResultado = new Date(fechaPartida.getTime() + 80 * 60 * 1000);

      if (p.estado === "confirmada" && limiteResultado <= ahoraGlobal) {
        console.log("[cargarPartidas] PENDIENTE", doc.id);
        pendientes.push(item);
      } else if (
        p.estado === "pendiente_cancelacion_club" ||
        fechaPartida >= ahoraGlobal ||
        (p.estado === "confirmada" && limiteResultado > ahoraGlobal)
      ) {
        if (
          p.estado === "abierta" ||
          p.estado === "confirmada" ||
          p.estado === "pendiente_cancelacion_club"
        ) {
          console.log("[cargarPartidas] PROXIMA", doc.id);
          proximas.push(item);
        }
      }
    });

    let modo = window.modoPartidas;
    if (modo !== "pendientes" && modo !== "proximas") {
      modo = "proximas";
      window.modoPartidas = "proximas";
    }

    proximas.sort(function(a, b) {
      return a._fechaOrden - b._fechaOrden;
    });

    pendientes.sort(function(a, b) {
      return b._fechaOrden - a._fechaOrden;
    });

    const seleccion = modo === "pendientes" ? pendientes : proximas;
    const fragment = document.createDocumentFragment();
    seleccion.forEach(function(item) {
      fragment.appendChild(item.nodo);
    });

    if (seleccion.length === 0) {
      contenedor.replaceChildren(textoNodo("No hay partidas"));
    } else {
      contenedor.replaceChildren(fragment);
      seleccion.forEach(cargarDatosPartidaRenderizada);
    }

    actualizarBotonesPartidas();
  })
  .catch(function(error) {
    console.error("Error cargando partidas:", error);
    contenedor.replaceChildren(textoNodo("Error cargando partidas"));
  });
}

function getCampoBusquedaPartida(id) {
  const seccionBusqueda = document.getElementById("buscarPartida");
  if (seccionBusqueda) {
    const campo = seccionBusqueda.querySelector("#" + id);
    if (campo) return campo;
  }

  return document.getElementById(id);
}

window.resetearBusquedaPartidas = function() {
  const ids = [
    "filtroFecha",
    "filtroTipo",
    "filtroGenero",
    "filtroNivelTipo",
    "filtroNivelDesde",
    "filtroNivelHasta",
    "filtroPista"
  ];

  ids.forEach(function(id) {
    const campo = getCampoBusquedaPartida(id);
    if (campo) {
      campo.value = "";
      if (campo.tagName === "SELECT") campo.selectedIndex = 0;
    }
  });

  const bloque = document.getElementById("bloqueNivelRango");
  if (bloque) bloque.style.display = "none";

  delete window.filtrosPartidas;
};

function cargarFiltroPistas() {
  const select = document.getElementById("filtroPista");
  if (!select) return;

  const primera = document.createElement("option");
  primera.value = "";
  primera.textContent = "Todas las pistas";
  select.replaceChildren(primera);

  db.collection("pistas").get().then(function(snapshot) {
    const fragment = document.createDocumentFragment();

    snapshot.forEach(function(doc) {
      const p = doc.data() || {};
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = (p.nombre || "Pista") + " - " + (p.localidad || "");
      fragment.appendChild(option);
    });

    select.appendChild(fragment);
  });
}

function aplicarFiltrosPartidas() {
  const tipoNivel = getCampoBusquedaPartida("filtroNivelTipo") ? getCampoBusquedaPartida("filtroNivelTipo").value : "";
  const desde = getCampoBusquedaPartida("filtroNivelDesde") ? getCampoBusquedaPartida("filtroNivelDesde").value : "";
  const hasta = getCampoBusquedaPartida("filtroNivelHasta") ? getCampoBusquedaPartida("filtroNivelHasta").value : "";

  if (tipoNivel === "rango") {
    const nDesde = parseFloat(desde);
    const nHasta = parseFloat(hasta);

    if (!isNaN(nDesde) && !isNaN(nHasta) && nDesde > nHasta) {
      alert("Nivel incorrecto");
      return;
    }
  }
 
  const filtroFecha = getCampoBusquedaPartida("filtroFecha").value;
  const elTipo = getCampoBusquedaPartida("filtroTipo");
  const filtroTipo = elTipo ? elTipo.value : "";
  const filtroGenero = getCampoBusquedaPartida("filtroGenero").value;
  const filtroPista = getCampoBusquedaPartida("filtroPista").value;

  window.vieneDeBusqueda = true; 
  window.filtrosPartidas = {
    fecha: filtroFecha || "",
    tipo: filtroTipo || "",
    genero: filtroGenero || "",
    pista: filtroPista || "",
    tipoNivel: tipoNivel || "",
    nivelDesde: desde || "",
    nivelHasta: hasta || ""
  };

  mostrar("partidas");
}

function cambiarFiltroNivel() {
  const tipo = getCampoBusquedaPartida("filtroNivelTipo").value;
  const bloque = document.getElementById("bloqueNivelRango");

  if (tipo === "rango") {
    bloque.style.display = "block";
  } else {
    bloque.style.display = "none";
  }
}

function limpiarFiltrosPartidas() {
  window.resetearBusquedaPartidas();
  cargarPartidas();
}

function verPista(id) {
  if (!id) return;

  localStorage.setItem("pistaSeleccionada", id);
  mostrar("pistas");
}

function obtenerSexoUsuarioPartidaTransaccion(transaction, uid) {
  return transaction.get(db.collection("usuarios").doc(uid)).then(function(docUsuario) {
    if (!docUsuario.exists) return "";
    return normalizarSexoPartida((docUsuario.data() || {}).sexo);
  });
}

function elegirReservaSustitutaPartidaTransaccion(transaction, p, reservas, uidSale) {
  if (!Array.isArray(reservas) || reservas.length === 0) return Promise.resolve(null);

  if (p.genero !== "mixto") return Promise.resolve(reservas[0]);

  return obtenerSexoUsuarioPartidaTransaccion(transaction, uidSale).then(function(sexoSale) {
    if (sexoSale !== "masculino" && sexoSale !== "femenino") return null;

    return Promise.all(reservas.map(function(uidReserva) {
      return obtenerSexoUsuarioPartidaTransaccion(transaction, uidReserva).then(function(sexoReserva) {
        return {
          uid: uidReserva,
          sexo: sexoReserva
        };
      });
    })).then(function(reservasDatos) {
      const reservaValida = reservasDatos.find(function(reserva) {
        return reserva.sexo === sexoSale;
      });

      return reservaValida ? reservaValida.uid : null;
    });
  });
}

function obtenerReservasCompatiblesPartidaTransaccion(transaction, p, reservas, uidSale) {
  const candidatas = arrayUnicoPartida(reservas);
  if (candidatas.length === 0) return Promise.resolve([]);
  if (p.genero !== "mixto") return Promise.resolve(candidatas);

  return obtenerSexoUsuarioPartidaTransaccion(transaction, uidSale).then(function(sexoSale) {
    if (sexoSale !== "masculino" && sexoSale !== "femenino") return [];

    return Promise.all(candidatas.map(function(uidReserva) {
      return obtenerSexoUsuarioPartidaTransaccion(transaction, uidReserva).then(function(sexoReserva) {
        return sexoReserva === sexoSale ? uidReserva : null;
      });
    })).then(function(resultados) {
      return resultados.filter(function(uidReserva) { return !!uidReserva; });
    });
  });
}

function ejecutarUnirseAPartidaTransaccional(partidaId, esReserva, ref, user) {
  return db.collection("usuarios").doc(user.uid).get().then(function(docUser) {
    if (!docUser.exists) return false;

    const datosUsuario = docUser.data() || {};
    const sexoUsuario = normalizarSexoPartida(datosUsuario.sexo);
    const nivelUsuario = parseFloat(datosUsuario.nivel);

    return db.runTransaction(function(transaction) {
      return transaction.get(ref).then(function(doc) {
        if (!doc.exists) return false;

        const p = doc.data() || {};
        const generoPartida = p.genero;

        if (partidaAlcanzoLimiteCancelacionClub(p)) {
          throw crearErrorLimiteCancelacionClubPartida();
        }

        if (p.estado === "pendiente_cancelacion_club") {
          throw new Error("Esta partida está pendiente de cancelación con el club y ya no admite nuevos jugadores.");
        }

        if (
          (generoPartida === "masculino" && sexoUsuario !== "masculino") ||
          (generoPartida === "femenino" && sexoUsuario !== "femenino")
        ) {
          throw new Error("No puedes unirte a esta partida por restricción de género");
        }

        if (p.nivel && typeof p.nivel === "object") {
          const desdeNum = parseFloat(p.nivel.desde);
          const hastaNum = parseFloat(p.nivel.hasta);

          if (isNaN(nivelUsuario) || nivelUsuario < desdeNum || nivelUsuario > hastaNum) {
            throw new Error("No puedes unirte a esta partida por restricción de nivel");
          }
        }

        let jugadores = arrayUnicoPartida(p.jugadores);
        let reservas = arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
          return !jugadores.includes(uidReserva);
        });
        const entraComoReserva = esReserva || jugadores.length >= 4;

        if (jugadores.includes(user.uid) || reservas.includes(user.uid)) return false;

        const completarEntrada = function() {
          if (partidaAlcanzoLimiteCancelacionClub(p)) {
            throw crearErrorLimiteCancelacionClubPartida();
          }

          const jugadoresAntes = jugadores.length;
          if (!esReserva) {
            if (jugadores.length < 4) jugadores.push(user.uid);
            else if (reservas.length < 2) reservas.push(user.uid);
            else throw new Error("La partida ya tiene el máximo de reservas");
          } else {
            if (reservas.length < 2) reservas.push(user.uid);
            else throw new Error("La partida ya tiene el máximo de reservas");
          }

          jugadores = arrayUnicoPartida(jugadores).slice(0, 4);
          reservas = arrayUnicoPartida(reservas).filter(function(uidReserva) {
            return !jugadores.includes(uidReserva);
          }).slice(0, 2);

          const datosUpdate = {
            jugadores: jugadores,
            reservas: reservas
          };

          if (!entraComoReserva && jugadores.length === 4 && p.sustitucionPendiente === true) {
            Object.assign(datosUpdate, datosSustitucionResueltaPartida());
          }
          if (!entraComoReserva && jugadores.length === 4 && partidaConfirmadaConPlazaLibre(p)) {
            Object.assign(datosUpdate, datosPartidaCompletaPartida());
          }

          transaction.update(ref, datosUpdate);
          return {
            jugadores: jugadores,
            reservas: reservas,
            jugadoresAntes: jugadoresAntes,
            entroComoReserva: entraComoReserva,
            estado: p.estado || null,
            creadaPor: p.creadaPor || null,
            creador: p.creador || null,
            fecha: p.fecha || null,
            hora: p.hora || null,
            partidaConfirmadaCompletada:
              !entraComoReserva &&
              jugadoresAntes < 4 &&
              jugadores.length === 4 &&
              p.estado === "confirmada"
          };
        };

        if (generoPartida === "mixto") {
          const participantes = entraComoReserva ? reservas : jugadores;

          return Promise.all(participantes.map(function(uid) {
            return transaction.get(db.collection("usuarios").doc(uid));
          })).then(function(docsUsuarios) {
            let hombres = 0;
            let mujeres = 0;

            docsUsuarios.forEach(function(docParticipante) {
              if (!docParticipante.exists) return;

              const sexoParticipante = normalizarSexoPartida((docParticipante.data() || {}).sexo);
              if (sexoParticipante === "masculino") hombres++;
              if (sexoParticipante === "femenino") mujeres++;
            });

            if (entraComoReserva && (
              (sexoUsuario === "masculino" && hombres >= 1) ||
              (sexoUsuario === "femenino" && mujeres >= 1)
            )) {
              throw new Error("En partidas mixtas solo puede haber un reserva masculino y una reserva femenina.");
            }

            if (!entraComoReserva && (
              (sexoUsuario === "masculino" && hombres >= 2) ||
              (sexoUsuario === "femenino" && mujeres >= 2)
            )) {
              throw new Error("Esta partida es mixta. Debe haber un máximo de 2 hombres y 2 mujeres.");
            }

            return completarEntrada();
          });
        }

        return completarEntrada();
      });
    });
  }).then(function(actualizada) {
    if (actualizada) {
      console.log("[unirse] UPDATE OK");
      const avisos = [];
      if (!actualizada.entroComoReserva && actualizada.jugadoresAntes < 4 && actualizada.jugadores.length === 4 && actualizada.estado === "abierta") {
        const creadorAviso = actualizada.creadaPor || actualizada.creador || null;

        if (creadorAviso) {
          avisos.push(notificarPartida(creadorAviso, {
            tipo: "partida_completa",
            titulo: "Partida completa",
            mensaje: "La partida ya tiene 4 jugadores. Recuerda realizar la reserva en el club y confirmar la partida. Si ya no hay disponibilidad en el club para esa fecha y hora, cancela la partida.",
            partidaId: partidaId,
            accion: "abrir_partida",
            dedupeKey: "partida_completa_" + partidaId,
            prioridad: "alta",
            emailCritico: true,
            data: { jugadores: actualizada.jugadores }
          }));
        } else {
          console.warn("[partida_completa] No se pudo crear aviso: partida sin creador fiable", {
            partidaId: partidaId,
            creadaPor: actualizada.creadaPor,
            creador: actualizada.creador
          });
        }
      }
      if (actualizada.partidaConfirmadaCompletada) {
        avisos.push(notificarPartida(actualizada.jugadores.concat(actualizada.reservas || []), {
          tipo: "partida_completa_confirmada",
          titulo: "Partida completa",
          mensaje: "Partida completa.",
          partidaId: partidaId,
          accion: "abrir_partida",
          dedupeKey: "partida_completa_confirmada_" + partidaId,
          prioridad: "alta",
          data: { jugadores: actualizada.jugadores }
        }));
      }

      Promise.all(avisos).then(function() {
        cargarPartidas();
      });
    }
  }).catch(function(error) {
    if (esErrorLimiteCancelacionClubPartida(error)) {
      return forzarCancelacionClubTrasAccionBloqueada(partidaId).then(function() {
        alert(error.message);
      });
    }
    alert(error && error.message ? error.message : "No se pudo unir a la partida");
  });
}

function resolverAvisosSolicitudSustitucionPartida(partidaId, datos) {
  if (typeof window.resolverNotificacionPorDedupe !== "function" || !datos) {
    return Promise.resolve(false);
  }

  const uidSolicita = datos.uidSolicita;
  const creador = datos.creadaPor;
  const reservas = arrayUnicoPartida(datos.reservasCompatibles);
  const participantes = arrayUnicoPartida(datos.participantes).filter(function(uid) {
    return uid !== uidSolicita && uid !== creador && !reservas.includes(uid);
  });
  const tareas = [];

  reservas.forEach(function(uidReserva) {
    tareas.push(window.resolverNotificacionPorDedupe(
      uidReserva,
      "solicitud_sustitucion_reserva_" + partidaId + "_" + uidSolicita
    ));
  });
  if (creador) {
    tareas.push(window.resolverNotificacionPorDedupe(
      creador,
      "solicitud_sustitucion_creador_" + partidaId + "_" + uidSolicita
    ));
  }
  participantes.forEach(function(uidParticipante) {
    tareas.push(window.resolverNotificacionPorDedupe(
      uidParticipante,
      "solicitud_sustitucion_participante_" + partidaId + "_" + uidSolicita
    ));
  });

  return Promise.all(tareas).catch(function(error) {
    console.warn("No se pudieron resolver los avisos de solicitud de sustitución:", error.message);
    return false;
  });
}

function solicitarSustitutoPartida(partidaId) {
  const user = firebase.auth().currentUser;
  if (!user) return Promise.resolve();

  const ref = db.collection("partidas").doc(partidaId);
  return db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) throw new Error("La partida ya no existe");

      const p = doc.data() || {};
      if (partidaAlcanzoLimiteCancelacionClub(p)) {
        throw crearErrorLimiteCancelacionClubPartida();
      }

      const jugadores = arrayUnicoPartida(p.jugadores);
      const reservas = arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
        return !jugadores.includes(uidReserva);
      });

      if (p.estado !== "confirmada") {
        throw new Error("Solo se puede solicitar sustituto en una partida confirmada.");
      }
      if (p.creadaPor === user.uid) {
        throw new Error("El creador no puede solicitar sustituto porque es responsable de la reserva del club.");
      }
      if (!jugadores.includes(user.uid)) {
        throw new Error("Solo un jugador titular puede solicitar sustituto.");
      }
      if (tieneSustitucionPendientePartida(p)) {
        throw new Error("Ya hay otra sustitución pendiente en esta partida.");
      }
      if (tieneSolicitudSustitucionPartida(p)) {
        if (p.solicitudSustitucionUid === user.uid) {
          throw new Error("Ya has solicitado un sustituto. Sigues ocupando tu plaza hasta que alguien acepte.");
        }
        throw new Error("Ya hay una solicitud de sustituto pendiente en esta partida.");
      }
      if (p.resultado || (p.valoraciones && Object.keys(p.valoraciones).length > 0)) {
        throw new Error("No se puede solicitar sustituto con el resultado o las valoraciones iniciadas.");
      }

      return obtenerReservasCompatiblesPartidaTransaccion(transaction, p, reservas, user.uid)
        .then(function(reservasCompatibles) {
          transaction.update(ref, {
            solicitudSustitucionEstado: "solicitud_sustitucion_pendiente",
            solicitudSustitucionUid: user.uid,
            solicitudSustitucionAt: firebase.firestore.FieldValue.serverTimestamp(),
            solicitudSustitucionReservasCompatibles: reservasCompatibles
          });

          return {
            uidSolicita: user.uid,
            creadaPor: p.creadaPor || p.creador || null,
            jugadores: jugadores,
            reservas: reservas,
            reservasCompatibles: reservasCompatibles,
            fecha: p.fecha || null,
            hora: p.hora || null
          };
        });
    });
  }).then(function(actualizada) {
    const participantes = arrayUnicoPartida(actualizada.jugadores.concat(actualizada.reservas));
    const otrosParticipantes = participantes.filter(function(uidParticipante) {
      return uidParticipante !== actualizada.uidSolicita &&
        uidParticipante !== actualizada.creadaPor &&
        !actualizada.reservasCompatibles.includes(uidParticipante);
    });
    const avisos = [];

    if (actualizada.reservasCompatibles.length > 0) {
      avisos.push(notificarPartida(actualizada.reservasCompatibles, {
        tipo: "solicitud_sustitucion_reserva",
        titulo: "Solicitud de sustituto",
        mensaje: "Un jugador solicita sustituto en una partida confirmada. Puedes aceptar ocupar su plaza.",
        partidaId: partidaId,
        accion: "abrir_partida",
        dedupeKey: "solicitud_sustitucion_reserva_" + partidaId + "_" + actualizada.uidSolicita,
        prioridad: "alta",
        emailCritico: true,
        data: { uidSolicita: actualizada.uidSolicita }
      }));
    }
    if (actualizada.creadaPor) {
      avisos.push(notificarPartida(actualizada.creadaPor, {
        tipo: "solicitud_sustitucion_creador",
        titulo: "Solicitud de sustituto",
        mensaje: "Un jugador ha solicitado sustituto. La partida sigue confirmada y necesita que alguien ocupe esa plaza antes del límite.",
        partidaId: partidaId,
        accion: "abrir_partida",
        dedupeKey: "solicitud_sustitucion_creador_" + partidaId + "_" + actualizada.uidSolicita,
        prioridad: "alta",
        emailCritico: true,
        data: { uidSolicita: actualizada.uidSolicita }
      }));
    }
    if (otrosParticipantes.length > 0) {
      avisos.push(notificarPartida(otrosParticipantes, {
        tipo: "solicitud_sustitucion_participante",
        titulo: "Solicitud de sustituto",
        mensaje: "Un jugador solicita sustituto. Sigue formando parte de la partida hasta que alguien acepte ocupar su plaza.",
        partidaId: partidaId,
        accion: "abrir_partida",
        dedupeKey: "solicitud_sustitucion_participante_" + partidaId + "_" + actualizada.uidSolicita,
        data: { uidSolicita: actualizada.uidSolicita }
      }));
    }

    return Promise.all(avisos).then(function() {
      cargarPartidas();
    });
  }).catch(function(error) {
    if (esErrorLimiteCancelacionClubPartida(error)) {
      return forzarCancelacionClubTrasAccionBloqueada(partidaId).then(function() {
        alert(error.message);
      });
    }
    alert(error && error.message ? error.message : "No se pudo solicitar sustituto");
  });
}

function ejecutarSalirDePartidaTransaccional(partidaId, ref, uid, opciones) {
  opciones = opciones || {};
  const confirmarCreador = opciones.confirmarCreador !== false;
  const refrescar = opciones.refrescar !== false;
  const silencioso = opciones.silencioso === true;
  const propagarError = opciones.propagarError === true;
  let penalizacionAbandono = null;

  return ref.get().then(function(docInicial) {
    if (!docInicial.exists) return;

    const pInicial = docInicial.data() || {};
    if (partidaAlcanzoLimiteCancelacionClub(pInicial)) {
      throw crearErrorLimiteCancelacionClubPartida();
    }

    if (pInicial.cambioCreadorPendiente === true) {
      const mensaje = "La partida necesita un nuevo creador antes de permitir salidas.";
      if (!silencioso) alert(mensaje);
      if (propagarError) throw new Error(mensaje);
      return;
    }

    if (pInicial.sustitucionPendiente === true && arrayUnicoPartida(pInicial.jugadores).includes(uid)) {
      const mensaje = "Hay una sustitución pendiente de aceptar o rechazar. Espera a que se resuelva antes de realizar otra salida.";
      if (!silencioso) alert(mensaje);
      if (propagarError) throw new Error(mensaje);
      return;
    }

    if (pInicial.creadaPor === uid && pInicial.estado === "confirmada") {
      const mensaje = "No puedes abandonar una partida confirmada porque eres el responsable de la reserva realizada en el club.";
      if (!silencioso) alert(mensaje);
      if (propagarError) throw new Error(mensaje);
      return;
    }

    if (
      pInicial.estado === "confirmada" &&
      pInicial.creadaPor !== uid &&
      arrayUnicoPartida(pInicial.jugadores).includes(uid)
    ) {
      if (!silencioso && opciones.abandonoConfirmado !== true) {
        throw new Error("Debes elegir Solicitar sustituto o Salir con penalización.");
      }

      penalizacionAbandono = crearPenalizacionPartida(
        partidaId,
        uid,
        "abandono_confirmada",
        "Abandono de una partida confirmada"
      );
    }

    if (pInicial.creadaPor === uid && pInicial.estado === "abierta") {
      const jugadoresIniciales = arrayUnicoPartida(pInicial.jugadores);
      const titularesRestantes = jugadoresIniciales.filter(function(jugadorUid) {
        return jugadorUid !== uid;
      });
      const cambioCreadorCaducaAt = obtenerCaducidadCambioCreadorPartida(pInicial);
      const ahora = new Date();
      const debeEliminar = titularesRestantes.length === 0 || !cambioCreadorCaducaAt || ahora >= cambioCreadorCaducaAt;

      if (debeEliminar) {
        const mensajeCancelar = titularesRestantes.length === 0
          ? "Eres el único jugador de esta partida. Si sales, la partida se eliminará. ¿Continuar?"
          : "Faltan menos de 8 horas para la partida. Si el creador abandona ahora, la partida se cancelará. ¿Continuar?";
        const ok = confirmarCreador
          ? confirm(mensajeCancelar)
          : true;
        if (!ok) return;

        return notificarPartida(titularesRestantes.concat(pInicial.reservas || []), {
          tipo: "partida_cancelada",
          titulo: "Partida cancelada",
          mensaje: "La partida del " + textoFechaAvisoPartida(pInicial) + " se ha cancelado.",
          partidaId: partidaId,
          accion: "abrir_partida",
          dedupeKey: "partida_cancelada_" + partidaId,
          prioridad: "alta",
          data: { motivo: titularesRestantes.length === 0 ? "sin_jugadores" : "menos_8h" }
        }).then(function() {
          return eliminarPartidaConChat(partidaId);
        }).then(function(borrada) {
          if (!borrada && propagarError) throw new Error("No se pudo cancelar la partida del creador.");
          if (borrada && refrescar) cargarPartidas();
        });
      }

      return ref.update({
        jugadores: titularesRestantes,
        cambioCreadorPendiente: true,
        creadorAnterior: uid,
        cambioCreadorDesde: firebase.firestore.FieldValue.serverTimestamp(),
        cambioCreadorCaducaAt: cambioCreadorCaducaAt,
        cambioCreadorCandidatos: titularesRestantes
      }).then(function() {
        return notificarPartida(titularesRestantes, {
          tipo: "cambio_creador_pendiente",
          titulo: "La partida necesita un nuevo creador",
          mensaje: "El creador ha abandonado la partida. El primero que acepte será el nuevo responsable.",
          partidaId: partidaId,
          accion: "aceptar_ser_creador",
          dedupeKey: "cambio_creador_pendiente_" + partidaId,
          prioridad: "alta",
          emailCritico: true,
          data: {
            creadorAnterior: uid,
            candidatos: titularesRestantes
          }
        });
      }).then(function() {
        if (refrescar) cargarPartidas();
      });
    }

    return db.runTransaction(function(transaction) {
      return transaction.get(ref).then(function(doc) {
        if (!doc.exists) return false;

        const p = doc.data() || {};
        if (partidaAlcanzoLimiteCancelacionClub(p)) {
          throw crearErrorLimiteCancelacionClubPartida();
        }

        let jugadores = arrayUnicoPartida(p.jugadores);
        let reservas = arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
          return !jugadores.includes(uidReserva);
        });

        if (p.cambioCreadorPendiente === true) {
          throw new Error("La partida necesita un nuevo creador antes de permitir salidas.");
        }

        if (p.sustitucionPendiente === true && jugadores.includes(uid)) {
          throw new Error("Hay una sustitución pendiente de aceptar o rechazar. Espera a que se resuelva antes de realizar otra salida.");
        }

        if (p.creadaPor === uid && (p.estado === "abierta" || p.estado === "confirmada")) {
          throw new Error("El creador debe cancelar la partida para salir.");
        }

        if (
          p.estado === "confirmada" &&
          (
            p.resultado ||
            (p.valoraciones && Object.keys(p.valoraciones).length > 0)
          )
        ) {
          throw new Error("No se puede abandonar una partida con resultado o valoraciones iniciadas.");
        }

        if (jugadores.includes(uid)) {
          const indiceSale = jugadores.indexOf(uid);
          const aplicaPenalizacionAbandono =
            p.estado === "confirmada" &&
            p.creadaPor !== uid &&
            !!penalizacionAbandono;

          return elegirReservaSustitutaPartidaTransaccion(transaction, p, reservas, uid).then(function(uidReservaSustituta) {
            if (partidaAlcanzoLimiteCancelacionClub(p)) {
              throw crearErrorLimiteCancelacionClubPartida();
            }

            const datosUpdate = Object.assign({}, datosSolicitudSustitucionResueltaPartida());
            jugadores = jugadores.filter(function(j) { return j !== uid; });

            if (uidReservaSustituta) {
              jugadores.splice(indiceSale, 0, uidReservaSustituta);
              reservas = reservas.filter(function(r) { return r !== uidReservaSustituta; });
              Object.assign(datosUpdate, datosSustitucionReservaPendientePartida(uid, uidReservaSustituta));
            } else if (p.estado === "confirmada") {
              Object.assign(datosUpdate, datosSustitucionResueltaPartida(), datosPartidaIncompletaPartida(uid));
            } else {
              Object.assign(datosUpdate, datosSustitucionResueltaPartida());
            }

            datosUpdate.jugadores = arrayUnicoPartida(jugadores).slice(0, 4);
            datosUpdate.reservas = arrayUnicoPartida(reservas).filter(function(uidReserva) {
              return !datosUpdate.jugadores.includes(uidReserva);
            }).slice(0, 2);
            if (uidReservaSustituta) {
              Object.assign(datosUpdate, datosPartidaCompletaPartida());
            }
            if (aplicaPenalizacionAbandono) {
              datosUpdate.abandonosConPenalizacion = firebase.firestore.FieldValue.arrayUnion({
                uid: uid,
                penalizacionId: penalizacionAbandono.id,
                createdAt: penalizacionAbandono.createdAt
              });
            }

            function finalizarSalidaPartida(docUsuario) {
              transaction.update(ref, datosUpdate);

              if (aplicaPenalizacionAbandono) {
                const datosUsuario = docUsuario && docUsuario.exists ? (docUsuario.data() || {}) : {};
                const datosClasificacion = datosClasificacionPenalizaciones(datosUsuario, [penalizacionAbandono]);

                transaction.update(db.collection("usuarios").doc(uid), Object.assign({}, datosClasificacion.update, {
                  "clasificacion.abandonos": firebase.firestore.FieldValue.increment(1),
                  penalizaciones: firebase.firestore.FieldValue.arrayUnion(penalizacionAbandono)
                }));
              }

              return {
                tipoAviso: uidReservaSustituta
                  ? "reserva_pendiente_aceptar"
                  : (!uidReservaSustituta && p.estado === "confirmada" ? "sin_reserva_compatible" : null),
                uidReservaSustituta: uidReservaSustituta || null,
                uidSale: uid,
                jugadores: datosUpdate.jugadores,
                reservas: datosUpdate.reservas,
                reservasSolicitudAnterior: arrayUnicoPartida(p.solicitudSustitucionReservasCompatibles),
                solicitudAnteriorUid: p.solicitudSustitucionUid || null,
                participantesSolicitudAnterior: arrayUnicoPartida(p.jugadores).concat(p.reservas || []),
                creadaPor: p.creadaPor || p.creador || null,
                fecha: p.fecha || null,
                hora: p.hora || null,
                penalizacionAbandono: aplicaPenalizacionAbandono ? penalizacionAbandono : null,
                cancelarAutomaticamente5h: partidaConfirmadaAlcanzoVentana5h(p)
              };
            }

            if (!aplicaPenalizacionAbandono) {
              return finalizarSalidaPartida(null);
            }

            return transaction.get(db.collection("usuarios").doc(uid)).then(finalizarSalidaPartida);
          });
        }

        if (reservas.includes(uid)) {
          reservas = reservas.filter(function(r) { return r !== uid; });
          transaction.update(ref, {
            reservas: arrayUnicoPartida(reservas).slice(0, 2)
          });
          return { tipoAviso: null };
        }

        return false;
      });
    }).then(function(actualizada) {
      if (!actualizada) return;

      let aviso = Promise.resolve();
      const resolverSolicitudAnterior = actualizada.solicitudAnteriorUid
        ? resolverAvisosSolicitudSustitucionPartida(partidaId, {
            uidSolicita: actualizada.solicitudAnteriorUid,
            creadaPor: actualizada.creadaPor,
            reservasCompatibles: actualizada.reservasSolicitudAnterior,
            participantes: actualizada.participantesSolicitudAnterior
          })
        : Promise.resolve(false);
      if (actualizada.tipoAviso === "reserva_pendiente_aceptar") {
        aviso = Promise.all([
          notificarPartida(actualizada.uidReservaSustituta, {
            tipo: "reserva_pendiente_aceptar",
            titulo: "Confirma tu plaza",
            mensaje: "Has sido propuesto para cubrir una baja en una partida. Confirma si puedes jugar.",
            partidaId: partidaId,
            accion: "abrir_partida",
            dedupeKey: "reserva_pendiente_aceptar_" + partidaId + "_" + actualizada.uidReservaSustituta,
            prioridad: "alta",
            emailCritico: true,
            data: { sale: actualizada.uidSale }
          }),
          notificarPartida(actualizada.creadaPor, {
            tipo: "reserva_pendiente_aceptar",
            titulo: "Jugador pendiente de aceptar",
            mensaje: "Una reserva ha sido propuesta para cubrir una baja. No podrás confirmar la partida hasta que responda.",
            partidaId: partidaId,
            accion: "abrir_partida",
            dedupeKey: "reserva_pendiente_creador_" + partidaId + "_" + actualizada.uidReservaSustituta,
            prioridad: "alta",
            emailCritico: true,
            data: {
              uidReserva: actualizada.uidReservaSustituta,
              sale: actualizada.uidSale
            }
          })
        ]);
      } else if (actualizada.tipoAviso === "sin_reserva_compatible") {
        aviso = notificarPartida(actualizada.jugadores.concat(actualizada.creadaPor || []), {
          tipo: "sin_reserva_compatible",
          titulo: "Falta cubrir una plaza",
          mensaje: "Falta 1 jugador para completar la partida.",
          partidaId: partidaId,
          accion: "abrir_partida",
          dedupeKey: "sin_reserva_compatible_" + partidaId + "_" + actualizada.uidSale,
          prioridad: "alta",
          emailCritico: true,
          data: { sale: actualizada.uidSale }
        });
      }

      return resolverSolicitudAnterior.then(function() {
        return aviso;
      }).then(function() {
        if (!actualizada.penalizacionAbandono) return null;

        return notificarPartida(actualizada.uidSale, {
          tipo: "penalizacion_abandono_confirmada",
          titulo: "Penalización por abandono",
          mensaje: "Has abandonado una partida confirmada. Se ha registrado una penalización activa durante 180 días.",
          partidaId: partidaId,
          accion: "abrir_partida",
          dedupeKey: "penalizacion_abandono_confirmada_" + partidaId + "_" + actualizada.uidSale,
          prioridad: "alta",
          emailCritico: true,
          data: {
            penalizacionId: actualizada.penalizacionAbandono.id,
            tipo: actualizada.penalizacionAbandono.tipo,
            puntos: actualizada.penalizacionAbandono.puntos,
            caducaAt: actualizada.penalizacionAbandono.caducaAt
          }
        });
      }).then(function() {
        if (actualizada.cancelarAutomaticamente5h) {
          return procesarLimiteCancelacionClubPartida(partidaId).then(function() {
            if (refrescar) cargarPartidas();
          });
        }
        if (refrescar) cargarPartidas();
      });
    });
  }).catch(function(error) {
    if (esErrorLimiteCancelacionClubPartida(error)) {
      return forzarCancelacionClubTrasAccionBloqueada(partidaId).then(function() {
        if (!silencioso) alert(error.message);
        if (propagarError) throw error;
      });
    }
    if (!silencioso) alert(error && error.message ? error.message : "No se pudo salir de la partida");
    if (propagarError) throw error;
  });
}

function aceptarCambioCreadorPartida(idPartida) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const ref = db.collection("partidas").doc(idPartida);

  return db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) throw new Error("La partida ya no existe");

      const p = doc.data() || {};
      const candidatos = arrayUnicoPartida(p.cambioCreadorCandidatos);

      if (p.cambioCreadorPendiente !== true) {
        throw new Error("El cambio de creador ya no está disponible.");
      }

      if (p.estado !== "abierta") {
        throw new Error("Esta partida ya no admite cambio de creador.");
      }

      if (!candidatos.includes(user.uid)) {
        throw new Error("Solo los jugadores titulares restantes pueden aceptar ser creador.");
      }

      const jugadores = arrayUnicoPartida(p.jugadores);
      if (!jugadores.includes(user.uid)) {
        throw new Error("Solo los jugadores titulares restantes pueden aceptar ser creador.");
      }

      transaction.update(ref, {
        creadaPor: user.uid,
        creador: user.uid,
        cambioCreadorPendiente: false,
        creadorAnterior: null,
        cambioCreadorDesde: null,
        cambioCreadorCaducaAt: null,
        cambioCreadorCandidatos: []
      });

      return {
        candidatos: candidatos,
        creadorAnterior: p.creadorAnterior || null,
        estado: p.estado || null,
        jugadores: jugadores,
        fecha: p.fecha || null,
        hora: p.hora || null
      };
    });
  }).then(function(resultado) {
    if (!resultado) return;

    const avisos = [
      notificarPartida(resultado.candidatos.concat(resultado.creadorAnterior || []), {
        tipo: "cambio_creador_aceptado",
        titulo: "Nuevo creador de partida",
        mensaje: "La partida del " + textoFechaAvisoPartida(resultado) + " ya tiene nuevo creador.",
        partidaId: idPartida,
        accion: "abrir_partida",
        dedupeKey: "cambio_creador_aceptado_" + idPartida,
        data: { nuevoCreador: user.uid }
      })
    ];

    if (resultado.estado === "abierta" && resultado.jugadores.length === 4) {
      avisos.push(notificarPartida(user.uid, {
        tipo: "partida_completa",
        titulo: "Partida completa",
        mensaje: "Tu partida ya tiene 4 jugadores. Recuerda realizar la reserva en el club y confirmar la partida. Si no hay disponibilidad en el club, debes cancelar la partida.",
        partidaId: idPartida,
        accion: "abrir_partida",
        dedupeKey: "partida_completa_" + idPartida,
        prioridad: "alta",
        emailCritico: true,
        data: { jugadores: resultado.jugadores }
      }));
    }

    return Promise.all(avisos).then(function() {
      cargarPartidas();
    });
  }).catch(function(error) {
    alert(error && error.message ? error.message : "No se pudo aceptar ser creador");
  });
}

function aceptarSustitucionPartida(idPartida) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const ref = db.collection("partidas").doc(idPartida);

  db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) return false;

      const p = doc.data() || {};
      if (partidaAlcanzoLimiteCancelacionClub(p)) {
        throw crearErrorLimiteCancelacionClubPartida();
      }

      if (p.estado === "pendiente_cancelacion_club") {
        throw new Error("La partida ya está pendiente de cancelación con el club.");
      }
      if (tieneSolicitudSustitucionPartida(p)) {
        const uidSale = p.solicitudSustitucionUid;
        const compatibles = arrayUnicoPartida(p.solicitudSustitucionReservasCompatibles);
        const jugadoresSolicitud = arrayUnicoPartida(p.jugadores);
        const reservasSolicitud = arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
          return !jugadoresSolicitud.includes(uidReserva);
        });

        if (p.estado !== "confirmada") {
          throw new Error("Esta solicitud de sustituto ya no está disponible.");
        }
        if (!compatibles.includes(user.uid) || !reservasSolicitud.includes(user.uid)) {
          throw new Error("No figuras como reserva compatible para esta sustitución.");
        }
        const indiceSale = jugadoresSolicitud.indexOf(uidSale);
        if (indiceSale < 0) {
          throw new Error("El jugador que solicitó sustituto ya no ocupa la plaza.");
        }

        if (partidaAlcanzoLimiteCancelacionClub(p)) {
          throw crearErrorLimiteCancelacionClubPartida();
        }

        jugadoresSolicitud.splice(indiceSale, 1, user.uid);
        const reservasActualizadas = reservasSolicitud.filter(function(uidReserva) {
          return uidReserva !== user.uid;
        });
        transaction.update(ref, Object.assign({
          estado: "confirmada",
          jugadores: jugadoresSolicitud.slice(0, 4),
          reservas: reservasActualizadas.slice(0, 2)
        }, datosSolicitudSustitucionResueltaPartida(), datosSustitucionResueltaPartida(), datosPartidaCompletaPartida()));

        return {
          modo: "solicitud",
          uidReserva: user.uid,
          uidSale: uidSale,
          jugadores: jugadoresSolicitud.slice(0, 4),
          reservas: reservasActualizadas.slice(0, 2),
          reservasCompatibles: compatibles,
          participantesAnteriores: arrayUnicoPartida(p.jugadores).concat(p.reservas || []),
          creadaPor: p.creadaPor || p.creador || null,
          fecha: p.fecha || null,
          hora: p.hora || null
        };
      }

      if (p.sustitucionTipo !== "reserva_subida_pendiente_aceptar") {
        throw new Error("No hay sustitución pendiente de aceptar.");
      }

      if (p.sustitucionEntraUid !== user.uid) {
        throw new Error("Solo el reserva propuesto puede aceptar la sustitución.");
      }

      const jugadores = arrayUnicoPartida(p.jugadores);
      if (p.estado !== "confirmada" && p.estado !== "abierta") {
        throw new Error("Esta sustitución ya no está disponible.");
      }
      if (!jugadores.includes(user.uid)) {
        throw new Error("El reserva propuesto no figura como jugador de la partida.");
      }

      if (partidaAlcanzoLimiteCancelacionClub(p)) {
        throw crearErrorLimiteCancelacionClubPartida();
      }

      transaction.update(ref, Object.assign({
        estado: p.estado === "confirmada" ? "confirmada" : "abierta",
        jugadores: jugadores.slice(0, 4),
        reservas: arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
          return !jugadores.includes(uidReserva);
        }).slice(0, 2)
      }, datosSustitucionResueltaPartida()));

      return {
        modo: "abandono",
        uidReserva: user.uid,
        jugadores: jugadores.slice(0, 4),
        creadaPor: p.creadaPor || p.creador || null,
        fecha: p.fecha || null,
        hora: p.hora || null
      };
    });
  }).then(function(actualizada) {
    if (!actualizada) return;

    if (actualizada.modo === "solicitud") {
      const destinatariosSolicitud = arrayUnicoPartida(
        actualizada.jugadores
          .concat(actualizada.reservas)
          .concat(actualizada.uidSale || [])
          .concat(actualizada.creadaPor || [])
      );
      return resolverAvisosSolicitudSustitucionPartida(idPartida, {
        uidSolicita: actualizada.uidSale,
        creadaPor: actualizada.creadaPor,
        reservasCompatibles: actualizada.reservasCompatibles,
        participantes: actualizada.participantesAnteriores
      }).then(function() {
        return notificarPartida(destinatariosSolicitud, {
          tipo: "sustitucion_confirmada",
          titulo: "Sustitución confirmada",
          mensaje: "Sustitución confirmada.",
          partidaId: idPartida,
          accion: "abrir_partida",
          dedupeKey: "sustitucion_confirmada_" + idPartida + "_" + actualizada.uidSale,
          prioridad: "alta",
          emailCritico: true,
          data: {
            uidSale: actualizada.uidSale,
            uidEntra: actualizada.uidReserva
          }
        });
      }).then(function() {
        cargarPartidas();
      });
    }

    const destinatarios = arrayUnicoPartida(actualizada.jugadores.concat(actualizada.creadaPor || [])).filter(function(uid) {
      return uid !== actualizada.uidReserva;
    });
    const dedupePendiente = "reserva_pendiente_aceptar_" + idPartida + "_" + actualizada.uidReserva;
    const dedupeCreador = "reserva_pendiente_creador_" + idPartida + "_" + actualizada.uidReserva;
    const resolverPendiente = typeof window.resolverNotificacionPorDedupe === "function"
      ? Promise.all([
          window.resolverNotificacionPorDedupe(actualizada.uidReserva, dedupePendiente),
          window.resolverNotificacionPorDedupe(actualizada.creadaPor, dedupeCreador)
        ]).catch(function(error) {
          console.warn("No se pudieron resolver los avisos pendientes de reserva:", error.message);
          return false;
        })
      : Promise.resolve(false);

    return resolverPendiente.then(function() {
      return notificarPartida(destinatarios, {
        tipo: "reserva_subida_titular",
        titulo: "Reserva confirmada",
        mensaje: "La reserva ha confirmado su participación y la partida vuelve a estar completa.",
        partidaId: idPartida,
        accion: "abrir_partida",
        dedupeKey: "reserva_subida_titular_" + idPartida + "_" + actualizada.uidReserva,
        prioridad: "alta",
        emailCritico: true,
        data: { uidReserva: actualizada.uidReserva }
      });
    }).then(function() {
      cargarPartidas();
    });
  }).catch(function(error) {
    if (esErrorLimiteCancelacionClubPartida(error)) {
      return forzarCancelacionClubTrasAccionBloqueada(idPartida).then(function() {
        alert(error.message);
      });
    }
    alert(error && error.message ? error.message : "No se pudo aceptar la sustitución");
  });
}

function rechazarSustitucionPartida(idPartida) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const ref = db.collection("partidas").doc(idPartida);

  db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) return false;

      const p = doc.data() || {};
      if (partidaAlcanzoLimiteCancelacionClub(p)) {
        throw crearErrorLimiteCancelacionClubPartida();
      }

      if (p.sustitucionTipo !== "reserva_subida_pendiente_aceptar") {
        throw new Error("No hay sustitución pendiente de aceptar.");
      }

      if (p.sustitucionEntraUid !== user.uid) {
        throw new Error("Solo el reserva propuesto puede rechazar la sustitución.");
      }

      const uidSale = p.sustitucionSaleUid;
      let jugadores = arrayUnicoPartida(p.jugadores);
      let reservas = arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
        return !jugadores.includes(uidReserva);
      });
      const indiceRechaza = jugadores.indexOf(user.uid);

      jugadores = jugadores.filter(function(uidJugador) {
        return uidJugador !== user.uid;
      });
      const jugadoresTrasRechazo = jugadores.slice();

      return elegirReservaSustitutaPartidaTransaccion(transaction, p, reservas, uidSale).then(function(nuevoReservaUid) {
        if (partidaAlcanzoLimiteCancelacionClub(p)) {
          throw crearErrorLimiteCancelacionClubPartida();
        }

        const datosUpdate = {
          estado: p.estado === "confirmada" ? "confirmada" : "abierta"
        };

        if (nuevoReservaUid) {
          const indiceInsercion = indiceRechaza >= 0 ? indiceRechaza : jugadores.length;
          jugadores.splice(indiceInsercion, 0, nuevoReservaUid);
          reservas = reservas.filter(function(uidReserva) {
            return uidReserva !== nuevoReservaUid;
          });
          Object.assign(datosUpdate, datosSustitucionReservaPendientePartida(uidSale, nuevoReservaUid));
        } else if (p.estado === "confirmada") {
          Object.assign(datosUpdate, datosSustitucionResueltaPartida(), datosPartidaIncompletaPartida(uidSale));
        } else {
          Object.assign(datosUpdate, datosSustitucionResueltaPartida());
        }

        datosUpdate.jugadores = arrayUnicoPartida(jugadores).slice(0, 4);
        datosUpdate.reservas = arrayUnicoPartida(reservas).filter(function(uidReserva) {
          return !datosUpdate.jugadores.includes(uidReserva);
        }).slice(0, 2);

        transaction.update(ref, datosUpdate);
        return {
          uidReservaRechaza: user.uid,
          uidNuevaReserva: nuevoReservaUid || null,
          uidSale: uidSale,
          jugadoresTrasRechazo: jugadoresTrasRechazo,
          creadaPor: p.creadaPor || p.creador || null,
          fecha: p.fecha || null,
          hora: p.hora || null
        };
      });
    });
  }).then(function(actualizada) {
    if (!actualizada) return;

    const destinatariosRechazo = arrayUnicoPartida(actualizada.jugadoresTrasRechazo.concat(actualizada.creadaPor || [])).filter(function(uid) {
      return uid !== actualizada.uidReservaRechaza;
    });
    const dedupePendiente = "reserva_pendiente_aceptar_" + idPartida + "_" + actualizada.uidReservaRechaza;
    const dedupeCreador = "reserva_pendiente_creador_" + idPartida + "_" + actualizada.uidReservaRechaza;
    const resolverPendiente = typeof window.resolverNotificacionPorDedupe === "function"
      ? Promise.all([
          window.resolverNotificacionPorDedupe(actualizada.uidReservaRechaza, dedupePendiente),
          window.resolverNotificacionPorDedupe(actualizada.creadaPor, dedupeCreador)
        ]).catch(function(error) {
          console.warn("No se pudieron resolver los avisos pendientes de reserva:", error.message);
          return false;
        })
      : Promise.resolve(false);
    const avisos = [
      notificarPartida(destinatariosRechazo, {
        tipo: "reserva_rechazada",
        titulo: "Reserva rechazada",
        mensaje: "La reserva propuesta ha rechazado cubrir la baja.",
        partidaId: idPartida,
        accion: "abrir_partida",
        dedupeKey: "reserva_rechazada_" + idPartida + "_" + actualizada.uidReservaRechaza,
        prioridad: "alta",
        emailCritico: true,
        data: {
          uidReserva: actualizada.uidReservaRechaza,
          uidSale: actualizada.uidSale
        }
      })
    ];

    if (actualizada.uidNuevaReserva) {
      avisos.push(notificarPartida(actualizada.uidNuevaReserva, {
        tipo: "reserva_pendiente_aceptar",
        titulo: "Confirma tu plaza",
        mensaje: "Has sido propuesto para cubrir una baja en una partida. Confirma si puedes jugar.",
        partidaId: idPartida,
        accion: "abrir_partida",
        dedupeKey: "reserva_pendiente_aceptar_" + idPartida + "_" + actualizada.uidNuevaReserva,
        prioridad: "alta",
        emailCritico: true,
        data: { sale: actualizada.uidSale }
      }));
      avisos.push(notificarPartida(actualizada.creadaPor, {
        tipo: "reserva_pendiente_aceptar",
        titulo: "Jugador pendiente de aceptar",
        mensaje: "Una reserva ha sido propuesta para cubrir una baja. No podrás confirmar la partida hasta que responda.",
        partidaId: idPartida,
        accion: "abrir_partida",
        dedupeKey: "reserva_pendiente_creador_" + idPartida + "_" + actualizada.uidNuevaReserva,
        prioridad: "alta",
        emailCritico: true,
        data: {
          uidReserva: actualizada.uidNuevaReserva,
          sale: actualizada.uidSale
        }
      }));
    } else {
      const destinatariosSinReserva = destinatariosRechazo.filter(function(uid) {
        return uid !== actualizada.uidSale;
      });
      avisos.push(notificarPartida(destinatariosSinReserva, {
        tipo: "sin_reserva_compatible",
        titulo: "Falta cubrir una plaza",
        mensaje: "Falta 1 jugador para completar la partida.",
        partidaId: idPartida,
        accion: "abrir_partida",
        dedupeKey: "sin_reserva_compatible_" + idPartida + "_" + actualizada.uidSale,
        prioridad: "alta",
        emailCritico: true,
        data: {
          sale: actualizada.uidSale,
          uidReservaRechaza: actualizada.uidReservaRechaza
        }
      }));
    }

    return resolverPendiente.then(function() {
      return Promise.all(avisos);
    }).then(function() {
      cargarPartidas();
    });
  }).catch(function(error) {
    if (esErrorLimiteCancelacionClubPartida(error)) {
      return forzarCancelacionClubTrasAccionBloqueada(idPartida).then(function() {
        alert(error.message);
      });
    }
    alert(error && error.message ? error.message : "No se pudo rechazar la sustitución");
  });
}

function unirseAPartida(slotId) {
  const user = firebase.auth().currentUser;
  console.log("[unirse] uid actual:", user ? user.uid : null);
  if (!user) return;

  const partidaId = slotId.split("_")[1];
  console.log("[unirse] slotId:", slotId);
  console.log("[unirse] partidaId:", partidaId);
  const esReserva = slotId.startsWith("r");
  const ref = db.collection("partidas").doc(partidaId);
  return ejecutarUnirseAPartidaTransaccional(partidaId, esReserva, ref, user);

  ref.get().then(function(doc) {
    if (!doc.exists) return;
    console.log("[unirse] documento encontrado:", doc.id);

    const p = doc.data();

    db.collection("usuarios").doc(user.uid).get().then(function(docUser) {
      if (!docUser.exists) return;

      const datosUsuario = docUser.data() || {};
      const sexoUsuario = normalizarSexoPartida(datosUsuario.sexo);
      const nivelUsuario = parseFloat(datosUsuario.nivel);
      const generoPartida = p.genero;

      console.log("VALIDACION GENERO");
      console.log("sexoUsuario=", sexoUsuario);
      console.log("generoPartida=", generoPartida);

      if (
        (generoPartida === "masculino" && sexoUsuario !== "masculino") ||
        (generoPartida === "femenino" && sexoUsuario !== "femenino")
      ) {
        console.log("BLOQUEADO POR GENERO");
        alert("No puedes unirte a esta partida por restricción de género");
        return;
      }

      if (p.nivel && typeof p.nivel === "object") {
        const desdeNum = parseFloat(p.nivel.desde);
        const hastaNum = parseFloat(p.nivel.hasta);

        if (isNaN(nivelUsuario) || nivelUsuario < desdeNum || nivelUsuario > hastaNum) {
          alert("No puedes unirte a esta partida por restricción de nivel");
          return;
        }
      }

      let jugadores = arrayUnicoPartida(p.jugadores);
      let reservas = arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
        return !jugadores.includes(uidReserva);
      });
      const entraComoReserva = esReserva || jugadores.length >= 4;
      console.log("[unirse] jugadores antes:", jugadores);
      console.log("[unirse] reservas antes:", reservas);

      if (jugadores.includes(user.uid) || reservas.includes(user.uid)) return;

      const completarEntrada = function() {
        if (!esReserva) {
          if (jugadores.length < 4) jugadores.push(user.uid);
          else if (reservas.length < 2) reservas.push(user.uid);
          else {
            alert("La partida ya tiene el máximo de reservas");
            return;
          }
        } else {
          if (reservas.length < 2) reservas.push(user.uid);
          else {
            alert("La partida ya tiene el máximo de reservas");
            return;
          }
        }

        const datosUpdate = {
          jugadores: jugadores,
          reservas: reservas
        };

        if (!entraComoReserva && jugadores.length === 4 && p.sustitucionPendiente === true) {
          Object.assign(datosUpdate, datosSustitucionResueltaPartida());
        }

        ref.update(datosUpdate).then(function() {
          console.log("[unirse] UPDATE OK");
          cargarPartidas();
        });
      };

      if (generoPartida === "mixto") {
        const participantes = entraComoReserva ? reservas : jugadores;

        Promise.all(participantes.map(function(uid) {
          return db.collection("usuarios").doc(uid).get();
        })).then(function(docsUsuarios) {
          let hombres = 0;
          let mujeres = 0;

          docsUsuarios.forEach(function(docParticipante) {
            if (!docParticipante.exists) return;

            const sexoParticipante = normalizarSexoPartida((docParticipante.data() || {}).sexo);
            if (sexoParticipante === "masculino") hombres++;
            if (sexoParticipante === "femenino") mujeres++;
          });

          if (entraComoReserva && (
            (sexoUsuario === "masculino" && hombres >= 1) ||
            (sexoUsuario === "femenino" && mujeres >= 1)
          )) {
            alert("En partidas mixtas solo puede haber un reserva masculino y una reserva femenina.");
            return;
          }

          if (!entraComoReserva && (
            (sexoUsuario === "masculino" && hombres >= 2) ||
            (sexoUsuario === "femenino" && mujeres >= 2)
          )) {
            alert("Esta partida es mixta. Debe haber un máximo de 2 hombres y 2 mujeres.");
            return;
          }

          completarEntrada();
        });
        return;
      }

      completarEntrada();
    });
  });
}

function obtenerSexoUsuarioPartida(uid) {
  return db.collection("usuarios").doc(uid).get().then(function(docUsuario) {
    if (!docUsuario.exists) return "";
    return normalizarSexoPartida((docUsuario.data() || {}).sexo);
  });
}

function elegirReservaSustitutaPartida(p, reservas, uidSale) {
  if (!Array.isArray(reservas) || reservas.length === 0) return Promise.resolve(null);

  if (p.genero !== "mixto") return Promise.resolve(reservas[0]);

  return obtenerSexoUsuarioPartida(uidSale).then(function(sexoSale) {
    if (sexoSale !== "masculino" && sexoSale !== "femenino") return null;

    return Promise.all(reservas.map(function(uidReserva) {
      return obtenerSexoUsuarioPartida(uidReserva).then(function(sexoReserva) {
        return {
          uid: uidReserva,
          sexo: sexoReserva
        };
      });
    })).then(function(reservasDatos) {
      const reservaValida = reservasDatos.find(function(reserva) {
        return reserva.sexo === sexoSale;
      });

      return reservaValida ? reservaValida.uid : null;
    });
  });
}

async function salirDePartida(partidaId) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  const uid = user.uid;
  const ref = db.collection("partidas").doc(partidaId);

  try {
    const doc = await ref.get();
    if (!doc.exists) return;
    const p = doc.data() || {};
    const esTitularNoCreador =
      p.estado === "confirmada" &&
      p.creadaPor !== uid &&
      arrayUnicoPartida(p.jugadores).includes(uid);

    if (esTitularNoCreador) {
      const accion = await mostrarDialogoSalidaConfirmadaPartida();
      if (accion === "solicitar") return solicitarSustitutoPartida(partidaId);
      if (accion === "penalizacion") {
        return ejecutarSalirDePartidaTransaccional(partidaId, ref, uid, {
          abandonoConfirmado: true
        });
      }
      return;
    }
  } catch (error) {
    alert(error && error.message ? error.message : "No se pudo comprobar la partida");
    return;
  }

  return ejecutarSalirDePartidaTransaccional(partidaId, ref, uid);
}

window.guardarPartidaFinalizada = function(p, idPartida) {
  const historialRef = db.collection("historial_partidas").doc(idPartida);
  const partidaRef = db.collection("partidas").doc(idPartida);
  const datos = {
    idPartida: idPartida,
    tipo: p.tipo || null,
    estado: p.estado || null,
    fecha: p.fecha || null,
    hora: p.hora || null,
    pistaId: p.pistaId || null,
    genero: p.genero || null,
    nivel: p.nivel || null,
    jugadores: p.jugadores || [],
    reservas: p.reservas || [],
    participantesPostPartido: p.participantesPostPartido || null,
    resultado: p.resultado || null,
    valoraciones: p.valoraciones || {},
    creadaPor: p.creadaPor || null,
    finalizadaAt: p.finalizadaAt || null,
    guardadaEnHistorialAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const marcarPartidaEnHistorial = function() {
    return partidaRef.set({
      guardadaEnHistorial: true,
      guardadaEnHistorialAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  };

  return historialRef.get().then(function(doc) {
    if (doc.exists) return marcarPartidaEnHistorial();
    return historialRef.set(datos).then(marcarPartidaEnHistorial);
  });
};
