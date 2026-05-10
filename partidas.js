let modoPartidas = "proximas";

function actualizarBotonesPartidas() {
  const btnProx = document.getElementById("btnProximas");
  const btnPend = document.getElementById("btnPendientes");

  if (!btnProx || !btnPend) return;

  if (modoPartidas === "proximas") {
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
  modoPartidas = modo;
  actualizarBotonesPartidas();
  cargarPartidas();
}

function pintarJugador(uid, slotId) {
  const el = document.getElementById(slotId);
  if (!el) return;

  // ===== LIBRE =====
 if (!uid) {
  el.innerHTML =
    "<div onclick='unirseAPartida(\"" + slotId + "\")' style='display:flex; flex-direction:column; align-items:center; gap:4px; color:#999; cursor:pointer;'>" +

      "<div style='position:relative; width:40px; height:40px;'>" +

        "<img src='imagen/hombre.jpeg' style='width:40px; height:40px; border-radius:50%; object-fit:cover; opacity:0.3;'>" +

        "<div style='position:absolute; bottom:-2px; right:-2px; width:18px; height:18px; border-radius:50%; background:#1565C0; color:#fff; font-size:12px; display:flex; align-items:center; justify-content:center;'>+</div>" +

      "</div>" +

      "<span style='font-size:12px;'>Libre</span>" +

    "</div>";
  return;
}

  // ===== JUGADOR =====
  db.collection("usuarios").doc(uid).get().then(doc => {
    if (!doc.exists) return;

   const raw = doc.data() || {};

const u = {
    nombre: raw.nombre,
    nivel: raw.nivel,
    imagen: raw.fotoPerfil,
    genero: raw.sexo
};

let img = "imagen/hombre.jpeg";

if (u.imagen && u.imagen !== "") {
    img = u.imagen;
} else if (u.genero === "mujer") {
    img = "imagen/mujer.jpeg";
}

    el.innerHTML =
      "<div style='display:flex; flex-direction:column; align-items:center; gap:4px;'>" +

        "<div style='position:relative; width:40px; height:40px;'>" +
        "<img src='" + img + "' style='width:40px; height:40px; border-radius:50%; object-fit:cover;'>" +
        "</div>" +

        "<div style='font-size:12px; text-align:center; line-height:1.1; max-width:60px;'>" +
          "<div style='overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'>" +
            (u.nombre || "Jugador") +
          "</div>" +
          "<div style='color:#666;'>Nivel " + (u.nivel || "-") + "</div>" +
        "</div>" +

      "</div>";
  });
}

function crearPartida() {
  console.log("CLICK CREAR PARTIDA");

  const div = document.getElementById("pistaSeleccionada");
  const pistaId = div && div.dataset ? div.dataset.id : null;

  const fecha = document.getElementById("fechaPartida")?.value;
  const hora = document.getElementById("horaPartida")?.value;
  // VALIDAR HORA SI ES HOY

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

console.log("pistaId:", pistaId);
console.log("fecha:", fecha);
console.log("hora:", hora);
console.log("tipo:", tipo);
console.log("genero:", genero);

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
  const hoy = new Date().toISOString().split("T")[0];

  input.value = "";

  input.addEventListener("change", function () {
    if (this.value < hoy) {
      alert("No puedes seleccionar una fecha anterior a hoy");
      this.value = "";
    }
  });
}

function cargarPartidas() {

  if (!window.modoPartidas) {
  window.modoPartidas = "proximas";
}

  actualizarBotonesPartidas();
  cargarFiltroPistas();

  const contenedor = document.getElementById("listaPartidas");
  if (!contenedor) return;

  contenedor.innerHTML = "Cargando...";

  db.collection("partidas").get()
  .then(function(snapshot) {

    if (snapshot.empty) {
      contenedor.innerHTML = "No hay partidas";
      return;
    }

    let htmlProximas = "";
    let htmlPendientes = "";

    const ahoraGlobal = new Date();

    // FILTROS DESDE MEMORIA
    const filtros = window.filtrosPartidas || {};
    console.log("FILTROS COMPLETOS:", filtros);
    const tipoNivel = filtros.tipoNivel || "";
    const nivelDesde = filtros.nivelDesde || "";
    const nivelHasta = filtros.nivelHasta || "";

    const filtroFecha = filtros.fecha || "";
    const filtroTipo = (filtros.tipo || "").toLowerCase().trim();
    console.log("FILTRO TIPO:", filtroTipo);
    const filtroGenero = filtros.genero || "";
    const filtroPista = filtros.pista || "";

    snapshot.forEach(function(doc) {

      const p = doc.data() || {};

      console.log("TIPO PARTIDA:", p.reservas && p.reservas.tipo);

    if (
    filtroTipo &&
    (((p.reservas && p.reservas.tipo) || "").toLowerCase().trim() !== filtroTipo)
    ) return;

      // ===============================
      // FECHA
      // ===============================
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
      }

      const ahora = new Date();

      // ===============================
      // BORRADOS AUTOMÁTICOS
      // ===============================

      if (p.estado === "cancelada") {
        db.collection("partidas").doc(doc.id).delete();
        return;
      }

      if (p.estado === "abierta" && fechaPartida && fechaPartida < ahora) {
        db.collection("partidas").doc(doc.id).delete();
        return;
      }

      if (p.estado === "finalizada") {

        const totalJugadores = (p.jugadores || []).length;
        const votos = p.votaciones || [];

        if (totalJugadores > 0 && votos.length >= totalJugadores) {
          db.collection("partidas").doc(doc.id).delete();
          return;
        }

        if (fechaPartida) {
          const limite = new Date(fechaPartida);
          limite.setDate(limite.getDate() + 3);

          if (ahora > limite) {
            db.collection("partidas").doc(doc.id).delete();
            return;
          }
        }
      }

      if (!fechaPartida) return;

      const esFutura = fechaPartida >= ahoraGlobal;
      const esPasada = fechaPartida < ahoraGlobal;

      

      // ===============================
      // RENDER
      // ===============================

      p.jugadores = p.jugadores || [];
      p.reservas = p.reservas || [];

      let fondo = "#ffffff";

      if (p.estado === "confirmada" || p.estado === "cerrada") {
        fondo = "#e3f2fd";
      }

      const nivelTexto =
        (p.nivel && p.nivel.desde && p.nivel.hasta)
          ? p.nivel.desde + " - " + p.nivel.hasta
          : "Cualquiera";

      let mostrarSalir = false;

      if (
        (p.jugadores || []).includes(firebase.auth().currentUser.uid) ||
        (p.reservas || []).includes(firebase.auth().currentUser.uid)
      ) {
        mostrarSalir = true;
      }

      let bloque = `
<div style="border:1px solid #ccc; padding:10px; margin-bottom:10px; border-radius:10px; background:${fondo};">

  <div style="padding-top:8px;">

    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div style="font-size:13px; color:#666;">
        ${p.fecha || ""} - ${p.hora || ""}
      </div>

      <div style="cursor:pointer; display:flex; align-items:center; gap:6px; font-size:12px; background:#E3F2FD; padding:4px 8px; border-radius:12px;">
        <span>💬</span>
        <span>Chat partida</span>
      </div>
    </div>

    <div onclick="verPista('${p.pistaId}')" style="cursor:pointer; display:flex; align-items:center; gap:6px;">
      <span>📍</span>
      <span id="pista_${doc.id}" style="font-weight:500;">Cargando pista...</span>
    </div>

    <div style="display:flex; justify-content:space-between; font-size:13px; color:#666; margin-top:4px;">
      <div>
        ${p.tipo || "ranking"} - ${nivelTexto} - ${p.genero || ""}
      </div>

      <div id="creador_${doc.id}">
        Creador: -
      </div>
    </div>

    ${mostrarSalir ? `
    <div style="margin-top:6px; text-align:right;">
      <button onclick="salirDePartida('${doc.id}')" style="background:#e53935; color:white; border:none; padding:6px 10px; border-radius:6px;">
        Salir
      </button>
    </div>
    ` : ""}

  </div>

  <div style="text-align:center; margin-top:10px;">
    <div><b>Jugadores:</b></div>

    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; justify-items:center;">
      <div class="jugadorSlot" id="j1_${doc.id}"></div>
      <div class="jugadorSlot" id="j2_${doc.id}"></div>
      <div class="jugadorSlot" id="j3_${doc.id}"></div>
      <div class="jugadorSlot" id="j4_${doc.id}"></div>
    </div>
  </div>

  <div style="text-align:center; margin-top:10px;">
    <div><b>Reservas</b></div>

    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; justify-items:center;">
      <div class="jugadorSlot" id="r1_${doc.id}"></div>
      <div class="jugadorSlot" id="r2_${doc.id}"></div>
    </div>
  </div>

</div>
`;

      if (esFutura) {
        htmlProximas += bloque;
      } else {
        htmlPendientes += bloque;
      }

    });

    let modo = window.modoPartidas;

if (modo !== "pendientes" && modo !== "proximas") {
  modo = "proximas";
  window.modoPartidas = "proximas";
}

contenedor.innerHTML =
  (modo === "pendientes")
    ? htmlPendientes
    : htmlProximas;

    actualizarBotonesPartidas();

    snapshot.forEach(function(doc) {

      const p = doc.data() || {};

      p.jugadores = p.jugadores || [];
      p.reservas = p.reservas || [];

      if (p.pistaId) {
        db.collection("pistas").doc(p.pistaId).get().then(function(docPista) {
          if (docPista.exists) {
            const pista = docPista.data();
            const texto = (pista.nombre || "") + " - " + (pista.localidad || "");
            const el = document.getElementById("pista_" + doc.id);
            if (el) el.innerText = texto;
          }
        });
      }

      for (var i = 0; i < 4; i++) {
        pintarJugador(p.jugadores[i] || null, "j" + (i + 1) + "_" + doc.id);
      }

      for (var i = 0; i < 2; i++) {
        pintarJugador(p.reservas[i] || null, "r" + (i + 1) + "_" + doc.id);
      }

      if (p.creadaPor) {
        db.collection("usuarios").doc(p.creadaPor).get().then(function(docUser) {
          if (docUser.exists) {
            const u = docUser.data();
            const el = document.getElementById("creador_" + doc.id);
            if (el) {
              el.innerText = "Creador: " + (u.nombre || "Jugador");
            }
          }
        });
      }

    });

  })
  .catch(function(error) {
    console.error("Error cargando partidas:", error);
    contenedor.innerHTML = "Error cargando partidas";
  });
}

function cargarFiltroPistas() {
  const select = document.getElementById("filtroPista");
  if (!select) return;

  select.innerHTML = '<option value="">Todas las pistas</option>';

  db.collection("pistas").get().then(function(snapshot) {
    snapshot.forEach(function(doc) {
      const p = doc.data() || {};
      const nombre = (p.nombre || "Pista") + " - " + (p.localidad || "");
      select.innerHTML += '<option value="' + doc.id + '">' + nombre + '</option>';
    });
  });
}

function aplicarFiltrosPartidas() {

  const tipoNivel = document.getElementById("filtroNivelTipo") ? document.getElementById("filtroNivelTipo").value : "";
  const desde = document.getElementById("filtroNivelDesde") ? document.getElementById("filtroNivelDesde").value : "";
  const hasta = document.getElementById("filtroNivelHasta") ? document.getElementById("filtroNivelHasta").value : "";

  if (tipoNivel === "rango") {
    const nDesde = parseFloat(desde);
    const nHasta = parseFloat(hasta);

    if (!isNaN(nDesde) && !isNaN(nHasta) && nDesde > nHasta) {
      alert("Nivel incorrecto");
      return;
    }
  }
  const filtros = window.filtrosPartidas || {};
  const filtroFecha = document.getElementById("filtroFecha").value;
  const selectTipo = document.getElementById("filtroTipo");

let filtroTipo = "";

if (selectTipo && selectTipo.selectedIndex >= 0) {
  filtroTipo = selectTipo.options[selectTipo.selectedIndex].value;
}
  const tipoNormalizado = (filtroTipo || "").toLowerCase().trim();
  const filtroGenero = document.getElementById("filtroGenero").value;
  const filtroPista = document.getElementById("filtroPista").value;

  console.log("VALOR SELECT TIPO:", document.getElementById("filtroTipo").value);

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
  cargarPartidas();
}

function cambiarFiltroNivel() {
  const tipo = document.getElementById("filtroNivelTipo").value;
  const bloque = document.getElementById("bloqueNivelRango");

  if (tipo === "rango") {
    bloque.style.display = "block";
  } else {
    bloque.style.display = "none";
  }
}

function limpiarFiltrosPartidas() {

  const f1 = document.getElementById("filtroFecha");
  const f2 = document.getElementById("filtroTipo");
  const f3 = document.getElementById("filtroGenero");
  const f4 = document.getElementById("filtroNivelTipo");
  const f5 = document.getElementById("filtroNivelDesde");
  const f6 = document.getElementById("filtroNivelHasta");
  const f7 = document.getElementById("filtroPista");

  if (f1) f1.value = "";
  if (f2) f2.value = "";
  if (f3) f3.value = "";
  if (f4) f4.value = "";
  if (f5) f5.value = "";
  if (f6) f6.value = "";
  if (f7) f7.value = "";

  const bloque = document.getElementById("bloqueNivelRango");
  if (bloque) bloque.style.display = "none";

  window.filtrosPartidas = null;

  cargarPartidas();
}

function verPista(id) {
  if (!id) return;

  localStorage.setItem("pistaSeleccionada", id);
  mostrar("pistas");
}

function unirseAPartida(slotId) {

  const user = firebase.auth().currentUser;
  if (!user) return;

  const partidaId = slotId.split("_")[1];
  const esReserva = slotId.startsWith("r");

  const ref = db.collection("partidas").doc(partidaId);

  ref.get().then(function(doc) {

    if (!doc.exists) return;

    const p = doc.data();

    let jugadores = p.jugadores || [];
    let reservas = p.reservas || [];

    if (jugadores.includes(user.uid) || reservas.includes(user.uid)) return;

    if (!esReserva) {
      if (jugadores.length < 4) {
        jugadores.push(user.uid);
      } else {
        reservas.push(user.uid);
      }
    } else {
      if (reservas.length < 2) {
        reservas.push(user.uid);
      }
    }

    ref.update({
      jugadores: jugadores,
      reservas: reservas
    }).then(function() {
      cargarPartidas();
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

      const ok = confirm("Se cancelará la partida para todos. ¿Continuar?");
      if (!ok) return;

      ref.delete().then(function() {
        cargarPartidas();
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

      return;
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