let unsubscribePerfil = null;
let unsubscribeUser = null;
const perfilSocialState = {
  perfilUid: null,
  perfilNombre: "",
  tipo: "seguidores",
  usuarios: [],
  filtroSexo: "todos",
  textoVacio: "",
  eventosRegistrados: false,
  delegacionPerfilRegistrada: false
};

function obtenerTotalPerfil(valor) {
  if (Array.isArray(valor)) return valor.length;
  if (typeof valor === "number") return valor;
  return 0;
}

function obtenerNumeroPerfil(valor, fallback) {
  const numero = Number(valor);
  return isNaN(numero) ? (fallback || 0) : numero;
}

function existeValorNivelPerfil(valor) {
  return valor !== undefined && valor !== null && valor !== "";
}

function normalizarNumeroNivelPerfil(valor, fallback) {
  if (!existeValorNivelPerfil(valor)) return fallback;
  const numero = Number(String(valor).replace(",", "."));
  return isNaN(numero) ? fallback : numero;
}

function formatearNivelPerfil(valor) {
  const numero = Number(valor);
  if (isNaN(numero)) return "";
  return numero.toFixed(2);
}

function calcularMediaValoracionPerfil(clasificacion, campoTotal) {
  const valoracionesRecibidas = Number((clasificacion && clasificacion.valoracionesRecibidas) || 0);
  if (!valoracionesRecibidas || valoracionesRecibidas <= 0) return 0;

  const total = Number((clasificacion && clasificacion[campoTotal]) || 0);
  if (isNaN(total)) return 0;

  return total / valoracionesRecibidas;
}

function crearEstrellasValoracionPerfil(media) {
  const contenedor = document.createElement("span");
  contenedor.className = "clasificacionEstrellas perfilEstrellasValoracion";

  const numero = Number(media);
  const valor = isNaN(numero) ? 0 : numero;

  for (let i = 1; i <= 5; i++) {
    const estrella = document.createElement("span");
    estrella.className = "clasificacionEstrella";
    estrella.textContent = "★";

    if (valor >= i) {
      estrella.classList.add("llena");
    } else if (valor >= i - 0.5) {
      estrella.classList.add("media");
    } else {
      estrella.classList.add("vacia");
    }

    contenedor.appendChild(estrella);
  }

  return contenedor;
}

function renderizarFilaValoracionPerfil(id, nombre, media) {
  const fila = document.getElementById(id);
  if (!fila) return;

  const valor = Number(media) || 0;
  fila.replaceChildren();

  const etiqueta = document.createElement("span");
  etiqueta.className = "perfilValoracionNombre";
  etiqueta.textContent = nombre;

  const estrellas = crearEstrellasValoracionPerfil(valor);

  const numero = document.createElement("strong");
  numero.className = "perfilValoracionNumero";
  numero.textContent = valor.toFixed(1);

  fila.appendChild(etiqueta);
  fila.appendChild(estrellas);
  fila.appendChild(numero);
}

function renderizarValoracionesPerfil(clasificacion) {
  clasificacion = clasificacion || {};

  renderizarFilaValoracionPerfil(
    "valoracionPuntualidadPerfil",
    "Puntualidad",
    calcularMediaValoracionPerfil(clasificacion, "puntualidadTotal")
  );

  renderizarFilaValoracionPerfil(
    "valoracionActitudPerfil",
    "Actitud",
    calcularMediaValoracionPerfil(clasificacion, "actitudTotal")
  );

  renderizarFilaValoracionPerfil(
    "valoracionCompromisoPerfil",
    "Compromiso",
    calcularMediaValoracionPerfil(clasificacion, "compromisoTotal")
  );
}

function renderizarReputacionResumenPerfil(clasificacion) {
  const reputacion = document.getElementById("reputacionPerfil");
  if (reputacion) reputacion.innerText = obtenerNumeroPerfil(clasificacion && clasificacion.puntos, 0);

  const etiqueta = reputacion && reputacion.parentElement
    ? reputacion.parentElement.querySelector("span")
    : null;

  if (etiqueta) {
    etiqueta.replaceChildren(
      document.createTextNode("Puntos"),
      document.createElement("br"),
      document.createTextNode("reputaci\u00f3n")
    );
  }
}

function configurarContadorSocialPerfil(elemento, tipo, data) {
  if (!elemento) return;

  const stat = elemento.closest(".stat");
  const perfilEl = document.getElementById("perfil");
  const uid = perfilEl && perfilEl.dataset ? perfilEl.dataset.uid : null;

  if (!stat || !uid) {
    console.warn("[PERFIL SOCIAL] No se pudo preparar contador social", {
      existeStat: !!stat,
      uid: uid || null,
      tipo: tipo || null
    });
    return;
  }

  stat.classList.add("perfilStatPulsable");
  stat.setAttribute("role", "button");
  stat.setAttribute("aria-label", tipo === "seguidores" ? "Ver seguidores" : "Ver seguidos");
  stat.tabIndex = 0;
  stat.dataset.accionSocialPerfil = "abrir";
  stat.dataset.uidPerfil = uid;
  stat.dataset.tipoSocial = tipo;
  stat.onclick = null;
  stat.onkeydown = null;
}

function configurarContadoresSocialesPerfil(data) {
  configurarContadorSocialPerfil(document.getElementById("seguidores"), "seguidores", data);
  configurarContadorSocialPerfil(document.getElementById("seguidos"), "seguidos", data);
}

function manejarAccionSocialPerfil(elemento) {
  if (!elemento) return;

  const uid = elemento.dataset.uidPerfil;
  const tipo = elemento.dataset.tipoSocial;

  if (!uid || !tipo) {
    console.warn("[PERFIL SOCIAL] Falta uid o tipo en contador social", {
      uid: uid || null,
      tipo: tipo || null
    });
    return;
  }

  if (typeof abrirPerfilSocial !== "function") {
    console.warn("[PERFIL SOCIAL] abrirPerfilSocial no esta disponible");
    return;
  }

  abrirPerfilSocial(uid, tipo);
}

function registrarDelegacionSocialPerfil() {
  if (perfilSocialState.delegacionPerfilRegistrada) return;

  const perfil = document.getElementById("perfil");
  if (!perfil) return;

  perfilSocialState.delegacionPerfilRegistrada = true;

  perfil.addEventListener("click", function(event) {
    const accion = event.target.closest("[data-accion-social-perfil]");
    if (!accion || !perfil.contains(accion)) return;
    manejarAccionSocialPerfil(accion);
  });

  perfil.addEventListener("keydown", function(event) {
    if (event.key !== "Enter" && event.key !== " ") return;

    const accion = event.target.closest("[data-accion-social-perfil]");
    if (!accion || !perfil.contains(accion)) return;

    event.preventDefault();
    manejarAccionSocialPerfil(accion);
  });
}

function crearDatoStatsAvanzadasPerfil(etiqueta, valor) {
  const item = document.createElement("div");
  item.appendChild(crearTextoPerfil("span", etiqueta));
  item.appendChild(crearTextoPerfil("strong", valor));
  return item;
}

function obtenerTextoCampoPerfil(data, rutas) {
  for (let i = 0; i < rutas.length; i++) {
    let actual = data;
    const partes = rutas[i].split(".");

    for (let j = 0; j < partes.length; j++) {
      actual = actual && actual[partes[j]];
    }

    if (actual !== undefined && actual !== null && actual !== "") return String(actual);
  }

  return "Sin datos todavia";
}

function obtenerEntradaMasHabitualPerfil(mapa) {
  if (!mapa || typeof mapa !== "object") return null;

  return Object.keys(mapa).reduce(function(mejor, id) {
    const entrada = mapa[id];
    if (!entrada || typeof entrada !== "object") return mejor;

    const veces = obtenerNumeroPerfil(entrada.veces, 0);
    if (!mejor || veces > mejor.veces) {
      return Object.assign({}, entrada, {
        id: id,
        veces: veces
      });
    }

    return mejor;
  }, null);
}

function formatearEntradaHabitualPerfil(entrada, singular, plural, campoNombre, fallbackIdCampo) {
  if (!entrada || !entrada.veces) return "Sin datos todavia";

  const nombre = entrada[campoNombre || "nombre"] || entrada[fallbackIdCampo || "uid"] || entrada.id || "Sin datos";
  const etiqueta = entrada.veces === 1 ? singular : plural;
  return nombre + " (" + entrada.veces + " " + etiqueta + ")";
}

function renderizarStatsAvanzadasPerfil(data) {
  const contenedor = document.getElementById("statsAvanzadasPerfil");
  if (!contenedor) return;

  data = data || {};
  const clasificacion = data.clasificacion || {};
  const partidosTotales = obtenerNumeroPerfil(clasificacion.partidos, 0);
  const rankingPartidos = obtenerNumeroPerfil(data.rankingPartidos || clasificacion.rankingPartidos, 0);
  const victoriasRanking = obtenerNumeroPerfil(clasificacion.victoriasRanking, 0);
  const derrotasRanking = rankingPartidos > 0 ? Math.max(0, rankingPartidos - victoriasRanking) : 0;
  const porcentajeVictoria = rankingPartidos > 0
    ? Math.round((victoriasRanking / rankingPartidos) * 100) + "%"
    : "Sin datos todavia";
  const partidasAmistosas = partidosTotales > 0
    ? Math.max(0, partidosTotales - rankingPartidos)
    : 0;
  const compromisoLogro = clasificacion.compromisoLogro !== undefined && clasificacion.compromisoLogro !== null
    ? clasificacion.compromisoLogro
    : clasificacion.partidasCompletadasSinAbandono;
  const companeroHabitual = obtenerEntradaMasHabitualPerfil(clasificacion.companerosMap);
  const rivalHabitual = obtenerEntradaMasHabitualPerfil(clasificacion.rivalesMap);
  const pistaHabitual = obtenerEntradaMasHabitualPerfil(clasificacion.pistasJugadasMap);

  contenedor.replaceChildren(
    crearDatoStatsAvanzadasPerfil("Companero mas habitual", formatearEntradaHabitualPerfil(companeroHabitual, "partida", "partidas", "nombre", "uid")),
    crearDatoStatsAvanzadasPerfil("Rival mas habitual", formatearEntradaHabitualPerfil(rivalHabitual, "partido", "partidos", "nombre", "uid")),
    crearDatoStatsAvanzadasPerfil("Pista mas jugada", formatearEntradaHabitualPerfil(pistaHabitual, "partida", "partidas", "nombre", "pistaId")),
    crearDatoStatsAvanzadasPerfil("Partidas ranking", String(rankingPartidos)),
    crearDatoStatsAvanzadasPerfil("Partidas amistosas", String(partidasAmistosas)),
    crearDatoStatsAvanzadasPerfil("Victorias ranking", String(victoriasRanking)),
    crearDatoStatsAvanzadasPerfil("Derrotas ranking", String(derrotasRanking)),
    crearDatoStatsAvanzadasPerfil("% de victoria", porcentajeVictoria),
    crearDatoStatsAvanzadasPerfil("Partidas organizadas", String(obtenerNumeroPerfil(clasificacion.partidasCreadas, 0))),
    crearDatoStatsAvanzadasPerfil("Pistas creadas", String(obtenerNumeroPerfil(clasificacion.pistasCreadas, 0))),
    crearDatoStatsAvanzadasPerfil("Abandonos", String(obtenerNumeroPerfil(clasificacion.abandonos, 0))),
    crearDatoStatsAvanzadasPerfil("Partidas completadas sin abandono", String(obtenerNumeroPerfil(compromisoLogro, 0)))
  );
}

function obtenerStatsRankingPerfil(data) {
  data = data || {};
  const clasificacion = data.clasificacion || {};
  const partidasRanking = obtenerNumeroPerfil(
    clasificacion.partidasRanking !== undefined && clasificacion.partidasRanking !== null
      ? clasificacion.partidasRanking
      : (data.rankingPartidos || clasificacion.rankingPartidos),
    0
  );
  const victoriasRanking = obtenerNumeroPerfil(clasificacion.victoriasRanking, 0);
  const derrotasRanking = clasificacion.derrotasRanking !== undefined && clasificacion.derrotasRanking !== null
    ? obtenerNumeroPerfil(clasificacion.derrotasRanking, 0)
    : Math.max(0, partidasRanking - victoriasRanking);

  return {
    partidasRanking: partidasRanking,
    victoriasRanking: victoriasRanking,
    derrotasRanking: derrotasRanking
  };
}

function renderizarRankingCabeceraPerfil(data) {
  const stats = obtenerStatsRankingPerfil(data);
  const partidas = document.getElementById("rankingPartidasCabecera");
  const ganadas = document.getElementById("rankingGanadasCabecera");
  const perdidas = document.getElementById("rankingPerdidasCabecera");

  if (partidas) partidas.innerText = stats.partidasRanking;
  if (ganadas) ganadas.innerText = stats.victoriasRanking;
  if (perdidas) perdidas.innerText = stats.derrotasRanking;
}

function normalizarPorcentajePerfil(valor, fallback) {
  const numero = Number(valor);
  if (isNaN(numero)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numero)));
}

function fechaPerfilToDate(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  if (valor instanceof Date) return valor;

  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? null : fecha;
}

function formatearFechaPerfil(valor) {
  const fecha = fechaPerfilToDate(valor);
  if (!fecha) return "Sin datos";

  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function obtenerDiasRestantesPerfil(valor) {
  const fecha = fechaPerfilToDate(valor);
  if (!fecha) return 0;

  const msDia = 24 * 60 * 60 * 1000;
  const diferencia = fecha.getTime() - Date.now();
  return Math.max(0, Math.ceil(diferencia / msDia));
}

function penalizacionActivaPerfil(penalizacion) {
  if (!penalizacion || penalizacion.activa === false) return false;

  const caducaAt = fechaPerfilToDate(penalizacion.caducaAt);
  if (!caducaAt) return false;

  return caducaAt.getTime() > Date.now();
}

function restriccionFiabilidadActivaPerfil(restriccion) {
  if (!restriccion || restriccion.activa !== true) return false;

  const hasta = fechaPerfilToDate(restriccion.hasta);
  if (!hasta) return false;
  return hasta.getTime() > Date.now();
}

function crearPenalizacionDesdeRestriccionPerfil(restriccion) {
  return {
    tipo: "restriccion_fiabilidad",
    motivo: restriccion.motivo || "Restriccion temporal por fiabilidad",
    impactoFiabilidad: "Restriccion temporal",
    createdAt: restriccion.desde || null,
    caducaAt: restriccion.hasta || null,
    activa: true
  };
}

function obtenerImpactoFiabilidadPerfil(penalizacion) {
  if (!penalizacion) return "Sin datos";
  if (penalizacion.tipo === "restriccion_fiabilidad") return "Restriccion temporal";

  const impacto = Number(penalizacion.impactoFiabilidad);
  if (!isNaN(impacto)) return impacto + "% fiabilidad";

  const impactosPorTipo = {
    abandono_confirmada: -10,
    cancelacion_por_falta_sustituto: -10
  };
  const tipo = String(penalizacion.tipo || "").trim();
  if (Object.prototype.hasOwnProperty.call(impactosPorTipo, tipo)) {
    return impactosPorTipo[tipo] + "% fiabilidad";
  }

  const puntos = Number(penalizacion.puntos);
  if (!isNaN(puntos) && puntos !== 0) return puntos + " puntos";

  return "No especificado";
}

function crearTextoPerfil(tag, texto, className) {
  const el = document.createElement(tag || "div");
  if (className) el.className = className;
  el.textContent = texto;
  return el;
}

function crearDatoIconoPerfil(src, etiqueta, valor, valorId) {
  const item = document.createElement("div");
  item.className = "perfilFiabilidadDato";

  const icono = document.createElement("img");
  icono.src = src;
  icono.alt = etiqueta;

  const texto = document.createElement("div");
  texto.appendChild(crearTextoPerfil("span", etiqueta));
  const valorEl = crearTextoPerfil("strong", valor);
  if (valorId) valorEl.id = valorId;
  texto.appendChild(valorEl);

  item.appendChild(icono);
  item.appendChild(texto);
  return item;
}

function crearLineaPenalizacionPerfil(etiqueta, valor) {
  const fila = document.createElement("div");
  fila.className = "perfilPenalizacionLinea";
  fila.appendChild(crearTextoPerfil("span", etiqueta));
  fila.appendChild(crearTextoPerfil("strong", valor || "Sin datos"));
  return fila;
}

function crearTarjetaPenalizacionPerfil(penalizacion, activa) {
  const card = document.createElement("div");
  card.className = activa ? "perfilPenalizacionCard activa" : "perfilPenalizacionCard historica";

  card.appendChild(crearTextoPerfil("h5", activa ? "Penalizacion activa" : "Penalizacion historica"));
  card.appendChild(crearLineaPenalizacionPerfil("Tipo", penalizacion.tipo || "Sin datos"));
  card.appendChild(crearLineaPenalizacionPerfil("Motivo", penalizacion.motivo || "Sin datos"));
  card.appendChild(crearLineaPenalizacionPerfil("Impacto", obtenerImpactoFiabilidadPerfil(penalizacion)));
  card.appendChild(crearLineaPenalizacionPerfil("Fecha de aplicacion", formatearFechaPerfil(penalizacion.createdAt)));
  card.appendChild(crearLineaPenalizacionPerfil("Fecha de caducidad", formatearFechaPerfil(penalizacion.caducaAt)));

  if (activa) {
    card.appendChild(crearLineaPenalizacionPerfil("Dias restantes", obtenerDiasRestantesPerfil(penalizacion.caducaAt) + " dias"));
    card.appendChild(crearLineaPenalizacionPerfil("Estado", "Activa"));
  } else {
    card.appendChild(crearLineaPenalizacionPerfil("Estado", "Caducada"));
  }

  return card;
}

function restriccionNoPresentadoActivaPerfil(restriccion) {
  if (!restriccion || restriccion.activa !== true) return false;

  const hasta = fechaPerfilToDate(restriccion.hasta);
  if (!hasta) return false;
  return hasta.getTime() > Date.now();
}

function crearItemRestriccionPerfil(texto, hasta) {
  const item = document.createElement("li");
  item.className = "perfilRestriccionActivaItem";

  const descripcion = crearTextoPerfil("strong", texto);
  item.appendChild(descripcion);

  if (hasta) {
    item.appendChild(crearTextoPerfil("span", "Hasta " + formatearFechaPerfil(hasta)));
  }

  return item;
}

function obtenerRestriccionesFiabilidadPerfil(fiabilidad, restriccion) {
  const restricciones = [];
  const activa = restriccionFiabilidadActivaPerfil(restriccion);
  const hasta = activa ? restriccion.hasta : null;
  const valor = Number(fiabilidad);

  if (activa) {
    if (restriccion.bloqueaCrear === true) restricciones.push({ texto: "No puede crear partidas.", hasta: hasta });
    if (restriccion.bloqueaUnirse === true) restricciones.push({ texto: "No puede apuntarse a partidas.", hasta: hasta });
    if (restriccion.bloqueaChat === true) {
      restricciones.push({ texto: "No puede usar Chat General.", hasta: hasta });
      restricciones.push({ texto: "No puede usar Chat Privado.", hasta: hasta });
    }
    return restricciones;
  }

  if (isNaN(valor) || valor >= 70) return restricciones;

  restricciones.push({ texto: "No puede crear partidas.", hasta: hasta });
  if (valor < 60) restricciones.push({ texto: "No puede apuntarse a partidas.", hasta: hasta });
  if (valor < 40) {
    restricciones.push({ texto: "No puede usar Chat General.", hasta: hasta });
    restricciones.push({ texto: "No puede usar Chat Privado.", hasta: hasta });
  }

  return restricciones;
}

function obtenerRestriccionesActivasPerfil(data, fiabilidad) {
  const restricciones = obtenerRestriccionesFiabilidadPerfil(fiabilidad, data && data.restriccionFiabilidad);

  if (restriccionNoPresentadoActivaPerfil(data && data.restriccionNoPresentado)) {
    restricciones.push({
      texto: "No puede apuntarse a partidas.",
      hasta: data.restriccionNoPresentado.hasta
    });
  }

  return restricciones;
}

function obtenerProximaRestriccionPerfil(fiabilidad) {
  const valor = Number(fiabilidad);
  if (isNaN(valor)) return null;

  if (valor >= 70) return { umbral: 70, diferencia: Math.max(0, valor - 70) };
  if (valor >= 60) return { umbral: 60, diferencia: Math.max(0, valor - 60) };
  if (valor >= 40) return { umbral: 40, diferencia: Math.max(0, valor - 40) };
  return null;
}

function crearFilaEscalaFiabilidadPerfil(rango, efecto) {
  const fila = document.createElement("div");
  fila.className = "perfilEscalaFiabilidadFila";
  fila.appendChild(crearTextoPerfil("span", rango));
  fila.appendChild(crearTextoPerfil("strong", efecto));
  return fila;
}

function renderizarConsecuenciasFiabilidadPerfil(data, fiabilidad) {
  const contenedor = document.getElementById("fiabilidadConsecuenciasPerfil");
  if (!contenedor) return;

  contenedor.replaceChildren();
  contenedor.className = "perfilConsecuenciasFiabilidad";

  const restriccionesBox = document.createElement("div");
  restriccionesBox.className = "perfilConsecuenciaBloque";
  restriccionesBox.appendChild(crearTextoPerfil("h5", "Restricciones activas"));

  const restricciones = obtenerRestriccionesActivasPerfil(data, fiabilidad);
  if (restricciones.length) {
    const lista = document.createElement("ul");
    lista.className = "perfilRestriccionesActivasLista";
    restricciones.forEach(function(restriccion) {
      lista.appendChild(crearItemRestriccionPerfil(restriccion.texto, restriccion.hasta));
    });
    restriccionesBox.appendChild(lista);
  } else {
    restriccionesBox.appendChild(crearTextoPerfil("p", "Sin restricciones activas.", "perfilConsecuenciaTexto"));
  }

  const proximaBox = document.createElement("div");
  proximaBox.className = "perfilConsecuenciaBloque perfilProximaRestriccion";
  proximaBox.appendChild(crearTextoPerfil("h5", "Proxima restriccion"));

  const proxima = obtenerProximaRestriccionPerfil(fiabilidad);
  if (proxima) {
    proximaBox.appendChild(crearTextoPerfil("p", "Fiabilidad actual: " + fiabilidad + "%", "perfilConsecuenciaTexto"));
    proximaBox.appendChild(crearTextoPerfil("p", "Proxima restriccion: " + proxima.umbral + "%", "perfilConsecuenciaTexto"));
    proximaBox.appendChild(crearTextoPerfil("p", "Te faltan " + proxima.diferencia + " puntos de fiabilidad.", "perfilConsecuenciaTexto destacado"));
  } else {
    proximaBox.appendChild(crearTextoPerfil("p", "Fiabilidad actual: " + fiabilidad + "%", "perfilConsecuenciaTexto"));
    proximaBox.appendChild(crearTextoPerfil("p", "Ya esta en el tramo de restriccion maxima.", "perfilConsecuenciaTexto destacado"));
  }

  const escalaBox = document.createElement("div");
  escalaBox.className = "perfilConsecuenciaBloque";
  escalaBox.appendChild(crearTextoPerfil("h5", "Escala de Fiabilidad"));

  const tabla = document.createElement("div");
  tabla.className = "perfilEscalaFiabilidadTabla";
  tabla.appendChild(crearFilaEscalaFiabilidadPerfil("100%-70%", "Sin restricciones"));
  tabla.appendChild(crearFilaEscalaFiabilidadPerfil("<70%", "7 dias sin crear partidas"));
  tabla.appendChild(crearFilaEscalaFiabilidadPerfil("<60%", "7 dias sin crear ni apuntarse a partidas"));
  tabla.appendChild(crearFilaEscalaFiabilidadPerfil("<40%", "30 dias sin crear partidas, apuntarse ni usar Chat General o Privado"));
  escalaBox.appendChild(tabla);

  contenedor.appendChild(restriccionesBox);
  contenedor.appendChild(proximaBox);
  contenedor.appendChild(escalaBox);
}

function renderizarListaPenalizacionesPerfil(id, lista, mensajeVacio, activa) {
  const contenedor = document.getElementById(id);
  if (!contenedor) return;

  contenedor.classList.remove("perfilMensajeVacio");
  contenedor.classList.add("perfilPenalizacionesLista");
  contenedor.replaceChildren();

  if (!lista.length) {
    contenedor.classList.add("perfilMensajeVacio");
    contenedor.classList.remove("perfilPenalizacionesLista");
    contenedor.textContent = mensajeVacio;
    return;
  }

  lista.forEach(function(penalizacion) {
    contenedor.appendChild(crearTarjetaPenalizacionPerfil(penalizacion, activa));
  });
}

function renderizarFiabilidadPenalizacionesPerfil(data) {
  data = data || {};
  const clasificacion = data.clasificacion || {};
  const fiabilidad = normalizarPorcentajePerfil(clasificacion.fiabilidad, 100);
  const penalizacionesActivasTotal = obtenerTotalPerfil(clasificacion.penalizacionesActivas);
  const abandonos = obtenerTotalPerfil(clasificacion.abandonos);
  const penalizaciones = Array.isArray(data.penalizaciones) ? data.penalizaciones : [];
  const restriccionFiabilidad = restriccionFiabilidadActivaPerfil(data.restriccionFiabilidad)
    ? crearPenalizacionDesdeRestriccionPerfil(data.restriccionFiabilidad)
    : null;
  const activas = penalizaciones.filter(penalizacionActivaPerfil)
    .concat(restriccionFiabilidad ? [restriccionFiabilidad] : []);
  const historicas = penalizaciones.filter(function(penalizacion) {
    return !penalizacionActivaPerfil(penalizacion);
  });

  const fiabilidadResumenPerfil = document.getElementById("fiabilidadResumenPerfil");
  if (fiabilidadResumenPerfil) fiabilidadResumenPerfil.textContent = fiabilidad + "%";

  const penalizacionesActivasResumenPerfil = document.getElementById("penalizacionesActivasResumenPerfil");
  if (penalizacionesActivasResumenPerfil) penalizacionesActivasResumenPerfil.textContent = penalizacionesActivasTotal;

  const resumen = document.querySelector("#perfil .perfilFiabilidadResumen");
  if (resumen) {
    resumen.replaceChildren(
      crearDatoIconoPerfil("imagenes app/clasificacion/fiabilidad.png", "Fiabilidad actual", fiabilidad + "%", "fiabilidadActualPerfil"),
      crearDatoIconoPerfil("imagenes app/clasificacion/abandono.png", "Abandonos", String(abandonos)),
      crearDatoIconoPerfil("imagenes app/clasificacion/penalizacion.png", "Penalizaciones activas", String(penalizacionesActivasTotal))
    );
  }

  renderizarListaPenalizacionesPerfil(
    "penalizacionesActivasPerfil",
    activas,
    "Sin penalizaciones activas",
    true
  );

  renderizarConsecuenciasFiabilidadPerfil(data, fiabilidad);

  renderizarListaPenalizacionesPerfil(
    "penalizacionesHistoricasPerfil",
    historicas,
    "Sin penalizaciones historicas",
    false
  );
}

function renderizarEvolucionNivelPerfil(data) {
  let nivelActualNum = normalizarNumeroNivelPerfil(data && data.nivel, null);
  const nivelInicialNum = normalizarNumeroNivelPerfil(data && data.nivelInicial, nivelActualNum);
  if (nivelActualNum === null && nivelInicialNum !== null) nivelActualNum = nivelInicialNum;

  const nivelActual = nivelActualNum === null ? "0.00" : formatearNivelPerfil(nivelActualNum);
  const nivelInicial = nivelInicialNum === null ? "0.00" : formatearNivelPerfil(nivelInicialNum);

  let delta = normalizarNumeroNivelPerfil(data && data.nivelDelta, null);
  if (delta === null) delta = (nivelActualNum || 0) - (nivelInicialNum || 0);
  if (Math.abs(delta) < 0.005) delta = 0;

  const nivelPerfil = document.getElementById("nivelPerfil");
  if (nivelPerfil) nivelPerfil.innerText = nivelActual + " nivel";

  const nivelInicialPerfil = document.getElementById("nivelInicialPerfil");
  if (nivelInicialPerfil) nivelInicialPerfil.innerText = nivelInicial;

  const nivelActualPerfil = document.getElementById("nivelActualPerfil");
  if (nivelActualPerfil) nivelActualPerfil.innerText = nivelActual;

  const nivelDeltaPerfil = document.getElementById("nivelDeltaPerfil");
  if (nivelDeltaPerfil) {
    nivelDeltaPerfil.classList.remove("nivelDeltaSube", "nivelDeltaBaja", "nivelDeltaIgual");
    if (delta > 0) {
      nivelDeltaPerfil.innerText = "▲ +" + delta.toFixed(2);
      nivelDeltaPerfil.classList.add("nivelDeltaSube");
    } else if (delta < 0) {
      nivelDeltaPerfil.innerText = "▼ " + delta.toFixed(2);
      nivelDeltaPerfil.classList.add("nivelDeltaBaja");
    } else {
      nivelDeltaPerfil.innerText = "0.00";
      nivelDeltaPerfil.classList.add("nivelDeltaIgual");
    }
  }
}

function obtenerFotoVisualPerfil(data, usarFallbackSexo) {
  data = data || {};
  if (usarFallbackSexo) {
    return data.fotoPerfil && data.fotoPerfil.startsWith("http")
      ? data.fotoPerfil
      : (data.sexo === "mujer" ? "imagen/mujer.jpeg" : "imagen/hombre.jpeg");
  }

  return data.fotoPerfil || "imagen/hombre.jpeg";
}

function renderizarDatosVisualesPerfil(data, opciones) {
  data = data || {};
  opciones = opciones || {};

  const nombrePerfil = document.getElementById("nombrePerfil");
  if (nombrePerfil) nombrePerfil.innerText = data.nombre || "";

  renderizarEvolucionNivelPerfil(data);

  const fotoPerfil = document.getElementById("fotoPerfil");
  if (fotoPerfil) fotoPerfil.src = obtenerFotoVisualPerfil(data, opciones.usarFallbackSexo === true);

  const manoPerfil = document.getElementById("manoPerfil");
  if (manoPerfil) manoPerfil.innerText = data.mano || "-";

  const posicionPerfil = document.getElementById("posicionPerfil");
  if (posicionPerfil) posicionPerfil.innerText = data.posicion || "-";

  renderizarRankingCabeceraPerfil(data);

  if (opciones.actualizarStats !== false) {
    const clasificacion = data.clasificacion || {};
    const partidasCount = document.getElementById("partidasCount");
    if (partidasCount) partidasCount.innerText = obtenerTotalPerfil(clasificacion.partidos);

    renderizarReputacionResumenPerfil(clasificacion);
    renderizarStatsAvanzadasPerfil(data);
    renderizarValoracionesPerfil(clasificacion);
    renderizarFiabilidadPenalizacionesPerfil(data);
    if (typeof window.renderizarLogrosPerfil === "function") {
      window.renderizarLogrosPerfil(data);
    }

    const seguidores = document.getElementById("seguidores");
    if (seguidores) seguidores.innerText = obtenerTotalPerfil(data.seguidores);

    const seguidos = document.getElementById("seguidos");
    if (seguidos) seguidos.innerText = obtenerTotalPerfil(data.siguiendo);

    configurarContadoresSocialesPerfil(data);
  }

  const manoSelect = document.getElementById("manoEditar");
  const posicionSelect = document.getElementById("posicionEditar");

  if (manoSelect && data.mano) manoSelect.value = data.mano;
  if (posicionSelect && data.posicion) posicionSelect.value = data.posicion;
}

function configurarBotonChatPrivadoPerfil(uid) {
  const user = auth.currentUser;
  const botones = document.querySelector("#perfil .perfil-botones");
  if (!user || !botones) return;

  let btn = document.getElementById("btnChatPrivadoPerfil");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "btnChatPrivadoPerfil";
    btn.type = "button";
    btn.className = "btnBlue";
    btn.textContent = "Chat privado";
    botones.appendChild(btn);
  }

  const esPerfilAjeno = uid && uid !== user.uid;
  btn.style.display = esPerfilAjeno ? "block" : "none";
  btn.onclick = esPerfilAjeno ? function() {
    const nombre = document.getElementById("nombrePerfil")?.innerText || "Jugador";
    if (typeof window.abrirChatPrivado === "function") {
      window.abrirChatPrivado(uid, nombre);
    }
  } : null;
}

function registrarEventosPerfilSocial() {
  if (perfilSocialState.eventosRegistrados) return;
  perfilSocialState.eventosRegistrados = true;

  const input = document.getElementById("buscarPerfilSocial");
  if (input) {
    input.addEventListener("input", renderizarListaSocialPerfil);
  }

  document.querySelectorAll(".perfilSocialFiltroBtn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      perfilSocialState.filtroSexo = btn.dataset.filtroSexo || "todos";
      document.querySelectorAll(".perfilSocialFiltroBtn").forEach(function(boton) {
        boton.classList.toggle("activo", boton === btn);
      });
      renderizarListaSocialPerfil();
    });
  });
}

function textoVacioSocialPerfil() {
  if (perfilSocialState.textoVacio) return perfilSocialState.textoVacio;

  return perfilSocialState.tipo === "seguidores"
    ? "Todavia no tiene seguidores"
    : "Todavia no sigue a nadie";
}

function renderizarListaSocialPerfil() {
  const contenedor = document.getElementById("listaPerfilSocial");
  if (!contenedor) return;

  const input = document.getElementById("buscarPerfilSocial");
  const texto = typeof window.normalizarTextoJugadores === "function"
    ? window.normalizarTextoJugadores(input ? input.value : "")
    : String(input ? input.value : "").toLowerCase().trim();

  const usuarios = perfilSocialState.usuarios.filter(function(jugador) {
    const nombreNormalizado = jugador.nombreNormalizado || "";
    const coincideTexto = !texto || nombreNormalizado.startsWith(texto);
    const coincideSexo = perfilSocialState.filtroSexo === "todos" || jugador.sexoNormalizado === perfilSocialState.filtroSexo;
    return coincideTexto && coincideSexo;
  });

  if (usuarios.length === 0) {
    const vacio = document.createElement("div");
    vacio.className = "jugadoresVacio";
    vacio.textContent = perfilSocialState.usuarios.length === 0 ? textoVacioSocialPerfil() : "No hay jugadores";
    contenedor.replaceChildren(vacio);
    return;
  }

  const fragment = document.createDocumentFragment();
  usuarios.forEach(function(jugador) {
    if (typeof window.crearTarjetaJugadorLista === "function") {
      fragment.appendChild(window.crearTarjetaJugadorLista(jugador));
    }
  });

  contenedor.replaceChildren(fragment);
}

function cargarUsuariosSocialesPerfil(uids) {
  const lista = Array.isArray(uids) ? uids.filter(Boolean) : [];
  const unicos = lista.filter(function(uid, index, arr) {
    return arr.indexOf(uid) === index;
  });

  return Promise.all(unicos.map(function(uid) {
    return db.collection("usuarios").doc(uid).get()
      .then(function(doc) {
        if (!doc.exists || typeof window.crearJugadorListaDesdeDoc !== "function") return null;
        return window.crearJugadorListaDesdeDoc(doc);
      })
      .catch(function(error) {
        console.warn("No se pudo cargar usuario social:", error.message);
        return null;
      });
  })).then(function(usuarios) {
    return usuarios.filter(Boolean).sort(function(a, b) {
      return (a.nombreNormalizado || "").localeCompare(b.nombreNormalizado || "");
    });
  });
}

function notificarCambioSeguidoresAgrupadoPerfil(datos) {
  if (!datos || !datos.paraUid || !datos.tipo) return Promise.resolve(null);
  if (datos.actorUid && datos.actorUid === datos.paraUid) return Promise.resolve(null);
  if (typeof window.crearOActualizarNotificacionSeguidoresAgrupada !== "function") {
    console.warn("No esta disponible la notificacion agrupada de seguidores");
    return Promise.resolve(null);
  }

  return window.crearOActualizarNotificacionSeguidoresAgrupada(datos)
    .catch(function(error) {
      console.warn("No se pudo crear la notificacion agrupada de seguidores:", error.message);
      return null;
    });
}

function normalizarTipoSocialPerfil(tipo) {
  return tipo === "seguidos" || tipo === "siguiendo" ? "seguidos" : "seguidores";
}

function abrirPerfilSocial(uid, tipo) {
  if (!uid) return;

  registrarEventosPerfilSocial();
  perfilSocialState.perfilUid = uid;
  perfilSocialState.tipo = normalizarTipoSocialPerfil(tipo);
  perfilSocialState.usuarios = [];
  perfilSocialState.filtroSexo = "todos";
  perfilSocialState.textoVacio = "";

  const input = document.getElementById("buscarPerfilSocial");
  if (input) input.value = "";

  document.querySelectorAll(".perfilSocialFiltroBtn").forEach(function(btn) {
    btn.classList.toggle("activo", btn.dataset.filtroSexo === "todos");
  });

  const titulo = document.getElementById("perfilSocialTitulo");
  const contenedor = document.getElementById("listaPerfilSocial");
  if (contenedor) contenedor.replaceChildren(document.createTextNode("Cargando usuarios..."));

  mostrar("perfilSocial");
  window.scrollTo({ top: 0, behavior: "auto" });

  db.collection("usuarios").doc(uid).get().then(function(doc) {
    if (!doc.exists) {
      if (contenedor) contenedor.replaceChildren(document.createTextNode("No se pudo cargar la lista"));
      return;
    }

    const data = doc.data() || {};
    perfilSocialState.perfilNombre = data.nombre || "Jugador";
    const ids = perfilSocialState.tipo === "seguidores" ? data.seguidores : data.siguiendo;

    if (titulo) {
      titulo.textContent = perfilSocialState.tipo === "seguidores"
        ? "Seguidores de " + perfilSocialState.perfilNombre
        : "Seguidos de " + perfilSocialState.perfilNombre;
    }

    return cargarUsuariosSocialesPerfil(ids).then(function(usuarios) {
      perfilSocialState.usuarios = usuarios;
      renderizarListaSocialPerfil();
    });
  }).catch(function(error) {
    console.error("Error cargando lista social:", error);
    if (contenedor) contenedor.replaceChildren(document.createTextNode("No se pudo cargar la lista"));
  });
}

function abrirListaNotificacionSocialPerfil(config) {
  config = config || {};

  registrarEventosPerfilSocial();
  perfilSocialState.perfilUid = auth.currentUser ? auth.currentUser.uid : null;
  perfilSocialState.perfilNombre = "";
  perfilSocialState.tipo = "seguidores";
  perfilSocialState.usuarios = [];
  perfilSocialState.filtroSexo = "todos";
  perfilSocialState.textoVacio = config.tipo === "nuevos_seguidores"
    ? "No hay seguidores para mostrar"
    : "No hay jugadores para mostrar";

  const input = document.getElementById("buscarPerfilSocial");
  if (input) input.value = "";

  document.querySelectorAll(".perfilSocialFiltroBtn").forEach(function(btn) {
    btn.classList.toggle("activo", btn.dataset.filtroSexo === "todos");
  });

  const titulo = document.getElementById("perfilSocialTitulo");
  const contenedor = document.getElementById("listaPerfilSocial");
  if (titulo) titulo.textContent = config.titulo || "Jugadores";
  if (contenedor) contenedor.replaceChildren(document.createTextNode("Cargando usuarios..."));

  mostrar("perfilSocial");
  window.scrollTo({ top: 0, behavior: "auto" });

  return cargarUsuariosSocialesPerfil(config.uids).then(function(usuarios) {
    perfilSocialState.usuarios = usuarios;
    renderizarListaSocialPerfil();
  }).catch(function(error) {
    console.error("Error cargando lista de notificacion social:", error);
    if (contenedor) contenedor.replaceChildren(document.createTextNode("No se pudo cargar la lista"));
  });
}

function abrirListaSocialPerfil(tipo) {
  const perfilEl = document.getElementById("perfil");
  const uid = perfilEl && perfilEl.dataset ? perfilEl.dataset.uid : null;
  abrirPerfilSocial(uid, tipo);
}

function volverPerfilSocial() {
  if (perfilSocialState.perfilUid) {
    verPerfil(perfilSocialState.perfilUid);
    return;
  }

  mostrar("perfil");
}

window.abrirPerfilSocial = abrirPerfilSocial;
window.abrirListaNotificacionSocialPerfil = abrirListaNotificacionSocialPerfil;
window.abrirListaSocialPerfil = abrirListaSocialPerfil;
window.volverPerfilSocial = volverPerfilSocial;

async function resolverPartidasActivasAntesDeEliminarPerfil(uid) {
  if (!uid) return;

  if (typeof ejecutarSalirDePartidaTransaccional !== "function") {
    throw new Error("No esta disponible la salida transaccional de partidas.");
  }

  const consultas = await Promise.all([
    db.collection("partidas").where("jugadores", "array-contains", uid).get(),
    db.collection("partidas").where("reservas", "array-contains", uid).get()
  ]);

  const partidasActivas = {};

  consultas.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      const p = doc.data() || {};
      if (p.estado !== "abierta" && p.estado !== "confirmada") return;
      partidasActivas[doc.id] = doc.ref;
    });
  });

  const ids = Object.keys(partidasActivas);
  for (let i = 0; i < ids.length; i++) {
    const partidaId = ids[i];
    await ejecutarSalirDePartidaTransaccional(partidaId, partidasActivas[partidaId], uid, {
      confirmarCreador: false,
      refrescar: false,
      silencioso: true,
      propagarError: true
    });
  }
}

async function borrarSnapshotEnBatchesPerfil(snapshot) {
  if (!snapshot || snapshot.empty) return;

  let batch = db.batch();
  let contador = 0;
  const commits = [];

  snapshot.forEach(function(doc) {
    batch.delete(doc.ref);
    contador++;

    if (contador >= 450) {
      commits.push(batch.commit());
      batch = db.batch();
      contador = 0;
    }
  });

  if (contador > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

async function borrarMensajesQueryPerfil(query) {
  const snapshot = await query.get();
  await borrarSnapshotEnBatchesPerfil(snapshot);
}

async function recalcularUltimoMensajeChatPerfil(parentRef, mensajesRef) {
  const snapshot = await mensajesRef.orderBy("at", "desc").limit(1).get();

  if (!snapshot.empty) {
    const mensaje = snapshot.docs[0].data() || {};
    await parentRef.set({
      lastMessage: mensaje.t || "",
      lastActivity: mensaje.at || null,
      lastSender: mensaje.u || null,
      lastSenderName: mensaje.n || ""
    }, { merge: true });
    return;
  }

  await parentRef.set({
    lastMessage: "",
    lastActivity: null,
    lastSender: null,
    lastSenderName: ""
  }, { merge: true });
}

async function eliminarMensajesGeneralUsuarioPerfil(uid) {
  const generalRef = db.collection("chats").doc("general");
  const mensajesRef = generalRef.collection("mensajes");
  const generalDoc = await generalRef.get();
  const debeRecalcular = generalDoc.exists && (generalDoc.data() || {}).lastSender === uid;

  await borrarMensajesQueryPerfil(mensajesRef.where("u", "==", uid));

  if (debeRecalcular) {
    await recalcularUltimoMensajeChatPerfil(generalRef, mensajesRef);
  }
}

function obtenerOtroParticipanteChatPrivadoPerfil(chat, uid) {
  if (!chat || !uid) return null;

  const participantes = Array.isArray(chat.participantes) ? chat.participantes : [];
  const otroDesdeLista = participantes.find(function(participanteUid) {
    return participanteUid && participanteUid !== uid;
  });
  if (otroDesdeLista) return otroDesdeLista;

  const participantesMap = chat.participantesMap && typeof chat.participantesMap === "object"
    ? chat.participantesMap
    : {};
  return Object.keys(participantesMap).find(function(participanteUid) {
    return participanteUid && participanteUid !== uid && participantesMap[participanteUid] === true;
  }) || null;
}

async function notificarChatPrivadoEliminadoPerfil(chatId, otroUid, uidEliminado) {
  if (!chatId || !otroUid || typeof window.crearNotificacionesParaUids !== "function") return;

  await window.crearNotificacionesParaUids(otroUid, {
    origen: "perfil",
    tipo: "chat_privado_eliminado_por_baja_usuario",
    titulo: "Chat privado eliminado",
    mensaje: "Un usuario ha eliminado su perfil. El chat privado que mantenias con el se ha eliminado.",
    accion: null,
    prioridad: "normal",
    dedupeKey: "chat_privado_eliminado_por_baja_usuario_" + chatId,
    data: {
      motivo: "baja_usuario",
      usuarioUid: uidEliminado || null
    }
  });
}

async function eliminarChatsPrivadosUsuarioPerfil(uid) {
  const snapshot = await db.collection("chatsPrivados")
    .where("participantesMap." + uid, "==", true)
    .get();

  for (let i = 0; i < snapshot.docs.length; i++) {
    const chatDoc = snapshot.docs[i];
    const privadoRef = chatDoc.ref;
    const chat = chatDoc.data() || {};
    const otroUid = obtenerOtroParticipanteChatPrivadoPerfil(chat, uid);

    const mensajesSnap = await privadoRef.collection("mensajes").get();
    await borrarSnapshotEnBatchesPerfil(mensajesSnap);
    await privadoRef.delete();

    await notificarChatPrivadoEliminadoPerfil(chatDoc.id, otroUid, uid);
  }
}

async function obtenerPartidasCandidatasMensajesUsuarioPerfil(uid) {
  const consultas = await Promise.all([
    db.collection("partidas").where("jugadores", "array-contains", uid).get(),
    db.collection("partidas").where("reservas", "array-contains", uid).get(),
    db.collection("partidas").where("creadaPor", "==", uid).get(),
    db.collection("partidas").where("creador", "==", uid).get()
  ]);

  const partidas = {};
  consultas.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      partidas[doc.id] = doc.ref;
    });
  });

  return Object.keys(partidas).map(function(id) {
    return partidas[id];
  });
}

async function eliminarMensajesPartidasUsuarioPerfil(uid) {
  const partidasRefs = await obtenerPartidasCandidatasMensajesUsuarioPerfil(uid);

  for (let i = 0; i < partidasRefs.length; i++) {
    const partidaRef = partidasRefs[i];
    const partidaDoc = await partidaRef.get();
    if (!partidaDoc.exists) continue;

    const partida = partidaDoc.data() || {};
    const mensajesRef = partidaRef.collection("mensajes");
    const debeRecalcular = partida.lastSender === uid;

    await borrarMensajesQueryPerfil(mensajesRef.where("u", "==", uid));

    if (debeRecalcular) {
      await recalcularUltimoMensajeChatPerfil(partidaRef, mensajesRef);
    }
  }
}

async function eliminarMensajesUsuarioAntesDeEliminarPerfil(uid) {
  if (!uid) return;

  await eliminarMensajesGeneralUsuarioPerfil(uid);
  await eliminarChatsPrivadosUsuarioPerfil(uid);
  await eliminarMensajesPartidasUsuarioPerfil(uid);
}

function partidaBloqueaEliminarPerfilComoCreador(p) {
  if (!p) return false;

  const estado = String(p.estado || "").toLowerCase().trim();
  if (
    estado === "finalizada" ||
    estado === "cancelada" ||
    estado === "eliminada" ||
    estado === "historial"
  ) {
    return false;
  }

  return true;
}

async function usuarioTienePartidasActivasComoCreadorPerfil(uid) {
  if (!uid) return false;

  const consultas = await Promise.all([
    db.collection("partidas").where("creadaPor", "==", uid).get(),
    db.collection("partidas").where("creador", "==", uid).get()
  ]);
  const partidas = {};

  consultas.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      partidas[doc.id] = doc.data() || {};
    });
  });

  return Object.keys(partidas).some(function(id) {
    return partidaBloqueaEliminarPerfilComoCreador(partidas[id]);
  });
}

async function limpiarRelacionesSocialesUsuario(uid, nombreUsuarioEliminado) {
  if (!uid) return;

  const snapshot = await db.collection("usuarios").get();
  const updates = [];
  const usuariosQuePierdenSeguidorPorPerfilBorrado = [];
  const camposSociales = ["seguidores", "siguiendo", "seguidos"];

  snapshot.forEach(function(doc) {
    if (doc.id === uid) return;

    const data = doc.data() || {};
    const update = {};
    const pierdeSeguidorPorPerfilBorrado = Array.isArray(data.seguidores) && data.seguidores.includes(uid);

    if (pierdeSeguidorPorPerfilBorrado) {
      usuariosQuePierdenSeguidorPorPerfilBorrado.push(doc.id);
    }

    camposSociales.forEach(function(campo) {
      if (!Array.isArray(data[campo]) || !data[campo].includes(uid)) return;
      update[campo] = data[campo].filter(function(id) {
        return id !== uid;
      });
    });

    if (Object.keys(update).length > 0) {
      updates.push(doc.ref.update(update));
    }
  });

  await Promise.all(updates);

  await Promise.all(usuariosQuePierdenSeguidorPorPerfilBorrado.map(function(paraUid) {
    return notificarCambioSeguidoresAgrupadoPerfil({
      tipo: "seguidores_perdidos_perfil_borrado",
      paraUid: paraUid,
      actorUid: uid,
      actorNombre: nombreUsuarioEliminado || "",
      motivo: "perfil_borrado"
    });
  }));
}

async function anonimizarPistasCreadasUsuario(uid) {
  if (!uid) return;

  const camposUidCreador = ["creadaPor", "creador", "creadorUid", "creadaPorUid"];
  const camposNombreCreador = ["creadorNombre", "nombreCreador"];
  const consultas = await Promise.all(camposUidCreador.map(function(campo) {
    return db.collection("pistas").where(campo, "==", uid).get();
  }));
  const pistas = {};

  consultas.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      pistas[doc.id] = doc;
    });
  });

  let batch = db.batch();
  let contador = 0;
  const commits = [];

  Object.keys(pistas).forEach(function(id) {
    const doc = pistas[id];
    const data = doc.data() || {};
    const update = {};

    camposUidCreador.forEach(function(campo) {
      if (data[campo] === uid) update[campo] = "usuario_eliminado";
    });

    camposNombreCreador.forEach(function(campo) {
      if (Object.prototype.hasOwnProperty.call(data, campo) && data[campo] !== "Usuario eliminado") {
        update[campo] = "Usuario eliminado";
      }
    });

    if (Object.keys(update).length === 0) return;

    batch.update(doc.ref, update);
    contador++;

    if (contador >= 450) {
      commits.push(batch.commit());
      batch = db.batch();
      contador = 0;
    }
  });

  if (contador > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

function generarUidAnonimoUsuarioEliminado(uid) {
  const texto = String(uid || "");
  let hash = 2166136261;

  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hashCorto = (hash >>> 0).toString(36).padStart(8, "0").slice(0, 8);
  return "usuario_eliminado_" + hashCorto;
}

function esObjetoPlanoPerfil(valor) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;

  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
}

function objetoTieneIdentidadUsuarioHistorialPerfil(obj, uid) {
  const camposUid = [
    "uid",
    "idUsuario",
    "idJugador",
    "uidUsuario",
    "usuarioUid",
    "uidJugador",
    "jugadorUid",
    "userUid"
  ];

  return camposUid.some(function(campo) {
    return obj[campo] === uid;
  });
}

function objetoTieneCreadorUsuarioHistorialPerfil(obj, uid) {
  const camposCreador = ["creadaPor", "creador", "creadorUid", "creadaPorUid"];

  return camposCreador.some(function(campo) {
    return obj[campo] === uid;
  });
}

function anonimizarValorHistorialPerfil(valor, uid, uidAnonimo, contextoUsuario) {
  const camposNombreUsuario = [
    "nombre",
    "displayName",
    "nombreUsuario",
    "usuarioNombre",
    "nombreJugador",
    "jugadorNombre"
  ];
  const camposNombreCreador = ["creadorNombre", "nombreCreador"];
  const camposFotoUsuario = [
    "foto",
    "fotoPerfil",
    "imagen",
    "avatar",
    "photoURL",
    "fotoUrl",
    "imagenUrl"
  ];

  if (valor === uid) {
    return {
      valor: uidAnonimo,
      cambiado: true
    };
  }

  if (Array.isArray(valor)) {
    let cambiadoArray = false;
    const arrayAnonimizado = valor.map(function(item) {
      const resultado = anonimizarValorHistorialPerfil(item, uid, uidAnonimo, contextoUsuario);
      if (resultado.cambiado) cambiadoArray = true;
      return resultado.valor;
    });

    return {
      valor: cambiadoArray ? arrayAnonimizado : valor,
      cambiado: cambiadoArray
    };
  }

  if (!esObjetoPlanoPerfil(valor)) {
    return {
      valor: valor,
      cambiado: false
    };
  }

  const identificaUsuario = objetoTieneIdentidadUsuarioHistorialPerfil(valor, uid);
  const identificaCreador = objetoTieneCreadorUsuarioHistorialPerfil(valor, uid);
  const contextoActual = contextoUsuario === true || identificaUsuario;
  let cambiadoObjeto = false;
  const objetoAnonimizado = {};

  Object.keys(valor).forEach(function(clave) {
    const claveAnonima = clave === uid ? uidAnonimo : clave;
    const valorOriginal = valor[clave];
    let valorNuevo = valorOriginal;
    let cambiadoValor = false;
    const contextoHijo = contextoActual || clave === uid;

    if (contextoActual && camposNombreUsuario.includes(clave)) {
      if (valorOriginal !== "Usuario eliminado") {
        valorNuevo = "Usuario eliminado";
        cambiadoValor = true;
      }
    } else if (identificaCreador && camposNombreCreador.includes(clave)) {
      if (valorOriginal !== "Usuario eliminado") {
        valorNuevo = "Usuario eliminado";
        cambiadoValor = true;
      }
    } else if (contextoActual && camposFotoUsuario.includes(clave)) {
      if (valorOriginal) {
        valorNuevo = "";
        cambiadoValor = true;
      }
    } else {
      const resultado = anonimizarValorHistorialPerfil(valorOriginal, uid, uidAnonimo, contextoHijo);
      valorNuevo = resultado.valor;
      cambiadoValor = resultado.cambiado;
    }

    if (claveAnonima !== clave || cambiadoValor) cambiadoObjeto = true;
    objetoAnonimizado[claveAnonima] = valorNuevo;
  });

  return {
    valor: cambiadoObjeto ? objetoAnonimizado : valor,
    cambiado: cambiadoObjeto
  };
}

function crearUpdateAnonimizacionHistorialPerfil(data, uid, uidAnonimo) {
  const resultado = anonimizarValorHistorialPerfil(data || {}, uid, uidAnonimo, false);
  const dataAnonimizada = resultado.valor || {};
  const update = {};

  Object.keys(dataAnonimizada).forEach(function(campo) {
    if ((data || {})[campo] !== dataAnonimizada[campo]) {
      update[campo] = dataAnonimizada[campo];
    }
  });

  return update;
}

async function obtenerHistorialCandidatoAnonimizacionPerfil(uid) {
  const coleccion = db.collection("historial_partidas");
  const consultas = [
    coleccion.where("jugadores", "array-contains", uid).get(),
    coleccion.where("reservas", "array-contains", uid).get(),
    coleccion.where("participantesPostPartido", "array-contains", uid).get(),
    coleccion.where("creadaPor", "==", uid).get(),
    coleccion.where("creador", "==", uid).get(),
    coleccion.where("creadorUid", "==", uid).get(),
    coleccion.where("creadaPorUid", "==", uid).get(),
    coleccion.where("resultado.equipo1", "array-contains", uid).get(),
    coleccion.where("resultado.equipo2", "array-contains", uid).get(),
    coleccion.where("resultado.propuestoPor", "==", uid).get(),
    coleccion.where("resultado.validaciones", "array-contains", uid).get(),
    coleccion.where("resultado.rechazos", "array-contains", uid).get(),
    coleccion.where("incumplimientosPostPartidoUids", "array-contains", uid).get(),
    coleccion.where("creadorAnterior", "==", uid).get(),
    coleccion.where("uidSolicita", "==", uid).get(),
    coleccion.where("uidReserva", "==", uid).get(),
    coleccion.where("uidSale", "==", uid).get(),
    coleccion.where("uidEntra", "==", uid).get(),
    coleccion.where("uidReservaSustituta", "==", uid).get(),
    coleccion.where("uidReservaRechaza", "==", uid).get(),
    coleccion.where("uidNuevaReserva", "==", uid).get(),
    coleccion.where("sustitucionSaleUid", "==", uid).get(),
    coleccion.where("sustitucionEntraUid", "==", uid).get()
  ];

  if (firebase.firestore.FieldPath) {
    consultas.push(
      coleccion.where(new firebase.firestore.FieldPath("valoraciones", uid), "!=", null).get()
    );
  }

  const snapshots = await Promise.all(consultas);
  const docs = {};

  snapshots.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      docs[doc.id] = doc;
    });
  });

  return Object.keys(docs).map(function(id) {
    return docs[id];
  });
}

async function anonimizarHistorialUsuarioEliminado(uid) {
  if (!uid) return;

  const uidAnonimo = generarUidAnonimoUsuarioEliminado(uid);
  const docs = await obtenerHistorialCandidatoAnonimizacionPerfil(uid);
  let batch = db.batch();
  let contador = 0;
  const commits = [];

  docs.forEach(function(doc) {
    const data = doc.data() || {};
    const update = crearUpdateAnonimizacionHistorialPerfil(data, uid, uidAnonimo);

    if (Object.keys(update).length === 0) return;

    batch.update(doc.ref, update);
    contador++;

    if (contador >= 450) {
      commits.push(batch.commit());
      batch = db.batch();
      contador = 0;
    }
  });

  if (contador > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

function reemplazarNombreEnTextoNotificacionPerfil(texto, nombreUsuario) {
  if (!texto || !nombreUsuario) return texto || "";

  return String(texto).split(nombreUsuario).join("Usuario eliminado");
}

function notificacionMencionaUidEnDataPerfil(data, uid) {
  if (data === uid) return true;
  if (Array.isArray(data)) {
    return data.some(function(item) {
      return notificacionMencionaUidEnDataPerfil(item, uid);
    });
  }
  if (!esObjetoPlanoPerfil(data)) return false;

  return Object.keys(data).some(function(clave) {
    return clave === uid || notificacionMencionaUidEnDataPerfil(data[clave], uid);
  });
}

function notificacionApuntaPerfilEliminadoPerfil(n, uid) {
  const data = n && esObjetoPlanoPerfil(n.data) ? n.data : {};

  return !!(
    n &&
    n.accion === "abrir_perfil" &&
    (
      data.uid === uid ||
      data.usuarioUid === uid ||
      data.perfilUid === uid ||
      data.jugadorUid === uid ||
      data.creadorUid === uid ||
      !n.partidaId
    )
  );
}

function notificacionDebeResolversePorUsuarioEliminadoPerfil(n, uid) {
  if (!n) return false;
  if (notificacionApuntaPerfilEliminadoPerfil(n, uid)) return true;
  if (n.tipo === "chat_privado_eliminado_por_baja_usuario") return true;

  const data = esObjetoPlanoPerfil(n.data) ? n.data : {};
  if (
    !n.partidaId &&
    !n.chatId &&
    (
      data.uid === uid ||
      data.usuarioUid === uid ||
      data.perfilUid === uid ||
      data.jugadorUid === uid ||
      data.creadorUid === uid
    )
  ) {
    return true;
  }

  return false;
}

function crearUpdateNotificacionUsuarioEliminadoPerfil(n, uid, uidAnonimo, nombreUsuario) {
  const dataOriginal = esObjetoPlanoPerfil(n && n.data) ? n.data : {};
  const dataAnonimizada = anonimizarValorHistorialPerfil(dataOriginal, uid, uidAnonimo, false);
  const titulo = reemplazarNombreEnTextoNotificacionPerfil(n && n.titulo, nombreUsuario);
  const mensaje = reemplazarNombreEnTextoNotificacionPerfil(n && n.mensaje, nombreUsuario);
  const mencionaUid = notificacionMencionaUidEnDataPerfil(dataOriginal, uid);
  const apuntaPerfil = notificacionApuntaPerfilEliminadoPerfil(n, uid);
  const debeResolver = notificacionDebeResolversePorUsuarioEliminadoPerfil(n, uid);
  const update = {};

  if (dataAnonimizada.cambiado) update.data = dataAnonimizada.valor;
  if (titulo !== ((n && n.titulo) || "")) update.titulo = titulo;
  if (mensaje !== ((n && n.mensaje) || "")) update.mensaje = mensaje;

  if (apuntaPerfil || n.accion === "abrir_perfil") {
    update.accion = null;
  }

  if (debeResolver) {
    update.resuelta = true;
    update.resueltaAt = firebase.firestore.FieldValue.serverTimestamp();
    update.leida = true;
    update.leidaAt = firebase.firestore.FieldValue.serverTimestamp();
    update.accion = null;
  } else if (mencionaUid && n.accion === "abrir_perfil") {
    update.accion = null;
  }

  return update;
}

async function obtenerNotificacionesAjenasCandidatasUsuarioEliminadoPerfil(uid) {
  const coleccion = db.collection("notificaciones");
  const camposDataUid = [
    "uid",
    "usuarioUid",
    "perfilUid",
    "creadorUid",
    "jugadorUid",
    "reservaUid",
    "sustitutoUid",
    "nuevoCreador",
    "creadorAnterior",
    "uidSolicita",
    "uidReserva",
    "uidSale",
    "uidEntra",
    "uidReservaSustituta",
    "uidReservaRechaza",
    "uidNuevaReserva",
    "sale",
    "usuario.uid",
    "perfil.uid",
    "creador.uid",
    "jugador.uid",
    "reserva.uid",
    "sustituto.uid",
    "solicitante.uid",
    "nuevoCreador.uid",
    "creadorAnterior.uid"
  ];
  const camposDataArray = [
    "jugadores",
    "reservas",
    "participantes",
    "destinatarios",
    "candidatos"
  ];
  const consultas = [];

  camposDataUid.forEach(function(campo) {
    consultas.push(coleccion.where("data." + campo, "==", uid).get());
  });

  camposDataArray.forEach(function(campo) {
    consultas.push(coleccion.where("data." + campo, "array-contains", uid).get());
  });

  const snapshots = await Promise.all(consultas);
  const docs = {};

  snapshots.forEach(function(snapshot) {
    snapshot.forEach(function(doc) {
      const data = doc.data() || {};
      if (data.uid === uid) return;
      docs[doc.id] = doc;
    });
  });

  return Object.keys(docs).map(function(id) {
    return docs[id];
  });
}

async function limpiarNotificacionesUsuarioEliminado(uid, uidAnonimo, nombreUsuario) {
  if (!uid) return;

  uidAnonimo = uidAnonimo || generarUidAnonimoUsuarioEliminado(uid);

  const propiasSnap = await db.collection("notificaciones").where("uid", "==", uid).get();
  await borrarSnapshotEnBatchesPerfil(propiasSnap);

  const docs = await obtenerNotificacionesAjenasCandidatasUsuarioEliminadoPerfil(uid);
  let batch = db.batch();
  let contador = 0;
  const commits = [];

  docs.forEach(function(doc) {
    const data = doc.data() || {};
    const update = crearUpdateNotificacionUsuarioEliminadoPerfil(data, uid, uidAnonimo, nombreUsuario);

    if (Object.keys(update).length === 0) return;

    batch.set(doc.ref, update, { merge: true });
    contador++;

    if (contador >= 450) {
      commits.push(batch.commit());
      batch = db.batch();
      contador = 0;
    }
  });

  if (contador > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

async function borrarSubcoleccionesUsuario(uid) {
  if (!uid) return;

  const subcoleccionesPropias = ["chatLeidos"];
  const userRef = db.collection("usuarios").doc(uid);

  for (let i = 0; i < subcoleccionesPropias.length; i++) {
    const snapshot = await userRef.collection(subcoleccionesPropias[i]).get();
    await borrarSnapshotEnBatchesPerfil(snapshot);
  }
}

function rutaStoragePerteneceAUsuarioPerfil(ref, uid) {
  return !!(
    ref &&
    uid &&
    typeof ref.fullPath === "string" &&
    ref.fullPath.indexOf("usuarios/" + uid + "/") === 0
  );
}

async function borrarStorageRefUsuarioPerfil(ref, uid) {
  if (!rutaStoragePerteneceAUsuarioPerfil(ref, uid)) return false;

  try {
    await ref.delete();
    return true;
  } catch (error) {
    if (error && error.code === "storage/object-not-found") return false;
    console.warn("No se pudo borrar un archivo de Storage del usuario:", error.message);
    return false;
  }
}

async function borrarStorageFolderUsuarioPerfil(ref, uid) {
  if (!ref || typeof ref.listAll !== "function") {
    console.warn("No esta disponible el listado de Storage personal del usuario.");
    return;
  }

  let resultado;
  try {
    resultado = await ref.listAll();
  } catch (error) {
    if (error && error.code === "storage/object-not-found") return;
    console.warn("No se pudo listar Storage personal del usuario:", error.message);
    return;
  }

  const items = Array.isArray(resultado.items) ? resultado.items : [];
  const prefixes = Array.isArray(resultado.prefixes) ? resultado.prefixes : [];

  for (let i = 0; i < items.length; i++) {
    await borrarStorageRefUsuarioPerfil(items[i], uid);
  }

  for (let j = 0; j < prefixes.length; j++) {
    await borrarStorageFolderUsuarioPerfil(prefixes[j], uid);
  }
}

async function eliminarStorageUsuario(uid, datosUsuario) {
  if (!uid) return;
  if (!firebase.storage) {
    console.warn("No esta disponible Firebase Storage para limpiar imagenes del usuario.");
    return;
  }

  datosUsuario = datosUsuario || {};
  const storage = firebase.storage();
  const fotoPerfil = datosUsuario.fotoPerfil || "";

  if (typeof window.borrarImagenStorageSiProcede === "function") {
    await window.borrarImagenStorageSiProcede(fotoPerfil, ["usuarios/", "fotosPerfil/"]);
  }

  const carpetaUsuario = storage.ref().child("usuarios/" + uid);
  await borrarStorageFolderUsuarioPerfil(carpetaUsuario, uid);
}

function usuarioPuedeReautenticarseConPasswordPerfil(user) {
  if (!user || !user.email) return false;

  const providers = Array.isArray(user.providerData) ? user.providerData : [];
  if (providers.length === 0) return true;

  return providers.some(function(provider) {
    return provider && provider.providerId === "password";
  });
}

async function reautenticarUsuarioParaEliminarPerfil(user) {
  if (!usuarioPuedeReautenticarseConPasswordPerfil(user) || !firebase.auth.EmailAuthProvider) {
    alert("Esta app solo puede eliminar cuentas iniciadas con email y contrasena. Si tu cuenta usa Google u otro proveedor, contacta con soporte.");
    return false;
  }

  const password = prompt("Introduce tu contrasena actual para confirmar la eliminacion");
  if (!password) {
    alert("Eliminacion cancelada");
    return false;
  }

  const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);

  try {
    await user.reauthenticateWithCredential(credential);
    return true;
  } catch (errorReauth) {
    console.error(errorReauth);
    alert("No se pudo confirmar tu identidad. No se ha borrado nada.");
    return false;
  }
}

async function borrarUsuarioFirestoreYAuthPerfil(userRef, user) {
  try {
    await userRef.delete();
  } catch (errorFirestore) {
    console.error(errorFirestore);
    const error = new Error("No se pudo borrar el documento del usuario. No se ha borrado la cuenta de Auth.");
    error.code = "perfil/firestore-delete-failed";
    error.originalError = errorFirestore;
    throw error;
  }

  try {
    await user.delete();
  } catch (errorAuth) {
    console.error(errorAuth);
    errorAuth.perfilFirestoreBorrado = true;
    throw errorAuth;
  }
}

async function eliminarPerfil() {

  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;

  try {
    alert("Vas a eliminar tu cuenta. Esta accion no se puede deshacer.");

    const confirmacion = prompt("Escribe ELIMINAR para confirmar el borrado definitivo de tu cuenta");
    if (confirmacion !== "ELIMINAR") {
      alert("Eliminacion cancelada");
      return;
    }

    const reautenticado = await reautenticarUsuarioParaEliminarPerfil(user);
    if (!reautenticado) return;

    const tienePartidasActivasComoCreador = await usuarioTienePartidasActivasComoCreadorPerfil(uid);
    if (tienePartidasActivasComoCreador) {
      alert("Tienes una partida activa como creador. Debes cancelarla o resolverla antes de eliminar tu cuenta.");
      return;
    }

    const userRef = db.collection("usuarios").doc(uid);
    const userDoc = await userRef.get();
    const datosPerfil = userDoc.exists ? (userDoc.data() || {}) : {};
    const uidAnonimo = generarUidAnonimoUsuarioEliminado(uid);
    const nombreUsuarioEliminado = datosPerfil.nombre || user.displayName || "";

    await resolverPartidasActivasAntesDeEliminarPerfil(uid);

    // 2. limpiar referencias sociales
    await limpiarRelacionesSocialesUsuario(uid, nombreUsuarioEliminado);

    await eliminarMensajesUsuarioAntesDeEliminarPerfil(uid);

    await anonimizarPistasCreadasUsuario(uid);

    await anonimizarHistorialUsuarioEliminado(uid);

    await limpiarNotificacionesUsuarioEliminado(uid, uidAnonimo, nombreUsuarioEliminado);

    await eliminarStorageUsuario(uid, datosPerfil);

    await borrarSubcoleccionesUsuario(uid);

    await borrarUsuarioFirestoreYAuthPerfil(userRef, user);

    alert("Cuenta eliminada");
    await auth.signOut();
    mostrar("login");

  } catch (error) {

    console.error(error);

    if (error && error.perfilFirestoreBorrado === true) {
      alert("El perfil se ha borrado de la base de datos, pero no se pudo borrar la cuenta de autenticacion. Vuelve a iniciar sesion si es posible o contacta con soporte.");
      await auth.signOut();
      mostrar("login");
      return;
    }

    if (error && error.code === "perfil/firestore-delete-failed") {
      alert("No se pudo borrar el perfil de la base de datos. No se ha borrado la cuenta de autenticacion.");
      return;
    }

    if (error && (error.code === "perfil/storage-list-failed" || error.code === "perfil/storage-delete-failed")) {
      alert("No se pudo limpiar completamente el Storage personal. No se ha borrado el perfil ni la cuenta de autenticacion.");
      return;
    }

    if (error && error.code === "auth/requires-recent-login") {
      alert("Vuelve a iniciar sesión para eliminar la cuenta");
      await auth.signOut();
    } else {
      alert("No se pudo eliminar la cuenta. No se ha completado el borrado.");
    }

  }
}

function verPerfil(uid = auth.currentUser?.uid){

  document.getElementById("btnCambiarFoto").style.display = "none";
  registrarDelegacionSocialPerfil();

  const user = auth.currentUser;
  if (!user || !uid) return;

  // limpiar listeners anteriores
 if (typeof unsubscribePerfil === "function") unsubscribePerfil();
if (typeof unsubscribeUser === "function") unsubscribeUser();

  mostrar("perfil");
  window.scrollTo({ top: 0, behavior: "auto" });

  // guardar uid activo
  const perfilEl = document.getElementById("perfil");
  if (perfilEl) perfilEl.dataset.uid = uid;

  const btnSeguir = document.getElementById("btnSeguir");
  const editarBtn = document.getElementById("btnEditar");
  const eliminarBtn = document.getElementById("btnEliminar");
  configurarBotonChatPrivadoPerfil(uid);

  // control botones
  if (editarBtn) editarBtn.style.display = (user.uid === uid) ? "block" : "none";
  if (eliminarBtn) eliminarBtn.style.display = (user.uid === uid) ? "block" : "none";
  if (btnSeguir) {
    btnSeguir.style.display = (user.uid !== uid) ? "block" : "none";
    btnSeguir.onclick = toggleSeguir;
  }

  if (btnSeguir && user.uid !== uid) {
  db.collection("usuarios").doc(user.uid).get().then(miDoc => {

    const siguiendo = miDoc.data()?.siguiendo || [];

    if (siguiendo.includes(uid)) {
      btnSeguir.innerText = "Dejar de seguir";
      btnSeguir.classList.remove("btnSeguir");
      btnSeguir.classList.add("btnSiguiendo");
    } else {
      btnSeguir.innerText = "Seguir";
      btnSeguir.classList.remove("btnSiguiendo");
      btnSeguir.classList.add("btnSeguir");
    }

  });
}

  // LISTENER PERFIL
  unsubscribePerfil = db.collection("usuarios").doc(uid).onSnapshot(doc => {

if (!doc.exists) {
  console.log("NO EXISTE DOC");
  return;
}

const data = doc.data();
console.log("DATA:", data);

    renderizarDatosVisualesPerfil(data, { usarFallbackSexo: true });
    console.log("FOTO PERFIL:", data.fotoPerfil);

  });

  // LISTENER USUARIO (estado seguir)
  unsubscribeUser = db.collection("usuarios").doc(user.uid).onSnapshot(miDoc => {

    if (!miDoc.exists) return;

    const perfilActual = document.getElementById("perfil").dataset.uid;
    if (!perfilActual) return;

    if (perfilActual === user.uid) {
      if (btnSeguir) {
        btnSeguir.style.display = "none";
        btnSeguir.onclick = null;
      }
      return;
    }

    const siguiendo = miDoc.data()?.siguiendo || [];
    const sigo = siguiendo.includes(perfilActual);

    if (btnSeguir) {
      btnSeguir.innerText = sigo ? "Dejar de seguir" : "Seguir";
      btnSeguir.classList.toggle("btnYellow", !sigo);
    }

  });

}

function editarPerfil(){

  if (typeof unsubscribePerfil === "function") unsubscribePerfil();


  const user = auth.currentUser;
  if (!user) return;

  const imgEditar = document.getElementById("fotoPerfilEditar");

if (imgEditar && auth.currentUser) {
  db.collection("usuarios").doc(auth.currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();

      let defaultImg = data.sexo === "mujer"
        ? "imagen/mujer.jpeg"
        : "imagen/hombre.jpeg";

      imgEditar.src = (data.fotoPerfil || defaultImg) + "?t=" + Date.now();
    }
  });
}

  mostrar("perfilEditar");

  const manoEl = document.getElementById("mano");
  const posicionEl = document.getElementById("posicion");

  if (manoEl) manoEl.disabled = false;
  if (posicionEl) posicionEl.disabled = false;

  const btnFoto = document.getElementById("btnCambiarFoto");
  if (btnFoto) btnFoto.style.display = "block";

  // ESCUCHA EN TIEMPO REAL (igual que perfil)
  db.collection("usuarios").doc(user.uid)
    .onSnapshot(doc => {

      if (!doc.exists) return;

      const data = doc.data();

      const foto = document.getElementById("fotoPerfilEditar");
      if (foto) foto.src = data.fotoPerfil || "imagen/hombre.jpeg";

      if (manoEl) manoEl.value = data.mano || "";
      if (posicionEl) posicionEl.value = data.posicion || "";

    });

}


function toggleSeguir(){

 

  const btnSeguir = document.getElementById("btnSeguir");
  if (btnSeguir) btnSeguir.disabled = true;

  const user = auth.currentUser;
  if (!user) return;

  const uid = document.getElementById("perfil").dataset.uid;

  const miRef = db.collection("usuarios").doc(user.uid);
  const otroRef = db.collection("usuarios").doc(uid);

  return miRef.get().then(miDoc => {

    const misDatos = miDoc.data() || {};
    const siguiendo = misDatos.siguiendo || [];
    const sigo = siguiendo.includes(uid);
    const nombreActor = misDatos.nombre || user.displayName || (user.email ? user.email.split("@")[0] : "");

    if (btnSeguir) {
  if (!sigo) {
  // vas a empezar a seguir
  btnSeguir.innerText = "Dejar de seguir";
  btnSeguir.classList.remove("btnSeguir");
  btnSeguir.classList.add("btnSiguiendo");
} else {
  // vas a dejar de seguir
  btnSeguir.innerText = "Seguir";
  btnSeguir.classList.remove("btnSiguiendo");
  btnSeguir.classList.add("btnSeguir");
}
}

    if (sigo) {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayRemove(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayRemove(user.uid)
        })
      ]).then(function() {
        return notificarCambioSeguidoresAgrupadoPerfil({
          tipo: "seguidores_perdidos",
          paraUid: uid,
          actorUid: user.uid,
          actorNombre: nombreActor,
          motivo: "unfollow"
        });
      });

    } else {

      return Promise.all([
        miRef.update({
          siguiendo: firebase.firestore.FieldValue.arrayUnion(uid)
        }),
        otroRef.update({
          seguidores: firebase.firestore.FieldValue.arrayUnion(user.uid)
        })
      ]).then(function() {
        return notificarCambioSeguidoresAgrupadoPerfil({
          tipo: "nuevos_seguidores",
          paraUid: uid,
          actorUid: user.uid,
          actorNombre: nombreActor,
          motivo: "follow"
        });
      });

    }

  }).finally(() => {
    if (btnSeguir) btnSeguir.disabled = false;
  });

}

function guardarPerfil(){

  console.log("CLICK GUARDAR");

  const user = auth.currentUser;
  if (!user) return;

  const manoEl = document.getElementById("manoEditar");
  const posicionEl = document.getElementById("posicionEditar");

  if (!manoEl || !posicionEl) return;

  const mano = manoEl.value;
  const posicion = posicionEl.value;

  if (!mano || !posicion) return;

  db.collection("usuarios").doc(user.uid).update({
    mano: mano,
    posicion: posicion
  })
  .then(() => {

    mostrar("perfil");

  })
  .catch(err => {
    console.error(err);
  });

}


function cargarPerfil(uid){

  unsubscribePerfil && unsubscribePerfil();
  registrarDelegacionSocialPerfil();
  configurarBotonChatPrivadoPerfil(uid);

  const user = auth.currentUser;
  const esPerfilPropio = !!(user && uid === user.uid);
  const btnSeguir = document.getElementById("btnSeguir");
  const editarBtn = document.getElementById("btnEditar");
  const eliminarBtn = document.getElementById("btnEliminar");

  if (btnSeguir) {
    btnSeguir.style.display = esPerfilPropio ? "none" : "block";
    btnSeguir.onclick = esPerfilPropio ? null : toggleSeguir;
  }
  if (editarBtn) editarBtn.style.display = esPerfilPropio ? "block" : "none";
  if (eliminarBtn) eliminarBtn.style.display = esPerfilPropio ? "block" : "none";

  const perfilEl = document.getElementById("perfil");
  if (perfilEl) perfilEl.dataset.uid = uid;

  unsubscribePerfil = db.collection("usuarios")
    .doc(uid)
    .onSnapshot(doc => {

      if (!doc.exists) return;

      const data = doc.data();

      renderizarDatosVisualesPerfil(data, {
        actualizarStats: document.getElementById("perfil").style.display === "block"
      });

    });
}


function irPerfil(){
  const user = auth.currentUser;
  if (!user) return;

  mostrar("perfil");
  cargarPerfil(user.uid);
}
