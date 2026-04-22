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

  if (!fecha || !hora || !tipo || !genero) {
    alert("Completa todos los campos");
    return;
  }

  console.log("pistaId:", pistaId);
console.log("fecha:", fecha);
console.log("hora:", hora);
console.log("tipo:", tipo);
console.log("genero:", genero);

  return db.collection("partidas").add({
    pistaId: pistaId,
    fecha: fecha,
    hora: hora,
    tipo: tipo,
    genero: genero,
    jugadores: auth.currentUser ? [auth.currentUser.uid] : [],
    creadorId: auth.currentUser ? auth.currentUser.uid : null,
    estado: "abierta"
  }).then(() => {
    document.getElementById("pistaSeleccionada").innerText = "Ninguna pista seleccionada";
    document.getElementById("pistaSeleccionada").dataset.id = "";
    mostrar("partidas");
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

