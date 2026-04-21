function crearPartida() {

  const div = document.getElementById("pistaSeleccionada");
const pistaId = div ? div.dataset.id : null;

if (!pistaId) {
  alert("Selecciona una pista");
  return;
}
const fecha = document.getElementById("fechaPartida")?.value;
const hora = document.getElementById("horaPartida")?.value;

if (!fecha || !hora) {
  alert("Completa todos los campos");
  return;
}
  return db.collection("partidas").add({
    pistaId: pistaId,
    jugadores: [],
    estado: "borrador",
    fecha: fecha,
    hora: hora,
  });

}

window.seleccionarPistaPartida = function(id, nombre) {
  const div = document.getElementById("pistaSeleccionada");
  if (div) {
    div.innerText = nombre;
    div.dataset.id = id;
  }

  window.modoSeleccionPista = false;
  mostrar("partidas");
};

