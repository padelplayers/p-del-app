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

const PLAZO_POSTPARTIDO_MS = 3 * 24 * 60 * 60 * 1000;

function partidaSuperaPlazoPostPartido(p, ahora) {
  const fechaPartida = obtenerFechaHoraPostPartido(p);
  if (!fechaPartida) return false;
  return p && p.estado === "confirmada" && (ahora || new Date()) >= new Date(fechaPartida.getTime() + PLAZO_POSTPARTIDO_MS);
}

function obtenerTipoPostPartido(p) {
  return String((p && p.tipo) || "ranking").toLowerCase().trim();
}

function esPartidaAmistosaPostPartido(p) {
  return obtenerTipoPostPartido(p) === "amistosa";
}

function esPartidaRankingPostPartido(p) {
  const tipo = obtenerTipoPostPartido(p);
  return tipo === "ranking" || tipo === "competitiva" || tipo === "competitivo";
}

function arrayUnicoPostPartido(valores) {
  const lista = Array.isArray(valores) ? valores.filter(function(uid) { return !!uid; }) : [];
  return lista.filter(function(uid, index) {
    return lista.indexOf(uid) === index;
  });
}

function obtenerParticipantesAmistosaPostPartido(p) {
  const jugadores = arrayUnicoPostPartido(p && p.jugadores);
  const reservas = arrayUnicoPostPartido(p && p.reservas);
  const participantes = arrayUnicoPostPartido(p && p.participantesPostPartido);

  if (reservas.length > 0) {
    const permitidos = jugadores.concat(reservas);
    if (
      participantes.length >= jugadores.length &&
      jugadores.every(function(uid) { return participantes.includes(uid); }) &&
      participantes.every(function(uid) { return permitidos.includes(uid); })
    ) {
      return participantes;
    }

    return [];
  }

  return jugadores;
}

function obtenerParticipantesRankingPostPartido(p) {
  const resultado = p && p.resultado;
  if (!resultado || resultado.estado !== "validado") return [];

  const equipo1 = Array.isArray(resultado.equipo1) ? resultado.equipo1 : [];
  const equipo2 = Array.isArray(resultado.equipo2) ? resultado.equipo2 : [];
  const participantes = equipo1.concat(equipo2);

  if (participantes.length !== 4) return [];
  if (new Set(participantes).size !== 4) return [];
  return participantes;
}

function obtenerParticipantesValoracionPostPartido(p) {
  if (esPartidaAmistosaPostPartido(p)) return obtenerParticipantesAmistosaPostPartido(p);
  if (esPartidaRankingPostPartido(p)) return obtenerParticipantesRankingPostPartido(p);
  return arrayUnicoPostPartido(p && p.jugadores);
}

function obtenerParticipantesIncumplimientoPostPartido(p) {
  if (esPartidaRankingPostPartido(p)) {
    const participantesResultado = obtenerParticipantesRankingPostPartido(p);
    if (participantesResultado.length > 0) return participantesResultado;
    return obtenerJugadoresPermitidosResultadoRanking(p);
  }

  const participantesValoracion = obtenerParticipantesValoracionPostPartido(p);
  if (participantesValoracion.length > 0) return participantesValoracion;
  return arrayUnicoPostPartido(p && p.jugadores);
}

function obtenerUidsSinValorarPostPartido(p, participantes) {
  const valoraciones = p && p.valoraciones && typeof p.valoraciones === "object"
    ? p.valoraciones
    : {};

  return arrayUnicoPostPartido(participantes).filter(function(uid) {
    return !valoraciones[uid];
  });
}

function valoracionesCompletasParaParticipantesPostPartido(p, participantes) {
  const jugadores = arrayUnicoPostPartido(participantes);
  if (jugadores.length < 2) return false;

  const valoraciones = p && p.valoraciones;
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

function amistosaTieneValoracionesCompletasBase(p) {
  if (!p || !esPartidaAmistosaPostPartido(p)) return false;

  return valoracionesCompletasParaParticipantesPostPartido(p, obtenerParticipantesAmistosaPostPartido(p));
}

function amistosaTieneValoracionesCompletas(p) {
  return p && p.estado === "confirmada" && amistosaTieneValoracionesCompletasBase(p);
}

function partidaTieneValoracionesCompletasPostPartido(p) {
  return valoracionesCompletasParaParticipantesPostPartido(p, obtenerParticipantesValoracionPostPartido(p));
}

function mensajeBloqueoSustitucionPostPartido(p) {
  if (!p || p.sustitucionPendiente !== true) return "";

  if (p.sustitucionTipo === "reserva_subida_pendiente_aceptar") {
    return "Sustitución pendiente de aceptar. El postpartido se activará cuando el reserva confirme su participación.";
  }

  if (p.sustitucionTipo === "sin_reserva_compatible") {
    return "Sustitución pendiente. Falta cubrir una plaza antes de cerrar la partida.";
  }

  return "";
}

function partidaRankingConDatosCompletosPostPartido(p) {
  return !!(
    p &&
    esPartidaRankingPostPartido(p) &&
    p.resultado &&
    p.resultado.estado === "validado" &&
    partidaTieneValoracionesCompletasPostPartido(p)
  );
}

function partidaRankingListaParaCierre(p) {
  return !!(p && p.estado === "confirmada" && partidaRankingConDatosCompletosPostPartido(p));
}

function calcularClasificacionComunitariaAmistosa(p) {
  if (!p || p.estado !== "finalizada" || !amistosaTieneValoracionesCompletasBase(p)) return null;

  const jugadores = obtenerParticipantesAmistosaPostPartido(p);
  if (jugadores.length < 4) return null;
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

function crearUpdateLogrosPartidaPostPartido(datos, p) {
  const update = {
    "clasificacion.puntos": firebase.firestore.FieldValue.increment(datos.puntos),
    "clasificacion.partidos": firebase.firestore.FieldValue.increment(datos.partidos),
    "clasificacion.puntualidadTotal": firebase.firestore.FieldValue.increment(datos.puntualidadTotal),
    "clasificacion.actitudTotal": firebase.firestore.FieldValue.increment(datos.actitudTotal),
    "clasificacion.compromisoTotal": firebase.firestore.FieldValue.increment(datos.compromisoTotal),
    "clasificacion.valoracionesRecibidas": firebase.firestore.FieldValue.increment(datos.valoracionesRecibidas),
    "clasificacion.compromisoLogro": firebase.firestore.FieldValue.increment(datos.partidos)
  };

  if (p && p.pistaId) {
    update["clasificacion.pistasJugadasIds"] = firebase.firestore.FieldValue.arrayUnion(p.pistaId);
  }

  return update;
}

function obtenerNombreUsuarioStatsPostPartido(docUsuario, uid) {
  const datos = docUsuario && docUsuario.exists ? (docUsuario.data() || {}) : {};
  return datos.nombre || datos.displayName || uid || "Jugador";
}

function obtenerNombrePistaStatsPostPartido(p, docPista) {
  const datosPista = docPista && docPista.exists ? (docPista.data() || {}) : {};
  return (p && (p.nombrePista || p.pistaNombre)) ||
    datosPista.nombre ||
    (p && p.pistaId) ||
    "Pista";
}

function incrementarMapaStatsPostPartido(mapa, id, datosBase) {
  if (!id) return mapa && typeof mapa === "object" ? Object.assign({}, mapa) : {};

  const siguiente = mapa && typeof mapa === "object" ? Object.assign({}, mapa) : {};
  const anterior = siguiente[id] && typeof siguiente[id] === "object" ? siguiente[id] : {};
  const veces = Number(anterior.veces || 0);

  siguiente[id] = Object.assign({}, anterior, datosBase, {
    veces: isNaN(veces) ? 1 : veces + 1
  });

  return siguiente;
}

function crearUpdateStatsHabitualesPostPartido(uid, contexto, docUsuario) {
  const datosUsuario = docUsuario && docUsuario.exists ? (docUsuario.data() || {}) : {};
  const clasificacion = datosUsuario.clasificacion || {};
  const update = {};

  if (contexto && contexto.pistaId) {
    update["clasificacion.pistasJugadasMap"] = incrementarMapaStatsPostPartido(
      clasificacion.pistasJugadasMap,
      contexto.pistaId,
      {
        pistaId: contexto.pistaId,
        nombre: contexto.nombrePista || contexto.pistaId
      }
    );
  }

  const companeroUid = contexto && contexto.companerosPorUid ? contexto.companerosPorUid[uid] : null;
  if (companeroUid) {
    update["clasificacion.companerosMap"] = incrementarMapaStatsPostPartido(
      clasificacion.companerosMap,
      companeroUid,
      {
        uid: companeroUid,
        nombre: (contexto.nombresPorUid && contexto.nombresPorUid[companeroUid]) || companeroUid
      }
    );
  }

  const rivales = contexto && contexto.rivalesPorUid && Array.isArray(contexto.rivalesPorUid[uid])
    ? contexto.rivalesPorUid[uid]
    : [];

  if (rivales.length > 0) {
    let rivalesMap = clasificacion.rivalesMap;
    rivales.forEach(function(rivalUid) {
      rivalesMap = incrementarMapaStatsPostPartido(
        rivalesMap,
        rivalUid,
        {
          uid: rivalUid,
          nombre: (contexto.nombresPorUid && contexto.nombresPorUid[rivalUid]) || rivalUid
        }
      );
    });
    update["clasificacion.rivalesMap"] = rivalesMap;
  }

  return update;
}

function crearContextoStatsRankingPostPartido(p, docsUsuarios, docPista) {
  const resultado = p && p.resultado ? p.resultado : {};
  const equipo1 = Array.isArray(resultado.equipo1) ? resultado.equipo1 : [];
  const equipo2 = Array.isArray(resultado.equipo2) ? resultado.equipo2 : [];
  const jugadores = equipo1.concat(equipo2);
  const nombresPorUid = {};
  const companerosPorUid = {};
  const rivalesPorUid = {};

  jugadores.forEach(function(uid, index) {
    nombresPorUid[uid] = obtenerNombreUsuarioStatsPostPartido(docsUsuarios[index], uid);
  });

  equipo1.forEach(function(uid) {
    companerosPorUid[uid] = equipo1.find(function(otroUid) { return otroUid !== uid; }) || null;
    rivalesPorUid[uid] = equipo2.slice();
  });

  equipo2.forEach(function(uid) {
    companerosPorUid[uid] = equipo2.find(function(otroUid) { return otroUid !== uid; }) || null;
    rivalesPorUid[uid] = equipo1.slice();
  });

  return {
    pistaId: p && p.pistaId,
    nombrePista: obtenerNombrePistaStatsPostPartido(p, docPista),
    nombresPorUid: nombresPorUid,
    companerosPorUid: companerosPorUid,
    rivalesPorUid: rivalesPorUid
  };
}

function crearContextoStatsAmistosaPostPartido(p, jugadores, docsUsuarios, docPista) {
  const nombresPorUid = {};

  jugadores.forEach(function(uid, index) {
    nombresPorUid[uid] = obtenerNombreUsuarioStatsPostPartido(docsUsuarios[index], uid);
  });

  return {
    pistaId: p && p.pistaId,
    nombrePista: obtenerNombrePistaStatsPostPartido(p, docPista),
    nombresPorUid: nombresPorUid,
    companerosPorUid: {},
    rivalesPorUid: {}
  };
}

function partidaRankingPermiteStatsHabituales(p) {
  return !!(
    p &&
    (p.estado === "confirmada" || p.estado === "finalizada") &&
    esPartidaRankingPostPartido(p) &&
    obtenerParticipantesRankingPostPartido(p).length === 4
  );
}

function partidaAmistosaPermiteStatsHabituales(p) {
  return !!(
    p &&
    p.estado === "finalizada" &&
    esPartidaAmistosaPostPartido(p) &&
    obtenerParticipantesAmistosaPostPartido(p).length >= 4
  );
}

function aplicarClasificacionComunitariaAmistosa(idPartida) {
  const partidaRef = db.collection("partidas").doc(idPartida);

  return db.runTransaction(function(transaction) {
    return transaction.get(partidaRef).then(function(doc) {
      if (!doc.exists) return null;

      const p = doc.data() || {};
      if (!esPartidaAmistosaPostPartido(p)) return null;
      const debeAplicarClasificacion = p.clasificacionComunitariaAplicada !== true;
      const debeAplicarStats = p.statsHabitualesAplicadas !== true;
      if (!debeAplicarClasificacion && !debeAplicarStats) return null;
      if (debeAplicarStats && !partidaAmistosaPermiteStatsHabituales(p)) return null;

      const incrementos = debeAplicarClasificacion ? calcularClasificacionComunitariaAmistosa(p) : null;
      if (debeAplicarClasificacion && !incrementos) return null;

      const jugadores = obtenerParticipantesAmistosaPostPartido(p).filter(function(uid) {
        return !incrementos || !!incrementos[uid];
      });
      if (jugadores.length === 0) return null;
      const pistaRef = p.pistaId ? db.collection("pistas").doc(p.pistaId) : null;
      const usuarioRefs = jugadores.map(function(uid) {
        return db.collection("usuarios").doc(uid);
      });
      const necesitaLecturasUsuarios = debeAplicarStats || debeAplicarClasificacion;
      const lecturas = necesitaLecturasUsuarios
        ? usuarioRefs.map(function(usuarioRef) { return transaction.get(usuarioRef); })
        : [];

      if (debeAplicarStats && pistaRef) lecturas.push(transaction.get(pistaRef));

      return Promise.all(lecturas).then(function(docs) {
        const docsUsuarios = docs.slice(0, usuarioRefs.length);
        const docPista = debeAplicarStats && pistaRef ? docs[docs.length - 1] : null;
        const contextoStats = debeAplicarStats
          ? crearContextoStatsAmistosaPostPartido(p, jugadores, docsUsuarios, docPista)
          : null;

        jugadores.forEach(function(uid, index) {
          const usuarioRef = usuarioRefs[index];
          const updateBase = debeAplicarClasificacion
            ? crearUpdateLogrosPartidaPostPartido(incrementos[uid], p)
            : {};
          const updateStats = debeAplicarStats
            ? crearUpdateStatsHabitualesPostPartido(uid, contextoStats, docsUsuarios[index])
            : {};

          const updateUsuario = Object.assign({}, updateBase, updateStats);
          if (Object.keys(updateUsuario).length > 0) {
            transaction.update(usuarioRef, updateUsuario);
          }
        });

        const updatePartida = {};
        if (debeAplicarClasificacion) {
          updatePartida.clasificacionComunitariaAplicada = true;
          updatePartida.clasificacionComunitariaAplicadaAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        if (debeAplicarStats && partidaAmistosaPermiteStatsHabituales(p)) {
          updatePartida.statsHabitualesAplicadas = true;
          updatePartida.statsHabitualesAplicadasAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        if (Object.keys(updatePartida).length > 0) transaction.update(partidaRef, updatePartida);

        return true;
      });
    });
  });
}

function calcularClasificacionComunitariaRanking(p) {
  if (!partidaRankingListaParaCierre(p)) return null;

  const jugadores = obtenerParticipantesRankingPostPartido(p);
  if (jugadores.length !== 4) return null;
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

function aplicarClasificacionComunitariaRanking(idPartida) {
  const partidaRef = db.collection("partidas").doc(idPartida);

  return db.runTransaction(function(transaction) {
    return transaction.get(partidaRef).then(function(doc) {
      if (!doc.exists) return null;

      const p = doc.data() || {};
      if (!esPartidaRankingPostPartido(p)) return null;
      const debeAplicarClasificacion = p.clasificacionComunitariaAplicada !== true;
      const debeAplicarStats = p.statsHabitualesAplicadas !== true;
      const puedeAplicarClasificacion = debeAplicarClasificacion && partidaRankingListaParaCierre(p);
      const puedeAplicarStats = debeAplicarStats && partidaRankingPermiteStatsHabituales(p);
      if (!puedeAplicarClasificacion && !puedeAplicarStats) return null;

      const incrementos = puedeAplicarClasificacion ? calcularClasificacionComunitariaRanking(p) : null;
      const aplicarClasificacion = !!incrementos;
      if (!aplicarClasificacion && !puedeAplicarStats) return null;

      const jugadores = obtenerParticipantesRankingPostPartido(p).filter(function(uid) {
        return puedeAplicarStats || !!incrementos[uid];
      });
      if (jugadores.length === 0) return null;
      const usuarioRefs = jugadores.map(function(uid) {
        return db.collection("usuarios").doc(uid);
      });
      const pistaRef = p.pistaId ? db.collection("pistas").doc(p.pistaId) : null;
      const lecturas = usuarioRefs.map(function(usuarioRef) {
        return transaction.get(usuarioRef);
      });

      if (puedeAplicarStats && pistaRef) lecturas.push(transaction.get(pistaRef));

      return Promise.all(lecturas).then(function(docs) {
        const docsUsuarios = docs.slice(0, usuarioRefs.length);
        const docPista = puedeAplicarStats && pistaRef ? docs[docs.length - 1] : null;
        const contextoStats = puedeAplicarStats
          ? crearContextoStatsRankingPostPartido(p, docsUsuarios, docPista)
          : null;

        jugadores.forEach(function(uid, index) {
          const usuarioRef = usuarioRefs[index];
          const updateBase = aplicarClasificacion && incrementos[uid]
            ? crearUpdateLogrosPartidaPostPartido(incrementos[uid], p)
            : {};
          const updateStats = puedeAplicarStats
            ? crearUpdateStatsHabitualesPostPartido(uid, contextoStats, docsUsuarios[index])
            : {};

          const updateUsuario = Object.assign({}, updateBase, updateStats);
          if (Object.keys(updateUsuario).length > 0) {
            transaction.update(usuarioRef, updateUsuario);
          }
        });

        const updatePartida = {};
        if (aplicarClasificacion) {
          updatePartida.clasificacionComunitariaAplicada = true;
          updatePartida.clasificacionComunitariaAplicadaAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        if (puedeAplicarStats) {
          updatePartida.statsHabitualesAplicadas = true;
          updatePartida.statsHabitualesAplicadasAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        if (Object.keys(updatePartida).length > 0) transaction.update(partidaRef, updatePartida);

        return true;
      });
    });
  });
}

function esPartidaConResultadoPostPartido(p) {
  const tipo = obtenerTipoPostPartido(p);
  return tipo === "ranking" || tipo === "competitiva" || tipo === "competitivo";
}

function notificarPostPartido(uids, datos) {
  if (typeof window.crearNotificacionesParaUids !== "function") return Promise.resolve();

  const lista = arrayUnicoPostPartido(Array.isArray(uids) ? uids : [uids]);
  if (lista.length === 0) return Promise.resolve();

  return window.crearNotificacionesParaUids(lista, Object.assign({
    origen: "postpartido",
    prioridad: "alta",
    caducaAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    emailCritico: false
  }, datos)).catch(function(error) {
    console.warn("No se pudo crear aviso de postpartido:", error.message);
  });
}

function generarAvisoPostPartidoPartida(idPartida) {
  const ref = db.collection("partidas").doc(idPartida);

  return db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) return null;

      const p = doc.data() || {};
      if (!esPartidaPendientePostPartido(p)) return null;

      if (esPartidaRankingPostPartido(p)) {
        if (p.resultado || p.avisoIntroducirResultadoGeneradoAt) return null;

        const destinatariosResultado = obtenerJugadoresPermitidosResultadoRanking(p);
        if (destinatariosResultado.length === 0) return null;

        transaction.update(ref, {
          avisoIntroducirResultadoGeneradoAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return {
          tipo: "introducir_resultado",
          destinatarios: destinatariosResultado
        };
      }

      if (esPartidaAmistosaPostPartido(p)) {
        if (p.avisoValorarJugadoresGeneradoAt) return null;

        const participantesConfigurados = obtenerParticipantesAmistosaPostPartido(p);
        const participantes = participantesConfigurados.length > 0
          ? participantesConfigurados
          : arrayUnicoPostPartido(p.jugadores);
        const valoraciones = p.valoraciones || {};
        const destinatariosValoracion = participantes.filter(function(uid) {
          return !valoraciones[uid];
        });
        if (destinatariosValoracion.length === 0) return null;

        transaction.update(ref, {
          avisoValorarJugadoresGeneradoAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return {
          tipo: "valorar_jugadores",
          destinatarios: destinatariosValoracion
        };
      }

      return null;
    });
  }).then(function(aviso) {
    if (!aviso) return false;

    if (aviso.tipo === "introducir_resultado") {
      return notificarPostPartido(aviso.destinatarios, {
        tipo: "introducir_resultado",
        titulo: "Introduce el resultado",
        mensaje: "Si ya has terminado la partida, introduce el resultado para que el resto de jugadores pueda validarlo.",
        partidaId: idPartida,
        accion: "introducir_resultado",
        dedupeKey: "introducir_resultado_" + idPartida
      }).then(function() { return true; });
    }

    return notificarPostPartido(aviso.destinatarios, {
      tipo: "valorar_jugadores",
      titulo: "Valora a los jugadores",
      mensaje: "Han pasado 80 minutos desde el inicio de la partida amistosa. Ya puedes valorar a los jugadores.",
      partidaId: idPartida,
      accion: "valorar_jugadores",
      dedupeKey: "valorar_jugadores_" + idPartida
    }).then(function() { return true; });
  });
}

function aplicarIncumplimientosPostPartidoPartida(idPartida) {
  const ref = db.collection("partidas").doc(idPartida);

  return db.runTransaction(async function(transaction) {
    const doc = await transaction.get(ref);
    if (!doc.exists) return null;

    const p = doc.data() || {};
    if (p.incumplimientosPostPartidoAplicados === true) return null;
    if (!partidaSuperaPlazoPostPartido(p)) return null;

    const participantes = obtenerParticipantesIncumplimientoPostPartido(p);
    const incumplidores = obtenerUidsSinValorarPostPartido(p, participantes);
    const usuarioRefs = incumplidores.map(function(uid) {
      return db.collection("usuarios").doc(uid);
    });
    const usuarioDocs = await Promise.all(usuarioRefs.map(function(usuarioRef) {
      return transaction.get(usuarioRef);
    }));

    usuarioDocs.forEach(function(docUsuario, index) {
      if (!docUsuario.exists) return;

      const datosUsuario = docUsuario.data() || {};
      const clasificacion = datosUsuario.clasificacion || {};
      const compromisoActual = Number(clasificacion.compromisoLogro || 0);
      const compromisoNuevo = isNaN(compromisoActual)
        ? 0
        : Math.max(0, compromisoActual - 1);

      transaction.update(usuarioRefs[index], {
        "clasificacion.compromisoLogro": compromisoNuevo,
        "clasificacion.puntos": firebase.firestore.FieldValue.increment(-3)
      });
    });

    transaction.update(ref, {
      incumplimientosPostPartidoAplicados: true,
      incumplimientosPostPartidoAplicadosAt: firebase.firestore.FieldValue.serverTimestamp(),
      incumplimientosPostPartidoUids: incumplidores
    });

    return incumplidores;
  });
}

function revisarAvisosPostPartido() {
  if (!firebase.auth().currentUser) return Promise.resolve();

  return db.collection("partidas").where("estado", "==", "confirmada").get()
    .then(function(snapshot) {
      const tareas = [];
      snapshot.forEach(function(doc) {
        const p = doc.data() || {};
        if (esPartidaPendientePostPartido(p)) {
          tareas.push(generarAvisoPostPartidoPartida(doc.id));
        }
        if (partidaSuperaPlazoPostPartido(p)) {
          tareas.push(aplicarIncumplimientosPostPartidoPartida(doc.id));
        }
      });
      return Promise.all(tareas);
    })
    .catch(function(error) {
      console.warn("No se pudieron revisar los avisos postpartido:", error.message);
    });
}

function asegurarRevisionAvisosPostPartido() {
  if (window.revisionAvisosPostPartidoInterval) return;
  revisarAvisosPostPartido();
  window.revisionAvisosPostPartidoInterval = setInterval(function() {
    revisarAvisosPostPartido();
  }, 60 * 1000);
}

window.generarAvisoPostPartidoPartida = generarAvisoPostPartidoPartida;
window.revisarAvisosPostPartido = revisarAvisosPostPartido;
window.asegurarRevisionAvisosPostPartido = asegurarRevisionAvisosPostPartido;

function resolverAvisoPostPartido(uid, dedupeKey) {
  if (typeof window.resolverNotificacionPorDedupe !== "function") return Promise.resolve(false);
  return window.resolverNotificacionPorDedupe(uid, dedupeKey).catch(function(error) {
    console.warn("No se pudo resolver aviso de postpartido:", error.message);
    return false;
  });
}

function obtenerVersionResultadoPostPartido(resultado) {
  return resultado && resultado.resultadoVersion ? resultado.resultadoVersion : "sin_version";
}

function resolverAvisosResultadoPendiente(idPartida, resultado, uids) {
  const version = obtenerVersionResultadoPostPartido(resultado);
  const dedupeKeys = [
    "resultado_pendiente_" + idPartida + "_" + version,
    "nuevo_resultado_propuesto_" + idPartida + "_" + version
  ];
  return Promise.all(arrayUnicoPostPartido(uids).map(function(uid) {
    return Promise.all(dedupeKeys.map(function(dedupeKey) {
      return resolverAvisoPostPartido(uid, dedupeKey);
    }));
  }));
}

function resolverAvisosDisputaResultado(idPartida, resultado, uids) {
  const rechazos = arrayUnicoPostPartido(resultado && resultado.rechazos);
  const destinatarios = arrayUnicoPostPartido(uids);

  return Promise.all(rechazos.map(function(uidRechaza) {
    const dedupeKey = "resultado_disputa_" + idPartida + "_" + uidRechaza;
    return Promise.all(destinatarios.map(function(uid) {
      return resolverAvisoPostPartido(uid, dedupeKey);
    }));
  }));
}

function finalizarPartidaRankingSiCompleta(idPartida) {
  const partidaRef = db.collection("partidas").doc(idPartida);
  let debeGuardarHistorial = false;

  return db.runTransaction(function(transaction) {
    return transaction.get(partidaRef).then(function(doc) {
      if (!doc.exists) return false;

      const p = doc.data() || {};
      if (!partidaRankingConDatosCompletosPostPartido(p)) return false;
      if (p.rankingCompetitivoAplicado !== true) return false;
      if (p.clasificacionComunitariaAplicada !== true) return false;

      if (p.estado === "finalizada") {
        debeGuardarHistorial = p.guardadaEnHistorial !== true;
        return false;
      }

      if (p.estado !== "confirmada") return false;

      debeGuardarHistorial = true;
      transaction.update(partidaRef, {
        estado: "finalizada",
        finalizadaAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return true;
    });
  }).then(function() {
    if (!debeGuardarHistorial) return null;

    return partidaRef.get().then(function(docFinalizada) {
      if (!docFinalizada.exists) return null;
      if (typeof window.guardarPartidaFinalizada !== "function") {
        console.error("guardarPartidaFinalizada no disponible");
        return null;
      }

      return window.guardarPartidaFinalizada(docFinalizada.data() || {}, idPartida);
    });
  });
}

function cerrarPartidaRankingTrasValoraciones(idPartida) {
  const partidaRef = db.collection("partidas").doc(idPartida);

  return partidaRef.get().then(function(doc) {
    if (!doc.exists) return null;

    const p = doc.data() || {};
    if (!partidaRankingListaParaCierre(p)) return null;

    if (typeof window.aplicarRankingCompetitivo !== "function") {
      console.error("aplicarRankingCompetitivo no disponible");
      return null;
    }

    return window.aplicarRankingCompetitivo(idPartida)
      .then(function() {
        return aplicarClasificacionComunitariaRanking(idPartida);
      })
      .then(function() {
        return finalizarPartidaRankingSiCompleta(idPartida);
      });
  });
}

window.cierresRankingEnCurso = window.cierresRankingEnCurso || {};

function rankingNecesitaIntentoCierre(p) {
  return !!(
    partidaRankingConDatosCompletosPostPartido(p) &&
    p.estado !== "finalizada" &&
    (
      p.rankingCompetitivoAplicado !== true ||
      p.clasificacionComunitariaAplicada !== true ||
      p.guardadaEnHistorial !== true
    )
  );
}

function intentarCerrarRankingAtascada(idPartida, p) {
  if (!rankingNecesitaIntentoCierre(p)) return Promise.resolve(null);
  if (window.cierresRankingEnCurso[idPartida]) return Promise.resolve(null);

  window.cierresRankingEnCurso[idPartida] = true;

  return cerrarPartidaRankingTrasValoraciones(idPartida).then(function(resultado) {
    if (typeof cargarPartidas === "function") cargarPartidas();
    return resultado;
  }).catch(function(error) {
    console.error("Error cerrando ranking atascada:", error);
    throw error;
  }).then(function(resultado) {
    delete window.cierresRankingEnCurso[idPartida];
    return resultado;
  }, function(error) {
    delete window.cierresRankingEnCurso[idPartida];
    throw error;
  });
}

function puedeValorarPostPartido(p, uidActual) {
  const jugadores = p && Array.isArray(p.jugadores) ? p.jugadores : [];
  if (!uidActual) return false;
  if (!p || p.estado !== "confirmada") return false;
  if (mensajeBloqueoSustitucionPostPartido(p)) return false;
  if (!esPartidaPendientePostPartido(p)) return false;

  if (esPartidaAmistosaPostPartido(p)) {
    const reservas = Array.isArray(p.reservas) ? p.reservas : [];
    const participantes = obtenerParticipantesAmistosaPostPartido(p);
    if (participantes.length > 0) return participantes.includes(uidActual);
    return reservas.length > 0 && jugadores.includes(uidActual);
  }

  if (!esPartidaConResultadoPostPartido(p)) return false;

  return !!(p.resultado && p.resultado.estado === "validado" && obtenerParticipantesRankingPostPartido(p).includes(uidActual));
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

function crearBotonPrimarioPostPartido(texto, accion) {
  const btn = crearBotonPostPartido(texto, accion);
  btn.style.background = "#1565C0";
  btn.style.color = "#fff";
  return btn;
}

function crearBotonSecundarioPostPartido(texto, accion) {
  const btn = crearBotonPostPartido(texto, accion);
  btn.style.background = "#FFC107";
  btn.style.color = "#000";
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

function obtenerJugadoresPermitidosResultadoRanking(p) {
  const titulares = arrayUnicoPostPartido(p && p.jugadores);
  const reservas = arrayUnicoPostPartido(p && p.reservas);
  return arrayUnicoPostPartido(titulares.concat(reservas));
}

function obtenerJugadoresResultadoValidos(resultado) {
  if (!resultado || !Array.isArray(resultado.equipo1) || !Array.isArray(resultado.equipo2)) return [];
  const seleccionados = resultado.equipo1.concat(resultado.equipo2);
  if (seleccionados.length !== 4) return [];
  if (new Set(seleccionados).size !== 4) return [];
  return seleccionados;
}

function resultadoTieneEquiposValidos(resultado, jugadoresPermitidos) {
  if (!resultado || !Array.isArray(jugadoresPermitidos) || jugadoresPermitidos.length < 4) return false;
  if (!Array.isArray(resultado.equipo1) || !Array.isArray(resultado.equipo2)) return false;
  if (resultado.equipo1.length !== 2 || resultado.equipo2.length !== 2) return false;

  const seleccionados = obtenerJugadoresResultadoValidos(resultado);
  if (seleccionados.length !== 4) return false;

  return seleccionados.every(function(uid) {
    return jugadoresPermitidos.includes(uid);
  });
}

function leerYValidarEquiposResultado(jugadoresPermitidos) {
  const ids = obtenerIdsSelectsResultado();
  const seleccionados = ids.map(function(id) {
    const select = document.getElementById(id);
    return select ? select.value : "";
  });

  if (seleccionados.some(function(uid) { return !uid; })) {
    return { error: "Selecciona los 4 jugadores de los equipos." };
  }

  const seleccionadosUnicos = new Set(seleccionados);
  if (seleccionadosUnicos.size !== 4) {
    return { error: "No puede repetirse ningun jugador en los equipos." };
  }

  if (!seleccionados.every(function(uid) { return jugadoresPermitidos.includes(uid); })) {
    return { error: "Todos los jugadores seleccionados deben ser titulares o reservas de esta partida." };
  }

  return {
    equipo1: [seleccionados[0], seleccionados[1]],
    equipo2: [seleccionados[2], seleccionados[3]]
  };
}

function obtenerIdsSelectsResultado() {
  return [
    "resultadoEquipo1Jugador1",
    "resultadoEquipo1Jugador2",
    "resultadoEquipo2Jugador1",
    "resultadoEquipo2Jugador2"
  ];
}

function actualizarOpcionesSelectsResultado() {
  const ids = obtenerIdsSelectsResultado();

  ids.forEach(function(id) {
    const select = document.getElementById(id);
    if (!select) return;

    Array.prototype.slice.call(select.options).forEach(function(option) {
      option.disabled = false;
      option.hidden = false;
    });
  });
}

function prepararCambioSelectResultado(select) {
  if (!select || select.disabled) return;

  actualizarOpcionesSelectsResultado();
  const optionVacia = Array.prototype.slice.call(select.options).find(function(option) {
    return !option.value;
  });
  const optionActual = Array.prototype.slice.call(select.options).find(function(option) {
    return option.value && option.value === select.value;
  });
  if (optionActual) {
    if (optionVacia) optionVacia.hidden = true;
    optionActual.disabled = true;
    optionActual.hidden = true;
  }
}

function manejarCambioSelectResultado(select) {
  if (!select) return;

  actualizarOpcionesSelectsResultado();
  const valorSeleccionado = select.value;
  if (!valorSeleccionado) return;

  const otroSelect = obtenerIdsSelectsResultado().map(function(id) {
    return document.getElementById(id);
  }).find(function(candidato) {
    return candidato &&
      candidato !== select &&
      candidato.value === valorSeleccionado;
  });

  if (otroSelect) {
    otroSelect.value = "";
    alert("Ese jugador ya estaba seleccionado en otra posición. Esa posición ha quedado vacía para que elijas otro jugador.");
  }

  prepararCambioSelectResultado(select);
}

function fijarEquiposFormularioResultado(resultado, bloqueado) {
  if (!resultado) return;

  const valores = []
    .concat(Array.isArray(resultado.equipo1) ? resultado.equipo1 : [])
    .concat(Array.isArray(resultado.equipo2) ? resultado.equipo2 : []);
  const ids = obtenerIdsSelectsResultado();

  ids.forEach(function(id, index) {
    const select = document.getElementById(id);
    if (!select) return;
    select.value = valores[index] || "";
    select.disabled = bloqueado === true;
  });

  actualizarOpcionesSelectsResultado();
}

function equiposCorregidosFormularioResultado() {
  const overlay = document.getElementById("modalResultadoPostPartido");
  const modal = overlay ? overlay.querySelector(".postPartidoModal") : null;
  return !!(modal && modal.dataset.equiposCorregidos === "true");
}

function equiposHanCambiadoResultado(resultadoAnterior, equiposNuevos) {
  function firmaEquipos(resultado) {
    const parejas = [
      Array.isArray(resultado && resultado.equipo1) ? resultado.equipo1.slice().sort() : [],
      Array.isArray(resultado && resultado.equipo2) ? resultado.equipo2.slice().sort() : []
    ];
    return parejas.map(function(pareja) {
      return pareja.join("|");
    }).sort().join("::");
  }

  return firmaEquipos(resultadoAnterior) !== firmaEquipos(equiposNuevos);
}

function cargarDatosJugadoresPostPartido(jugadores) {
  return Promise.all(jugadores.map(function(uid) {
    return db.collection("usuarios").doc(uid).get().then(function(docUsuario) {
      const datos = docUsuario.exists ? (docUsuario.data() || {}) : {};
      return {
        uid: uid,
        nombre: datos.nombre || "Jugador"
      };
    });
  }));
}

function nombreJugadorPostPartido(uid, mapaNombres) {
  return mapaNombres[uid] || "Jugador";
}

function textoGanadorResultado(ganador) {
  if (ganador === "A") return "Equipo 1";
  if (ganador === "B") return "Equipo 2";
  return "-";
}

function crearResumenResultadoPendiente(resultado, jugadores) {
  const resumen = document.createElement("div");
  resumen.className = "postPartidoResultadoResumen";
  resumen.appendChild(crearTextoPostPartido("Resultado propuesto:"));
  resumen.appendChild(crearTextoPostPartido("Cargando equipos..."));

  cargarDatosJugadoresPostPartido(jugadores).then(function(datosJugadores) {
    const mapaNombres = {};
    datosJugadores.forEach(function(jugador) {
      mapaNombres[jugador.uid] = jugador.nombre;
    });

    const fragment = document.createDocumentFragment();
    fragment.appendChild(crearTextoPostPartido("Resultado propuesto:"));
    fragment.appendChild(crearTextoPostPartido(
      "Equipo 1: " +
      nombreJugadorPostPartido(resultado.equipo1[0], mapaNombres) +
      " / " +
      nombreJugadorPostPartido(resultado.equipo1[1], mapaNombres)
    ));
    fragment.appendChild(crearTextoPostPartido(
      "Equipo 2: " +
      nombreJugadorPostPartido(resultado.equipo2[0], mapaNombres) +
      " / " +
      nombreJugadorPostPartido(resultado.equipo2[1], mapaNombres)
    ));

    (resultado.sets || []).forEach(function(set, index) {
      fragment.appendChild(crearTextoPostPartido(
        "Set " + (index + 1) + ": " + set.a + " - " + set.b
      ));
    });

    fragment.appendChild(crearTextoPostPartido("Ganador: " + textoGanadorResultado(resultado.ganador)));
    resumen.replaceChildren(fragment);
  }).catch(function(error) {
    console.error("Error cargando resumen de resultado:", error);
    resumen.replaceChildren(crearTextoPostPartido("No se pudo cargar el resumen del resultado."));
  });

  return resumen;
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
    const jugadoresPermitidos = obtenerJugadoresPermitidosResultadoRanking(p);

    if (!jugadoresPermitidos.includes(user.uid)) {
      alert("Solo los jugadores titulares o reservas pueden introducir resultado");
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

    if (
      p.resultado &&
      p.resultado.estado === "pendiente" &&
      resultadoTieneEquiposValidos(p.resultado, jugadoresPermitidos)
    ) {
      alert("Ya hay un resultado pendiente de validación");
      return;
    }

    if (
      p.resultado &&
      p.resultado.estado !== "disputa" &&
      !(p.resultado.estado === "pendiente" && !resultadoTieneEquiposValidos(p.resultado, jugadoresPermitidos))
    ) {
      alert("Este resultado no se puede sobrescribir");
      return;
    }

    const resultadoAnterior = p.resultado || null;
    const vieneDeDisputa = resultadoAnterior && resultadoAnterior.estado === "disputa";
    const editaEquipos = vieneDeDisputa && equiposCorregidosFormularioResultado();
    let equipos = null;

    if (vieneDeDisputa && !editaEquipos) {
      equipos = {
        equipo1: Array.isArray(resultadoAnterior.equipo1) ? resultadoAnterior.equipo1.slice() : [],
        equipo2: Array.isArray(resultadoAnterior.equipo2) ? resultadoAnterior.equipo2.slice() : []
      };

      if (!resultadoTieneEquiposValidos(equipos, jugadoresPermitidos)) {
        alert("El resultado anterior no tiene equipos validos. Pulsa Corregir equipos para seleccionarlos de nuevo.");
        return;
      }
    } else {
      equipos = leerYValidarEquiposResultado(jugadores);
      if (equipos.error) {
        alert(equipos.error);
        return;
      }
    }
    const equiposModificados = vieneDeDisputa &&
      equiposHanCambiadoResultado(resultadoAnterior, equipos);

    const resultadoVersion = Date.now();
    const resultadoNuevo = {
      estado: "pendiente",
      equipo1: equipos.equipo1,
      equipo2: equipos.equipo2,
      sets: validacion.sets,
      ganador: validacion.ganador,
      propuestoPor: user.uid,
      propuestoAt: firebase.firestore.FieldValue.serverTimestamp(),
      resultadoVersion: resultadoVersion,
      equiposCorregidos: equiposModificados,
      validaciones: [user.uid],
      rechazos: []
    };
    const participantesResultado = obtenerJugadoresResultadoValidos(resultadoNuevo);
    const destinatarios = participantesResultado.filter(function(uid) {
      return uid !== user.uid;
    });
    const tipoAviso = vieneDeDisputa ? "nuevo_resultado_propuesto" : "resultado_pendiente";
    let mensajeAviso = vieneDeDisputa
      ? "Se ha propuesto un nuevo resultado. Debes validarlo o rechazarlo. Si no respondes podrán aplicarse penalizaciones."
      : "Se ha introducido un resultado. Debes validarlo o rechazarlo. La validación del resultado es obligatoria. La falta de respuesta puede conllevar penalizaciones.";

    if (equiposModificados) {
      mensajeAviso = "Se ha propuesto un nuevo resultado y también se han modificado los equipos. Revisa marcador y parejas antes de validar o rechazar.";
    }

    return ref.update({
      resultado: resultadoNuevo
    }).then(function() {
      const participantesDisputa = vieneDeDisputa
        ? arrayUnicoPostPartido(obtenerJugadoresResultadoValidos(resultadoAnterior).concat(participantesResultado).concat(resultadoAnterior.propuestoPor || []))
        : [];
      const resolverDisputa = vieneDeDisputa
        ? resolverAvisosDisputaResultado(id, resultadoAnterior, participantesDisputa)
        : Promise.resolve();

      return resolverDisputa.then(function() {
        return notificarPostPartido(destinatarios, {
          tipo: tipoAviso,
          titulo: equiposModificados
            ? "Nuevo resultado y equipos propuestos"
            : (vieneDeDisputa ? "Nuevo resultado propuesto" : "Resultado pendiente"),
          mensaje: mensajeAviso,
          partidaId: id,
          accion: "validar_resultado",
          dedupeKey: tipoAviso + "_" + id + "_" + resultadoVersion,
          data: {
            resultadoVersion: resultadoVersion,
            propuestoPor: user.uid,
            equiposCorregidos: equiposModificados
          }
        });
      });
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

function crearSelectJugadorResultado(id, jugadoresDatos) {
  const select = document.createElement("select");
  select.id = id;
  select.onfocus = function() {
    prepararCambioSelectResultado(select);
  };
  select.onmousedown = function() {
    prepararCambioSelectResultado(select);
  };
  select.onblur = actualizarOpcionesSelectsResultado;
  select.onchange = function() {
    manejarCambioSelectResultado(select);
  };

  const vacia = document.createElement("option");
  vacia.value = "";
  vacia.textContent = "Seleccionar";
  select.appendChild(vacia);

  jugadoresDatos.forEach(function(jugador) {
    const option = document.createElement("option");
    option.value = jugador.uid;
    option.textContent = jugador.nombre || "Jugador";
    select.appendChild(option);
  });

  return select;
}

function crearFilaSelectorEquipoResultado(labelTexto, selectId, jugadoresDatos) {
  const fila = document.createElement("label");
  fila.className = "postPartidoValoracionFila";
  fila.style.gridTemplateColumns = "minmax(90px, 1fr) minmax(160px, 2fr)";

  const texto = document.createElement("span");
  texto.textContent = labelTexto;

  fila.appendChild(texto);
  fila.appendChild(crearSelectJugadorResultado(selectId, jugadoresDatos));
  return fila;
}

function crearBloqueEquipoResultado(tituloTexto, selectId1, selectId2, jugadoresDatos) {
  const bloque = document.createElement("div");
  bloque.className = "postPartidoValoracionJugador";

  const titulo = document.createElement("h4");
  titulo.textContent = tituloTexto;

  bloque.appendChild(titulo);
  bloque.appendChild(crearFilaSelectorEquipoResultado("Jugador 1", selectId1, jugadoresDatos));
  bloque.appendChild(crearFilaSelectorEquipoResultado("Jugador 2", selectId2, jugadoresDatos));
  return bloque;
}

function construirFormularioResultado(id, jugadoresDatos, p) {
  cerrarFormularioResultado();
  p = p || {};
  const resultadoDisputa = p.resultado && p.resultado.estado === "disputa" ? p.resultado : null;
  const bloquearEquipos = !!(resultadoDisputa && resultadoTieneEquiposValidos(resultadoDisputa, obtenerJugadoresPermitidosResultadoRanking(p)));

  const overlay = document.createElement("div");
  overlay.id = "modalResultadoPostPartido";
  overlay.className = "postPartidoModalOverlay";

  const modal = document.createElement("div");
  modal.className = "postPartidoModal";
  modal.dataset.equiposCorregidos = "false";

  const titulo = document.createElement("h3");
  titulo.textContent = resultadoDisputa ? "Proponer nuevo resultado" : "Introducir resultado";

  const descripcion = document.createElement("p");
  descripcion.textContent = bloquearEquipos
    ? "Equipos del resultado rechazado. Modifica solo el marcador o corrige equipos si hace falta."
    : "Selecciona los equipos reales de la partida.";

  const cabecera = document.createElement("div");
  cabecera.className = "postPartidoSetFila postPartidoSetCabecera";
  cabecera.appendChild(document.createElement("div"));
  cabecera.appendChild(crearTextoPostPartido("Equipo 1"));
  cabecera.appendChild(crearTextoPostPartido("Equipo 2"));

  const acciones = document.createElement("div");
  acciones.className = "postPartidoModalAcciones";

  const cancelar = crearBotonSecundarioPostPartido("Cancelar", cerrarFormularioResultado);
  const guardar = crearBotonPrimarioPostPartido("Guardar resultado", function() {
    guardarResultadoPropuesto(id);
  });
  guardar.style.background = "#2E7D32";

  acciones.appendChild(cancelar);

  if (bloquearEquipos) {
    const corregirEquipos = crearBotonPostPartido("Corregir equipos", function() {
      modal.dataset.equiposCorregidos = "true";
      obtenerIdsSelectsResultado().forEach(function(selectId) {
        const select = document.getElementById(selectId);
        if (select) select.disabled = false;
      });
      descripcion.textContent = "Corrige los equipos y modifica el marcador.";
      corregirEquipos.disabled = true;
      actualizarOpcionesSelectsResultado();
    });
    corregirEquipos.style.background = "#1565C0";
    corregirEquipos.style.color = "#fff";
    acciones.appendChild(corregirEquipos);
  }

  acciones.appendChild(guardar);

  modal.appendChild(titulo);
  modal.appendChild(descripcion);
  modal.appendChild(crearBloqueEquipoResultado(
    "Equipo 1",
    "resultadoEquipo1Jugador1",
    "resultadoEquipo1Jugador2",
    jugadoresDatos
  ));
  modal.appendChild(crearBloqueEquipoResultado(
    "Equipo 2",
    "resultadoEquipo2Jugador1",
    "resultadoEquipo2Jugador2",
    jugadoresDatos
  ));
  modal.appendChild(cabecera);
  modal.appendChild(crearFilaSetResultado(1, false));
  modal.appendChild(crearFilaSetResultado(2, false));
  modal.appendChild(crearFilaSetResultado(3, true));
  modal.appendChild(acciones);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  if (bloquearEquipos) {
    fijarEquiposFormularioResultado(resultadoDisputa, true);
  } else {
    actualizarOpcionesSelectsResultado();
  }
}

function crearFormularioResultado(id) {
  const ref = db.collection("partidas").doc(id);

  ref.get().then(function(doc) {
    if (!doc.exists) {
      alert("La partida ya no existe");
      return;
    }

    const p = doc.data() || {};
    const jugadores = Array.isArray(p.jugadores) ? p.jugadores : [];
    const jugadoresUnicos = new Set(jugadores);
    const jugadoresPermitidos = obtenerJugadoresPermitidosResultadoRanking(p);
    const mensajeBloqueo = mensajeBloqueoSustitucionPostPartido(p);

    if (mensajeBloqueo) {
      alert(mensajeBloqueo);
      return;
    }

    if (jugadores.length !== 4 || jugadoresUnicos.size !== 4) {
      alert("La partida necesita 4 titulares para introducir resultado");
      return;
    }

    return cargarDatosJugadoresPostPartido(jugadores).then(function(jugadoresDatos) {
      construirFormularioResultado(id, jugadoresDatos, p);
    });
  }).catch(function(error) {
    console.error("Error abriendo formulario de resultado:", error);
    alert("No se pudo abrir el formulario de resultado");
  });
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
    const jugadores = obtenerParticipantesValoracionPostPartido(p);
    const jugadoresUnicos = new Set(jugadores);
    const mensajeBloqueo = mensajeBloqueoSustitucionPostPartido(p);

    if (mensajeBloqueo) {
      alert(mensajeBloqueo);
      return;
    }

    if (!puedeValorarPostPartido(p, user.uid)) {
      alert("Esta partida no admite valoraciones en este momento");
      return;
    }

    if (!jugadores.includes(user.uid)) {
      alert("Solo los jugadores participantes pueden valorar");
      return;
    }

    if (jugadores.length < 2 || jugadoresUnicos.size !== jugadores.length) {
      alert("La partida necesita participantes válidos para valorar");
      return;
    }

    if (p.valoraciones && p.valoraciones[user.uid]) {
      if (rankingNecesitaIntentoCierre(p)) {
        return intentarCerrarRankingAtascada(id, p).then(function() {
          cerrarFormularioValoraciones();
        });
      }

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
      if (!esPartidaAmistosaPostPartido(partidaActualizada)) {
        if (partidaRankingListaParaCierre(partidaActualizada)) {
          return cerrarPartidaRankingTrasValoraciones(id);
        }

        return null;
      }
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
        if (typeof window.guardarPartidaFinalizada !== "function") {
          console.error("guardarPartidaFinalizada no disponible");
          return null;
        }

        return window.guardarPartidaFinalizada(partidaFinalizada, id);
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
    const jugadores = obtenerParticipantesValoracionPostPartido(p);
    const jugadoresUnicos = new Set(jugadores);
    const mensajeBloqueo = mensajeBloqueoSustitucionPostPartido(p);

    if (mensajeBloqueo) {
      alert(mensajeBloqueo);
      return;
    }

    if (!puedeValorarPostPartido(p, user.uid)) {
      alert("Esta partida no admite valoraciones en este momento");
      return;
    }

    if (esPartidaAmistosaPostPartido(p) && jugadores.length === 0 && Array.isArray(p.reservas) && p.reservas.length > 0) {
      abrirSelectorReservasParticipantesAmistosa(id, p);
      return;
    }

    if (!jugadores.includes(user.uid)) {
      alert("Solo los jugadores participantes pueden valorar");
      return;
    }

    if (jugadores.length < 2 || jugadoresUnicos.size !== jugadores.length) {
      alert("La partida necesita participantes válidos para valorar");
      return;
    }

    if (
      esPartidaAmistosaPostPartido(p) &&
      (!Array.isArray(p.reservas) || p.reservas.length === 0) &&
      !Array.isArray(p.participantesPostPartido)
    ) {
      ref.set({ participantesPostPartido: jugadores }, { merge: true });
    }

    if (p.valoraciones && p.valoraciones[user.uid]) {
      alert("Ya has valorado esta partida.");
      return;
    }

    const otrosJugadores = jugadores.filter(function(uid) { return uid !== user.uid; });
    if (otrosJugadores.length < 1) {
      alert("La partida necesita participantes válidos para valorar");
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
      crearFormularioValoraciones(
        id,
        jugadoresValorados,
        esPartidaAmistosaPostPartido(p) ? "amistosa" : "ranking"
      );
    });
  }).catch(function(error) {
    console.error("Error abriendo valoraciones:", error);
    alert("No se pudieron abrir las valoraciones");
  });
}

function crearFormularioValoraciones(id, jugadoresValorados, tipoValoracion) {
  cerrarFormularioValoraciones();

  const overlay = document.createElement("div");
  overlay.id = "modalValoracionesPostPartido";
  overlay.className = "postPartidoModalOverlay";

  const modal = document.createElement("div");
  modal.className = "postPartidoModal";

  const titulo = document.createElement("h3");
  titulo.textContent = "Valorar jugadores";

  const descripcion = document.createElement("p");
  descripcion.textContent = "Valora a los otros " + jugadoresValorados.length + " participantes de esta partida " + (tipoValoracion || "amistosa") + ".";

  const acciones = document.createElement("div");
  acciones.className = "postPartidoModalAcciones";

  const cancelar = crearBotonSecundarioPostPartido("Cancelar", cerrarFormularioValoraciones);
  const guardar = crearBotonPrimarioPostPartido("Guardar valoraciones", function() {
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

function abrirSelectorReservasParticipantesAmistosa(id, p) {
  cerrarFormularioValoraciones();

  const jugadores = arrayUnicoPostPartido(p.jugadores);
  const reservas = arrayUnicoPostPartido(p.reservas);
  if (reservas.length === 0) {
    db.collection("partidas").doc(id).set({
      participantesPostPartido: jugadores
    }, { merge: true }).then(function() {
      abrirFormularioValoracionesAmistosa(id);
    });
    return;
  }

  cargarDatosJugadoresPostPartido(reservas).then(function(reservasDatos) {
    const overlay = document.createElement("div");
    overlay.id = "modalValoracionesPostPartido";
    overlay.className = "postPartidoModalOverlay";

    const modal = document.createElement("div");
    modal.className = "postPartidoModal";

    const titulo = document.createElement("h3");
    titulo.textContent = "Reservas participantes";

    const descripcion = document.createElement("p");
    descripcion.textContent = "¿Qué reservas participaron?";

    const lista = document.createElement("div");
    lista.className = "postPartidoReservasParticipantes";

    reservasDatos.forEach(function(reserva) {
      const fila = document.createElement("label");
      fila.className = "postPartidoReservaParticipanteFila";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = reserva.uid;
      checkbox.className = "reservaParticipantePostPartido";

      const nombre = document.createElement("span");
      nombre.textContent = reserva.nombre || "Jugador";

      fila.appendChild(checkbox);
      fila.appendChild(nombre);
      lista.appendChild(fila);
    });

    const acciones = document.createElement("div");
    acciones.className = "postPartidoModalAcciones";

    const cancelar = crearBotonSecundarioPostPartido("Cancelar", cerrarFormularioValoraciones);
    const continuar = crearBotonPrimarioPostPartido("Continuar", function() {
      const seleccionados = Array.prototype.slice.call(document.querySelectorAll(".reservaParticipantePostPartido"))
        .filter(function(input) { return input.checked; })
        .map(function(input) { return input.value; });

      const participantes = arrayUnicoPostPartido(jugadores.concat(seleccionados));
      db.collection("partidas").doc(id).set({
        participantesPostPartido: participantes
      }, { merge: true }).then(function() {
        cerrarFormularioValoraciones();
        abrirFormularioValoracionesAmistosa(id);
      }).catch(function(error) {
        console.error("Error guardando reservas participantes:", error);
        alert("No se pudo guardar la selección de reservas participantes");
      });
    });

    acciones.appendChild(cancelar);
    acciones.appendChild(continuar);

    modal.appendChild(titulo);
    modal.appendChild(descripcion);
    modal.appendChild(lista);
    modal.appendChild(acciones);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }).catch(function(error) {
    console.error("Error abriendo selección de reservas participantes:", error);
    alert("No se pudo abrir la selección de reservas participantes");
  });
}

window.crearAccionesPostPartido = function(id, p, uidActual) {
  const jugadores = p && Array.isArray(p.jugadores) ? p.jugadores : [];
  const participantesValoracion = obtenerParticipantesValoracionPostPartido(p);
  const participantesResultado = obtenerJugadoresResultadoValidos(p && p.resultado);
  const reservas = p && Array.isArray(p.reservas) ? p.reservas : [];
  const puedeConfigurarReservasAmistosa = esPartidaAmistosaPostPartido(p) && reservas.length > 0 && participantesValoracion.length === 0 && jugadores.includes(uidActual);
  const puedeActuarResultadoRanking = esPartidaConResultadoPostPartido(p) && reservas.includes(uidActual);
  if (!uidActual || (!jugadores.includes(uidActual) && !participantesValoracion.includes(uidActual) && !participantesResultado.includes(uidActual) && !puedeActuarResultadoRanking)) return null;
  if (!esPartidaPendientePostPartido(p)) return null;

  const resultado = p.resultado || null;
  const estadoResultado = resultado && resultado.estado;
  const mensajeBloqueo = mensajeBloqueoSustitucionPostPartido(p);
  const box = document.createElement("div");
  box.className = "postPartidoBox";

  if (mensajeBloqueo) {
    box.appendChild(crearTextoPostPartido(mensajeBloqueo));
    return box;
  }

  if (esPartidaAmistosaPostPartido(p)) {
    box.appendChild(crearTextoPostPartido("Partida amistosa. No necesita resultado."));

    if (!puedeConfigurarReservasAmistosa && p.valoraciones && p.valoraciones[uidActual]) {
      box.appendChild(crearTextoPostPartido("Ya has valorado esta partida."));
      return box;
    }

    const accionesAmistosa = document.createElement("div");
    accionesAmistosa.className = "postPartidoAcciones";
    accionesAmistosa.appendChild(crearBotonPrimarioPostPartido("Valorar jugadores", function() {
      window.abrirValoracionesPostPartido(id);
    }));
    box.appendChild(accionesAmistosa);
    return box;
  }

  if (!esPartidaConResultadoPostPartido(p)) return null;

  if (!resultado) {
    const acciones = document.createElement("div");
    acciones.className = "postPartidoAcciones";
    acciones.appendChild(crearBotonPrimarioPostPartido("Introducir resultado", function() {
      window.abrirFormularioResultado(id);
    }));
    box.appendChild(acciones);
    return box;
  }

  if (estadoResultado === "pendiente") {
    const validaciones = Array.isArray(resultado.validaciones) ? resultado.validaciones : [];
    const jugadoresPermitidos = obtenerJugadoresPermitidosResultadoRanking(p);
    box.appendChild(crearTextoPostPartido("Resultado pendiente de validación"));

    if (!resultadoTieneEquiposValidos(resultado, jugadoresPermitidos)) {
      box.appendChild(crearTextoPostPartido("Resultado pendiente sin equipos registrados. Debe proponerse de nuevo."));

      const accionesSinEquipos = document.createElement("div");
      accionesSinEquipos.className = "postPartidoAcciones";
      accionesSinEquipos.appendChild(crearBotonPrimarioPostPartido("Proponer nuevo resultado", function() {
        window.abrirFormularioResultado(id);
      }));
      box.appendChild(accionesSinEquipos);
      return box;
    }

    box.appendChild(crearResumenResultadoPendiente(resultado, jugadoresPermitidos));

    if (validaciones.includes(uidActual)) {
      box.appendChild(crearTextoPostPartido("Resultado validado por ti"));
      return box;
    }

    const accionesPendiente = document.createElement("div");
    accionesPendiente.className = "postPartidoAcciones";
    accionesPendiente.appendChild(crearBotonPrimarioPostPartido("Confirmar resultado", function() {
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
    accionesDisputa.appendChild(crearBotonPrimarioPostPartido("Proponer nuevo resultado", function() {
      window.abrirFormularioResultado(id);
    }));
    box.appendChild(accionesDisputa);
    return box;
  }

  if (estadoResultado === "validado") {
    if (rankingNecesitaIntentoCierre(p)) {
      intentarCerrarRankingAtascada(id, p);
    }

    box.appendChild(crearTextoPostPartido("Resultado validado. Pendiente de valoraciones."));

    if (p.valoraciones && p.valoraciones[uidActual]) {
      box.appendChild(crearTextoPostPartido("Ya has valorado esta partida."));
      return box;
    }

    if (puedeValorarPostPartido(p, uidActual)) {
      const accionesValoracion = document.createElement("div");
      accionesValoracion.className = "postPartidoAcciones";
      accionesValoracion.appendChild(crearBotonPrimarioPostPartido("Valorar jugadores", function() {
        window.abrirValoracionesPostPartido(id);
      }));
      box.appendChild(accionesValoracion);
    }

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

function validarContextoResultadoPendiente(p, uid) {
  const jugadoresPermitidos = obtenerJugadoresPermitidosResultadoRanking(p);
  const mensajeBloqueo = mensajeBloqueoSustitucionPostPartido(p);

  if (mensajeBloqueo) {
    return { error: mensajeBloqueo };
  }

  if (jugadoresPermitidos.length < 4) {
    return { error: "La partida necesita jugadores titulares o reservas suficientes para validar resultado" };
  }

  if (p.estado !== "confirmada") {
    return { error: "Esta partida no admite validacion de resultado en este momento" };
  }

  if (!p.resultado || typeof p.resultado !== "object") {
    return { error: "No hay resultado pendiente" };
  }

  if (p.resultado.estado !== "pendiente") {
    return { error: "El resultado ya no esta pendiente" };
  }

  if (!resultadoTieneEquiposValidos(p.resultado, jugadoresPermitidos)) {
    return { error: "Resultado pendiente sin equipos registrados. Debe proponerse de nuevo." };
  }

  const jugadoresResultado = obtenerJugadoresResultadoValidos(p.resultado);
  if (!jugadoresResultado.includes(uid)) {
    return { error: "Solo los jugadores del resultado pueden validar el resultado" };
  }

  return { jugadores: jugadoresResultado, resultado: p.resultado };
}

window.confirmarResultadoPartida = function(id) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Debes iniciar sesion");
    return;
  }

  const ref = db.collection("partidas").doc(id);

  db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) throw new Error("La partida ya no existe");

      const p = doc.data() || {};
      const contexto = validarContextoResultadoPendiente(p, user.uid);
      if (contexto.error) throw new Error(contexto.error);

      const resultadoActual = contexto.resultado;
      const validaciones = Array.isArray(resultadoActual.validaciones)
        ? resultadoActual.validaciones.filter(function(uid) { return contexto.jugadores.includes(uid); })
        : [];
      const rechazos = Array.isArray(resultadoActual.rechazos)
        ? resultadoActual.rechazos.filter(function(uid) { return uid !== user.uid; })
        : [];

      if (!validaciones.includes(user.uid)) validaciones.push(user.uid);

      const titularesValidados = contexto.jugadores.every(function(uid) {
        return validaciones.includes(uid);
      });

      const resultadoNuevo = Object.assign({}, resultadoActual, {
        estado: titularesValidados ? "validado" : "pendiente",
        validaciones: validaciones,
        rechazos: rechazos
      });

      if (titularesValidados) {
        resultadoNuevo.validadoAt = firebase.firestore.FieldValue.serverTimestamp();
      }

      transaction.update(ref, { resultado: resultadoNuevo });
      return {
        titularesValidados: titularesValidados,
        jugadores: contexto.jugadores,
        resultadoAnterior: resultadoActual,
        resultadoNuevo: resultadoNuevo
      };
    });
  }).then(function(resultado) {
    if (!resultado) return;

    const resolver = resultado.titularesValidados
      ? resolverAvisosResultadoPendiente(id, resultado.resultadoAnterior, resultado.jugadores)
      : resolverAvisosResultadoPendiente(id, resultado.resultadoAnterior, [user.uid]);

    return resolver.then(function() {
      if (!resultado.titularesValidados) return;

      return notificarPostPartido(resultado.jugadores, {
        tipo: "resultado_validado",
        titulo: "Resultado validado",
        mensaje: "Valora a los jugadores que participaron en la partida.",
        partidaId: id,
        accion: "valorar_jugadores",
        dedupeKey: "resultado_validado_" + id,
        data: {
          resultadoVersion: obtenerVersionResultadoPostPartido(resultado.resultadoNuevo)
        }
      });
    }).then(function() {
      if (typeof cargarPartidas === "function") cargarPartidas();
    });
  }).catch(function(error) {
    console.error("Error confirmando resultado:", error);
    alert(error && error.message ? error.message : "No se pudo confirmar el resultado");
  });
};

window.rechazarResultadoPartida = function(id) {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Debes iniciar sesion");
    return;
  }

  const ref = db.collection("partidas").doc(id);

  db.runTransaction(function(transaction) {
    return transaction.get(ref).then(function(doc) {
      if (!doc.exists) throw new Error("La partida ya no existe");

      const p = doc.data() || {};
      const contexto = validarContextoResultadoPendiente(p, user.uid);
      if (contexto.error) throw new Error(contexto.error);

      const resultadoActual = contexto.resultado;
      const validaciones = Array.isArray(resultadoActual.validaciones)
        ? resultadoActual.validaciones.filter(function(uid) { return uid !== user.uid; })
        : [];
      const rechazos = Array.isArray(resultadoActual.rechazos)
        ? resultadoActual.rechazos.slice()
        : [];

      if (!rechazos.includes(user.uid)) rechazos.push(user.uid);

      const resultadoNuevo = Object.assign({}, resultadoActual, {
        estado: "disputa",
        validaciones: validaciones,
        rechazos: rechazos,
        disputaAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(ref, { resultado: resultadoNuevo });
      return {
        jugadores: contexto.jugadores,
        resultadoAnterior: resultadoActual,
        resultadoNuevo: resultadoNuevo
      };
    });
  }).then(function(resultado) {
    if (!resultado) return;

    const destinatarios = arrayUnicoPostPartido(resultado.jugadores.concat(resultado.resultadoAnterior.propuestoPor || [])).filter(function(uid) {
      return uid !== user.uid;
    });

    return resolverAvisosResultadoPendiente(id, resultado.resultadoAnterior, resultado.jugadores).then(function() {
      return notificarPostPartido(destinatarios, {
        tipo: "resultado_disputa",
        titulo: "Resultado en disputa",
        mensaje: "Un jugador ha rechazado el resultado. La partida entra en disputa. Utilizad el chat de partida para llegar a un acuerdo. Si no se completa el resultado dentro del plazo establecido podrán aplicarse penalizaciones.",
        partidaId: id,
        accion: "abrir_partida",
        dedupeKey: "resultado_disputa_" + id + "_" + user.uid,
        data: {
          resultadoVersion: obtenerVersionResultadoPostPartido(resultado.resultadoAnterior),
          rechazadoPor: user.uid
        }
      });
    }).then(function() {
      if (typeof cargarPartidas === "function") cargarPartidas();
    });
  }).catch(function(error) {
    console.error("Error rechazando resultado:", error);
    alert(error && error.message ? error.message : "No se pudo rechazar el resultado");
  });
};
