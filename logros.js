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
        { estrellas: 1, nombre: "Primera Victoria", objetivo: "1 victoria ranking" },
        { estrellas: 2, nombre: "Competidor", objetivo: "10 victorias ranking" },
        { estrellas: 3, nombre: "Especialista", objetivo: "25 victorias ranking" },
        { estrellas: 4, nombre: "Referente Competitivo", objetivo: "50 victorias ranking" },
        { estrellas: 5, nombre: "Leyenda Competitiva", objetivo: "100 victorias ranking" }
      ]
    },
    {
      id: "comunidad",
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
        { estrellas: 1, nombre: "Explorador", objetivo: "2 pistas diferentes" },
        { estrellas: 2, nombre: "Ruta Local", objetivo: "4 pistas diferentes" },
        { estrellas: 3, nombre: "Conquistador del Morvedre", objetivo: "6 pistas diferentes" },
        { estrellas: 4, nombre: "Maestro Explorador", objetivo: "8 pistas diferentes" },
        { estrellas: 5, nombre: "Leyenda Exploradora", objetivo: "10 pistas diferentes" }
      ]
    },
    {
      id: "organizador",
      nombre: "Organizador",
      iconoColor: TROFEOS_BASE + "organizador-color.png",
      iconoGris: TROFEOS_BASE + "organizador-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primera Partida", objetivo: "1 partida creada" },
        { estrellas: 2, nombre: "Organizador Local", objetivo: "3 partidas creadas" },
        { estrellas: 3, nombre: "Organizador Habitual", objetivo: "5 partidas creadas" },
        { estrellas: 4, nombre: "Organizador Experto", objetivo: "25 partidas creadas" },
        { estrellas: 5, nombre: "Gran Organizador", objetivo: "100 partidas creadas" }
      ]
    },
    {
      id: "creador_pistas",
      nombre: "Creador de pistas",
      iconoColor: TROFEOS_BASE + "creador_de_pista-color.png",
      iconoGris: TROFEOS_BASE + "creador_de_pista-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primera Pista", objetivo: "1 pista creada" },
        { estrellas: 2, nombre: "Creador Local", objetivo: "3 pistas creadas" },
        { estrellas: 3, nombre: "Maestro de Pistas", objetivo: "5 pistas creadas" }
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

  function obtenerPartidasSinAbandono(data, clasificacion) {
    const candidatos = [
      data && data.partidasSinAbandono,
      data && data.partidasCompletadasSinAbandono,
      clasificacion && clasificacion.partidasSinAbandono,
      clasificacion && clasificacion.partidasCompletadasSinAbandono
    ];

    for (let i = 0; i < candidatos.length; i++) {
      if (candidatos[i] !== undefined && candidatos[i] !== null && candidatos[i] !== "") {
        return obtenerNumeroLogro(candidatos[i], 0);
      }
    }

    return null;
  }

  function calcularEstadoLogro(data, categoria, logro, desbloqueadoManual) {
    const clasificacion = (data && data.clasificacion) || {};

    if (logro.tipo === "partidos") {
      const progreso = obtenerNumeroLogro(clasificacion.partidos, 0);
      return {
        progreso: progreso,
        textoProgreso: "Progreso: " + progreso + " / " + logro.objetivo,
        desbloqueado: desbloqueadoManual || progreso >= logro.valorObjetivo
      };
    }

    if (logro.tipo === "comunidad") {
      const valoraciones = obtenerNumeroLogro(clasificacion.valoracionesRecibidas, 0);
      const media = obtenerMediaComunidad(clasificacion);
      return {
        progreso: valoraciones,
        textoProgreso: "Progreso: " + valoraciones + " / " + logro.objetivo,
        desbloqueado: desbloqueadoManual || (valoraciones >= logro.valorObjetivo && media >= logro.mediaMinima)
      };
    }

    if (logro.tipo === "sin_abandono") {
      const progreso = obtenerPartidasSinAbandono(data || {}, clasificacion);
      if (progreso === null) {
        return {
          progreso: null,
          textoProgreso: "Progreso: Sin datos todavia / " + logro.objetivo,
          desbloqueado: desbloqueadoManual
        };
      }

      return {
        progreso: progreso,
        textoProgreso: "Progreso: " + progreso + " / " + logro.objetivo,
        desbloqueado: desbloqueadoManual || progreso >= logro.valorObjetivo
      };
    }

    return {
      progreso: null,
      textoProgreso: "Progreso: Sin datos todavia / " + logro.objetivo,
      desbloqueado: desbloqueadoManual
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
