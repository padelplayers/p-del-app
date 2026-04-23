function pintarJugador(uid, slotId) {
  if (!uid) {
    document.getElementById(slotId).innerText = "Libre";
    return;
  }

  db.collection("usuarios").doc(uid).get().then(doc => {
    if (!doc.exists) {
      document.getElementById(slotId).innerText = "Jugador";
      return;
    }

    const u = doc.data();

    const html =
      "<div style='display:flex; align-items:center; gap:6px;'>" +
        "<img src='" + (u.foto || "imagen/hombre.jpeg") + "' style='width:28px;height:28px;border-radius:50%;'>" +
        "<span>" + (u.nombre || "Jugador") + "</span>" +
      "</div>";

    document.getElementById(slotId).innerHTML = html;
  });
}

function crearPartida() {
  console.log("CLICK CREAR PARTIDA");

  const div = document.getElementById("pistaSeleccionada");
  const pistaId = div && div.dataset ? div.dataset.id : null;

  const fecha = document.getElementById("fechaPartida")?.value;
  const hora = document.getElementById("horaPartida")?.value;
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

  db.collection("partidas").add({
  pistaId: pistaId,

  fecha: fecha,
  hora: hora,
  tipo: tipo,
  genero: genero,
  nivel: nivelTipo === "cualquiera" ? "cualquiera" : {
  desde: nivelDesde,
  hasta: nivelHasta
},

  jugadores: [auth.currentUser.uid],
  reservas: [],

  estado: "abierta",
  creadaPor: auth.currentUser.uid,
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
  const contenedor = document.getElementById("listaPartidas");
  if (!contenedor) return;

  contenedor.innerHTML = "Cargando...";

  db.collection("partidas").get()
  .then(function(snapshot) {

    if (snapshot.empty) {
      contenedor.innerHTML = "No hay partidas";
      return;
    }

    let html = "";

    // 1. SOLO construir HTML
    snapshot.forEach(function(doc) {

      const p = doc.data() || {};

      let pistaTexto = "Cargando pista...";

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

      html +=

      "<div style='border:1px solid #ccc; padding:10px; margin-bottom:10px; border-radius:10px;'>" +

      "<div style='font-size:18px; font-weight:bold;'>" + (p.tipo || "") + "</div>" +

      "<div style='color:gray; margin-bottom:10px;'>" +
      (p.fecha || "") + " - " + (p.hora || "") +
      "</div>" +

      "<div id='pista_" + doc.id + "'><b>Pista:</b> " + pistaTexto + "</div>" +

      "<div><b>Estado:</b> " + (p.estado || "") + "</div>" +

      "<div><b>Creador:</b> " + (p.creadorNombre || "Jugador") + "</div>" +

      "<div><b>Nivel:</b> " +
      (p.nivelTipo === "rango"
        ? (p.nivelDesde + " - " + p.nivelHasta)
        : "Cualquiera") +
      "</div>" +

      "<div><b>Género:</b> " + (p.genero || "") + "</div>" +

      "<br>" +

      "<div><b>Jugadores:</b></div>" +

      "<div style='display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;'>" +

      "<div class='jugadorSlot' id='j1_" + doc.id + "'>...</div>" +
      "<div class='jugadorSlot' id='j2_" + doc.id + "'>...</div>" +
      "<div class='jugadorSlot' id='j3_" + doc.id + "'>...</div>" +
      "<div class='jugadorSlot' id='j4_" + doc.id + "'>...</div>" +

      "</div>" +

      "<div style='margin-top:5px;'><b>Reservas</b></div>" +

      "<div style='display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;'>" +

      "<div class='jugadorSlot' id='r1_" + doc.id + "'>...</div>" +
      "<div class='jugadorSlot' id='r2_" + doc.id + "'>...</div>" +

      "</div>" +

      "<button class='btnBlue'>Unirse</button>" +

      "</div>";
    });

    // 2. Pintar HTML en DOM
    contenedor.innerHTML = html;

    // 3. AHORA sí pintar jugadores (DOM ya existe)
    snapshot.forEach(function(doc) {

      const p = doc.data() || {};
      p.jugadores = p.jugadores || [];
      p.reservas = p.reservas || [];

      for (var i = 0; i < 4; i++) {
        pintarJugador(p.jugadores[i] || null, "j" + (i + 1) + "_" + doc.id);
      }

      for (var i = 0; i < 2; i++) {
        pintarJugador(p.reservas[i] || null, "r" + (i + 1) + "_" + doc.id);
      }
    });

  })
  .catch(function(error) {
    console.error("Error cargando partidas:", error);
    contenedor.innerHTML = "Error cargando partidas";
  });
}