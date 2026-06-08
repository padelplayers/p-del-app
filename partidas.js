window.modoPartidas = window.modoPartidas || "proximas";

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

function puedeConfirmarPartida(p, uid, ahora) {
  const fechaPartida = obtenerFechaHoraPartida(p);

  return (
    uid &&
    p &&
    p.creadaPor === uid &&
    p.estado === "abierta" &&
    (p.jugadores || []).length === 4 &&
    fechaPartida &&
    fechaPartida >= (ahora || new Date())
  );
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

function datosSustitucionPendientePartida(uid) {
  return {
    sustitucionPendiente: true,
    sustitucionPendienteDesde: firebase.firestore.FieldValue.delete(),
    sustitucionPendienteUid: firebase.firestore.FieldValue.delete(),
    sustitucionTipo: "sin_reserva_compatible",
    sustitucionSaleUid: uid,
    sustitucionEntraUid: firebase.firestore.FieldValue.delete(),
    sustitucionPendienteAt: firebase.firestore.FieldValue.serverTimestamp()
  };
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
      document.getElementById("pistaSeleccionada").innerText = "Ninguna pista";
      document.getElementById("pistaSeleccionada").dataset.id = "";
      mostrar("partidas");
      cargarPartidas();
    });
  });
}

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

  ref.get().then(function(doc) {
    if (!doc.exists) {
      alert("La partida ya no existe");
      return;
    }

    const p = doc.data() || {};

    if (p.creadaPor !== user.uid) {
      alert("Solo el creador puede confirmar la partida");
      return;
    }

    if (p.estado !== "abierta") {
      alert("Esta partida no se puede confirmar");
      return;
    }

    if ((p.jugadores || []).length !== 4) {
      alert("La partida necesita 4 jugadores titulares");
      return;
    }

    const fechaPartida = obtenerFechaHoraPartida(p);
    if (!fechaPartida || fechaPartida < new Date()) {
      alert("No se puede confirmar una partida cuya fecha u hora ya paso");
      return;
    }

    ref.update({
      estado: "confirmada",
      confirmadaAt: new Date(),
      confirmadaPor: user.uid
    }).then(function() {
      cargarPartidas();
    });
  });
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
  if (p.sustitucionPendiente === true) {
    const sustitucionBadge = textoNodo("Sustitución pendiente", "span");
    sustitucionBadge.textContent = p.sustitucionTipo === "reserva_subida_pendiente_aceptar"
      ? "Sustitución pendiente de aceptar"
      : "Sustitución pendiente";
    sustitucionBadge.className = "partidaEstadoBadge";
    sustitucionBadge.style.cssText = "background:#FFC107; color:#000; border-color:#FFC107; font-weight:bold;";
    cabecera.appendChild(sustitucionBadge);
  }
  cabecera.appendChild(pistaFila);
  cabecera.appendChild(metaFila);

  const user = firebase.auth().currentUser;
  const uidActual = user ? user.uid : null;
  const esCreador = uidActual && p.creadaPor === uidActual;
  const confirmarActivo = puedeConfirmarPartida(p, uidActual);
  const puedeResponderSustitucion =
    p.sustitucionTipo === "reserva_subida_pendiente_aceptar" &&
    uidActual &&
    p.sustitucionEntraUid === uidActual;

  if (mostrarSalir || esCreador) {
    const salirWrap = document.createElement("div");
    salirWrap.className = "partidaAcciones";

    if (esCreador && p.estado === "abierta") {
      const confirmar = document.createElement("button");
      confirmar.type = "button";
      confirmar.textContent = confirmarActivo ? "Confirmar partida" : "Faltan jugadores";
      confirmar.disabled = !confirmarActivo;
      confirmar.style.cssText = confirmarActivo
        ? "background:#1565C0; color:#fff;"
        : "background:#ddd; color:#777; cursor:not-allowed;";
      confirmar.onclick = function() { confirmarPartida(id); };
      salirWrap.appendChild(confirmar);
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

function cargarPartidas() {
  if (!window.modoPartidas) window.modoPartidas = "proximas";

  actualizarBotonesPartidas();
  cargarFiltroPistas();

  const contenedor = document.getElementById("listaPartidas");
  if (!contenedor) return;

  contenedor.replaceChildren(textoNodo("Cargando..."));

  db.collection("partidas").get()
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

      if (p.estado === "abierta" && fechaPartida && fechaPartida < ahora) {
        eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
        return;
      }

      if (p.estado === "confirmada" && fechaPartida) {
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
      if (p.estado === "confirmada" || p.estado === "cerrada") fondo = "#e3f2fd";

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
        fechaPartida >= ahoraGlobal ||
        (p.estado === "confirmada" && limiteResultado > ahoraGlobal)
      ) {
        if (p.estado === "abierta" || p.estado === "confirmada") {
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

          transaction.update(ref, datosUpdate);
          return true;
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
      cargarPartidas();
    }
  }).catch(function(error) {
    alert(error && error.message ? error.message : "No se pudo unir a la partida");
  });
}

function ejecutarSalirDePartidaTransaccional(partidaId, ref, uid, opciones) {
  console.log("### DIAG_ELIMINAR_PERFIL ejecutarSalirDePartidaTransaccional INICIO ###", {
    partidaId: partidaId,
    uid: uid,
    opciones: opciones || null
  });
  opciones = opciones || {};
  const confirmarCreador = opciones.confirmarCreador !== false;
  const refrescar = opciones.refrescar !== false;
  const silencioso = opciones.silencioso === true;
  const propagarError = opciones.propagarError === true;

  return ref.get().then(function(docInicial) {
    console.log("### DIAG_ELIMINAR_PERFIL salida docInicial ###", {
      partidaId: partidaId,
      uid: uid,
      existe: docInicial.exists
    });
    if (!docInicial.exists) return;

    const pInicial = docInicial.data() || {};
    console.log("### DIAG_ELIMINAR_PERFIL salida estado inicial ###", {
      partidaId: partidaId,
      uid: uid,
      estado: pInicial.estado,
      creadaPor: pInicial.creadaPor,
      esCreador: pInicial.creadaPor === uid,
      enJugadores: Array.isArray(pInicial.jugadores) && pInicial.jugadores.includes(uid),
      enReservas: Array.isArray(pInicial.reservas) && pInicial.reservas.includes(uid)
    });
    if (pInicial.creadaPor === uid && (pInicial.estado === "abierta" || pInicial.estado === "confirmada")) {
      console.log("### DIAG_ELIMINAR_PERFIL salida rama creador cancelar ###", {
        partidaId: partidaId,
        uid: uid,
        estado: pInicial.estado
      });
      const ok = confirmarCreador
        ? confirm("Eres el creador de la partida. Si sales, se cancelará la partida para todos. Continuar?")
        : true;
      if (!ok) return;

      return eliminarPartidaConChat(partidaId).then(function(borrada) {
        console.log("### DIAG_ELIMINAR_PERFIL salida resultado cancelar creador ###", {
          partidaId: partidaId,
          uid: uid,
          borrada: borrada
        });
        if (!borrada && propagarError) throw new Error("No se pudo cancelar la partida del creador.");
        if (borrada && refrescar) cargarPartidas();
      });
    }

    console.log("### DIAG_ELIMINAR_PERFIL salida entra runTransaction ###", {
      partidaId: partidaId,
      uid: uid
    });
    return db.runTransaction(function(transaction) {
      return transaction.get(ref).then(function(doc) {
        console.log("### DIAG_ELIMINAR_PERFIL salida transaction.get ###", {
          partidaId: partidaId,
          uid: uid,
          existe: doc.exists
        });
        if (!doc.exists) return false;

        const p = doc.data() || {};
        let jugadores = arrayUnicoPartida(p.jugadores);
        let reservas = arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
          return !jugadores.includes(uidReserva);
        });
        console.log("### DIAG_ELIMINAR_PERFIL salida transaction estado ###", {
          partidaId: partidaId,
          uid: uid,
          estado: p.estado,
          creadaPor: p.creadaPor,
          esCreador: p.creadaPor === uid,
          enJugadores: jugadores.includes(uid),
          enReservas: reservas.includes(uid),
          jugadores: jugadores,
          reservas: reservas
        });

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

          return elegirReservaSustitutaPartidaTransaccion(transaction, p, reservas, uid).then(function(uidReservaSustituta) {
            const datosUpdate = {};
            jugadores = jugadores.filter(function(j) { return j !== uid; });

            if (uidReservaSustituta) {
              jugadores.splice(indiceSale, 0, uidReservaSustituta);
              reservas = reservas.filter(function(r) { return r !== uidReservaSustituta; });
              if (p.estado === "confirmada") {
                Object.assign(datosUpdate, datosSustitucionReservaPendientePartida(uid, uidReservaSustituta));
              } else {
                Object.assign(datosUpdate, datosSustitucionResueltaPartida());
              }
            } else if (p.estado === "confirmada") {
              Object.assign(datosUpdate, datosSustitucionPendientePartida(uid));
            } else {
              Object.assign(datosUpdate, datosSustitucionResueltaPartida());
            }

            datosUpdate.jugadores = arrayUnicoPartida(jugadores).slice(0, 4);
            datosUpdate.reservas = arrayUnicoPartida(reservas).filter(function(uidReserva) {
              return !datosUpdate.jugadores.includes(uidReserva);
            }).slice(0, 2);

            console.log("### DIAG_ELIMINAR_PERFIL salida transaction update titular ###", {
              partidaId: partidaId,
              uid: uid,
              uidReservaSustituta: uidReservaSustituta || null,
              datosUpdate: datosUpdate
            });
            transaction.update(ref, datosUpdate);
            return true;
          });
        }

        if (reservas.includes(uid)) {
          reservas = reservas.filter(function(r) { return r !== uid; });
          console.log("### DIAG_ELIMINAR_PERFIL salida transaction update reserva ###", {
            partidaId: partidaId,
            uid: uid,
            reservas: arrayUnicoPartida(reservas).slice(0, 2)
          });
          transaction.update(ref, {
            reservas: arrayUnicoPartida(reservas).slice(0, 2)
          });
          return true;
        }

        console.log("### DIAG_ELIMINAR_PERFIL salida transaction sin cambios ###", {
          partidaId: partidaId,
          uid: uid
        });
        return false;
      });
    }).then(function(actualizada) {
      console.log("### DIAG_ELIMINAR_PERFIL salida transaction FIN ###", {
        partidaId: partidaId,
        uid: uid,
        actualizada: actualizada
      });
      if (actualizada && refrescar) cargarPartidas();
    });
  }).catch(function(error) {
    console.log("### DIAG_ELIMINAR_PERFIL salida ERROR ###", {
      partidaId: partidaId,
      uid: uid,
      message: error && error.message ? error.message : String(error)
    });
    if (!silencioso) alert(error && error.message ? error.message : "No se pudo salir de la partida");
    if (propagarError) throw error;
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
      if (p.sustitucionTipo !== "reserva_subida_pendiente_aceptar") {
        throw new Error("No hay sustitución pendiente de aceptar.");
      }

      if (p.sustitucionEntraUid !== user.uid) {
        throw new Error("Solo el reserva propuesto puede aceptar la sustitución.");
      }

      const jugadores = arrayUnicoPartida(p.jugadores);
      if (!jugadores.includes(user.uid)) {
        throw new Error("El reserva propuesto no figura como jugador de la partida.");
      }

      transaction.update(ref, Object.assign({
        estado: "confirmada",
        jugadores: jugadores.slice(0, 4),
        reservas: arrayUnicoPartida(p.reservas).filter(function(uidReserva) {
          return !jugadores.includes(uidReserva);
        }).slice(0, 2)
      }, datosSustitucionResueltaPartida()));

      return true;
    });
  }).then(function(actualizada) {
    if (actualizada) cargarPartidas();
  }).catch(function(error) {
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

      return elegirReservaSustitutaPartidaTransaccion(transaction, p, reservas, uidSale).then(function(nuevoReservaUid) {
        const datosUpdate = {
          estado: "confirmada"
        };

        if (nuevoReservaUid) {
          const indiceInsercion = indiceRechaza >= 0 ? indiceRechaza : jugadores.length;
          jugadores.splice(indiceInsercion, 0, nuevoReservaUid);
          reservas = reservas.filter(function(uidReserva) {
            return uidReserva !== nuevoReservaUid;
          });
          Object.assign(datosUpdate, datosSustitucionReservaPendientePartida(uidSale, nuevoReservaUid));
        } else {
          Object.assign(datosUpdate, datosSustitucionPendientePartida(uidSale));
        }

        datosUpdate.jugadores = arrayUnicoPartida(jugadores).slice(0, 4);
        datosUpdate.reservas = arrayUnicoPartida(reservas).filter(function(uidReserva) {
          return !datosUpdate.jugadores.includes(uidReserva);
        }).slice(0, 2);

        transaction.update(ref, datosUpdate);
        return true;
      });
    });
  }).then(function(actualizada) {
    if (actualizada) cargarPartidas();
  }).catch(function(error) {
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

function salirDePartida(partidaId) {
  const uid = firebase.auth().currentUser.uid;
  const ref = db.collection("partidas").doc(partidaId);
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
