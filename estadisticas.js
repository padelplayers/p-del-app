const estadisticasState = {
  periodo: "mes",
  pistasCache: {}
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
  if (!resultado || resultado.estado !== "validado") return false;

  const equipo1 = Array.isArray(resultado.equipo1) ? resultado.equipo1 : [];
  const equipo2 = Array.isArray(resultado.equipo2) ? resultado.equipo2 : [];
  const sets = Array.isArray(resultado.sets) ? resultado.sets : [];

  return equipo1.length === 2 && equipo2.length === 2 && sets.length >= 2;
}

function partidaEsPruebaEstadisticas(partida) {
  if (!partida) return false;
  return partida.prueba === true || partida.test === true || partida.esPrueba === true;
}

function partidaValidaEstadisticas(partida, periodo, inicio, fin) {
  if (!partida || partida.estado !== "finalizada") return false;
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

function normalizarPistaEstadisticas(partida, pistaData) {
  const nombre = partida.pistaNombre || partida.nombrePista || (pistaData && pistaData.nombre) || "Pista";
  const localidad = partida.pistaLocalidad || partida.localidad || (pistaData && pistaData.localidad) || "";
  const id = partida.pistaId || ("nombre_" + nombre.toLowerCase().trim());

  return {
    id: id,
    nombre: nombre,
    localidad: localidad
  };
}

function cargarPistaEstadisticas(pistaId) {
  if (!pistaId) return Promise.resolve(null);
  if (estadisticasState.pistasCache[pistaId]) return Promise.resolve(estadisticasState.pistasCache[pistaId]);

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
  let consulta = db.collection("historial_partidas").where("estado", "==", "finalizada");

  if (periodo !== "total" && inicio && fin) {
    consulta = consulta
      .where("finalizadaAt", ">=", inicio)
      .where("finalizadaAt", "<", fin);
  }

  return consulta.get().then(function(snapshot) {
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

function renderizarEstadisticas(resumen) {
  const resumenEl = document.getElementById("estadisticasResumen");
  const listaEl = document.getElementById("estadisticasLista");
  if (!resumenEl || !listaEl) return;

  const total = resumen.total || 0;
  const pistaTop = resumen.pistas.length > 0 ? resumen.pistas[0] : null;

  resumenEl.replaceChildren(
    crearResumenItemEstadisticas("Partidas finalizadas", String(total)),
    crearResumenItemEstadisticas("Pista más usada", pistaTop ? pistaTop.nombre : "-"),
    crearResumenItemEstadisticas("Pistas activas", String(resumen.pistas.length))
  );

  if (resumen.pistas.length === 0) {
    listaEl.replaceChildren(crearTextoEstadisticas("No hay partidas finalizadas con resultado valido en este periodo"));
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

      return agruparPartidasPorPistaEstadisticas(validas).then(function(pistas) {
        renderizarEstadisticas({
          total: validas.length,
          pistas: pistas
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
