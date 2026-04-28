function pintarJugador(uid, slotId) {
  const el = document.getElementById(slotId);
  if (!el) return;

  // ===== LIBRE =====
  if (!uid) {
    el.innerHTML =
      "<div style='display:flex; flex-direction:column; align-items:center; gap:4px; color:#999;'>" +

        "<div style='position:relative; width:40px; height:40px;'>" +

          "<img src='imagen/hombre.jpeg' style='width:40px; height:40px; border-radius:50%; object-fit:cover; display:block; opacity:0.3;'>" +

          "<div style='position:absolute; bottom:-2px; right:-2px; width:18px; height:18px; border-radius:50%; background:#1565C0; color:#fff; font-size:12px; display:flex; align-items:center; justify-content:center;'>+</div>" +

        "</div>" +

        "<span style='font-size:12px;'>Libre</span>" +

      "</div>";
    return;
  }

  // ===== JUGADOR =====
  db.collection("usuarios").doc(uid).get().then(doc => {
    if (!doc.exists) return;

    const u = doc.data();

    el.innerHTML =
      "<div style='display:flex; flex-direction:column; align-items:center; gap:4px;'>" +

        "<div style='position:relative; width:40px; height:40px;'>" +
          "<img src='" + (u.foto || "imagen/hombre.jpeg") + "' style='width:40px; height:40px; border-radius:50%; object-fit:cover; display:block;'>" +
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

    snapshot.forEach(function(doc) {

      const p = doc.data() || {};

      p.jugadores = p.jugadores || [];
      p.reservas = p.reservas || [];

      let fondo = "#ffffff";

      if (p.estado === "confirmada" || p.estado === "cerrada") {
        fondo = "#e3f2fd";
      }

      if (p.estado === "finalizada" || p.estado === "cancelada") {
        fondo = "#fdecea";
      }

      const nivelTexto =
        (p.nivel && p.nivel.desde && p.nivel.hasta)
          ? `${p.nivel.desde} - ${p.nivel.hasta}`
          : "Cualquiera";

      html += `
<div style="border:1px solid #ccc; padding:10px; margin-bottom:10px; border-radius:10px; background:${fondo};">

  <!-- ===================== -->
  <!-- CABECERA -->
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

  <div style="text-align:center; font-weight:500; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
    📍 ${p.nombrePista || "Pista"}
  </div>

  <div style="display:flex; justify-content:space-between; font-size:13px; color:#666; margin-top:4px;">
    <div>
      ${p.tipo || "ranking"} - ${nivelTexto || "Cualquiera"} - ${p.genero || ""}
    </div>

    <div id="creador_${doc.id}">
      Creador: -
    </div>
  </div>

</div>

  <!-- ===================== -->
  <!-- JUGADORES -->
  <!-- ===================== -->
  <div style="text-align:center; margin-top:10px;">
    <div><b>Jugadores:</b></div>

    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; justify-items:center;">
      <div class="jugadorSlot" id="j1_${doc.id}"></div>
      <div class="jugadorSlot" id="j2_${doc.id}"></div>
      <div class="jugadorSlot" id="j3_${doc.id}"></div>
      <div class="jugadorSlot" id="j4_${doc.id}"></div>
    </div>
  </div>

  <!-- ===================== -->
  <!-- RESERVAS -->
  <!-- ===================== -->
  <div style="text-align:center; margin-top:10px;">
    <div><b>Reservas</b></div>

    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; justify-items:center;">
      <div class="jugadorSlot" id="r1_${doc.id}"></div>
      <div class="jugadorSlot" id="r2_${doc.id}"></div>
    </div>
  </div>

</div>
`;
    });

    contenedor.innerHTML = html;

    snapshot.forEach(function(doc) {

      const p = doc.data() || {};
      p.jugadores = p.jugadores || [];
      p.reservas = p.reservas || [];

      if (p.pistaId) {
        db.collection("pistas").doc(p.pistaId).get().then(function(docPista) {
          if (docPista.exists) {
            const pista = docPista.data();
            const texto = `${pista.nombre || ""} - ${pista.localidad || ""}`;
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
    });

  })
  .catch(function(error) {
    console.error("Error cargando partidas:", error);
    contenedor.innerHTML = "Error cargando partidas";
  });
}

function verPista(id) {
  if (!id) return;

  localStorage.setItem("pistaSeleccionada", id);
  mostrar("pistas");
}   

