window.modoPartidas = window.modoPartidas || "proximas";

function textoNodo(texto, tag) {
  const el = document.createElement(tag || "div");
  el.textContent = texto;
  return el;
}

function actualizarBotonesPartidas() {
  const btnProx = document.getElementById("btnProximas");
  const btnPend = document.getElementById("btnPendientes");

  if (!btnProx || !btnPend) return;

  if (window.modoPartidas === "proximas") {
    btnProx.style.background = "#1565C0";
    btnProx.style.color = "#fff";
    btnPend.style.background = "#eee";
    btnPend.style.color = "#000";
  } else {
    btnPend.style.background = "#1565C0";
    btnPend.style.color = "#fff";
    btnProx.style.background = "#eee";
    btnProx.style.color = "#000";
  }
}

function cambiarModoPartidas(modo) {
  window.modoPartidas = modo;
  actualizarBotonesPartidas();
  cargarPartidas();
}

function pintarJugador(uid, slotId) {
  const el = document.getElementById(slotId);
  if (!el) return;

  if (!uid) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:4px; color:#999; cursor:pointer;";
    wrapper.onclick = function() { unirseAPartida(slotId); };

    const fotoWrap = document.createElement("div");
    fotoWrap.style.cssText = "position:relative; width:40px; height:40px;";

    const img = document.createElement("img");
    img.src = "imagen/hombre.jpeg";
    img.style.cssText = "width:40px; height:40px; border-radius:50%; object-fit:cover; opacity:0.3;";

    const plus = document.createElement("div");
    plus.style.cssText = "position:absolute; bottom:-2px; right:-2px; width:18px; height:18px; border-radius:50%; background:#1565C0; color:#fff; font-size:12px; display:flex; align-items:center; justify-content:center;";
    plus.textContent = "+";

    const label = document.createElement("span");
    label.style.fontSize = "12px";
    label.textContent = "Libre";

    fotoWrap.appendChild(img);
    fotoWrap.appendChild(plus);
    wrapper.appendChild(fotoWrap);
    wrapper.appendChild(label);
    el.replaceChildren(wrapper);
    return;
  }

  db.collection("usuarios").doc(uid).get().then(doc => {
    if (!doc.exists) return;

    const raw = doc.data() || {};
    const u = {
      nombre: raw.nombre,
      nivel: raw.nivel,
      imagen: raw.fotoPerfil,
      genero: raw.sexo
    };

    let imgSrc = "imagen/hombre.jpeg";
    if (u.imagen && u.imagen !== "") imgSrc = u.imagen;
    else if (u.genero === "mujer") imgSrc = "imagen/mujer.jpeg";

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:4px;";

    const fotoWrap = document.createElement("div");
    fotoWrap.style.cssText = "position:relative; width:40px; height:40px;";

    const img = document.createElement("img");
    img.src = imgSrc;
    img.style.cssText = "width:40px; height:40px; border-radius:50%; object-fit:cover;";

    const info = document.createElement("div");
    info.style.cssText = "font-size:12px; text-align:center; line-height:1.1; max-width:60px;";

    const nombre = document.createElement("div");
    nombre.style.cssText = "overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
    nombre.textContent = u.nombre || "Jugador";

    const nivel = document.createElement("div");
    nivel.style.color = "#666";
    nivel.textContent = "Nivel " + (u.nivel || "-");

    fotoWrap.appendChild(img);
    info.appendChild(nombre);
    info.appendChild(nivel);
    wrapper.appendChild(fotoWrap);
    wrapper.appendChild(info);
    el.replaceChildren(wrapper);
  });
}

function crearPartida() {
  const div = document.getElementById("pistaSeleccionada");
  const pistaId = div && div.dataset ? div.dataset.id : null;
  const fecha = document.getElementById("fechaPartida")?.value;
  const hora = document.getElementById("horaPartida")?.value;

  if (!fecha || !hora) {
    alert("Completa todos los campos");
    return;
  }

  const ahora = new Date();
  const partesFecha = fecha.split("-");
  const partesHora = hora.split(":");
  const fechaPartida = new Date(
    parseInt(partesFecha[0]),
    parseInt(partesFecha[1]) - 1,
    parseInt(partesFecha[2]),
    parseInt(partesHora[0]),
    parseInt(partesHora[1])
  );

  const esHoy =
    parseInt(partesFecha[0]) === ahora.getFullYear() &&
    parseInt(partesFecha[1]) === (ahora.getMonth() + 1) &&
    parseInt(partesFecha[2]) === ahora.getDate();

  if (esHoy && fechaPartida < ahora) {
    alert("No puedes seleccionar una hora anterior a la actual");
    return;
  }

  const tipo = document.getElementById("tipoPartida")?.value;
  const genero = document.getElementById("generoPartida")?.value;
  const nivelTipo = document.getElementById("nivelTipo").value;
  const nivelDesde = document.getElementById("nivelDesde").value;
  const nivelHasta = document.getElementById("nivelHasta").value;

  if (!pistaId) {
    alert("Selecciona una pista");
    return;
  }

  if (!fecha || !hora || !tipo || !genero) {
    alert("Completa todos los campos");
    return;
  }

  if (nivelTipo === "rango") {
    if (!nivelDesde || !nivelHasta) {
      alert("Selecciona rango de nivel");
      return;
    }

    if (parseFloat(nivelDesde) > parseFloat(nivelHasta)) {
      alert("Nivel incorrecto");
      return;
    }
  }

  const user = firebase.auth().currentUser;

  db.collection("partidas").add({
    pistaId: pistaId,
    fecha: fecha,
    hora: hora,
    tipo: tipo,
    genero: genero,
    creador: user.uid,
    creadorNombre: user.displayName || "Jugador",
    nivel: nivelTipo === "cualquiera" ? "cualquiera" : {
      desde: nivelDesde,
      hasta: nivelHasta
    },
    jugadores: [user.uid],
    reservas: [],
    estado: "abierta",
    creadaPor: user.uid,
    creadaAt: new Date()
  })
  .then(() => {
    document.getElementById("pistaSeleccionada").innerText = "Ninguna pista";
    document.getElementById("pistaSeleccionada").dataset.id = "";
    mostrar("partidas");
    cargarPartidas();
  });
}

window.seleccionarPistaPartida = function(id, nombre) {
  const div = document.getElementById("pistaSeleccionada");
  if (div) {
    div.innerText = nombre;
    div.dataset.id = id;
  }

  window.modoSeleccionPista = false;
  mostrar("crearPartida");
};

function initCrearPartida() {
  const input = document.getElementById("fechaPartida");
  if (!input) return;

  const hoy = new Date().toISOString().split("T")[0];
  input.value = "";
  input.onchange = function() {
    if (this.value < hoy) {
      alert("No puedes seleccionar una fecha anterior a hoy");
      this.value = "";
    }
  };
}

async function eliminarPartidaConChat(partidaId) {
  if (typeof window.eliminarChatTotal === "function") {
    const ok = await window.eliminarChatTotal(partidaId);
    if (ok === false) return false;
  } else {
    console.warn("[PARTIDAS] No se elimina la partida porque no esta disponible la limpieza del chat.");
    return false;
  }

  await db.collection("partidas").doc(partidaId).delete();
  return true;
}

function crearBloquePartida(id, p, nivelTexto, mostrarSalir, fondo) {
  const bloque = document.createElement("div");
  bloque.style.cssText = "border:1px solid #ccc; padding:10px; margin-bottom:10px; border-radius:10px; background:" + fondo + ";";

  const cabecera = document.createElement("div");
  cabecera.style.paddingTop = "8px";

  const filaTop = document.createElement("div");
  filaTop.style.cssText = "display:flex; justify-content:space-between; align-items:center;";

  const fecha = textoNodo((p.fecha || "") + " - " + (p.hora || ""));
  fecha.style.cssText = "font-size:13px; color:#666;";

  const chatBtn = document.createElement("button");
  chatBtn.type = "button";
  chatBtn.style.cssText = "cursor:pointer; display:flex; align-items:center; gap:6px; font-size:12px; background:#E3F2FD; padding:4px 8px; border-radius:12px; width:auto; margin:0;";
  chatBtn.textContent = "Chat partida";
  chatBtn.onclick = function() { abrirChatPartida(id, p.fecha || ""); };

  filaTop.appendChild(fecha);
  filaTop.appendChild(chatBtn);

  const pistaFila = document.createElement("button");
  pistaFila.type = "button";
  pistaFila.style.cssText = "cursor:pointer; display:flex; align-items:center; gap:6px; width:auto; margin:6px 0 0; padding:0; background:transparent; color:inherit;";
  pistaFila.onclick = function() { verPista(p.pistaId); };

  const pistaTexto = document.createElement("span");
  pistaTexto.id = "pista_" + id;
  pistaTexto.style.fontWeight = "500";
  pistaTexto.textContent = "Cargando pista...";
  pistaFila.appendChild(pistaTexto);

  const metaFila = document.createElement("div");
  metaFila.style.cssText = "display:flex; justify-content:space-between; font-size:13px; color:#666; margin-top:4px;";
  metaFila.appendChild(textoNodo((p.tipo || "ranking") + " - " + nivelTexto + " - " + (p.genero || "")));

  const creador = textoNodo("Creador: -");
  creador.id = "creador_" + id;
  metaFila.appendChild(creador);

  cabecera.appendChild(filaTop);
  cabecera.appendChild(pistaFila);
  cabecera.appendChild(metaFila);

  if (mostrarSalir) {
    const salirWrap = document.createElement("div");
    salirWrap.style.cssText = "margin-top:6px; text-align:right;";

    const salir = document.createElement("button");
    salir.style.cssText = "background:#e53935; color:white; border:none; padding:6px 10px; border-radius:6px;";
    salir.textContent = "Salir";
    salir.onclick = function() { salirDePartida(id); };

    salirWrap.appendChild(salir);
    cabecera.appendChild(salirWrap);
  }

  bloque.appendChild(cabecera);

  const jugadoresWrap = document.createElement("div");
  jugadoresWrap.style.cssText = "text-align:center; margin-top:10px;";
  const jugadoresTitulo = textoNodo("Jugadores:");
  jugadoresTitulo.style.fontWeight = "bold";
  const jugadoresGrid = document.createElement("div");
  jugadoresGrid.style.cssText = "display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; justify-items:center;";

  for (let i = 1; i <= 4; i++) {
    const slot = document.createElement("div");
    slot.className = "jugadorSlot";
    slot.id = "j" + i + "_" + id;
    jugadoresGrid.appendChild(slot);
  }

  jugadoresWrap.appendChild(jugadoresTitulo);
  jugadoresWrap.appendChild(jugadoresGrid);

  const reservasWrap = document.createElement("div");
  reservasWrap.style.cssText = "text-align:center; margin-top:10px;";
  const reservasTitulo = textoNodo("Reservas");
  reservasTitulo.style.fontWeight = "bold";
  const reservasGrid = document.createElement("div");
  reservasGrid.style.cssText = "display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; justify-items:center;";

  for (let i = 1; i <= 2; i++) {
    const slot = document.createElement("div");
    slot.className = "jugadorSlot";
    slot.id = "r" + i + "_" + id;
    reservasGrid.appendChild(slot);
  }

  reservasWrap.appendChild(reservasTitulo);
  reservasWrap.appendChild(reservasGrid);
  bloque.appendChild(jugadoresWrap);
  bloque.appendChild(reservasWrap);
  return bloque;
}

function cargarDatosPartidaRenderizada(item) {
  const id = item.id;
  const p = item.p;

  if (p.pistaId) {
    db.collection("pistas").doc(p.pistaId).get().then(function(docPista) {
      if (docPista.exists) {
        const pista = docPista.data();
        const texto = (pista.nombre || "") + " - " + (pista.localidad || "");
        const el = document.getElementById("pista_" + id);
        if (el) el.innerText = texto;
      }
    });
  }

  for (var i = 0; i < 4; i++) {
    pintarJugador(p.jugadores[i] || null, "j" + (i + 1) + "_" + id);
  }

  for (var r = 0; r < 2; r++) {
    pintarJugador(p.reservas[r] || null, "r" + (r + 1) + "_" + id);
  }

  if (p.creadaPor) {
    db.collection("usuarios").doc(p.creadaPor).get().then(function(docUser) {
      if (docUser.exists) {
        const u = docUser.data();
        const el = document.getElementById("creador_" + id);
        if (el) el.innerText = "Creador: " + (u.nombre || "Jugador");
      }
    });
  }
}

function cargarPartidas() {
  if (!window.modoPartidas) window.modoPartidas = "proximas";

  actualizarBotonesPartidas();
  cargarFiltroPistas();

  const contenedor = document.getElementById("listaPartidas");
  if (!contenedor) return;

  contenedor.replaceChildren(textoNodo("Cargando..."));

  db.collection("partidas").get()
  .then(function(snapshot) {
    if (snapshot.empty) {
      contenedor.replaceChildren(textoNodo("No hay partidas"));
      return;
    }

    const proximas = [];
    const pendientes = [];
    const ahoraGlobal = new Date();
    const filtros = window.filtrosPartidas || {};
    const tipoNivel = filtros.tipoNivel || "";
    const nivelDesde = filtros.nivelDesde || "";
    const nivelHasta = filtros.nivelHasta || "";
    const filtroFecha = filtros.fecha || "";
    const filtroTipo = (filtros.tipo || "").toLowerCase().trim();
    const filtroGenero = filtros.genero || "";
    const filtroPista = filtros.pista || "";

    snapshot.forEach(function(doc) {
      const p = doc.data() || {};

      if (filtroTipo && ((p.tipo || "ranking").toLowerCase().trim() !== filtroTipo)) return;
      if (filtroFecha && ((p.fecha || "") !== filtroFecha)) return;
      if (filtroGenero && ((p.genero || "").toLowerCase().trim() !== filtroGenero)) return;
      if (filtroPista && ((p.pistaId || p.pista || "") !== filtroPista)) return;

      let pasaNivel = true;
      let nivelPartidaDesde = "";
      let nivelPartidaHasta = "";

      if (p.nivel && typeof p.nivel === "object") {
        nivelPartidaDesde = p.nivel.desde || "";
        nivelPartidaHasta = p.nivel.hasta || "";
      }

      if (tipoNivel === "cualquiera") {
        pasaNivel = !p.nivel || p.nivel === "cualquiera";
      }

      if (tipoNivel === "rango") {
        const filtroDesdeNum = parseFloat(nivelDesde);
        const filtroHastaNum = parseFloat(nivelHasta);
        const partidaDesdeNum = parseFloat(nivelPartidaDesde);
        const partidaHastaNum = parseFloat(nivelPartidaHasta);

        pasaNivel = !isNaN(partidaDesdeNum) && !isNaN(partidaHastaNum);
        if (pasaNivel && !isNaN(filtroDesdeNum)) pasaNivel = filtroDesdeNum >= partidaDesdeNum;
        if (pasaNivel && !isNaN(filtroHastaNum)) pasaNivel = filtroHastaNum <= partidaHastaNum;
      }

      if (tipoNivel && !pasaNivel) return;

      let fechaPartida = null;

      if (p.fecha && p.hora) {
        const f = p.fecha.split("-");
        const h = p.hora.split(":");
        fechaPartida = new Date(
          parseInt(f[0]),
          parseInt(f[1]) - 1,
          parseInt(f[2]),
          parseInt(h[0]),
          parseInt(h[1])
        );
        console.log("[cargarPartidas] datos", {
          id: doc.id,
          fecha: p.fecha,
          hora: p.hora,
          fechaPartida,
          ahoraGlobal
        });
      }

      const ahora = new Date();

      if (p.estado === "cancelada") {
        eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
        return;
      }

      if (p.estado === "abierta" && fechaPartida && fechaPartida < ahora) {
        eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
        return;
      }

      if (p.estado === "finalizada") {
        const totalJugadores = (p.jugadores || []).length;
        const votos = p.votaciones || [];

        if (totalJugadores > 0 && votos.length >= totalJugadores) {
          eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
          return;
        }

        if (fechaPartida) {
          const limite = new Date(fechaPartida);
          limite.setDate(limite.getDate() + 3);

          if (ahora > limite) {
            eliminarPartidaConChat(doc.id).then(function(ok) { if (ok) cargarPartidas(); });
            return;
          }
        }
      }

      if (!fechaPartida) return;

      p.jugadores = p.jugadores || [];
      p.reservas = p.reservas || [];

      let fondo = "#ffffff";
      if (p.estado === "confirmada" || p.estado === "cerrada") fondo = "#e3f2fd";

      const nivelTexto =
        (p.nivel && p.nivel.desde && p.nivel.hasta)
          ? p.nivel.desde + " - " + p.nivel.hasta
          : "Cualquiera";

      const uid = firebase.auth().currentUser.uid;
      const mostrarSalir = p.jugadores.includes(uid) || p.reservas.includes(uid);
      const item = {
        id: doc.id,
        p: p,
        nodo: crearBloquePartida(doc.id, p, nivelTexto, mostrarSalir, fondo)
      };

      if (fechaPartida >= ahoraGlobal) {
        console.log("[cargarPartidas] PROXIMA", doc.id);
        proximas.push(item);
      } else {
        console.log("[cargarPartidas] PENDIENTE", doc.id);
        pendientes.push(item);
      }
    });

    let modo = window.modoPartidas;
    if (modo !== "pendientes" && modo !== "proximas") {
      modo = "proximas";
      window.modoPartidas = "proximas";
    }

    const seleccion = modo === "pendientes" ? pendientes : proximas;
    const fragment = document.createDocumentFragment();
    seleccion.forEach(function(item) {
      fragment.appendChild(item.nodo);
    });

    if (seleccion.length === 0) {
      contenedor.replaceChildren(textoNodo("No hay partidas"));
    } else {
      contenedor.replaceChildren(fragment);
      seleccion.forEach(cargarDatosPartidaRenderizada);
    }

    actualizarBotonesPartidas();
  })
  .catch(function(error) {
    console.error("Error cargando partidas:", error);
    contenedor.replaceChildren(textoNodo("Error cargando partidas"));
  });
}

function getCampoBusquedaPartida(id) {
  const seccionBusqueda = document.getElementById("buscarPartida");
  if (seccionBusqueda) {
    const campo = seccionBusqueda.querySelector("#" + id);
    if (campo) return campo;
  }

  return document.getElementById(id);
}

window.resetearBusquedaPartidas = function() {
  const ids = [
    "filtroFecha",
    "filtroTipo",
    "filtroGenero",
    "filtroNivelTipo",
    "filtroNivelDesde",
    "filtroNivelHasta",
    "filtroPista"
  ];

  ids.forEach(function(id) {
    const campo = getCampoBusquedaPartida(id);
    if (campo) {
      campo.value = "";
      if (campo.tagName === "SELECT") campo.selectedIndex = 0;
    }
  });

  const bloque = document.getElementById("bloqueNivelRango");
  if (bloque) bloque.style.display = "none";

  delete window.filtrosPartidas;
};

function cargarFiltroPistas() {
  const select = document.getElementById("filtroPista");
  if (!select) return;

  const primera = document.createElement("option");
  primera.value = "";
  primera.textContent = "Todas las pistas";
  select.replaceChildren(primera);

  db.collection("pistas").get().then(function(snapshot) {
    const fragment = document.createDocumentFragment();

    snapshot.forEach(function(doc) {
      const p = doc.data() || {};
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = (p.nombre || "Pista") + " - " + (p.localidad || "");
      fragment.appendChild(option);
    });

    select.appendChild(fragment);
  });
}

function aplicarFiltrosPartidas() {
  const tipoNivel = getCampoBusquedaPartida("filtroNivelTipo") ? getCampoBusquedaPartida("filtroNivelTipo").value : "";
  const desde = getCampoBusquedaPartida("filtroNivelDesde") ? getCampoBusquedaPartida("filtroNivelDesde").value : "";
  const hasta = getCampoBusquedaPartida("filtroNivelHasta") ? getCampoBusquedaPartida("filtroNivelHasta").value : "";

  if (tipoNivel === "rango") {
    const nDesde = parseFloat(desde);
    const nHasta = parseFloat(hasta);

    if (!isNaN(nDesde) && !isNaN(nHasta) && nDesde > nHasta) {
      alert("Nivel incorrecto");
      return;
    }
  }
 
  const filtroFecha = getCampoBusquedaPartida("filtroFecha").value;
  const elTipo = getCampoBusquedaPartida("filtroTipo");
  const filtroTipo = elTipo ? elTipo.value : "";
  const filtroGenero = getCampoBusquedaPartida("filtroGenero").value;
  const filtroPista = getCampoBusquedaPartida("filtroPista").value;

  window.vieneDeBusqueda = true; 
  window.filtrosPartidas = {
    fecha: filtroFecha || "",
    tipo: filtroTipo || "",
    genero: filtroGenero || "",
    pista: filtroPista || "",
    tipoNivel: tipoNivel || "",
    nivelDesde: desde || "",
    nivelHasta: hasta || ""
  };

  mostrar("partidas");
}

function cambiarFiltroNivel() {
  const tipo = getCampoBusquedaPartida("filtroNivelTipo").value;
  const bloque = document.getElementById("bloqueNivelRango");

  if (tipo === "rango") {
    bloque.style.display = "block";
  } else {
    bloque.style.display = "none";
  }
}

function limpiarFiltrosPartidas() {
  window.resetearBusquedaPartidas();
  cargarPartidas();
}

function verPista(id) {
  if (!id) return;

  localStorage.setItem("pistaSeleccionada", id);
  mostrar("pistas");
}

function unirseAPartida(slotId) {
  const user = firebase.auth().currentUser;
  console.log("[unirse] uid actual:", user ? user.uid : null);
  if (!user) return;

  const partidaId = slotId.split("_")[1];
  console.log("[unirse] slotId:", slotId);
  console.log("[unirse] partidaId:", partidaId);
  const esReserva = slotId.startsWith("r");
  const ref = db.collection("partidas").doc(partidaId);

  ref.get().then(function(doc) {
    if (!doc.exists) return;
    console.log("[unirse] documento encontrado:", doc.id);

    const p = doc.data();

    db.collection("usuarios").doc(user.uid).get().then(function(docUser) {
      if (!docUser.exists) return;

      const sexoUsuario = (docUser.data() || {}).sexo;
      const generoPartida = p.genero;

      console.log("VALIDACION GENERO");
      console.log("sexoUsuario=", sexoUsuario);
      console.log("generoPartida=", generoPartida);

      if (
        (generoPartida === "masculino" && sexoUsuario !== "hombre") ||
        (generoPartida === "femenino" && sexoUsuario !== "mujer")
      ) {
        console.log("BLOQUEADO POR GENERO");
        alert("No puedes unirte a esta partida por restricción de género");
        return;
      }

      let jugadores = p.jugadores || [];
      let reservas = p.reservas || [];
      console.log("[unirse] jugadores antes:", jugadores);
      console.log("[unirse] reservas antes:", reservas);

      if (jugadores.includes(user.uid) || reservas.includes(user.uid)) return;

      if (!esReserva) {
        if (jugadores.length < 4) jugadores.push(user.uid);
        else reservas.push(user.uid);
      } else {
        if (reservas.length < 2) reservas.push(user.uid);
      }

      ref.update({
        jugadores: jugadores,
        reservas: reservas
      }).then(function() {
        console.log("[unirse] UPDATE OK");
        cargarPartidas();
      });
    });
  });
}

function salirDePartida(partidaId) {
  const uid = firebase.auth().currentUser.uid;
  const ref = db.collection("partidas").doc(partidaId);

  ref.get().then(function(doc) {
    if (!doc.exists) return;

    const p = doc.data() || {};
    let jugadores = p.jugadores || [];
    let reservas = p.reservas || [];

    if (p.creadaPor === uid) {
      const ok = confirm("Se cancelara la partida para todos. Continuar?");
      if (!ok) return;

      eliminarPartidaConChat(partidaId).then(function(borrada) {
        if (borrada) cargarPartidas();
      });
      return;
    }

    if (jugadores.includes(uid)) {
      jugadores = jugadores.filter(function(j) { return j !== uid; });
      ref.update({ jugadores: jugadores }).then(function() {
        cargarPartidas();
      });
      return;
    }

    if (reservas.includes(uid)) {
      reservas = reservas.filter(function(r) { return r !== uid; });
      ref.update({ reservas: reservas }).then(function() {
        cargarPartidas();
      });
    }
  });
}

function guardarPartidaFinalizada(p, idPartida) {
  const datos = {
    fecha: p.fecha,
    hora: p.hora,
    jugadores: p.jugadores || [],
    resultado: p.resultado || null,
    valoraciones: p.valoraciones || [],
    creadaPor: p.creadaPor || null,
    timestamp: new Date()
  };

  db.collection("historial_partidas").doc(idPartida).set(datos);
}
