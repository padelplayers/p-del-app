const estadisticasState = {
  periodo: "mes",
  pistasCache: {},
  usuariosCache: {}
};

function usuarioEsAdminEstadisticas() {
  return typeof esAdmin !== "undefined" && esAdmin === true;
}

function abrirEstadisticas() {
  if (!usuarioEsAdminEstadisticas()) return;
  mostrar("estadisticas");
}

function volverEstadisticas() {
  mostrar("menu");
}

function inicioPeriodoEstadisticas(periodo, ahora) {
  const fecha = new Date(ahora.getTime());
  fecha.setHours(0, 0, 0, 0);

  if (periodo === "dia") return fecha;

  if (periodo === "semana") {
    const diaSemana = fecha.getDay() || 7;
    fecha.setDate(fecha.getDate() - diaSemana + 1);
    return fecha;
  }

  if (periodo === "mes") {
    fecha.setDate(1);
    return fecha;
  }

  if (periodo === "ano") {
    fecha.setMonth(0, 1);
    return fecha;
  }

  return null;
}

function finPeriodoEstadisticas(periodo, inicio) {
  if (!inicio) return null;
  const fin = new Date(inicio.getTime());

  if (periodo === "dia") fin.setDate(fin.getDate() + 1);
  if (periodo === "semana") fin.setDate(fin.getDate() + 7);
  if (periodo === "mes") fin.setMonth(fin.getMonth() + 1);
  if (periodo === "ano") fin.setFullYear(fin.getFullYear() + 1);

  return fin;
}

function periodoAnteriorEstadisticas(periodo, inicio) {
  if (!inicio || periodo === "total") return null;
  const anteriorInicio = new Date(inicio.getTime());

  if (periodo === "dia") anteriorInicio.setDate(anteriorInicio.getDate() - 1);
  if (periodo === "semana") anteriorInicio.setDate(anteriorInicio.getDate() - 7);
  if (periodo === "mes") anteriorInicio.setMonth(anteriorInicio.getMonth() - 1);
  if (periodo === "ano") anteriorInicio.setFullYear(anteriorInicio.getFullYear() - 1);

  return {
    inicio: anteriorInicio,
    fin: new Date(inicio.getTime())
  };
}

function fechaPartidaEstadisticas(partida) {
  if (!partida) return null;

  const finalizadaAt = partida.finalizadaAt;
  if (finalizadaAt && typeof finalizadaAt.toDate === "function") return finalizadaAt.toDate();
  if (finalizadaAt instanceof Date) return finalizadaAt;

  if (partida.fecha) {
    const partesFecha = String(partida.fecha).split("-");
    const partesHora = String(partida.hora || "00:00").split(":");
    if (partesFecha.length === 3) {
      const fecha = new Date(
        Number(partesFecha[0]),
        Number(partesFecha[1]) - 1,
        Number(partesFecha[2]),
        Number(partesHora[0] || 0),
        Number(partesHora[1] || 0)
      );
      if (!isNaN(fecha.getTime())) return fecha;
    }
  }

  return null;
}

function resultadoValidoEstadisticas(partida) {
  const resultado = partida && partida.resultado;
  if (partida && partida.resultadoValido === true) return true;
  if (!resultado || resultado.estado !== "validado") return false;

  const equipo1 = Array.isArray(resultado.equipo1) ? resultado.equipo1 : [];
  const equipo2 = Array.isArray(resultado.equipo2) ? resultado.equipo2 : [];
  const sets = Array.isArray(resultado.sets) ? resultado.sets : [];

  return equipo1.length === 2 && equipo2.length === 2 && sets.length >= 2;
}

function estadoValidoHistorialEstadisticas(partida) {
  const estado = String((partida && (partida.estadoFinal || partida.estado)) || "").toLowerCase().trim();
  return estado === "finalizada" || estado === "confirmada";
}

function partidaEsPruebaEstadisticas(partida) {
  if (!partida) return false;
  return partida.prueba === true || partida.test === true || partida.esPrueba === true;
}

function partidaValidaEstadisticas(partida, periodo, inicio, fin) {
  if (!partida || !estadoValidoHistorialEstadisticas(partida)) return false;
  if (partidaEsPruebaEstadisticas(partida)) return false;
  if (!resultadoValidoEstadisticas(partida)) return false;
  if (!partida.pistaId && !partida.pistaNombre && !partida.nombrePista) return false;

  const fecha = fechaPartidaEstadisticas(partida);
  if (!fecha) return false;
  if (periodo !== "total" && inicio && fin && (fecha < inicio || fecha >= fin)) return false;

  return true;
}

function formatearFechaEstadisticas(fecha) {
  if (!fecha) return "-";
  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function textoPeriodoEstadisticas(periodo) {
  if (periodo === "dia") return "Día";
  if (periodo === "semana") return "Semana";
  if (periodo === "ano") return "Año";
  if (periodo === "total") return "Total";
  return "Mes";
}

function crearTextoEstadisticas(texto) {
  const div = document.createElement("div");
  div.className = "estadisticasVacio";
  div.textContent = texto;
  return div;
}

function crearResumenItemEstadisticas(etiqueta, valor) {
  const item = document.createElement("div");
  item.className = "estadisticasResumenCard";

  const span = document.createElement("span");
  span.textContent = etiqueta;

  const strong = document.createElement("strong");
  strong.textContent = valor;

  item.appendChild(span);
  item.appendChild(strong);
  return item;
}

function normalizarSexoEstadisticas(valor) {
  const sexo = String(valor || "").toLowerCase().trim();
  if (sexo === "masculino" || sexo === "hombre") return "masculino";
  if (sexo === "femenino" || sexo === "mujer") return "femenino";
  return "";
}

function usuarioActivoEstadisticas(data) {
  data = data || {};
  return !(
    data.eliminado === true ||
    data.borrado === true ||
    data.perfilEliminado === true ||
    data.activo === false
  );
}

function arrayUnicoEstadisticas(lista) {
  return (Array.isArray(lista) ? lista : []).filter(Boolean).filter(function(uid, index, arr) {
    return arr.indexOf(uid) === index;
  });
}

function participantesPartidaEstadisticas(partida) {
  if (!partida) return [];

  const incidencia = partida.incidenciaPostPartido;
  if (incidencia && incidencia.tipo === "no_presentado") {
    if (incidencia.estado === "no_pudo_jugarse") return [];
    if (incidencia.estado === "jugada_igualmente") {
      return arrayUnicoEstadisticas(incidencia.participantesComputables);
    }
  }

  const resultado = partida.resultado || {};
  const equipo1 = Array.isArray(resultado.equipo1) ? resultado.equipo1 : [];
  const equipo2 = Array.isArray(resultado.equipo2) ? resultado.equipo2 : [];
  const participantesResultado = arrayUnicoEstadisticas(equipo1.concat(equipo2));
  if (participantesResultado.length === equipo1.length + equipo2.length && participantesResultado.length > 0) {
    return participantesResultado;
  }

  const participantesPostPartido = arrayUnicoEstadisticas(partida.participantesPostPartido);
  if (participantesPostPartido.length > 0) return participantesPostPartido;

  return arrayUnicoEstadisticas(partida.jugadores);
}

function cargarUsuarioEstadisticas(uid) {
  if (!uid) return Promise.resolve(null);
  if (Object.prototype.hasOwnProperty.call(estadisticasState.usuariosCache, uid)) {
    return Promise.resolve(estadisticasState.usuariosCache[uid]);
  }

  return db.collection("usuarios").doc(uid).get().then(function(doc) {
    const data = doc.exists ? (doc.data() || {}) : null;
    estadisticasState.usuariosCache[uid] = data;
    return data;
  }).catch(function(error) {
    console.warn("No se pudo cargar usuario para estadísticas:", error.message);
    estadisticasState.usuariosCache[uid] = null;
    return null;
  });
}

function cargarUsuariosRegistradosEstadisticas() {
  return db.collection("usuarios").get().then(function(snapshot) {
    const resumen = {
      total: 0,
      hombres: 0,
      mujeres: 0,
      sinSexo: 0
    };

    snapshot.forEach(function(doc) {
      const data = doc.data() || {};
      estadisticasState.usuariosCache[doc.id] = data;
      if (!usuarioActivoEstadisticas(data)) return;

      const sexo = normalizarSexoEstadisticas(data.sexo);
      resumen.total++;
      if (sexo === "masculino") resumen.hombres++;
      if (sexo === "femenino") resumen.mujeres++;
    });

    return resumen;
  });
}

function calcularParticipacionGeneroEstadisticas(partidas) {
  const uids = arrayUnicoEstadisticas(partidas.reduce(function(total, partida) {
    return total.concat(participantesPartidaEstadisticas(partida));
  }, []));

  return Promise.all(uids.map(cargarUsuarioEstadisticas)).then(function() {
    const resumen = {
      total: 0,
      hombres: 0,
      mujeres: 0
    };

    partidas.forEach(function(partida) {
      participantesPartidaEstadisticas(partida).forEach(function(uid) {
        const usuario = estadisticasState.usuariosCache[uid] || {};
        const sexo = normalizarSexoEstadisticas(usuario.sexo);

        if (sexo === "masculino") {
          resumen.hombres++;
          return;
        }

        if (sexo === "femenino") {
          resumen.mujeres++;
          return;
        }

        resumen.sinSexo++;
      });
    });

    resumen.total = resumen.hombres + resumen.mujeres;
    if (resumen.sinSexo > 0) {
      console.warn("Participaciones sin sexo resuelto en estadísticas:", resumen.sinSexo);
    }

    return resumen;
  });
}

function porcentajeParticipacionEstadisticas(valor, total) {
  if (!total) return "0%";
  return String(Math.round((valor * 10000) / total) / 100) + "%";
}

function textoParticipacionEstadisticas(valor, total) {
  const etiqueta = valor === 1 ? " participación" : " participaciones";
  return porcentajeParticipacionEstadisticas(valor, total) + " (" + valor + etiqueta + ")";
}

function textoVariacionEstadisticas(actual, anterior, periodo) {
  if (periodo === "total") return "No aplicable";
  if (anterior === 0 && actual > 0) return "Nuevo periodo con actividad";
  if (anterior === 0 && actual === 0) return "Sin actividad";
  if (actual === anterior) return "Sin cambios";

  const porcentaje = Math.round(((actual - anterior) / anterior) * 100);
  return (porcentaje > 0 ? "+" : "") + porcentaje + "%";
}

function tipoPistaDesdeDatosEstadisticas(partida, pistaData, tipo) {
  const valorHistorial = partida && partida[tipo];
  if (valorHistorial !== undefined && valorHistorial !== null && valorHistorial !== "") {
    if (typeof valorHistorial === "boolean") return valorHistorial;
    return Number(valorHistorial) > 0 || String(valorHistorial).toLowerCase().trim() === tipo;
  }

  const tipoTexto = String(
    (partida && (partida.tipoPista || partida.pistaTipo)) ||
    (pistaData && pistaData.tipo) ||
    ""
  ).toLowerCase();

  if (tipoTexto.includes(tipo)) return true;
  if (!pistaData) return false;
  return Number(pistaData[tipo] || 0) > 0;
}

function normalizarPistaEstadisticas(partida, pistaData) {
  const nombre = partida.pistaNombre || partida.nombrePista || (pistaData && pistaData.nombre) || "Pista";
  const localidad = partida.pistaLocalidad || partida.localidad || (pistaData && pistaData.localidad) || "";
  const id = partida.pistaId || ("nombre_" + nombre.toLowerCase().trim());

  return {
    id: id,
    nombre: nombre,
    localidad: localidad,
    indoor: tipoPistaDesdeDatosEstadisticas(partida, pistaData, "indoor"),
    outdoor: tipoPistaDesdeDatosEstadisticas(partida, pistaData, "outdoor")
  };
}

function cargarPistaEstadisticas(pistaId) {
  if (!pistaId) return Promise.resolve(null);
  if (Object.prototype.hasOwnProperty.call(estadisticasState.pistasCache, pistaId)) {
    return Promise.resolve(estadisticasState.pistasCache[pistaId]);
  }

  return db.collection("pistas").doc(pistaId).get().then(function(doc) {
    const data = doc.exists ? (doc.data() || {}) : null;
    estadisticasState.pistasCache[pistaId] = data;
    return data;
  }).catch(function(error) {
    console.warn("No se pudo cargar pista para estadísticas:", error.message);
    estadisticasState.pistasCache[pistaId] = null;
    return null;
  });
}

function cargarPartidasHistorialEstadisticas(periodo, inicio, fin) {
  return db.collection("historial_partidas").get().then(function(snapshot) {
    return snapshot.docs.map(function(doc) {
      return Object.assign({ idPartida: doc.id }, doc.data() || {});
    });
  });
}

function agruparPartidasPorPistaEstadisticas(partidas) {
  const pistaIds = partidas.map(function(partida) {
    return partida.pistaId || null;
  }).filter(Boolean).filter(function(id, index, arr) {
    return arr.indexOf(id) === index;
  });

  return Promise.all(pistaIds.map(cargarPistaEstadisticas)).then(function() {
    const mapa = {};

    partidas.forEach(function(partida) {
      const pistaData = partida.pistaId ? estadisticasState.pistasCache[partida.pistaId] : null;
      const pista = normalizarPistaEstadisticas(partida, pistaData);
      const fecha = fechaPartidaEstadisticas(partida);

      if (!mapa[pista.id]) {
        mapa[pista.id] = {
          id: pista.id,
          nombre: pista.nombre,
          localidad: pista.localidad,
          indoor: pista.indoor,
          outdoor: pista.outdoor,
          total: 0,
          ultimaFecha: null
        };
      }

      mapa[pista.id].total++;
      if (!mapa[pista.id].ultimaFecha || fecha > mapa[pista.id].ultimaFecha) {
        mapa[pista.id].ultimaFecha = fecha;
      }
    });

    return Object.keys(mapa).map(function(id) {
      return mapa[id];
    }).sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return a.nombre.localeCompare(b.nombre);
    });
  });
}

function obtenerPistaMasUsadaPorTipoEstadisticas(pistas, tipo) {
  const candidatas = pistas.filter(function(pista) {
    return pista && pista[tipo] === true;
  });

  return candidatas.length > 0 ? candidatas[0] : null;
}

function diaSemanaMasUsadoEstadisticas(partidas) {
  const nombres = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const totales = {};

  partidas.forEach(function(partida) {
    const fecha = fechaPartidaEstadisticas(partida);
    if (!fecha) return;
    const dia = fecha.getDay();
    totales[dia] = (totales[dia] || 0) + 1;
  });

  return Object.keys(totales).reduce(function(mejor, dia) {
    const total = totales[dia];
    if (!mejor || total > mejor.total) {
      return {
        dia: nombres[Number(dia)],
        total: total
      };
    }
    return mejor;
  }, null);
}

function renderizarEstadisticas(resumen) {
  const resumenEl = document.getElementById("estadisticasResumen");
  const listaEl = document.getElementById("estadisticasLista");
  if (!resumenEl || !listaEl) return;

  const total = resumen.total || 0;
  const pistaTop = resumen.pistas.length > 0 ? resumen.pistas[0] : null;
  const indoorTop = resumen.indoorTop || null;
  const outdoorTop = resumen.outdoorTop || null;
  const diaTop = resumen.diaTop || null;
  const participacion = resumen.participacionGenero || { total: 0, hombres: 0, mujeres: 0 };
  const usuarios = resumen.usuarios || { total: 0, hombres: 0, mujeres: 0 };

  resumenEl.replaceChildren(
    crearResumenItemEstadisticas("Partidas finalizadas", String(total)),
    crearResumenItemEstadisticas("Pista más usada", pistaTop ? pistaTop.nombre : "-"),
    crearResumenItemEstadisticas("Pistas activas", String(resumen.pistas.length)),
    crearResumenItemEstadisticas("Variación periodo anterior", resumen.variacion || "No aplicable"),
    crearResumenItemEstadisticas("Participantes hombres", textoParticipacionEstadisticas(participacion.hombres, participacion.total)),
    crearResumenItemEstadisticas("Participantes mujeres", textoParticipacionEstadisticas(participacion.mujeres, participacion.total)),
    crearResumenItemEstadisticas("Usuarios totales", String(usuarios.total)),
    crearResumenItemEstadisticas("Usuarios hombres", String(usuarios.hombres)),
    crearResumenItemEstadisticas("Usuarios mujeres", String(usuarios.mujeres)),
    crearResumenItemEstadisticas("Indoor más usada", indoorTop ? indoorTop.nombre : "Sin datos"),
    crearResumenItemEstadisticas("Outdoor más usada", outdoorTop ? outdoorTop.nombre : "Sin datos"),
    crearResumenItemEstadisticas("Día más usado", diaTop ? diaTop.dia + " (" + diaTop.total + ")" : "Sin datos")
  );

  if (resumen.pistas.length === 0) {
    listaEl.replaceChildren(crearTextoEstadisticas("No hay partidas finalizadas con resultado válido en este periodo"));
    return;
  }

  const fragment = document.createDocumentFragment();
  resumen.pistas.forEach(function(pista) {
    const card = document.createElement("article");
    card.className = "estadisticasPistaCard";

    const cabecera = document.createElement("div");
    cabecera.className = "estadisticasPistaCabecera";

    const titulo = document.createElement("strong");
    titulo.textContent = pista.nombre;

    const porcentaje = document.createElement("span");
    porcentaje.textContent = total > 0 ? Math.round((pista.total * 10000) / total) / 100 + "%" : "0%";

    cabecera.appendChild(titulo);
    cabecera.appendChild(porcentaje);

    const localidad = document.createElement("div");
    localidad.className = "estadisticasPistaLocalidad";
    localidad.textContent = pista.localidad || "Localidad no indicada";

    const detalle = document.createElement("div");
    detalle.className = "estadisticasPistaDetalle";
    detalle.textContent = pista.total + (pista.total === 1 ? " partida finalizada" : " partidas finalizadas");

    const ultima = document.createElement("div");
    ultima.className = "estadisticasPistaUltima";
    ultima.textContent = "Última partida: " + formatearFechaEstadisticas(pista.ultimaFecha);

    card.appendChild(cabecera);
    card.appendChild(localidad);
    card.appendChild(detalle);
    card.appendChild(ultima);
    fragment.appendChild(card);
  });

  listaEl.replaceChildren(fragment);
}

function cargarEstadisticas() {
  if (!usuarioEsAdminEstadisticas()) return Promise.resolve(null);

  const resumenEl = document.getElementById("estadisticasResumen");
  const listaEl = document.getElementById("estadisticasLista");
  if (resumenEl) resumenEl.replaceChildren(crearResumenItemEstadisticas("Periodo", textoPeriodoEstadisticas(estadisticasState.periodo)));
  if (listaEl) listaEl.replaceChildren(crearTextoEstadisticas("Cargando estadísticas..."));

  const ahora = new Date();
  const inicio = inicioPeriodoEstadisticas(estadisticasState.periodo, ahora);
  const fin = finPeriodoEstadisticas(estadisticasState.periodo, inicio);

  return cargarPartidasHistorialEstadisticas(estadisticasState.periodo, inicio, fin)
    .then(function(partidas) {
      const validas = partidas.filter(function(partida) {
        return partidaValidaEstadisticas(partida, estadisticasState.periodo, inicio, fin);
      });
      const anterior = periodoAnteriorEstadisticas(estadisticasState.periodo, inicio);
      const validasAnterior = anterior
        ? partidas.filter(function(partida) {
            return partidaValidaEstadisticas(partida, estadisticasState.periodo, anterior.inicio, anterior.fin);
          })
        : [];

      return Promise.all([
        agruparPartidasPorPistaEstadisticas(validas),
        cargarUsuariosRegistradosEstadisticas()
      ]).then(function(resultadosBase) {
        const pistas = resultadosBase[0];
        const usuarios = resultadosBase[1];

        return calcularParticipacionGeneroEstadisticas(validas).then(function(participacionGenero) {
          renderizarEstadisticas({
            total: validas.length,
            pistas: pistas,
            usuarios: usuarios,
            participacionGenero: participacionGenero,
            variacion: textoVariacionEstadisticas(validas.length, validasAnterior.length, estadisticasState.periodo),
            indoorTop: obtenerPistaMasUsadaPorTipoEstadisticas(pistas, "indoor"),
            outdoorTop: obtenerPistaMasUsadaPorTipoEstadisticas(pistas, "outdoor"),
            diaTop: diaSemanaMasUsadoEstadisticas(validas)
          });
        });
      });
    })
    .catch(function(error) {
      console.error("Error cargando estadísticas:", error);
      if (listaEl) listaEl.replaceChildren(crearTextoEstadisticas("No se pudieron cargar las estadísticas"));
    });
}

function configurarEventosEstadisticas() {
  document.querySelectorAll(".estadisticasFiltroBtn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      estadisticasState.periodo = btn.dataset.periodo || "mes";
      document.querySelectorAll(".estadisticasFiltroBtn").forEach(function(boton) {
        boton.classList.toggle("activo", boton === btn);
      });
      cargarEstadisticas();
    });
  });
}

document.addEventListener("DOMContentLoaded", configurarEventosEstadisticas);

window.abrirEstadisticas = abrirEstadisticas;
window.volverEstadisticas = volverEstadisticas;
window.cargarEstadisticas = cargarEstadisticas;
