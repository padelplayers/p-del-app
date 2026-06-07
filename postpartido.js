function obtenerFechaHoraPostPartido(p) {
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

function esPartidaPendientePostPartido(p) {
  const fechaPartida = obtenerFechaHoraPostPartido(p);
  if (!fechaPartida) return false;

  const limiteResultado = new Date(fechaPartida.getTime() + 80 * 60 * 1000);
  return p.estado === "confirmada" && limiteResultado <= new Date();
}

function obtenerTipoPostPartido(p) {
  return String((p && p.tipo) || "ranking").toLowerCase().trim();
}

function esPartidaAmistosaPostPartido(p) {
  return obtenerTipoPostPartido(p) === "amistosa";
}

function amistosaTieneValoracionesCompletasBase(p) {
  if (!p || !esPartidaAmistosaPostPartido(p)) return false;

  const jugadores = Array.isArray(p.jugadores) ? p.jugadores : [];
  if (jugadores.length !== 4) return false;

  const jugadoresUnicos = new Set(jugadores);
  if (jugadoresUnicos.size !== 4) return false;

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

function amistosaTieneValoracionesCompletas(p) {
  return p && p.estado === "confirmada" && amistosaTieneValoracionesCompletasBase(p);
}

function calcularClasificacionComunitariaAmistosa(p) {
  if (!p || p.estado !== "finalizada" || !amistosaTieneValoracionesCompletasBase(p)) return null;

  const jugadores = p.jugadores;
  const valoraciones = p.valoraciones || {};
  const incrementos = {};
  const aspectos = ["puntualidad", "actitud", "compromiso"];

  jugadores.forEach(function(uidValorado) {
    incrementos[uidValorado] = {
      puntos: 10,
      partidos: 1,
      puntualidadTotal: 0,
      actitudTotal: 0,
      compromisoTotal: 0,
      valoracionesRecibidas: 0
    };
  });

  for (let i = 0; i < jugadores.length; i++) {
    const uidValorador = jugadores[i];
    const valoracionValorador = valoraciones[uidValorador] || {};

    for (let j = 0; j < jugadores.length; j++) {
      const uidValorado = jugadores[j];
      if (uidValorado === uidValorador) continue;

      const valoracion = valoracionValorador[uidValorado] || {};
      for (let k = 0; k < aspectos.length; k++) {
        const aspecto = aspectos[k];
        const valor = Number(valoracion[aspecto]);

        if (!Number.isInteger(valor) || valor < 1 || valor > 5) return null;

        incrementos[uidValorado][aspecto + "Total"] += valor;
        incrementos[uidValorado].puntos += valor;
      }

      incrementos[uidValorado].valoracionesRecibidas += 1;
    }
  }

  return incrementos;
}

function aplicarClasificacionComunitariaAmistosa(idPartida) {
  const partidaRef = db.collection("partidas").doc(idPartida);

  return db.runTransaction(function(transaction) {
    return transaction.get(partidaRef).then(function(doc) {
      if (!doc.exists) return null;

      const p = doc.data() || {};
      if (p.clasificacionComunitariaAplicada === true) return null;
      if (!esPartidaAmistosaPostPartido(p)) return null;
      if (p.estado !== "finalizada") return null;
      if (!amistosaTieneValoracionesCompletasBase(p)) return null;

      const incrementos = calcularClasificacionComunitariaAmistosa(p);
      if (!incrementos) return null;

      Object.keys(incrementos).forEach(function(uid) {
        const datos = incrementos[uid];
        const usuarioRef = db.collection("usuarios").doc(uid);

        transaction.update(usuarioRef, {
          "clasificacion.puntos": firebase.firestore.FieldValue.increment(datos.puntos),
          "clasificacion.partidos": firebase.firestore.FieldValue.increment(datos.partidos),
          "clasificacion.puntualidadTotal": firebase.firestore.FieldValue.increment(datos.puntualidadTotal),
          "clasificacion.actitudTotal": firebase.firestore.FieldValue.increment(datos.actitudTotal),
          "clasificacion.compromisoTotal": firebase.firestore.FieldValue.increment(datos.compromisoTotal),
          "clasificacion.valoracionesRecibidas": firebase.firestore.FieldValue.increment(datos.valoracionesRecibidas)
        });
      });

      transaction.update(partidaRef, {
        clasificacionComunitariaAplicada: true,
        clasificacionComunitariaAplicadaAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return true;
    });
  });
}

function esPartidaConResultadoPostPartido(p) {
  const tipo = obtenerTipoPostPartido(p);
  return tipo === "ranking" || tipo === "competitiva" || tipo === "competitivo";
}

function crearTextoPostPartido(texto) {
  const el = document.createElement("div");
  el.className = "postPartidoTexto";
  el.textContent = texto;
  return el;
}

function crearBotonPostPartido(texto, accion) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = texto;
  btn.onclick = accion;
  return btn;
}

function cerrarFormularioResultado() {
  const modal = document.getElementById("modalResultadoPostPartido");
  if (modal) modal.remove();
}

function cerrarFormularioValoraciones() {
  const modal = document.getElementById("modalValoracionesPostPartido");
  if (modal) modal.remove();
}

function crearInputSet(setNumero, equipo) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.inputMode = "numeric";
  input.id = "resultadoSet" + setNumero + equipo;
  input.setAttribute("aria-label", "Set " + setNumero + " equipo " + equipo);
  return input;
}

function leerYValidarSetsResultado() {
  const sets = [];

  for (let i = 1; i <= 3; i++) {
    const inputA = document.getElementById("resultadoSet" + i + "A");
    const inputB = document.getElementById("resultadoSet" + i + "B");
    const valorA = inputA ? inputA.value.trim() : "";
    const valorB = inputB ? inputB.value.trim() : "";

    if (!valorA && !valorB && i === 3) continue;

    if (!valorA || !valorB) {
      return { error: "Completa los dos valores de cada set." };
    }

    const juegosA = Number(valorA);
    const juegosB = Number(valorB);

    if (!Number.isInteger(juegosA) || !Number.isInteger(juegosB) || juegosA < 0 || juegosB < 0) {
      return { error: "Los juegos deben ser números enteros." };
    }

    if (juegosA === juegosB) {
      return { error: "Un set no puede quedar empatado." };
    }

    sets.push({ a: juegosA, b: juegosB });
  }

  if (sets.length < 2) {
    return { error: "Debe haber al menos 2 sets completos." };
  }

  let setsA = 0;
  let setsB = 0;

  sets.forEach(function(set) {
    if (set.a > set.b) setsA++;
    if (set.b > set.a) setsB++;
  });

  if (setsA === 2 && setsB < 2) return { sets: sets, ganador: "A" };
  if (setsB === 2 && setsA < 2) return { sets: sets, ganador: "B" };

  return { error: "No hay ganador claro. El ganador debe ganar 2 sets." };
}

function guardarResultadoPropuesto(id) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Debes iniciar sesión");
    return;
  }

  const validacion = leerYValidarSetsResultado();
  if (validacion.error) {
    alert(validacion.error);
    return;
  }

  const ref = db.collection("partidas").doc(id);

  ref.get().then(function(doc) {
    if (!doc.exists) {
      alert("La partida ya no existe");
      return;
    }

    const p = doc.data() || {};
    const jugadores = Array.isArray(p.jugadores) ? p.jugadores : [];

    if (!jugadores.includes(user.uid)) {
      alert("Solo los jugadores titulares pueden introducir resultado");
      return;
    }

    if (p.estado !== "confirmada") {
      alert("Esta partida no admite resultado en este momento");
      return;
    }

    if (!esPartidaConResultadoPostPartido(p)) {
      alert("Las partidas amistosas no tienen resultado");
      return;
    }

    if (!esPartidaPendientePostPartido(p)) {
      alert("El resultado estará disponible 80 minutos después del inicio");
      return;
    }

    if (p.resultado && p.resultado.estado === "validado") {
      alert("El resultado ya está validado");
      return;
    }

    if (p.resultado && p.resultado.estado === "pendiente") {
      alert("Ya hay un resultado pendiente de validación");
      return;
    }

    if (p.resultado && p.resultado.estado !== "disputa") {
      alert("Este resultado no se puede sobrescribir");
      return;
    }

    return ref.update({
      resultado: {
        estado: "pendiente",
        sets: validacion.sets,
        ganador: validacion.ganador,
        propuestoPor: user.uid,
        propuestoAt: firebase.firestore.FieldValue.serverTimestamp(),
        validaciones: [user.uid],
        rechazos: []
      }
    }).then(function() {
      cerrarFormularioResultado();
      if (typeof cargarPartidas === "function") cargarPartidas();
    });
  }).catch(function(error) {
    console.error("Error guardando resultado:", error);
    alert("No se pudo guardar el resultado");
  });
}

function crearFilaSetResultado(numero, opcional) {
  const fila = document.createElement("div");
  fila.className = "postPartidoSetFila";

  const label = document.createElement("div");
  label.className = "postPartidoSetLabel";
  label.textContent = "Set " + numero + (opcional ? " opcional" : "");

  const inputA = crearInputSet(numero, "A");
  const inputB = crearInputSet(numero, "B");

  fila.appendChild(label);
  fila.appendChild(inputA);
  fila.appendChild(inputB);
  return fila;
}

function crearFormularioResultado(id) {
  cerrarFormularioResultado();

  const overlay = document.createElement("div");
  overlay.id = "modalResultadoPostPartido";
  overlay.className = "postPartidoModalOverlay";

  const modal = document.createElement("div");
  modal.className = "postPartidoModal";

  const titulo = document.createElement("h3");
  titulo.textContent = "Introducir resultado";

  const descripcion = document.createElement("p");
  descripcion.textContent = "Pareja A: jugadores 1 y 2. Pareja B: jugadores 3 y 4.";

  const cabecera = document.createElement("div");
  cabecera.className = "postPartidoSetFila postPartidoSetCabecera";
  cabecera.appendChild(document.createElement("div"));
  cabecera.appendChild(crearTextoPostPartido("Equipo 1"));
  cabecera.appendChild(crearTextoPostPartido("Equipo 2"));

  const acciones = document.createElement("div");
  acciones.className = "postPartidoModalAcciones";

  const cancelar = crearBotonPostPartido("Cancelar", cerrarFormularioResultado);
  const guardar = crearBotonPostPartido("Guardar resultado", function() {
    guardarResultadoPropuesto(id);
  });

  acciones.appendChild(cancelar);
  acciones.appendChild(guardar);

  modal.appendChild(titulo);
  modal.appendChild(descripcion);
  modal.appendChild(cabecera);
  modal.appendChild(crearFilaSetResultado(1, false));
  modal.appendChild(crearFilaSetResultado(2, false));
  modal.appendChild(crearFilaSetResultado(3, true));
  modal.appendChild(acciones);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function crearSelectValoracion(uidValorado, aspecto) {
  const select = document.createElement("select");
  select.id = "valoracion_" + uidValorado + "_" + aspecto;

  const vacia = document.createElement("option");
  vacia.value = "";
  vacia.textContent = "-";
  select.appendChild(vacia);

  for (let i = 1; i <= 5; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = String(i);
    select.appendChild(option);
  }

  return select;
}

function crearBloqueValoracionJugador(jugador) {
  const bloque = document.createElement("div");
  bloque.className = "postPartidoValoracionJugador";

  const nombre = document.createElement("h4");
  nombre.textContent = jugador.nombre || "Jugador";
  bloque.appendChild(nombre);

  ["puntualidad", "actitud", "compromiso"].forEach(function(aspecto) {
    const fila = document.createElement("label");
    fila.className = "postPartidoValoracionFila";

    const texto = document.createElement("span");
    texto.textContent = aspecto.charAt(0).toUpperCase() + aspecto.slice(1);

    fila.appendChild(texto);
    fila.appendChild(crearSelectValoracion(jugador.uid, aspecto));
    bloque.appendChild(fila);
  });

  return bloque;
}

function leerValoracionesFormulario(jugadoresValorados) {
  const valoraciones = {};

  for (let i = 0; i < jugadoresValorados.length; i++) {
    const uid = jugadoresValorados[i].uid;
    valoraciones[uid] = {};

    const aspectos = ["puntualidad", "actitud", "compromiso"];
    for (let j = 0; j < aspectos.length; j++) {
      const aspecto = aspectos[j];
      const select = document.getElementById("valoracion_" + uid + "_" + aspecto);
      const valor = select ? Number(select.value) : 0;

      if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
        return { error: "Completa todas las valoraciones de 1 a 5." };
      }

      valoraciones[uid][aspecto] = valor;
    }

    valoraciones[uid].createdAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  return { valoraciones: valoraciones };
}

function guardarValoracionesAmistosa(id, jugadoresValorados) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Debes iniciar sesión");
    return;
  }

  const datosFormulario = leerValoracionesFormulario(jugadoresValorados);
  if (datosFormulario.error) {
    alert(datosFormulario.error);
    return;
  }

  const ref = db.collection("partidas").doc(id);

  ref.get().then(function(doc) {
    if (!doc.exists) {
      alert("La partida ya no existe");
      return;
    }

    const p = doc.data() || {};
    const jugadores = Array.isArray(p.jugadores) ? p.jugadores : [];

    if (!esPartidaAmistosaPostPartido(p)) {
      alert("Estas valoraciones solo aplican a partidas amistosas");
      return;
    }

    if (!jugadores.includes(user.uid)) {
      alert("Solo los jugadores titulares pueden valorar");
      return;
    }

    if (!esPartidaPendientePostPartido(p)) {
      alert("Las valoraciones estarán disponibles 80 minutos después del inicio");
      return;
    }

    if (p.valoraciones && p.valoraciones[user.uid]) {
      alert("Ya has valorado esta partida");
      return;
    }

    return ref.set({
      valoraciones: {
        [user.uid]: datosFormulario.valoraciones
      }
    }, { merge: true }).then(function() {
      return ref.get();
    }).then(function(docActualizado) {
      if (!docActualizado.exists) return null;

      const partidaActualizada = docActualizado.data() || {};
      if (!amistosaTieneValoracionesCompletas(partidaActualizada)) return null;

      const finalizadaAt = firebase.firestore.FieldValue.serverTimestamp();
      const partidaFinalizada = Object.assign({}, partidaActualizada, {
        estado: "finalizada",
        finalizadaAt: finalizadaAt
      });

      return ref.update({
        estado: partidaFinalizada.estado,
        finalizadaAt: partidaFinalizada.finalizadaAt
      }).then(function() {
        if (typeof guardarPartidaFinalizada !== "function") return null;
        return guardarPartidaFinalizada(partidaFinalizada, id);
      }).then(function() {
        return aplicarClasificacionComunitariaAmistosa(id);
      });
    }).then(function() {
      cerrarFormularioValoraciones();
      if (typeof cargarPartidas === "function") cargarPartidas();
    });
  }).catch(function(error) {
    console.error("Error guardando valoraciones:", error);
    alert("No se pudieron guardar las valoraciones");
  });
}

function abrirFormularioValoracionesAmistosa(id) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Debes iniciar sesión");
    return;
  }

  const ref = db.collection("partidas").doc(id);

  ref.get().then(function(doc) {
    if (!doc.exists) {
      alert("La partida ya no existe");
      return;
    }

    const p = doc.data() || {};
    const jugadores = Array.isArray(p.jugadores) ? p.jugadores : [];

    if (!esPartidaAmistosaPostPartido(p)) {
      alert("Estas valoraciones solo aplican a partidas amistosas");
      return;
    }

    if (!jugadores.includes(user.uid)) {
      alert("Solo los jugadores titulares pueden valorar");
      return;
    }

    if (!esPartidaPendientePostPartido(p)) {
      alert("Las valoraciones estarán disponibles 80 minutos después del inicio");
      return;
    }

    if (p.valoraciones && p.valoraciones[user.uid]) {
      alert("Ya has valorado esta partida.");
      return;
    }

    const otrosJugadores = jugadores.filter(function(uid) { return uid !== user.uid; });
    if (otrosJugadores.length !== 3) {
      alert("La partida necesita 4 titulares para valorar");
      return;
    }

    return Promise.all(otrosJugadores.map(function(uid) {
      return db.collection("usuarios").doc(uid).get().then(function(docUsuario) {
        const datos = docUsuario.exists ? (docUsuario.data() || {}) : {};
        return {
          uid: uid,
          nombre: datos.nombre || "Jugador"
        };
      });
    })).then(function(jugadoresValorados) {
      crearFormularioValoraciones(id, jugadoresValorados);
    });
  }).catch(function(error) {
    console.error("Error abriendo valoraciones:", error);
    alert("No se pudieron abrir las valoraciones");
  });
}

function crearFormularioValoraciones(id, jugadoresValorados) {
  cerrarFormularioValoraciones();

  const overlay = document.createElement("div");
  overlay.id = "modalValoracionesPostPartido";
  overlay.className = "postPartidoModalOverlay";

  const modal = document.createElement("div");
  modal.className = "postPartidoModal";

  const titulo = document.createElement("h3");
  titulo.textContent = "Valorar jugadores";

  const descripcion = document.createElement("p");
  descripcion.textContent = "Valora a los otros 3 titulares de esta partida amistosa.";

  const acciones = document.createElement("div");
  acciones.className = "postPartidoModalAcciones";

  const cancelar = crearBotonPostPartido("Cancelar", cerrarFormularioValoraciones);
  const guardar = crearBotonPostPartido("Guardar valoraciones", function() {
    guardarValoracionesAmistosa(id, jugadoresValorados);
  });

  modal.appendChild(titulo);
  modal.appendChild(descripcion);
  jugadoresValorados.forEach(function(jugador) {
    modal.appendChild(crearBloqueValoracionJugador(jugador));
  });

  acciones.appendChild(cancelar);
  acciones.appendChild(guardar);
  modal.appendChild(acciones);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

window.crearAccionesPostPartido = function(id, p, uidActual) {
  const jugadores = p && Array.isArray(p.jugadores) ? p.jugadores : [];
  if (!uidActual || !jugadores.includes(uidActual)) return null;
  if (!esPartidaPendientePostPartido(p)) return null;

  const resultado = p.resultado || null;
  const estadoResultado = resultado && resultado.estado;
  const box = document.createElement("div");
  box.className = "postPartidoBox";

  if (esPartidaAmistosaPostPartido(p)) {
    box.appendChild(crearTextoPostPartido("Partida amistosa. No necesita resultado."));

    if (p.valoraciones && p.valoraciones[uidActual]) {
      box.appendChild(crearTextoPostPartido("Ya has valorado esta partida."));
      return box;
    }

    const accionesAmistosa = document.createElement("div");
    accionesAmistosa.className = "postPartidoAcciones";
    accionesAmistosa.appendChild(crearBotonPostPartido("Valorar jugadores", function() {
      window.abrirValoracionesPostPartido(id);
    }));
    box.appendChild(accionesAmistosa);
    return box;
  }

  if (!esPartidaConResultadoPostPartido(p)) return null;

  if (!resultado) {
    const acciones = document.createElement("div");
    acciones.className = "postPartidoAcciones";
    acciones.appendChild(crearBotonPostPartido("Introducir resultado", function() {
      window.abrirFormularioResultado(id);
    }));
    box.appendChild(acciones);
    return box;
  }

  if (estadoResultado === "pendiente") {
    const validaciones = Array.isArray(resultado.validaciones) ? resultado.validaciones : [];
    box.appendChild(crearTextoPostPartido("Resultado pendiente de validación"));

    if (validaciones.includes(uidActual)) {
      box.appendChild(crearTextoPostPartido("Resultado validado por ti"));
      return box;
    }

    const accionesPendiente = document.createElement("div");
    accionesPendiente.className = "postPartidoAcciones";
    accionesPendiente.appendChild(crearBotonPostPartido("Confirmar resultado", function() {
      window.confirmarResultadoPartida(id);
    }));
    accionesPendiente.appendChild(crearBotonPostPartido("Rechazar resultado", function() {
      window.rechazarResultadoPartida(id);
    }));
    box.appendChild(accionesPendiente);
    return box;
  }

  if (estadoResultado === "disputa") {
    box.appendChild(crearTextoPostPartido("Resultado en disputa. Revisadlo en el chat de la partida."));

    const accionesDisputa = document.createElement("div");
    accionesDisputa.className = "postPartidoAcciones";
    accionesDisputa.appendChild(crearBotonPostPartido("Proponer nuevo resultado", function() {
      window.abrirFormularioResultado(id);
    }));
    box.appendChild(accionesDisputa);
    return box;
  }

  if (estadoResultado === "validado") {
    box.appendChild(crearTextoPostPartido("Resultado validado. Pendiente de valoraciones."));
    return box;
  }

  return null;
};

window.abrirFormularioResultado = function(id) {
  crearFormularioResultado(id);
};

window.abrirValoracionesPostPartido = function(id) {
  abrirFormularioValoracionesAmistosa(id);
};

window.confirmarResultadoPartida = function(id) {
  alert("Confirmación de resultado pendiente de implementar");
  console.log("[postpartido] confirmarResultadoPartida pendiente", id);
};

window.rechazarResultadoPartida = function(id) {
  alert("Rechazo de resultado pendiente de implementar");
  console.log("[postpartido] rechazarResultadoPartida pendiente", id);
};
