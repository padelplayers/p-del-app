function crearPartida() {

  const div = document.getElementById("pistaSeleccionada");
  const pistaId = div && div.dataset ? div.dataset.id : null;

  const fecha = document.getElementById("fechaPartida")?.value;
  const hora = document.getElementById("horaPartida")?.value;
  const tipo = document.getElementById("tipoPartida")?.value;
  const genero = document.getElementById("generoPartida")?.value;

  if (!pistaId) {
    alert("Selecciona una pista");
    return;
  }

 if (!fecha || !hora || !tipo || !genero || tipo === "" || genero === "") {
    alert("Completa todos los campos");
    return;
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

  input.value = hoy;

  input.addEventListener("change", function () {
    if (this.value < hoy) {
      this.value = hoy;
    }
  });
}

function cargarPartidas() {
  const contenedor = document.getElementById("listaPartidas");
  if (!contenedor) return;

  contenedor.innerHTML = "Cargando...";

  db.collection("partidas").get()
  .then(snapshot => {
    if (snapshot.empty) {
      contenedor.innerHTML = "No hay partidas";
      return;
    }

    let html = "";

    snapshot.forEach(doc => {
      const p = doc.data();

      html += 
        "<div style='border:1px solid #ccc; padding:10px; margin-bottom:10px; border-radius:8px;'>" +

          "<b>" + (p.tipo || "") + "</b><br>" +
          (p.fecha || "") + " - " + (p.hora || "") + "<br><br>" +

          "<div><b>Jugadores:</b></div>" +
          (p.jugadores && p.jugadores[0] ? p.jugadores[0] : "-") + "<br>" +
          (p.jugadores && p.jugadores[1] ? p.jugadores[1] : "-") + "<br>" +
          (p.jugadores && p.jugadores[2] ? p.jugadores[2] : "-") + "<br>" +
          (p.jugadores && p.jugadores[3] ? p.jugadores[3] : "-") + "<br><br>" +

          "<div><b>Reservas:</b></div>" +
          (p.reservas && p.reservas[0] ? p.reservas[0] : "-") + "<br>" +
          (p.reservas && p.reservas[1] ? p.reservas[1] : "-") + "<br><br>" +

          "<button class='btnBlue'>Unirse</button>" +

        "</div>";
    });

    contenedor.innerHTML = html;
  });
}