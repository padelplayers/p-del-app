(function() {
  const TROFEOS_BASE = "imagenes app/trofeos/";

  const CATEGORIAS_LOGROS = [
    {
      id: "participacion",
      nombre: "Participaci\u00f3n",
      iconoColor: TROFEOS_BASE + "participacion-color.png",
      iconoGris: TROFEOS_BASE + "participacion-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primer Partido", objetivo: "1 partida", valorObjetivo: 1, tipo: "partidos" },
        { estrellas: 2, nombre: "Jugador Activo", objetivo: "10 partidas", valorObjetivo: 10, tipo: "partidos" },
        { estrellas: 3, nombre: "Jugador Habitual", objetivo: "50 partidas", valorObjetivo: 50, tipo: "partidos" },
        { estrellas: 4, nombre: "Veterano de la Pista", objetivo: "100 partidas", valorObjetivo: 100, tipo: "partidos" },
        { estrellas: 5, nombre: "Leyenda del P\u00e1del", objetivo: "250 partidas", valorObjetivo: 250, tipo: "partidos" }
      ]
    },
    {
      id: "competicion",
      nombre: "Competici\u00f3n",
      iconoColor: TROFEOS_BASE + "competicion-color.png",
      iconoGris: TROFEOS_BASE + "competicion-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primera Victoria", objetivo: "1 victoria ranking", valorObjetivo: 1, tipo: "victorias_ranking" },
        { estrellas: 2, nombre: "Competidor", objetivo: "10 victorias ranking", valorObjetivo: 10, tipo: "victorias_ranking" },
        { estrellas: 3, nombre: "Especialista", objetivo: "25 victorias ranking", valorObjetivo: 25, tipo: "victorias_ranking" },
        { estrellas: 4, nombre: "Referente Competitivo", objetivo: "50 victorias ranking", valorObjetivo: 50, tipo: "victorias_ranking" },
        { estrellas: 5, nombre: "Leyenda Competitiva", objetivo: "100 victorias ranking", valorObjetivo: 100, tipo: "victorias_ranking" }
      ]
    },
    {
      id: "comunidad",
      dinamica: true,
      nombre: "Comunidad",
      iconoColor: TROFEOS_BASE + "comunidad-color.png",
      iconoGris: TROFEOS_BASE + "comunidad-gris.png",
      logros: [
        { estrellas: 1, nombre: "Buen Compa\u00f1ero", objetivo: "5 valoraciones y media minima 3.5", valorObjetivo: 5, mediaMinima: 3.5, tipo: "comunidad" },
        { estrellas: 2, nombre: "Jugador Respetado", objetivo: "10 valoraciones y media minima 4.0", valorObjetivo: 10, mediaMinima: 4.0, tipo: "comunidad" },
        { estrellas: 3, nombre: "Referente Local", objetivo: "25 valoraciones y media minima 4.3", valorObjetivo: 25, mediaMinima: 4.3, tipo: "comunidad" },
        { estrellas: 4, nombre: "Embajador de la Comunidad", objetivo: "50 valoraciones y media minima 4.6", valorObjetivo: 50, mediaMinima: 4.6, tipo: "comunidad" },
        { estrellas: 5, nombre: "Leyenda de la Comunidad", objetivo: "100 valoraciones y media minima 4.8", valorObjetivo: 100, mediaMinima: 4.8, tipo: "comunidad" }
      ]
    },
    {
      id: "compromiso",
      dinamica: true,
      nombre: "Compromiso",
      iconoColor: TROFEOS_BASE + "compromiso-color.png",
      iconoGris: TROFEOS_BASE + "compromiso-gris.png",
      logros: [
        { estrellas: 1, nombre: "Comprometido", objetivo: "10 partidas sin abandono", valorObjetivo: 10, tipo: "sin_abandono" },
        { estrellas: 2, nombre: "Jugador Fiable", objetivo: "25 partidas sin abandono", valorObjetivo: 25, tipo: "sin_abandono" },
        { estrellas: 3, nombre: "Siempre Presente", objetivo: "50 partidas sin abandono", valorObjetivo: 50, tipo: "sin_abandono" },
        { estrellas: 4, nombre: "Ejemplo de Compromiso", objetivo: "100 partidas sin abandono", valorObjetivo: 100, tipo: "sin_abandono" },
        { estrellas: 5, nombre: "Compromiso Total", objetivo: "250 partidas sin abandono", valorObjetivo: 250, tipo: "sin_abandono" }
      ]
    },
    {
      id: "exploracion",
      nombre: "Exploraci\u00f3n",
      iconoColor: TROFEOS_BASE + "explorador-color.png",
      iconoGris: TROFEOS_BASE + "explorador-gris.png",
      logros: [
        { estrellas: 1, nombre: "Explorador", objetivo: "2 pistas diferentes", valorObjetivo: 2, tipo: "pistas_diferentes" },
        { estrellas: 2, nombre: "Ruta Local", objetivo: "4 pistas diferentes", valorObjetivo: 4, tipo: "pistas_diferentes" },
        { estrellas: 3, nombre: "Conquistador del Morvedre", objetivo: "6 pistas diferentes", valorObjetivo: 6, tipo: "pistas_diferentes" },
        { estrellas: 4, nombre: "Maestro Explorador", objetivo: "8 pistas diferentes", valorObjetivo: 8, tipo: "pistas_diferentes" },
        { estrellas: 5, nombre: "Leyenda Exploradora", objetivo: "10 pistas diferentes", valorObjetivo: 10, tipo: "pistas_diferentes" }
      ]
    },
    {
      id: "organizador",
      nombre: "Organizador",
      iconoColor: TROFEOS_BASE + "organizador-color.png",
      iconoGris: TROFEOS_BASE + "organizador-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primera Partida", objetivo: "1 partida creada", valorObjetivo: 1, tipo: "partidas_creadas" },
        { estrellas: 2, nombre: "Organizador Local", objetivo: "3 partidas creadas", valorObjetivo: 3, tipo: "partidas_creadas" },
        { estrellas: 3, nombre: "Organizador Habitual", objetivo: "5 partidas creadas", valorObjetivo: 5, tipo: "partidas_creadas" },
        { estrellas: 4, nombre: "Organizador Experto", objetivo: "25 partidas creadas", valorObjetivo: 25, tipo: "partidas_creadas" },
        { estrellas: 5, nombre: "Gran Organizador", objetivo: "100 partidas creadas", valorObjetivo: 100, tipo: "partidas_creadas" }
      ]
    },
    {
      id: "creador_pistas",
      nombre: "Creador de pistas",
      iconoColor: TROFEOS_BASE + "creador_de_pista-color.png",
      iconoGris: TROFEOS_BASE + "creador_de_pista-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primera Pista", objetivo: "1 pista creada", valorObjetivo: 1, tipo: "pistas_creadas" },
        { estrellas: 2, nombre: "Creador Local", objetivo: "3 pistas creadas", valorObjetivo: 3, tipo: "pistas_creadas" },
        { estrellas: 3, nombre: "Maestro de Pistas", objetivo: "5 pistas creadas", valorObjetivo: 5, tipo: "pistas_creadas" }
      ]
    }
  ];

  function crearTextoLogro(tag, texto, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = texto;
    return el;
  }

  function obtenerLogrosDesbloqueados(data) {
    const logros = data && data.logros;
    if (!logros || typeof logros !== "object") return {};
    return logros.desbloqueados && typeof logros.desbloqueados === "object"
      ? logros.desbloqueados
      : {};
  }

  function obtenerNumeroLogro(valor, fallback) {
    const numero = Number(valor);
    return isNaN(numero) ? fallback : numero;
  }

  function obtenerMediaComunidad(clasificacion) {
    const valoraciones = obtenerNumeroLogro(clasificacion.valoracionesRecibidas, 0);
    if (!valoraciones || valoraciones <= 0) return 0;

    const puntualidad = obtenerNumeroLogro(clasificacion.puntualidadTotal, 0) / valoraciones;
    const actitud = obtenerNumeroLogro(clasificacion.actitudTotal, 0) / valoraciones;
    const compromiso = obtenerNumeroLogro(clasificacion.compromisoTotal, 0) / valoraciones;
    return (puntualidad + actitud + compromiso) / 3;
  }

  function crearEstadoNumerico(progreso, logro, desbloqueadoManual) {
    return {
      progreso: progreso,
      textoProgreso: "Progreso: " + progreso + " | Objetivo: " + logro.objetivo,
      desbloqueado: desbloqueadoManual || progreso >= logro.valorObjetivo
    };
  }

  function obtenerPartidasSinAbandono(data, clasificacion) {
    const candidatos = [
      clasificacion && clasificacion.compromisoLogro,
      clasificacion && clasificacion.partidasSinAbandono,
      clasificacion && clasificacion.partidasCompletadasSinAbandono,
      data && data.compromisoLogro,
      data && data.partidasSinAbandono,
      data && data.partidasCompletadasSinAbandono
    ];

    for (let i = 0; i < candidatos.length; i++) {
      if (candidatos[i] !== undefined && candidatos[i] !== null && candidatos[i] !== "") {
        return obtenerNumeroLogro(candidatos[i], 0);
      }
    }

    return 0;
  }

  function obtenerPistasDiferentes(clasificacion) {
    const ids = clasificacion && clasificacion.pistasJugadasIds;
    if (!Array.isArray(ids)) return 0;
    return ids.filter(function(id, index) {
      return !!id && ids.indexOf(id) === index;
    }).length;
  }

  function calcularEstadoLogro(data, categoria, logro, desbloqueadoManual) {
    const clasificacion = (data && data.clasificacion) || {};
    const desbloqueadoPermanente = categoria && categoria.dinamica === true ? false : desbloqueadoManual;

    if (logro.tipo === "partidos") {
      const progreso = obtenerNumeroLogro(clasificacion.partidos, 0);
      return crearEstadoNumerico(progreso, logro, desbloqueadoPermanente);
    }

    if (logro.tipo === "victorias_ranking") {
      const progreso = obtenerNumeroLogro(clasificacion.victoriasRanking, 0);
      return crearEstadoNumerico(progreso, logro, desbloqueadoPermanente);
    }

    if (logro.tipo === "pistas_diferentes") {
      const progreso = obtenerPistasDiferentes(clasificacion);
      return crearEstadoNumerico(progreso, logro, desbloqueadoPermanente);
    }

    if (logro.tipo === "partidas_creadas") {
      const progreso = obtenerNumeroLogro(clasificacion.partidasCreadas, 0);
      return crearEstadoNumerico(progreso, logro, desbloqueadoPermanente);
    }

    if (logro.tipo === "pistas_creadas") {
      const progreso = obtenerNumeroLogro(clasificacion.pistasCreadas, 0);
      return crearEstadoNumerico(progreso, logro, desbloqueadoPermanente);
    }

    if (logro.tipo === "comunidad") {
      const valoraciones = obtenerNumeroLogro(clasificacion.valoracionesRecibidas, 0);
      const media = obtenerMediaComunidad(clasificacion);
      return {
        progreso: valoraciones,
        textoProgreso: "Progreso: " + valoraciones + " valoraciones, media " + media.toFixed(1) + " | Objetivo: " + logro.objetivo,
        desbloqueado: valoraciones >= logro.valorObjetivo && media >= logro.mediaMinima
      };
    }

    if (logro.tipo === "sin_abandono") {
      const progreso = obtenerPartidasSinAbandono(data || {}, clasificacion);
      return crearEstadoNumerico(progreso, logro, false);
    }

    return {
      progreso: 0,
      textoProgreso: "Progreso: 0 | Objetivo: " + logro.objetivo,
      desbloqueado: desbloqueadoPermanente
    };
  }

  function crearCardLogro(categoria, logro, estado) {
    const desbloqueado = estado.desbloqueado === true;
    const card = document.createElement("div");
    card.className = desbloqueado ? "perfilLogroNivel desbloqueado" : "perfilLogroNivel bloqueado";

    const icono = document.createElement("img");
    icono.src = desbloqueado ? categoria.iconoColor : categoria.iconoGris;
    icono.alt = categoria.nombre;

    const contenido = document.createElement("div");
    contenido.className = "perfilLogroContenido";
    contenido.appendChild(crearTextoLogro("div", "\u2605".repeat(logro.estrellas), "perfilLogroEstrellas"));
    contenido.appendChild(crearTextoLogro("strong", logro.nombre, "perfilLogroNombre"));
    contenido.appendChild(crearTextoLogro("span", estado.textoProgreso, "perfilLogroProgreso"));

    card.appendChild(icono);
    card.appendChild(contenido);
    return card;
  }

  function crearCategoriaLogros(categoria, desbloqueados, data) {
    const bloque = document.createElement("section");
    bloque.className = "perfilLogroCategoria";

    bloque.appendChild(crearTextoLogro("h4", "Categor\u00eda: " + categoria.nombre, "perfilLogroCategoriaTitulo"));

    const lista = document.createElement("div");
    lista.className = "perfilLogrosNiveles";

    categoria.logros.forEach(function(logro, index) {
      const logroId = categoria.id + "_" + (index + 1);
      const estado = calcularEstadoLogro(data || {}, categoria, logro, desbloqueados[logroId] === true);
      lista.appendChild(crearCardLogro(categoria, logro, estado));
    });

    bloque.appendChild(lista);
    return bloque;
  }

  window.renderizarLogrosPerfil = function(data) {
    const contenedor = document.getElementById("logrosPerfil");
    if (!contenedor) return;

    const desbloqueados = obtenerLogrosDesbloqueados(data || {});
    contenedor.replaceChildren();
    contenedor.classList.add("perfilLogrosListado");

    CATEGORIAS_LOGROS.forEach(function(categoria) {
      contenedor.appendChild(crearCategoriaLogros(categoria, desbloqueados, data || {}));
    });
  };

  window.CATEGORIAS_LOGROS_PERFIL = CATEGORIAS_LOGROS;
})();
