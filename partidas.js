function crearPartida() {

  const select = document.getElementById("selectPista");
  const pistaId = select.value;

  if (!pistaId) {
    alert("Selecciona una pista");
    return;
  }

  return db.collection("partidas").add({
    pistaId: pistaId,
    jugadores: [],
    estado: "borrador",
    fecha: new Date()
  });

}
