function normalizarNivelCompetitivo(valor) {
  const numero = parseFloat(valor);
  if (isNaN(numero)) return 0.25;

  return Math.min(7, Math.max(0.25, numero));
}

function formatearNivelCompetitivo(valor) {
  return normalizarNivelCompetitivo(valor).toFixed(2);
}

function calcularBonusDiferenciaRanking(diff) {
  if (diff < 0.5) return 0;
  if (diff < 1) return 0.02;
  if (diff < 1.5) return 0.05;
  return 0.09;
}

function calcularBonusMarcadorRanking(resultado) {
  const sets = Array.isArray(resultado && resultado.sets) ? resultado.sets : [];
  let setsGanador = 0;
  let setsPerdedor = 0;

  sets.forEach(function(set) {
    const ganaA = Number(set.a) > Number(set.b);
    const ganaB = Number(set.b) > Number(set.a);

    if (resultado.ganador === "A") {
      if (ganaA) setsGanador++;
      if (ganaB) setsPerdedor++;
    }

    if (resultado.ganador === "B") {
      if (ganaB) setsGanador++;
      if (ganaA) setsPerdedor++;
    }
  });

  return setsGanador === 2 && setsPerdedor === 0 ? 0.02 : 0;
}

function mediaEquipoRanking(equipo, niveles) {
  return equipo.reduce(function(total, uid) {
    return total + niveles[uid];
  }, 0) / equipo.length;
}

function resultadoRankingValido(resultado, jugadoresPermitidos) {
  if (!resultado || resultado.estado !== "validado") return false;
  if (!Array.isArray(resultado.equipo1) || !Array.isArray(resultado.equipo2)) return false;
  if (resultado.equipo1.length !== 2 || resultado.equipo2.length !== 2) return false;
  if (resultado.ganador !== "A" && resultado.ganador !== "B") return false;

  const seleccionados = resultado.equipo1.concat(resultado.equipo2);
  const unicos = new Set(seleccionados);
  if (seleccionados.length !== 4 || unicos.size !== 4) return false;

  return seleccionados.every(function(uid) {
    return jugadoresPermitidos.includes(uid);
  });
}

window.aplicarRankingCompetitivo = async function(idPartida) {
  const partidaRef = db.collection("partidas").doc(idPartida);

  return db.runTransaction(async function(transaction) {
    const partidaDoc = await transaction.get(partidaRef);
    if (!partidaDoc.exists) return null;

   const p = partidaDoc.data() || {};
   const tipo = String(p.tipo || "ranking").toLowerCase().trim();
   const titulares = Array.isArray(p.jugadores) ? p.jugadores : [];
   const reservas = Array.isArray(p.reservas) ? p.reservas : [];
   const jugadoresPermitidos = titulares.concat(reservas).filter(function(uid, index, lista) {
     return !!uid && lista.indexOf(uid) === index;
   });

   if (p.rankingCompetitivoAplicado === true) return null;
   if (tipo !== "ranking") return null;
   if (!resultadoRankingValido(p.resultado, jugadoresPermitidos)) return null;

   const resultado = p.resultado;
   const jugadores = resultado.equipo1.concat(resultado.equipo2);
   const equipoGanador = resultado.ganador === "A" ? resultado.equipo1 : resultado.equipo2;
    const equipoPerdedor = resultado.ganador === "A" ? resultado.equipo2 : resultado.equipo1;
    const usuarioRefs = jugadores.map(function(uid) {
      return db.collection("usuarios").doc(uid);
    });
    const usuarioDocs = await Promise.all(usuarioRefs.map(function(ref) {
      return transaction.get(ref);
    }));
    const niveles = {};
    const nivelesIniciales = {};

    usuarioDocs.forEach(function(doc, index) {
      const uid = jugadores[index];
      const datos = doc.exists ? (doc.data() || {}) : {};
      const nivelActual = normalizarNivelCompetitivo(datos.nivel);
      const nivelInicial = datos.nivelInicial === undefined || datos.nivelInicial === null || datos.nivelInicial === ""
        ? nivelActual
        : normalizarNivelCompetitivo(datos.nivelInicial);

      niveles[uid] = nivelActual;
      nivelesIniciales[uid] = nivelInicial;
    });

    const mediaEquipo1 = mediaEquipoRanking(resultado.equipo1, niveles);
    const mediaEquipo2 = mediaEquipoRanking(resultado.equipo2, niveles);
    const mediaGanador = resultado.ganador === "A" ? mediaEquipo1 : mediaEquipo2;
    const mediaPerdedor = resultado.ganador === "A" ? mediaEquipo2 : mediaEquipo1;
    const diff = Math.abs(mediaEquipo1 - mediaEquipo2);
    const bonus = calcularBonusDiferenciaRanking(diff);
    const bonusMarcador = calcularBonusMarcadorRanking(resultado);
    const deltaBase = 0.03;
    const delta = mediaGanador < mediaPerdedor
      ? deltaBase + bonus + bonusMarcador
      : Math.max(0.01, deltaBase - bonus + bonusMarcador);

    jugadores.forEach(function(uid, index) {
      const gana = equipoGanador.includes(uid);
      const cambio = gana ? delta : -delta;
      const nuevoNivel = normalizarNivelCompetitivo(niveles[uid] + cambio);
      const nivelInicial = nivelesIniciales[uid];

      const datosUsuarioRanking = {
        nivel: formatearNivelCompetitivo(nuevoNivel),
        nivelInicial: formatearNivelCompetitivo(nivelInicial),
        nivelDelta: (nuevoNivel - nivelInicial).toFixed(2),
        rankingPartidos: firebase.firestore.FieldValue.increment(1)
      };

      if (gana) {
        datosUsuarioRanking.clasificacion = {
          victoriasRanking: firebase.firestore.FieldValue.increment(1)
        };
      }

      transaction.set(usuarioRefs[index], datosUsuarioRanking, { merge: true });
    });

    transaction.update(partidaRef, {
      rankingCompetitivoAplicado: true,
      rankingCompetitivoAplicadoAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return true;
  });
};
