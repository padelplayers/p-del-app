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

function cargarPistasParaPartida() {

  auth.onAuthStateChanged((user) => {

    db.collection("pistas").get().then((snapshot) => {

      const select = document.getElementById("selectPista");
      if (!select) return;

      select.innerHTML = '<option value="">Selecciona pista</option>';

      snapshot.forEach((doc) => {

        const pista = doc.data();
        console.log("PISTA:", pista);

        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = pista.nombre + " - " + pista.localidad;

        if (user && pista.tipo === "Privada / Comunidad" && pista.creadaPor !== user.uid) {
          option.disabled = true;
          option.textContent += " (Solo propietario)";
        }

        select.appendChild(option);

      });

    });

  });

}