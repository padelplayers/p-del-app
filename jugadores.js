let jugadoresCache = [];
let jugadoresCargados = false;
let filtroSexoJugadores = "todos";
let eventosJugadoresRegistrados = false;

function normalizarTextoJugadores(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizarSexoJugador(sexo) {
  const valor = normalizarTextoJugadores(sexo);
  if (valor === "mujer" || valor === "femenino") return "mujer";
  if (valor === "hombre" || valor === "masculino") return "hombre";
  return valor;
}

function obtenerFotoJugador(data) {
  if (data.fotoPerfil) return data.fotoPerfil;
  return normalizarSexoJugador(data.sexo) === "mujer" ? "imagen/mujer.jpeg" : "imagen/hombre.jpeg";
}

function crearDatoJugador(etiqueta, valor) {
  const dato = document.createElement("div");
  dato.className = "jugadorDato";
  dato.textContent = etiqueta + ": " + valor;
  return dato;
}

function crearTarjetaJugador(jugador) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "jugadorCard";
  boton.onclick = function() {
    verPerfil(jugador.uid);
  };

  const img = document.createElement("img");
  img.className = "jugadorFoto";
  img.src = jugador.foto;
  img.alt = jugador.nombre ? "Foto de " + jugador.nombre : "Foto de jugador";

  const nombre = document.createElement("span");
  nombre.className = "jugadorNombre";
  nombre.textContent = jugador.nombre || "Jugador";

  const meta = document.createElement("div");
  meta.className = "jugadorMeta";

  if (jugador.nivel) {
    meta.appendChild(crearDatoJugador("Nivel", jugador.nivel));
  }

  if (jugador.sexoTexto) {
    meta.appendChild(crearDatoJugador("Sexo", jugador.sexoTexto));
  }

  boton.appendChild(img);
  boton.appendChild(nombre);
  boton.appendChild(meta);

  return boton;
}

function renderizarJugadores() {
  const contenedor = document.getElementById("listaJugadores");
  if (!contenedor) return;

  const input = document.getElementById("buscarJugadores");
  const texto = normalizarTextoJugadores(input ? input.value : "");

  const jugadoresFiltrados = jugadoresCache.filter(function(jugador) {
    const coincideTexto = !texto || jugador.nombreNormalizado.startsWith(texto);
    const coincideSexo = filtroSexoJugadores === "todos" || jugador.sexoNormalizado === filtroSexoJugadores;
    return coincideTexto && coincideSexo;
  });

  if (jugadoresFiltrados.length === 0) {
    const vacio = document.createElement("div");
    vacio.className = "jugadoresVacio";
    vacio.textContent = "No hay jugadores";
    contenedor.replaceChildren(vacio);
    return;
  }

  const fragment = document.createDocumentFragment();
  jugadoresFiltrados.forEach(function(jugador) {
    fragment.appendChild(crearTarjetaJugador(jugador));
  });

  contenedor.replaceChildren(fragment);
}

function cargarJugadores() {
  const contenedor = document.getElementById("listaJugadores");
  if (!contenedor) return Promise.resolve();

  if (jugadoresCargados) {
    renderizarJugadores();
    return Promise.resolve();
  }

  contenedor.replaceChildren(document.createTextNode("Cargando jugadores..."));

  return db.collection("usuarios").get().then(function(snapshot) {
    jugadoresCache = [];

    snapshot.forEach(function(doc) {
      const data = doc.data() || {};
      const nombre = data.nombre || "";
      const sexoNormalizado = normalizarSexoJugador(data.sexo);

      jugadoresCache.push({
        uid: doc.id,
        nombre: nombre,
        nombreNormalizado: normalizarTextoJugadores(nombre),
        foto: obtenerFotoJugador(data),
        nivel: data.nivel || "",
        sexoTexto: data.sexo || "",
        sexoNormalizado: sexoNormalizado
      });
    });

    jugadoresCache.sort(function(a, b) {
      return a.nombreNormalizado.localeCompare(b.nombreNormalizado);
    });

    jugadoresCargados = true;
    renderizarJugadores();
  }).catch(function(error) {
    console.error("Error cargando jugadores:", error);
    contenedor.replaceChildren(document.createTextNode("No se pudieron cargar los jugadores"));
  });
}

function registrarEventosJugadores() {
  if (eventosJugadoresRegistrados) return;
  eventosJugadoresRegistrados = true;

  const input = document.getElementById("buscarJugadores");
  if (input) {
    input.addEventListener("input", renderizarJugadores);
  }

  document.querySelectorAll(".jugadorFiltroBtn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      filtroSexoJugadores = btn.dataset.filtroSexo || "todos";
      document.querySelectorAll(".jugadorFiltroBtn").forEach(function(boton) {
        boton.classList.toggle("activo", boton === btn);
      });
      renderizarJugadores();
    });
  });
}

function abrirJugadores() {
  registrarEventosJugadores();
  mostrar("jugadores");
  cargarJugadores();
}

window.cargarJugadores = cargarJugadores;
window.abrirJugadores = abrirJugadores;
