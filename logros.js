(function() {
  const TROFEOS_BASE = "imagenes app/trofeos/";

  const CATEGORIAS_LOGROS = [
    {
      id: "participacion",
      nombre: "Participaci\u00f3n",
      iconoColor: TROFEOS_BASE + "participacion-color.png",
      iconoGris: TROFEOS_BASE + "participacion-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primer Partido", objetivo: "Objetivo pendiente" },
        { estrellas: 2, nombre: "Jugador Activo", objetivo: "Objetivo pendiente" },
        { estrellas: 3, nombre: "Jugador Habitual", objetivo: "Objetivo pendiente" },
        { estrellas: 4, nombre: "Veterano de la Pista", objetivo: "Objetivo pendiente" },
        { estrellas: 5, nombre: "Leyenda del P\u00e1del", objetivo: "Objetivo pendiente" }
      ]
    },
    {
      id: "competicion",
      nombre: "Competici\u00f3n",
      iconoColor: TROFEOS_BASE + "competicion-color.png",
      iconoGris: TROFEOS_BASE + "competicion-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primera Victoria", objetivo: "Objetivo pendiente" },
        { estrellas: 2, nombre: "Competidor", objetivo: "Objetivo pendiente" },
        { estrellas: 3, nombre: "Especialista", objetivo: "Objetivo pendiente" },
        { estrellas: 4, nombre: "Referente Competitivo", objetivo: "Objetivo pendiente" },
        { estrellas: 5, nombre: "Leyenda Competitiva", objetivo: "Objetivo pendiente" }
      ]
    },
    {
      id: "comunidad",
      nombre: "Comunidad",
      iconoColor: TROFEOS_BASE + "comunidad-color.png",
      iconoGris: TROFEOS_BASE + "comunidad-gris.png",
      logros: [
        { estrellas: 1, nombre: "Buen Compa\u00f1ero", objetivo: "Objetivo pendiente" },
        { estrellas: 2, nombre: "Jugador Respetado", objetivo: "Objetivo pendiente" },
        { estrellas: 3, nombre: "Referente Local", objetivo: "Objetivo pendiente" },
        { estrellas: 4, nombre: "Embajador de la Comunidad", objetivo: "Objetivo pendiente" },
        { estrellas: 5, nombre: "Leyenda de la Comunidad", objetivo: "Objetivo pendiente" }
      ]
    },
    {
      id: "compromiso",
      nombre: "Compromiso",
      iconoColor: TROFEOS_BASE + "compromiso-color.png",
      iconoGris: TROFEOS_BASE + "compromiso-gris.png",
      logros: [
        { estrellas: 1, nombre: "Comprometido", objetivo: "Objetivo pendiente" },
        { estrellas: 2, nombre: "Jugador Fiable", objetivo: "Objetivo pendiente" },
        { estrellas: 3, nombre: "Siempre Presente", objetivo: "Objetivo pendiente" },
        { estrellas: 4, nombre: "Ejemplo de Compromiso", objetivo: "Objetivo pendiente" },
        { estrellas: 5, nombre: "Compromiso Total", objetivo: "Objetivo pendiente" }
      ]
    },
    {
      id: "exploracion",
      nombre: "Exploraci\u00f3n",
      iconoColor: TROFEOS_BASE + "explorador-color.png",
      iconoGris: TROFEOS_BASE + "explorador-gris.png",
      logros: [
        { estrellas: 1, nombre: "Explorador", objetivo: "Objetivo pendiente" },
        { estrellas: 2, nombre: "Ruta Local", objetivo: "Objetivo pendiente" },
        { estrellas: 3, nombre: "Conquistador del Morvedre", objetivo: "Objetivo pendiente" },
        { estrellas: 4, nombre: "Maestro Explorador", objetivo: "Objetivo pendiente" },
        { estrellas: 5, nombre: "Leyenda Exploradora", objetivo: "Objetivo pendiente" }
      ]
    },
    {
      id: "organizador",
      nombre: "Organizador",
      iconoColor: TROFEOS_BASE + "organizador-color.png",
      iconoGris: TROFEOS_BASE + "organizador-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primera Partida", objetivo: "Objetivo pendiente" },
        { estrellas: 2, nombre: "Organizador Local", objetivo: "Objetivo pendiente" },
        { estrellas: 3, nombre: "Organizador Habitual", objetivo: "Objetivo pendiente" },
        { estrellas: 4, nombre: "Organizador Experto", objetivo: "Objetivo pendiente" },
        { estrellas: 5, nombre: "Gran Organizador", objetivo: "Objetivo pendiente" }
      ]
    },
    {
      id: "creador_pistas",
      nombre: "Creador de pistas",
      iconoColor: TROFEOS_BASE + "creador_de_pista-color.png",
      iconoGris: TROFEOS_BASE + "creador_de_pista-gris.png",
      logros: [
        { estrellas: 1, nombre: "Primera Pista", objetivo: "Objetivo pendiente" },
        { estrellas: 2, nombre: "Creador Local", objetivo: "Objetivo pendiente" },
        { estrellas: 3, nombre: "Maestro de Pistas", objetivo: "Objetivo pendiente" }
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

  function crearCardLogro(categoria, logro, desbloqueado) {
    const card = document.createElement("div");
    card.className = desbloqueado ? "perfilLogroNivel desbloqueado" : "perfilLogroNivel bloqueado";

    const icono = document.createElement("img");
    icono.src = desbloqueado ? categoria.iconoColor : categoria.iconoGris;
    icono.alt = categoria.nombre;

    const contenido = document.createElement("div");
    contenido.className = "perfilLogroContenido";
    contenido.appendChild(crearTextoLogro("div", "\u2605".repeat(logro.estrellas), "perfilLogroEstrellas"));
    contenido.appendChild(crearTextoLogro("strong", logro.nombre, "perfilLogroNombre"));
    contenido.appendChild(crearTextoLogro("span", "Progreso: 0 / objetivo", "perfilLogroProgreso"));
    contenido.appendChild(crearTextoLogro("span", "Objetivo: " + logro.objetivo, "perfilLogroObjetivo"));

    card.appendChild(icono);
    card.appendChild(contenido);
    return card;
  }

  function crearCategoriaLogros(categoria, desbloqueados) {
    const bloque = document.createElement("section");
    bloque.className = "perfilLogroCategoria";

    bloque.appendChild(crearTextoLogro("h4", "Categor\u00eda: " + categoria.nombre, "perfilLogroCategoriaTitulo"));

    const lista = document.createElement("div");
    lista.className = "perfilLogrosNiveles";

    categoria.logros.forEach(function(logro, index) {
      const logroId = categoria.id + "_" + (index + 1);
      lista.appendChild(crearCardLogro(categoria, logro, desbloqueados[logroId] === true));
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
      contenedor.appendChild(crearCategoriaLogros(categoria, desbloqueados));
    });
  };

  window.CATEGORIAS_LOGROS_PERFIL = CATEGORIAS_LOGROS;
})();
